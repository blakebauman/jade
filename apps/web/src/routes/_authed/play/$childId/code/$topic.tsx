import { CODE_MODES } from "@jade/core";
import {
	backspace,
	buildCodeRound,
	type CodeSkill,
	docOf,
	indent,
	insert,
	newline,
	outdent,
	SKILL_LABEL,
	TURTLE,
	textOf,
} from "@jade/core/code";
import { seeded } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FastForward, LifeBuoy, Play, Sparkles, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Confirm } from "#/components/Confirm.tsx";
import { CodeBoard } from "#/components/code/CodeBoard.tsx";
import { Editor } from "#/components/code/Editor.tsx";
import * as sound from "#/components/code/sound.ts";
import { Toolbox } from "#/components/code/Toolbox.tsx";
import { useReplay } from "#/components/code/useReplay.ts";
import { useChild } from "#/lib/child.ts";
import { type CodeMode, useCodeRound } from "#/lib/codeRound.ts";
import { dayKey, useVisualViewport, useWakeLock } from "#/lib/hooks.ts";
import { finishSession, saveAttempts, startSession } from "#/lib/offline.ts";
import { roundProgress } from "#/lib/queries.ts";
import { type MathResultItem, useRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/code/$topic")({
	params: {
		parse: (p) => ({ ...p, topic: z.enum(CODE_MODES).parse(p.topic) as CodeMode }),
		stringify: (p) => p,
	},
	validateSearch: z.object({ resume: z.boolean().optional() }),
	loader: ({ context, params }) => roundProgress(context.queryClient, params.childId),
	component: CodeRound,
});

const PRAISE = ["It works!", "Nice code!", "You did it!", "Brilliant!", "Tuck made it!"];
const KIND_LABEL = { build: "Write it", fix: "Fix it", predict: "Read it", draw: "Draw it", neat: "Make it neat" } as const;

function CodeRound() {
	const { topic } = Route.useParams();
	const { resume } = Route.useSearch();
	const progress = Route.useLoaderData();
	const child = useChild();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { compact } = useVisualViewport();
	const s = useCodeRound();
	useWakeLock(s.phase !== "ready");
	const [saving, setSaving] = useState(false);
	const [askStop, setAskStop] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [token, setToken] = useState(0);
	const [caret, setCaret] = useState<{ line: number; col: number } | null>(null);
	const editorRef = useRef<HTMLDivElement>(null);
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const r = useCodeRound.getState();
		if (resume && !r.finished && r.childId === child.id && r.mode === topic && r.puzzles.length > 0) {
			r.resume();
			return;
		}
		const puzzles = buildCodeRound(
			topic === "codereview" ? "review" : (topic as CodeSkill),
			progress.code?.levels ?? {},
			progress.code?.due ?? [],
			seeded(Date.now() % 2_147_483_647),
		);
		r.start({ childId: child.id, mode: topic, puzzles });
		navigate({ to: ".", search: (prev) => ({ ...prev, resume: true }), replace: true });
	}, [child.id, progress.code, resume, topic, navigate]);
	useEffect(() => () => speaker.stop(), []);

	const puzzle = s.puzzles[s.index];
	const doc = useMemo(() => {
		const d = docOf(s.code);
		return caret ? { ...d, line: Math.min(caret.line, d.lines.length - 1), col: caret.col } : d;
	}, [s.code, caret]);
	const setDoc = (d: { lines: string[]; line: number; col: number }) => {
		setCaret({ line: d.line, col: d.col });
		const r = useCodeRound.getState();
		if (r.phase !== "coding") return;
		// Editing after a run puts Tuck back at the start, ready for the next go.
		if (r.verdict) replay.show(Math.min(replay.state.board, (puzzle?.boards.length ?? 1) - 1));
		r.setCode(textOf(d));
	};

	const say = useCallback(() => {
		if (!puzzle) return;
		useCodeRound.getState().replay();
		void speaker.say(puzzle.goal, { kind: "sentence" });
	}, [puzzle]);

	// A new puzzle: read the goal out, and put the caret at the end of the starter.
	const lastIndex = useRef(-1);
	useEffect(() => {
		if (s.phase === "coding" && puzzle && lastIndex.current !== s.index) {
			lastIndex.current = s.index;
			setCaret(null);
			void speaker.say(puzzle.goal, { kind: "sentence" });
			editorRef.current?.querySelector<HTMLElement>("[role=textbox]")?.focus({ preventScroll: true });
		}
	}, [s.phase, s.index, puzzle]);

	const checks = s.verdict?.boards ?? null;
	const replay = useReplay(puzzle?.boards ?? [{ rows: ["."], start: { x: 0, y: 0, dir: 1 } }], checks, token, speed, () => {
		const r = useCodeRound.getState();
		const outcome = r.outcome;
		r.settle();
		if (outcome === "solved") sound.solved();
		if (outcome === "solved") void speaker.say(PRAISE[Math.floor(Math.random() * PRAISE.length)]!, { kind: "sentence" });
		else if (outcome === null && r.verdict?.error) void speaker.say(r.verdict.error.message, { kind: "sentence" });
	});

	// Each event the board starts playing gets its sound.
	const playingEv = replay.state.playing?.ev;
	useEffect(() => {
		if (playingEv) sound.forEvent(playingEv);
	}, [playingEv]);

	function saveLast(before: number) {
		const { attempts, sessionId } = useCodeRound.getState();
		if (attempts.length <= before) return;
		const last = attempts.at(-1)!;
		void saveAttempts(sessionId, [last], dayKey()).then((out) => {
			if (out?.newBadges.length) useCodeRound.setState((st) => ({ newBadges: [...st.newBadges, ...out.newBadges] }));
		});
	}

	function begin() {
		speaker.unlock();
		sound.unlock();
		const r = useCodeRound.getState();
		if (!r.serverStarted) {
			useCodeRound.setState({ serverStarted: true });
			void startSession({ id: r.sessionId, childId: r.childId, listId: null, subject: "code", mode: r.mode, startedAt: r.startedAt });
		}
		r.begin();
	}

	function run() {
		const r = useCodeRound.getState();
		const before = r.attempts.length;
		if (!r.run()) return;
		speaker.stop();
		setToken((t) => t + 1);
		saveLast(before);
	}

	function checkChoice() {
		const r = useCodeRound.getState();
		const before = r.attempts.length;
		const res = r.checkChoice();
		if (!res) return;
		if (res === "retry") {
			void speaker.say("Not there. Read it once more, one line at a time.", { kind: "sentence" });
			return;
		}
		setToken((t) => t + 1);
		saveLast(before);
	}

	function help() {
		const r = useCodeRound.getState();
		// "Read it" puzzles have no first line to give: after the hint comes the answer.
		if (r.current.help >= (puzzle?.kind === "predict" ? 1 : 2)) {
			const before = r.attempts.length;
			if (r.showMe()) {
				setCaret(null);
				setToken((t) => t + 1);
				saveLast(before);
			}
			return;
		}
		const step = r.help();
		if (step === 1 && puzzle) void speaker.say(puzzle.hint, { kind: "sentence" });
	}

	async function closeRound() {
		const r = useCodeRound.getState();
		setSaving(true);
		let summary = null;
		try {
			summary = await finishSession(r.sessionId, { attempts: r.attempts, finishedAt: Date.now(), day: dayKey() });
		} catch {}
		const items: MathResultItem[] = r.attempts.map((a, i) => {
			const p = r.puzzles[i]!;
			return {
				key: p.key,
				prompt: p.goal,
				answer: p.kind === "predict" && p.answer ? `Row ${p.answer.y + 1}, square ${p.answer.x + 1}` : p.solution,
				typed: a.typed,
				correct: a.correct,
				firstTry: a.correct && a.tries === 1,
				explain: p.hint,
			};
		});
		r.close();
		useRound.getState().finishRound({
			subject: "code",
			items,
			codeMode: r.mode,
			sessionId: r.sessionId,
			childId: r.childId,
			listId: null,
			mode: r.mode,
			attempts: r.attempts,
			planned: r.puzzles.length,
			summary,
			newBadges: [...r.newBadges, ...(summary?.newBadges ?? [])],
			queued: summary === null,
		});
		void qc.invalidateQueries({ queryKey: ["progress", child.id] });
		void qc.invalidateQueries({ queryKey: ["play", child.id] });
		navigate({ to: "/play/$childId/results", params: { childId: child.id }, replace: true });
	}

	async function advance() {
		if (useCodeRound.getState().next() === "next") return;
		await closeRound();
	}

	// Enter starts the round and moves on after a puzzle; Ctrl/Cmd+Enter runs from anywhere.
	const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
	keyHandler.current = (e: KeyboardEvent) => {
		if (askStop || e.defaultPrevented) return;
		const t = e.target as HTMLElement | null;
		const st = useCodeRound.getState();
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (st.phase === "coding") puzzle?.kind === "predict" ? checkChoice() : run();
			return;
		}
		if (e.key !== "Enter" || (t && (t.tagName === "BUTTON" || t.tagName === "A" || t.getAttribute("role") === "textbox"))) return;
		if (st.phase === "ready") {
			e.preventDefault();
			begin();
		} else if ((st.phase === "solved" || st.phase === "shown") && !saving) {
			e.preventDefault();
			void advance();
		}
	};
	useEffect(() => {
		const h = (e: KeyboardEvent) => keyHandler.current(e);
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, []);

	const title = topic === "codereview" ? "Code review" : SKILL_LABEL[topic as CodeSkill];

	if (s.puzzles.length === 0 && s.childId === child.id) {
		return (
			<main className="grid min-h-dvh place-items-center p-safe-6 text-center">
				<div className="space-y-5">
					<h1 className="text-3xl font-semibold">No puzzles to review right now</h1>
					<Link to="/play/$childId/code" params={{ childId: child.id }} className="key" data-variant="go">
						Back to Code
					</Link>
				</div>
			</main>
		);
	}
	if (!puzzle) return null;

	const predict = puzzle.kind === "predict";
	const coding = s.phase === "coding";
	const running = s.phase === "running";
	const done = s.phase === "solved" || s.phase === "shown";
	const shownBoard = Math.min(replay.state.board, puzzle.boards.length - 1);
	// The problem to mark: the run's (once it has finished playing), never while the kid is still typing a fix.
	const error = coding && s.verdict && !s.verdict.solved ? s.verdict.error : null;
	const message = done
		? s.phase === "shown"
			? predict
				? `${TURTLE} ends up here. Watch it again any time.`
				: "Here’s one way. It comes back later for another go."
			: s.verdict?.neat && puzzle.neat
				? `It works, in ${s.verdict.lines} lines. Neat!`
				: predict
					? "Spot on!"
					: s.current.runs > 1
						? "Fixed it! It works."
						: "It works, first time!"
		: error
			? error.message
			: predict && s.missed
				? "Not there. Read it once more, one line at a time."
				: null;

	return (
		<main className="mx-auto flex max-w-6xl flex-col px-safe-4 pt-safe-0 pb-safe-4 md:px-safe-8" style={{ minHeight: "100dvh" }}>
			<header className="flex items-center gap-3 py-3 md:gap-4">
				<Link
					to="/play/$childId/code"
					params={{ childId: child.id }}
					className="key size-11 !p-0"
					aria-label="Leave round"
					onClick={(e) => {
						if (s.attempts.length === 0) return;
						e.preventDefault();
						setAskStop(true);
					}}
				>
					<X className="size-5" aria-hidden />
				</Link>
				<KidTile name={child.name} avatar={child.avatar} size={40} />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm text-page-muted">Code · {title}</p>
					<ol className="mt-1.5 flex flex-wrap gap-1" aria-label={`Puzzle ${s.index + 1} of ${s.puzzles.length}`}>
						{s.puzzles.map((p, i) => {
							const a = s.attempts[i];
							return (
								<li key={`${p.key}-${i}`} className={i === s.index ? "-translate-y-0.5" : a ? "" : "opacity-45"}>
									<Tile size={14} law={a?.correct && a.tries === 1 ? "right" : undefined} grain={i % 4} aria-hidden />
								</li>
							);
						})}
					</ol>
				</div>
				<p className="font-display text-lg font-medium tabular-nums" aria-live="polite">
					{Math.min(s.index + 1, s.puzzles.length)}
					<span className="text-page-muted">/{s.puzzles.length}</span>
				</p>
			</header>

			{askStop && (
				<Confirm
					className="mb-4"
					message="Stop here?"
					note={`Your ${s.attempts.length} ${s.attempts.length === 1 ? "puzzle is" : "puzzles are"} saved, and you’ll see how you did.`}
					cancelLabel="Keep going"
					confirmLabel="Stop"
					busy={saving}
					onCancel={() => setAskStop(false)}
					onConfirm={() => void closeRound()}
				/>
			)}

			<h1 className="sr-only">Code · {title}</h1>
			{s.phase === "ready" ? (
				<section className="grid flex-1 place-items-center">
					<div className="flex flex-col items-center gap-8 text-center">
						<h2 className="text-4xl font-semibold md:text-5xl">
							{s.puzzles.length} {s.puzzles.length === 1 ? "puzzle" : "puzzles"}. Ready?
						</h2>
						<p className="max-w-[44ch] text-page-muted">
							Write real Python to tell {TURTLE} the turtle what to do, then press Run and watch. No clock: take your time.
						</p>
						<button type="button" className="key !min-h-16 !px-10 !text-2xl" data-variant="go" onClick={begin}>
							<Volume2 className="size-7" aria-hidden /> Start
						</button>
						<p className="hidden text-sm text-page-muted md:block">
							Keys: type your code · <kbd className="rounded bg-page-deep px-1.5">Tab</kbd> push in ·{" "}
							<kbd className="rounded bg-page-deep px-1.5">Ctrl Enter</kbd> run
						</p>
					</div>
				</section>
			) : (
				<section className="flex flex-1 flex-col gap-4 pb-4">
					<div className="flex items-start gap-3">
						<button
							type="button"
							onClick={say}
							className="tile shrink-0 !rounded-full transition-transform active:translate-y-0.5"
							style={{ width: 52, height: 52 }}
							aria-label="Read the goal again"
						>
							<Volume2 className="size-6" aria-hidden strokeWidth={2.2} />
						</button>
						<div className="plaque !block flex-1 px-4 py-2.5">
							<p className="font-display text-sm font-semibold tracking-wide opacity-80">{KIND_LABEL[puzzle.kind]}</p>
							<p className="text-lg leading-snug text-pretty">{puzzle.goal}</p>
						</div>
					</div>

					<div className="grid flex-1 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
						<div className="flex flex-col gap-3">
							{puzzle.boards.length > 1 && (
								<fieldset className="flex gap-2">
									<legend className="sr-only">Gardens</legend>
									{puzzle.boards.map((_, b) => (
										<button
											key={b}
											type="button"
											className="key !min-h-10"
											data-pressed={shownBoard === b}
											disabled={running}
											onClick={() => replay.show(b)}
										>
											Garden {b + 1}
										</button>
									))}
								</fieldset>
							)}
							<CodeBoard
								board={puzzle.boards[shownBoard]!}
								garden={replay.state.garden}
								playing={replay.state.playing}
								flat={predict}
								label={`${puzzle.boards.length > 1 ? `Garden ${shownBoard + 1} of ${puzzle.boards.length}. ` : ""}${TURTLE}’s garden`}
								onCell={predict && coding ? (c) => s.choose(c) : undefined}
								chosen={predict ? s.chosen : null}
								answer={predict && done ? puzzle.answer : null}
							/>
						</div>

						<div className="flex flex-col gap-3" ref={editorRef}>
							<Editor
								doc={doc}
								onChange={setDoc}
								readOnly={predict || !coding}
								marks={{ error, solved: s.phase === "solved" && !predict, now: replay.state.line }}
								onRun={run}
								compact={compact}
							/>
							<div className="min-h-7" aria-live="assertive">
								{message && (
									<p className={`text-lg ${done ? "font-display text-2xl font-semibold" : ""}`}>
										{s.verdict?.neat && done && puzzle.neat ? <Sparkles className="mr-1 inline size-6" aria-hidden /> : null}
										{message}
									</p>
								)}
								{coding && s.current.help >= 1 && <p className="mt-1 text-page-muted">Hint: {puzzle.hint}</p>}
								{coding && s.current.help >= 2 && !predict && (
									<p className="mt-1 text-page-muted">
										Start with: <code className="font-mono">{puzzle.solution.split("\n")[0]}</code>
									</p>
								)}
							</div>

							{done ? (
								<div className="flex justify-end">
									<button
										type="button"
										className="key !min-h-14 !px-8 !text-xl"
										data-variant="go"
										disabled={saving}
										onClick={() => void advance()}
									>
										{s.index + 1 >= s.puzzles.length ? (saving ? "Saving…" : "Finish") : "Next"}{" "}
										<ArrowRight className="size-6" aria-hidden />
									</button>
								</div>
							) : predict ? (
								<div className="flex flex-wrap items-center justify-end gap-2">
									<HelpKey help={s.current.help} onClick={help} disabled={!coding} predict />
									<button
										type="button"
										className="key !min-h-14 !px-8 !text-xl"
										data-variant="check"
										disabled={!coding || !s.chosen}
										onClick={checkChoice}
									>
										Check
									</button>
								</div>
							) : (
								<Toolbox
									snippets={puzzle.toolbox}
									onSnippet={(sn) => setDoc(insert(doc, sn, /^\d$/.test(sn)))}
									onNewline={() => setDoc(newline(doc))}
									onIndent={() => setDoc(indent(doc))}
									onOutdent={() => setDoc(outdent(doc))}
									onDelete={() => setDoc(backspace(doc, true))}
									disabled={!coding}
									compact={compact}
								>
									{running ? (
										<>
											<button
												type="button"
												className="key !min-h-12"
												data-pressed={speed === 2}
												data-toggle
												onClick={() => setSpeed((v) => (v === 1 ? 2 : 1))}
												aria-label="Faster"
											>
												<FastForward className="size-5" aria-hidden /> 2×
											</button>
											<button type="button" className="key !min-h-12" onClick={replay.skip}>
												Skip
											</button>
										</>
									) : (
										<HelpKey help={s.current.help} onClick={help} disabled={!coding} />
									)}
									<button
										type="button"
										className="key !min-h-12 !px-6 !text-lg"
										data-variant="check"
										disabled={!coding || s.code.trim() === ""}
										onClick={run}
									>
										<Play className="size-5" aria-hidden /> Run
									</button>
								</Toolbox>
							)}
						</div>
					</div>
				</section>
			)}
		</main>
	);
}

/** The help ladder: a hint, then the first line, then "Show me". */
function HelpKey({ help, onClick, disabled, predict }: { help: number; onClick: () => void; disabled?: boolean; predict?: boolean }) {
	const label = help === 0 ? "Hint" : help === 1 && !predict ? "First line" : "Show me";
	return (
		<button type="button" className="key !min-h-12" onClick={onClick} disabled={disabled}>
			<LifeBuoy className="size-5" aria-hidden /> {label}
		</button>
	);
}
