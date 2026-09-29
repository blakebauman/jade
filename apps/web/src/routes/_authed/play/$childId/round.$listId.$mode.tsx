import { SPELLING_MODES, splitSyllables } from "@jade/core";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips, Tile } from "@jade/ui/components/tile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Delete, Landmark, MessageSquareQuote, Snail, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AnswerRow, RevealRow } from "#/components/round/AnswerRow.tsx";
import { buildBank, TileBank } from "#/components/round/TileBank.tsx";
import type { WordInfo } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { describeMiss, firstFlagged } from "#/lib/feedback.ts";
import { dayKey, prefersReducedMotion, useVisualViewport } from "#/lib/hooks.ts";
import { finishSession, saveAttempts, startSession } from "#/lib/offline.ts";
import { listQuery, progressQuery, roundProgress, wordQuery } from "#/lib/queries.ts";
import { type RoundWord, useRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/round/$listId/$mode")({
	params: {
		parse: (p) => ({ ...p, mode: z.enum(SPELLING_MODES).parse(p.mode) }),
		stringify: (p) => p,
	},
	/**
	 * `only` = comma-separated subset (from "Practice these now" on the results screen).
	 * `resume` = continue the interrupted round kept on this device instead of starting a new one.
	 */
	validateSearch: z.object({ only: z.string().max(4000).optional(), resume: z.boolean().optional() }),
	loaderDeps: ({ search }) => ({ only: search.only }),
	loader: async ({ context, params, deps }) => {
		const only = deps.only ? new Set(deps.only.split(",")) : null;
		if (params.listId === "review") {
			if (only) return { words: [...only].map((word) => ({ word })) as RoundWord[], name: "Practice" };
			const progress = await roundProgress(context.queryClient, params.childId);
			return { words: progress.reviewDue.map((word) => ({ word })) as RoundWord[], name: "Review" };
		}
		const list = await context.queryClient.ensureQueryData(listQuery(params.listId));
		const words = (list.words as RoundWord[]).filter((w) => !only || only.has(w.word));
		return { words, name: only ? `${list.name} · practice` : list.name };
	},
	component: RoundScreen,
});

const MODE_TITLE: Record<(typeof SPELLING_MODES)[number], string> = { bee: "Bee", tiles: "Tiles", learn: "Learn", review: "Review" };

function RoundScreen() {
	const { listId, mode } = Route.useParams();
	const { words: listWords, name: listName } = Route.useLoaderData();
	const { resume } = Route.useSearch();
	const child = useChild();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { keyboard } = useVisualViewport();
	const reduced = useMemo(prefersReducedMotion, []);

	const s = useRound();
	const inputRef = useRef<HTMLInputElement>(null);
	const [checkNonce, setCheckNonce] = useState(0);
	const [revealShown, setRevealShown] = useState(0);
	const [spoken, setSpoken] = useState<{ label: string; text: string } | null>(null);
	const [used, setUsed] = useState<number[]>([]);
	const [saving, setSaving] = useState(false);

	// Start a fresh round once per mount (or pick up the interrupted one). Words are shuffled so the order can't be memorized.
	useEffect(() => {
		const r = useRound.getState();
		const roundListId = listId === "review" ? null : listId;
		if (resume && !r.finished && r.childId === child.id && r.listId === roundListId && r.mode === mode && r.words.length > 0) {
			r.resume();
		} else {
			const shuffled = [...listWords].sort(() => Math.random() - 0.5);
			r.start({ childId: child.id, listId: roundListId, mode, name: listName, words: shuffled });
		}
		return () => speaker.stop();
	}, [child.id, listId, mode, listWords, listName, resume]);
	const name = s.name || listName;

	const current = s.words[s.index];
	const word = current?.word ?? "";
	const { data: info } = useQuery({ ...wordQuery(word), enabled: !!word });
	const { data: progress } = useQuery(progressQuery(child.id));
	const box = progress?.boxes[word] ?? 0;
	const nextWord = s.words[s.index + 1]?.word;

	// Prefetch the next word's audio and info so moving on feels instant (and works if the network drops).
	useEffect(() => {
		if (!nextWord) return;
		speaker.prefetch(nextWord);
		void qc.prefetchQuery(wordQuery(nextWord));
	}, [nextWord, qc]);

	const sentence = current?.sentence ?? info?.sentence ?? null;
	const definition = current?.definition ?? info?.definition ?? null;
	const bank = useMemo(
		() => (mode === "tiles" && word ? buildBank(word, (s.index + 1) / (s.words.length + 1)) : []),
		[mode, word, s.index, s.words.length],
	);

	const focusInput = useCallback(() => {
		// Don't pop the iPad keyboard in Tiles mode; the bank is the input there.
		if (mode !== "tiles") inputRef.current?.focus({ preventScroll: true });
	}, [mode]);

	const sayWord = useCallback(
		(slow = false) => {
			if (!word) return;
			if (slow || s.phase !== "ready") useRound.getState().replay();
			void speaker.say(word, { slow });
		},
		[word, s.phase],
	);

	const ask = (label: string, text: string | null, kind: "sentence" | "definition") => {
		if (!text) return;
		setSpoken({ label, text });
		void speaker.say(text, { kind });
	};

	// New word: clear local UI state and say it.
	useEffect(() => {
		setSpoken(null);
		setUsed([]);
		setRevealShown(0);
		if (s.phase === "spelling" || s.phase === "study") {
			void speaker.say(word);
			focusInput();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only on word change
	}, [s.index]);

	function begin() {
		speaker.unlock();
		const r = useRound.getState();
		if (!r.serverStarted) {
			useRound.setState({ serverStarted: true });
			void startSession({ id: r.sessionId, childId: r.childId, listId: r.listId, mode: r.mode, startedAt: r.startedAt });
		}
		r.begin();
		void speaker.say(word);
		focusInput();
	}

	function check() {
		const grade = useRound.getState().check();
		if (!grade) return;
		setCheckNonce((n) => n + 1);
		const { phase, attempts, sessionId } = useRound.getState();
		// Save each word the moment it's done, so stopping (or a flat battery) never loses progress.
		if (phase === "correct" || phase === "reveal") {
			const last = attempts.at(-1);
			if (last)
				void saveAttempts(sessionId, [last], dayKey()).then((res) => {
					if (res?.newBadges.length) useRound.setState((st) => ({ newBadges: [...st.newBadges, ...res.newBadges] }));
				});
		}
		if (phase === "correct")
			void speaker.say(["Yes!", "Nice!", "Correct!", "You got it!"][Math.floor(Math.random() * 4)]!, { kind: "sentence" });
		if (phase === "retry") focusInput();
		if (phase === "reveal") {
			if (reduced) setRevealShown(word.length);
			void speaker.spell(word, (i) => setRevealShown(i + 1)).then(() => setRevealShown(word.length));
		}
	}

	async function advance() {
		if (useRound.getState().next() === "next") return;
		await closeRound();
	}

	/** Finish the round (or stop early): results cover the words answered so far. */
	async function closeRound() {
		const r = useRound.getState();
		setSaving(true);
		let summary = null;
		try {
			summary = await finishSession(r.sessionId, { attempts: r.attempts, finishedAt: Date.now(), day: dayKey() });
		} catch {}
		r.finishRound({
			sessionId: r.sessionId,
			childId: r.childId,
			listId: r.listId,
			mode: r.mode,
			attempts: r.attempts,
			planned: r.words.length,
			summary,
			newBadges: [...r.newBadges, ...(summary?.newBadges ?? [])],
			queued: summary === null,
			firstTries: r.firstTries,
		});
		void qc.invalidateQueries({ queryKey: ["progress", child.id] });
		navigate({ to: "/play/$childId/results", params: { childId: child.id }, replace: true });
	}

	function onKeyDown(e: globalThis.KeyboardEvent) {
		// Enter on a focused button already clicks it; handling it here too would check twice.
		const t = e.target as HTMLElement | null;
		if (e.key === "Enter" && t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
		if (e.key === "ArrowUp") {
			e.preventDefault();
			sayWord();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			sayWord(true);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (s.phase === "ready") begin();
			else if (s.phase === "spelling" || s.phase === "retry") check();
			else if (s.phase === "correct" || (s.phase === "reveal" && revealShown >= word.length)) void advance();
			else if (s.phase === "study") coverWord();
		}
	}

	const keyHandler = useRef(onKeyDown);
	keyHandler.current = onKeyDown;
	useEffect(() => {
		const h = (e: globalThis.KeyboardEvent) => keyHandler.current(e);
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, []);

	function coverWord() {
		useRound.getState().cover();
		focusInput();
	}

	// Tiles mode: bank picks drive the typed string; physical keys pick matching tiles.
	function pick(i: number) {
		const nextUsed = [...used, i];
		setUsed(nextUsed);
		useRound.getState().setTyped(nextUsed.map((j) => bank[j]).join(""));
	}
	function unpickAt(pos: number) {
		if (mode !== "tiles" || (s.phase !== "spelling" && s.phase !== "retry")) return;
		const nextUsed = used.filter((_, k) => k !== pos);
		setUsed(nextUsed);
		useRound.getState().setTyped(nextUsed.map((j) => bank[j]).join(""));
	}
	useEffect(() => {
		if (mode !== "tiles") return;
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const st = useRound.getState();
			if (st.phase !== "spelling" && st.phase !== "retry") return;
			if (e.key === "Backspace") {
				e.preventDefault();
				setUsed((u) => {
					const n = u.slice(0, -1);
					st.setTyped(n.map((j) => bank[j]).join(""));
					return n;
				});
			} else if (/^[a-z'-]$/i.test(e.key)) {
				setUsed((u) => {
					const i = bank.findIndex((c, k) => c === e.key.toLowerCase() && !u.includes(k));
					if (i < 0) return u;
					const n = [...u, i];
					st.setTyped(n.map((j) => bank[j]).join(""));
					return n;
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mode, bank]);

	if (listWords.length === 0) {
		return (
			<main className="grid min-h-dvh place-items-center p-6 text-center">
				<div className="space-y-5">
					<h1 className="text-3xl font-semibold">{listId === "review" ? "Nothing to review today" : "This list has no words yet"}</h1>
					<Link to="/play/$childId/spelling" params={{ childId: child.id }} className="key" data-variant="go">
						Back
					</Link>
				</div>
			</main>
		);
	}

	const judged = s.phase === "correct" || s.phase === "reveal" || s.phase === "retry";
	const notes = s.grade && !s.grade.correct ? describeMiss(s.grade, s.phase === "reveal") : [];
	const canType = s.phase === "spelling" || s.phase === "retry";
	const sayIt = keyboard ? 56 : 120;

	return (
		<main
			// With the iPad keyboard up, pin the screen to exactly the visible area above it. Safari scrolls the page to
			// reveal the focused field; a fixed box at the visual viewport's offset can't be slid under the keyboard.
			className={`mx-auto flex max-w-5xl flex-col px-4 md:px-8 ${keyboard ? "fixed inset-x-0 z-10 overflow-y-auto overscroll-contain" : ""}`}
			style={keyboard ? { top: "var(--vvtop, 0px)", height: "var(--vvh)" } : { minHeight: "var(--vvh, 100dvh)" }}
			data-keyboard={keyboard || undefined}
		>
			{/* Top rail */}
			<header className={`flex items-center gap-3 md:gap-4 ${keyboard ? "py-2" : "py-4"}`}>
				<Link
					to="/play/$childId/spelling"
					params={{ childId: child.id }}
					className="key size-11 !p-0"
					aria-label="Leave round"
					onClick={(e) => {
						// Answers are already saved; stopping just closes the round and shows results for what was done.
						if (s.attempts.length === 0) return;
						e.preventDefault();
						const n = s.attempts.length;
						if (confirm(`Stop here? Your ${n} ${n === 1 ? "answer is" : "answers are"} saved.`)) void closeRound();
					}}
				>
					<X className="size-5" aria-hidden />
				</Link>
				{!keyboard && <KidTile name={child.name} avatar={child.avatar} size={40} />}
				<div className="min-w-0 flex-1">
					{!keyboard && (
						<p className="truncate text-sm text-felt-muted">
							{MODE_TITLE[mode]} · {name}
						</p>
					)}
					<ol className="mt-1.5 flex flex-wrap gap-1" aria-label={`Word ${s.index + 1} of ${s.words.length}`}>
						{s.words.map((w, i) => {
							const a = s.attempts[i];
							// Tiny tiles: marigold edge = right first time; anything else stays plain maple (coral means a wrong letter,
							// not a missed word). Upcoming words are dimmed; the current word is lifted.
							const law = a?.correct && a.tries === 1 ? ("right" as const) : undefined;
							return (
								<li key={`${w.word}-${i}`} className={i === s.index ? "-translate-y-0.5" : a ? "" : "opacity-45"}>
									<Tile size={14} law={law} grain={i % 4} aria-hidden />
								</li>
							);
						})}
					</ol>
				</div>
				<p className="font-display text-lg font-medium tabular-nums" aria-live="polite">
					{Math.min(s.index + 1, s.words.length)}
					<span className="text-felt-muted">/{s.words.length}</span>
				</p>
			</header>

			{s.phase === "ready" ? (
				<section className="grid flex-1 place-items-center">
					<div className="flex flex-col items-center gap-8 text-center">
						<h1 className="text-4xl font-semibold md:text-5xl">{s.words.length} words. Ready?</h1>
						<p className="max-w-[40ch] text-felt-muted">
							{mode === "learn"
								? "Look at each word, hear it, then cover it and spell it."
								: mode === "tiles"
									? "Listen, then tap the tiles in order."
									: "Listen, ask for the definition or a sentence, then spell it."}
						</p>
						<button type="button" className="key !min-h-16 !px-10 !text-2xl" data-variant="go" onClick={begin}>
							<Volume2 className="size-7" aria-hidden /> Start
						</button>
						<p className="hidden text-sm text-felt-muted md:block">
							Keys: <kbd className="rounded bg-felt-deep px-1.5">↑</kbd> say again · <kbd className="rounded bg-felt-deep px-1.5">↓</kbd>{" "}
							slowly · <kbd className="rounded bg-felt-deep px-1.5">Enter</kbd> check
						</p>
					</div>
				</section>
			) : (
				<section
					className={`flex flex-1 flex-col items-center ${keyboard ? "justify-start gap-4 pt-1 pb-3" : "justify-center gap-7 pb-8"}`}
				>
					{/* Say it + bee questions; one compact row while the keyboard is up. */}
					<div className={`flex items-center ${keyboard ? "flex-row flex-wrap justify-center gap-2" : "flex-col gap-5"}`}>
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={() => sayWord()}
								className="tile !rounded-full transition-transform active:translate-y-0.5"
								style={{ width: sayIt, height: sayIt }}
								aria-label="Say the word again"
							>
								<Volume2 style={{ width: sayIt * 0.42, height: sayIt * 0.42 }} aria-hidden strokeWidth={2.2} />
							</button>
							<button type="button" className="key" data-variant="tile" onClick={() => sayWord(true)} aria-label="Say it slowly">
								<Snail className="size-5" aria-hidden /> {!keyboard && "Slowly"}
							</button>
						</div>
						{s.phase !== "study" && (
							<fieldset className={`rack m-0 flex min-w-0 flex-wrap justify-center gap-2 border-0 ${keyboard ? "!py-1.5 !px-2" : ""}`}>
								<legend className="sr-only">Ask about the word</legend>
								<button
									type="button"
									className="key"
									data-variant="tile"
									disabled={!definition}
									onClick={() => ask("Definition", definition, "definition")}
								>
									<BookOpen className="size-4" aria-hidden /> Definition
								</button>
								<button
									type="button"
									className="key"
									data-variant="tile"
									disabled={!sentence}
									onClick={() => ask("Sentence", sentence, "sentence")}
								>
									<MessageSquareQuote className="size-4" aria-hidden /> Sentence
								</button>
								{/* Many everyday words have no recorded origin; the question only appears when there's an answer. */}
								{info?.origin && (
									<button type="button" className="key" data-variant="tile" onClick={() => ask("Origin", info.origin, "definition")}>
										<Landmark className="size-4" aria-hidden /> Origin
									</button>
								)}
							</fieldset>
						)}
						{spoken && !keyboard && (
							<p className="plaque max-w-[60ch] !block px-4 py-2.5 text-center" aria-live="polite">
								<span className="mr-2 font-display font-semibold">{spoken.label}:</span>
								{maskWord(spoken.text, word)}
							</p>
						)}
					</div>

					{s.phase === "study" ? (
						<StudyCard word={word} info={info} definition={definition} sentence={sentence} onCover={coverWord} />
					) : (
						<>
							<AnswerRow
								typed={s.typed}
								target={word}
								phase={s.phase}
								grade={s.grade}
								showLength={child.settings.showLength || mode === "learn"}
								checkNonce={checkNonce}
								onTileClick={mode === "tiles" ? unpickAt : undefined}
								note={
									s.grade && notes.length > 0 && (s.phase === "retry" || s.phase === "reveal") && s.typed === s.grade.typed
										? { index: firstFlagged(s.grade), text: notes[0]! }
										: null
								}
								trailing={
									canType ? (
										<button
											key="check"
											type="button"
											className="key !min-h-14 shrink-0 !px-5 !text-xl md:!px-7"
											data-variant="check"
											disabled={s.typed.length === 0}
											onClick={check}
										>
											<Check className="size-6" aria-hidden /> <span className={keyboard ? "sr-only" : "max-sm:sr-only"}>Check</span>
										</button>
									) : (
										<button
											key="next"
											type="button"
											className="key !min-h-14 shrink-0 !px-5 !text-xl !transition-none md:!px-7"
											data-variant="go"
											// While the reveal spells out, Next waits; while saving it stays solid and just ignores taps.
											disabled={s.phase === "reveal" && revealShown < word.length}
											aria-disabled={saving}
											onClick={() => !saving && void advance()}
										>
											<span className="max-sm:sr-only">
												{s.index + 1 >= s.words.length ? (saving ? "Saving…" : "Finish") : "Next word"}
											</span>
											<ArrowRight className="size-6" aria-hidden />
										</button>
									)
								}
								overlay={
									mode !== "tiles" && (
										<input
											ref={inputRef}
											value={s.typed}
											onChange={(e) => s.setTyped(e.target.value)}
											disabled={!canType}
											aria-label="Type the spelling"
											className="absolute inset-0 h-full w-full cursor-text opacity-0"
											style={{ caretColor: "transparent", fontSize: 16 }}
											autoComplete="off"
											autoCorrect="off"
											autoCapitalize="none"
											spellCheck={false}
											inputMode="text"
											enterKeyHint="done"
											maxLength={40}
										/>
									)
								}
							/>

							<div
								className={`flex min-h-7 flex-col items-center gap-2 text-center ${notes.length > 0 && judged ? "mt-12" : ""}`}
								aria-live="assertive"
							>
								{s.phase === "correct" && (
									<p className="font-display text-2xl font-semibold text-felt-ink">{s.current.tries > 1 ? "Fixed it!" : "Spot on!"}</p>
								)}
								{s.phase === "retry" && (
									<p className="text-lg">
										Almost.{notes.length > 1 && ` Also: ${notes.slice(1).join(" · ")}.`}{" "}
										<span className="text-felt-muted">Fix the marked tiles and check again.</span>
									</p>
								)}
								{s.phase === "reveal" && notes.length > 1 && <p className="text-lg">Also: {notes.slice(1).join(" · ")}</p>}
								{!judged && (
									<span className="flex items-center gap-2 text-sm text-felt-muted">
										<Pips box={box} /> {box === 0 ? "New word" : box >= 4 ? "Nearly mastered" : "Practicing"}
										{s.typed.length > 0 && !child.settings.showLength && mode === "bee" && (
											<span className="tabular-nums">· {s.typed.length} letters</span>
										)}
									</span>
								)}
							</div>

							{s.phase === "reveal" && (
								<div className="flex w-full flex-col items-center gap-3">
									<p className="text-sm text-felt-muted">Here’s how it’s spelled:</p>
									<RevealRow word={word} shown={revealShown} />
								</div>
							)}

							{mode === "tiles" && canType && (
								<div className="flex w-full items-start gap-3">
									<TileBank bank={bank} used={used} onPick={pick} />
									<button
										type="button"
										className="key shrink-0"
										disabled={used.length === 0}
										onClick={() => unpickAt(used.length - 1)}
										aria-label="Take back last tile"
									>
										<Delete className="size-5" aria-hidden />
									</button>
								</div>
							)}
						</>
					)}
				</section>
			)}
		</main>
	);
}

/** Never show the word itself in a definition/sentence caption while it's being spelled. */
function maskWord(text: string, word: string) {
	if (!word) return text;
	return text.replace(new RegExp(`\\b${word.replace(/[-']/g, "\\$&")}\\w*`, "gi"), "_____");
}

function StudyCard({
	word,
	info,
	definition,
	sentence,
	onCover,
}: {
	word: string;
	info: WordInfo | undefined;
	definition: string | null;
	sentence: string | null;
	onCover: () => void;
}) {
	const syllables = info?.syllables ?? splitSyllables(word);
	const [lit, setLit] = useState(-1);
	let offset = 0;
	return (
		<div className="flex w-full flex-col items-center gap-6">
			<div className="flex flex-wrap items-end justify-center gap-5" aria-label={`${word}, split as ${syllables.join(", ")}`} role="img">
				{syllables.map((part) => {
					const start = offset;
					offset += part.length;
					return (
						<span key={`${part}-${start}`} className="flex gap-1.5" aria-hidden>
							{[...part].map((c, i) => (
								<Tile key={`${c}-${start + i}`} letter={c} size={68} law={start + i <= lit ? "right" : undefined} />
							))}
						</span>
					);
				})}
			</div>
			{info?.partOfSpeech && <p className="text-sm text-felt-muted italic">{info.partOfSpeech}</p>}
			<dl className="max-w-[60ch] space-y-2 text-center">
				{definition && (
					<div>
						<dt className="sr-only">Definition</dt>
						<dd className="text-lg">{definition}</dd>
					</div>
				)}
				{sentence && (
					<div>
						<dt className="sr-only">Sentence</dt>
						<dd className="text-felt-muted">“{sentence}”</dd>
					</div>
				)}
			</dl>
			<div className="flex flex-wrap justify-center gap-3">
				<button
					type="button"
					className="key"
					onClick={() => {
						setLit(-1);
						void speaker.spell(word, (i) => setLit(i)).then(() => setLit(word.length));
					}}
				>
					<Volume2 className="size-5" aria-hidden /> Spell it out loud
				</button>
				<button type="button" className="key" data-variant="go" onClick={onCover}>
					Cover it. I’ll spell it
				</button>
			</div>
		</div>
	);
}
