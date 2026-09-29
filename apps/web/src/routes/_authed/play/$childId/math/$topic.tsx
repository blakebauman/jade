import { MATH_MODES } from "@jade/core";
import { answerText, buildMathRound, keysFor, type MathTopic, seeded, TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Keypad } from "#/components/math/Keypad.tsx";
import { ProblemRow, tokensText } from "#/components/math/ProblemRow.tsx";
import { Visual } from "#/components/math/Visual.tsx";
import { useChild } from "#/lib/child.ts";
import { dayKey, useVisualViewport } from "#/lib/hooks.ts";
import { type MathMode, useMathRound } from "#/lib/mathRound.ts";
import { finishSession, saveAttempts, startSession } from "#/lib/offline.ts";
import { progressQuery } from "#/lib/queries.ts";
import { type MathResultItem, useRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/math/$topic")({
	params: {
		parse: (p) => ({ ...p, topic: z.enum(MATH_MODES).parse(p.topic) as MathMode }),
		stringify: (p) => p,
	},
	validateSearch: z.object({ resume: z.boolean().optional() }),
	loader: ({ context, params }) => context.queryClient.fetchQuery(progressQuery(params.childId)),
	component: MathRound,
});

const PRAISE = ["Yes!", "Nice!", "Correct!", "You got it!", "Brilliant!"];

function MathRound() {
	const { topic } = Route.useParams();
	const { resume } = Route.useSearch();
	const progress = Route.useLoaderData();
	const child = useChild();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { keyboard } = useVisualViewport();
	const s = useMathRound();
	const [saving, setSaving] = useState(false);
	const started = useRef(false);

	// Build the round once per mount (or pick up the interrupted one).
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const r = useMathRound.getState();
		if (resume && !r.finished && r.childId === child.id && r.mode === topic && r.problems.length > 0) {
			r.resume();
			return;
		}
		const problems = buildMathRound(
			topic === "mathreview" ? "review" : (topic as MathTopic),
			child.settings.math,
			progress.math.levels,
			progress.math.factsDue,
			seeded(Date.now() % 2_147_483_647),
		);
		r.start({ childId: child.id, mode: topic, problems });
	}, [child.id, child.settings.math, progress.math.levels, progress.math.factsDue, resume, topic]);
	useEffect(() => () => speaker.stop(), []);

	const problem = s.problems[s.index];
	const say = useCallback(() => {
		if (!problem) return;
		useMathRound.getState().replay();
		void speaker.say(problem.spoken, { kind: "sentence" });
	}, [problem]);

	// New problem: read it out.
	const lastIndex = useRef(-1);
	useEffect(() => {
		if (s.phase === "answering" && problem && lastIndex.current !== s.index) {
			lastIndex.current = s.index;
			void speaker.say(problem.spoken, { kind: "sentence" });
		}
	}, [s.phase, s.index, problem]);

	function begin() {
		speaker.unlock();
		const r = useMathRound.getState();
		if (!r.serverStarted) {
			useMathRound.setState({ serverStarted: true });
			void startSession({ id: r.sessionId, childId: r.childId, listId: null, subject: "math", mode: r.mode, startedAt: r.startedAt });
		}
		r.begin();
	}

	function check() {
		const res = useMathRound.getState().check();
		if (!res) return;
		const { phase, attempts, sessionId } = useMathRound.getState();
		if (phase === "correct") void speaker.say(PRAISE[Math.floor(Math.random() * PRAISE.length)]!, { kind: "sentence" });
		if (phase === "correct" || phase === "reveal") {
			const last = attempts.at(-1);
			if (last)
				void saveAttempts(sessionId, [last], dayKey()).then((out) => {
					if (out?.newBadges.length) useMathRound.setState((st) => ({ newBadges: [...st.newBadges, ...out.newBadges] }));
				});
		}
	}

	async function closeRound() {
		const r = useMathRound.getState();
		setSaving(true);
		let summary = null;
		try {
			summary = await finishSession(r.sessionId, { attempts: r.attempts, finishedAt: Date.now(), day: dayKey() });
		} catch {}
		const items: MathResultItem[] = r.attempts.map((a, i) => {
			const p = r.problems[i]!;
			return {
				key: p.key,
				prompt: p.text ?? tokensText(p.prompt),
				answer: answerText(p.answer),
				typed: a.typed,
				correct: a.correct,
				firstTry: a.correct && a.tries === 1,
				explain: p.explain,
			};
		});
		r.close();
		useRound.getState().finishRound({
			subject: "math",
			items,
			mathMode: r.mode,
			sessionId: r.sessionId,
			childId: r.childId,
			listId: null,
			mode: r.mode,
			attempts: r.attempts,
			planned: r.problems.length,
			summary,
			newBadges: [...r.newBadges, ...(summary?.newBadges ?? [])],
			queued: summary === null,
		});
		void qc.invalidateQueries({ queryKey: ["progress", child.id] });
		navigate({ to: "/play/$childId/results", params: { childId: child.id }, replace: true });
	}

	async function advance() {
		if (useMathRound.getState().next() === "next") return;
		await closeRound();
	}

	// Laptop keyboards: digits, symbols, Backspace, Enter, and ↑ to hear it again.
	const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
	keyHandler.current = (e: KeyboardEvent) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (e.key === "Enter" && t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
		const st = useMathRound.getState();
		if (e.key === "Enter") {
			e.preventDefault();
			if (st.phase === "ready") begin();
			else if (st.phase === "answering" || st.phase === "retry") check();
			else if (!saving) void advance();
		} else if (e.key === "Backspace") {
			e.preventDefault();
			st.backspace();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			say();
		} else if (/^[0-9/.<=>]$/.test(e.key)) st.input(e.key);
	};
	useEffect(() => {
		const h = (e: KeyboardEvent) => keyHandler.current(e);
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, []);

	const title = topic === "mathreview" ? "Facts review" : TOPIC_LABEL[topic as MathTopic];

	if (s.problems.length === 0 && s.childId === child.id) {
		return (
			<main className="grid min-h-dvh place-items-center p-6 text-center">
				<div className="space-y-5">
					<h1 className="text-3xl font-semibold">No facts to review right now</h1>
					<Link to="/play/$childId/math" params={{ childId: child.id }} className="key" data-variant="go">
						Back to math
					</Link>
				</div>
			</main>
		);
	}
	if (!problem) return null;

	const canAnswer = s.phase === "answering" || s.phase === "retry";
	const law = s.phase === "correct" ? ("right" as const) : s.phase === "reveal" ? ("wrong" as const) : undefined;
	const extra = keysFor(problem.answer);

	return (
		<main className="mx-auto flex max-w-5xl flex-col px-4 md:px-8" style={{ minHeight: "100dvh" }}>
			<header className="flex items-center gap-3 py-4 md:gap-4">
				<Link
					to="/play/$childId/math"
					params={{ childId: child.id }}
					className="key size-11 !p-0"
					aria-label="Leave round"
					onClick={(e) => {
						if (s.attempts.length === 0) return;
						e.preventDefault();
						const n = s.attempts.length;
						if (confirm(`Stop here? Your ${n} ${n === 1 ? "answer is" : "answers are"} saved.`)) void closeRound();
					}}
				>
					<X className="size-5" aria-hidden />
				</Link>
				<KidTile name={child.name} avatar={child.avatar} size={40} />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm text-felt-muted">Math · {title}</p>
					<ol className="mt-1.5 flex flex-wrap gap-1" aria-label={`Problem ${s.index + 1} of ${s.problems.length}`}>
						{s.problems.map((p, i) => {
							const a = s.attempts[i];
							return (
								<li key={p.key} className={i === s.index ? "-translate-y-0.5" : a ? "" : "opacity-45"}>
									<Tile size={14} law={a?.correct && a.tries === 1 ? "right" : undefined} grain={i % 4} aria-hidden />
								</li>
							);
						})}
					</ol>
				</div>
				<p className="font-display text-lg font-medium tabular-nums" aria-live="polite">
					{Math.min(s.index + 1, s.problems.length)}
					<span className="text-felt-muted">/{s.problems.length}</span>
				</p>
			</header>

			{s.phase === "ready" ? (
				<section className="grid flex-1 place-items-center">
					<div className="flex flex-col items-center gap-8 text-center">
						<h1 className="text-4xl font-semibold md:text-5xl">
							{s.problems.length} {s.problems.length === 1 ? "problem" : "problems"}. Ready?
						</h1>
						<p className="max-w-[40ch] text-felt-muted">Tap the number keys to answer. No clock: take your time.</p>
						<button type="button" className="key !min-h-16 !px-10 !text-2xl" data-variant="go" onClick={begin}>
							<Volume2 className="size-7" aria-hidden /> Start
						</button>
					</div>
				</section>
			) : (
				<section className={`flex flex-1 flex-col items-center gap-6 pb-8 ${keyboard ? "" : "justify-center"}`}>
					<div className="flex w-full flex-col items-center gap-4">
						<button type="button" onClick={say} className="tile !rounded-full" style={{ width: 64, height: 64 }} aria-label="Read it again">
							<Volume2 className="size-7" aria-hidden strokeWidth={2.2} />
						</button>
						{problem.text && <p className="plaque !block max-w-[52ch] px-5 py-3 text-center text-lg leading-relaxed">{problem.text}</p>}
						<div className="flex w-full items-center justify-center py-2">
							<ProblemRow problem={problem} typed={s.typed} law={law} />
						</div>
					</div>

					<div className="min-h-7 text-center" aria-live="assertive">
						{s.phase === "correct" && (
							<p className="font-display text-2xl font-semibold">{s.current.tries > 1 ? "Fixed it!" : "Spot on!"}</p>
						)}
						{s.phase === "retry" && <p className="text-lg">Not quite. Have another go.</p>}
						{s.result?.hint && canAnswer && <p className="text-lg">{s.result.hint}</p>}
					</div>

					{s.phase === "reveal" && (
						<div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl bg-felt-deep/60 p-5">
							<p className="font-display text-2xl">
								The answer is <span className="plaque !inline-flex px-3 py-0.5">{answerText(problem.answer)}</span>
							</p>
							<p className="text-center text-lg">{problem.explain}</p>
							{problem.visual && <Visual visual={problem.visual} />}
						</div>
					)}

					{canAnswer ? (
						<Keypad
							extra={extra}
							onKey={(k) => s.input(k)}
							onBackspace={() => s.backspace()}
							onCheck={check}
							canCheck={!!s.typed && !/[/.]$/.test(s.typed)}
							compact={keyboard}
						/>
					) : (
						<button
							type="button"
							className="key !min-h-14 !px-8 !text-xl"
							data-variant="go"
							disabled={saving}
							onClick={() => void advance()}
						>
							{s.index + 1 >= s.problems.length ? (saving ? "Saving…" : "Finish") : "Next"} <ArrowRight className="size-6" aria-hidden />
						</button>
					)}
				</section>
			)}
		</main>
	);
}
