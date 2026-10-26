import type { AttemptInput } from "@jade/core";
import { type Cell, type CodeSkill, checkCode, type Puzzle, type Verdict } from "@jade/core/code";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BadgeView } from "./api.ts";
import { safeStorage } from "./round.ts";

export type CodeMode = CodeSkill | "codereview";

/**
 * ready   → waiting for the first tap (unlocks audio on iPad)
 * coding  → writing (or, for predict, choosing a square)
 * running → a run is playing out on the board; `verdict` holds how it ends
 * solved  → it worked (or the right square was picked)
 * shown   → "Show me" played the answer; the puzzle counts as seen, not solved
 */
export type CodePhase = "ready" | "coding" | "running" | "solved" | "shown";

/** The help ladder, one step at a time: 1 the hint, 2 the first line, 3 "Show me". */
export type Help = 0 | 1 | 2 | 3;

type Current = {
	runs: number;
	help: Help;
	replays: number;
	startedAt: number;
	/** The program on the first run (what parents see), and how long the kid took to get there. */
	firstRun: string | null;
	firstMs: number;
};
const fresh = (): Current => ({ runs: 0, help: 0, replays: 0, startedAt: Date.now(), firstRun: null, firstMs: 0 });

/** How many runs a puzzle can take before an attempt stops counting tries (the API's limit). */
const MAX_TRIES = 5;

type CodeRoundState = {
	sessionId: string;
	childId: string;
	mode: CodeMode;
	puzzles: Puzzle[];
	index: number;
	/** The code in the editor, kept across a reload. */
	code: string;
	phase: CodePhase;
	verdict: Verdict | null;
	/** Where the playing run leads once it's done: solved, shown (the answer was given), or back to coding. */
	outcome: "solved" | "shown" | null;
	/** Predict: the square chosen, and whether the last check missed. */
	chosen: Cell | null;
	missed: boolean;
	current: Current;
	attempts: AttemptInput[];
	startedAt: number;
	serverStarted: boolean;
	finished: boolean;
	newBadges: BadgeView[];

	start(cfg: { childId: string; mode: CodeMode; puzzles: Puzzle[] }): void;
	resume(): void;
	begin(): void;
	setCode(code: string): void;
	replay(): void;
	/** Run the code; returns the verdict, and records the attempt once the puzzle's solved. */
	run(): Verdict | null;
	/** The run has finished playing on the board. */
	settle(): void;
	choose(c: Cell): void;
	/** Predict: check the chosen square. */
	checkChoice(): "right" | "retry" | "reveal" | null;
	help(): Help;
	showMe(): Verdict | null;
	next(): "next" | "done";
	close(): void;
};

export const useCodeRound = create<CodeRoundState>()(
	persist(
		(set, get) => {
			/** Close the current puzzle with an attempt. */
			const record = (correct: boolean, extra: Partial<Current> = {}) => {
				const s = get();
				const p = s.puzzles[s.index];
				if (!p) return null;
				const c = { ...s.current, ...extra };
				const attempt: AttemptInput = {
					clientId: crypto.randomUUID(),
					word: p.key,
					typed: (c.firstRun ?? s.code).slice(0, 2000),
					correct,
					tries: Math.min(Math.max(c.runs, 1), MAX_TRIES),
					// The hint counts as help; hearing the goal again doesn't.
					hintsUsed: c.help,
					replays: Math.min(c.replays, 50),
					ms: Math.min(c.firstMs || Date.now() - c.startedAt, 3_600_000),
					skill: p.skill,
					level: p.level,
				};
				set({ attempts: [...s.attempts, attempt], current: c });
				return attempt;
			};

			return {
				sessionId: "",
				childId: "",
				mode: "seq",
				puzzles: [],
				index: 0,
				code: "",
				phase: "ready",
				verdict: null,
				outcome: null,
				chosen: null,
				missed: false,
				current: fresh(),
				attempts: [],
				startedAt: 0,
				serverStarted: false,
				finished: true,
				newBadges: [],

				start: ({ childId, mode, puzzles }) =>
					set({
						sessionId: crypto.randomUUID(),
						childId,
						mode,
						puzzles,
						index: 0,
						code: puzzles[0]?.starter ?? "",
						phase: "ready",
						verdict: null,
						chosen: null,
						missed: false,
						current: fresh(),
						attempts: [],
						startedAt: Date.now(),
						serverStarted: false,
						finished: false,
						newBadges: [],
					}),

				resume: () =>
					set((s) => {
						const index = Math.min(Math.max(s.index, s.attempts.length), Math.max(s.puzzles.length - 1, 0));
						return {
							index,
							// Mid-puzzle code survives a reload; a puzzle not yet reached starts from its starter.
							code: index === s.index ? s.code : (s.puzzles[index]?.starter ?? ""),
							phase: "ready",
							verdict: null,
							chosen: null,
							missed: false,
							current: fresh(),
						};
					}),

				begin: () => set({ phase: "coding", current: fresh() }),

				setCode: (code) => {
					if (get().phase !== "coding") return;
					set({ code, verdict: null });
				},

				replay: () => set((s) => ({ current: { ...s.current, replays: s.current.replays + 1 } })),

				run: () => {
					const s = get();
					const p = s.puzzles[s.index];
					if (!p || s.phase !== "coding" || p.kind === "predict") return null;
					const verdict = checkCode(p, s.code);
					const current = {
						...s.current,
						runs: s.current.runs + 1,
						firstRun: s.current.firstRun ?? s.code,
						firstMs: s.current.firstMs || Date.now() - s.current.startedAt,
					};
					set({ verdict, current, phase: "running", outcome: verdict.solved ? "solved" : null });
					if (verdict.solved) record(true, current);
					return verdict;
				},

				settle: () => {
					const s = get();
					if (s.phase !== "running") return;
					set({ phase: s.outcome ?? "coding", outcome: null });
				},

				choose: (c) => {
					if (get().phase !== "coding") return;
					set({ chosen: c, missed: false });
				},

				checkChoice: () => {
					const s = get();
					const p = s.puzzles[s.index];
					if (!p?.answer || !s.chosen || s.phase !== "coding") return null;
					const right = s.chosen.x === p.answer.x && s.chosen.y === p.answer.y;
					const runs = s.current.runs + 1;
					const firstRun = s.current.firstRun ?? `${s.chosen.x},${s.chosen.y}`;
					const firstMs = s.current.firstMs || Date.now() - s.current.startedAt;
					const current = { ...s.current, runs, firstRun, firstMs };
					// Watching the code run is the reveal, right or not, once the turn is over.
					const verdict = checkCode({ boards: p.boards }, p.starter);
					if (right) {
						set({ current, verdict, phase: "running", outcome: "solved" });
						record(true, current);
						return "right";
					}
					if (runs < 2) {
						set({ current, missed: true });
						return "retry";
					}
					set({ current, verdict, phase: "running", outcome: "shown", missed: true });
					record(false, current);
					return "reveal";
				},

				help: () => {
					const s = get();
					const next = Math.min(3, s.current.help + 1) as Help;
					set({ current: { ...s.current, help: next } });
					return next;
				},

				showMe: () => {
					const s = get();
					const p = s.puzzles[s.index];
					if (!p || s.phase !== "coding") return null;
					const verdict = checkCode(p, p.solution);
					set({ code: p.solution, verdict, phase: "running", outcome: "shown" });
					record(false, { help: 3 });
					return verdict;
				},

				next: () => {
					const s = get();
					if (s.index + 1 >= s.puzzles.length) return "done";
					const index = s.index + 1;
					set({
						index,
						code: s.puzzles[index]?.starter ?? "",
						phase: "coding",
						verdict: null,
						chosen: null,
						missed: false,
						current: fresh(),
					});
					return "next";
				},

				close: () => set({ finished: true }),
			};
		},
		{
			name: "jade.coderound",
			version: 1,
			storage: createJSONStorage(() => safeStorage),
			partialize: (s) => ({
				sessionId: s.sessionId,
				childId: s.childId,
				mode: s.mode,
				puzzles: s.puzzles,
				index: s.index,
				code: s.code,
				attempts: s.attempts,
				startedAt: s.startedAt,
				serverStarted: s.serverStarted,
				finished: s.finished,
				newBadges: s.newBadges,
			}),
		},
	),
);

/** A code round that can be picked up where it was left, for the home shelf. */
export function resumableCode(childId: string) {
	const s = useCodeRound.getState();
	const left = s.puzzles.length - s.attempts.length;
	if (s.finished || s.childId !== childId || left <= 0 || s.attempts.length === 0 || Date.now() - s.startedAt > 86_400_000) return null;
	return { mode: s.mode, done: s.attempts.length, total: s.puzzles.length, startedAt: s.startedAt };
}
