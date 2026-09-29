import type { AttemptInput } from "@jade/core";
import { type CheckResult, checkAnswer, type MathTopic, type Problem } from "@jade/core/math";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BadgeView } from "./api.ts";
import { safeStorage } from "./round.ts";

export type MathMode = MathTopic | "mathreview";

/**
 * ready    → waiting for the first tap (unlocks audio on iPad)
 * answering→ entering an answer on the keypad
 * retry    → first try missed; the answer is not given away yet
 * correct  → right; tiles flip marigold
 * reveal   → second miss; the answer and the "how" are shown
 */
export type MathPhase = "ready" | "answering" | "retry" | "correct" | "reveal";

type Current = { tries: number; replays: number; startedAt: number; firstTyped: string | null };
const fresh = (): Current => ({ tries: 0, replays: 0, startedAt: Date.now(), firstTyped: null });

type MathRoundState = {
	sessionId: string;
	childId: string;
	mode: MathMode;
	problems: Problem[];
	index: number;
	typed: string;
	phase: MathPhase;
	result: CheckResult | null;
	current: Current;
	attempts: AttemptInput[];
	/** First answers of problems that took two tries, by attempt `clientId`. */
	firstTries: Record<string, string>;
	startedAt: number;
	serverStarted: boolean;
	finished: boolean;
	newBadges: BadgeView[];

	start(cfg: { childId: string; mode: MathMode; problems: Problem[] }): void;
	resume(): void;
	begin(): void;
	input(key: string): void;
	backspace(): void;
	replay(): void;
	check(): CheckResult | null;
	next(): "next" | "done";
	close(): void;
};

const MAX_LEN = 9;

export const useMathRound = create<MathRoundState>()(
	persist(
		(set, get) => ({
			sessionId: "",
			childId: "",
			mode: "facts",
			problems: [],
			index: 0,
			typed: "",
			phase: "ready",
			result: null,
			current: fresh(),
			attempts: [],
			firstTries: {},
			startedAt: 0,
			serverStarted: false,
			finished: true,
			newBadges: [],

			start: ({ childId, mode, problems }) =>
				set({
					sessionId: crypto.randomUUID(),
					childId,
					mode,
					problems,
					index: 0,
					typed: "",
					phase: "ready",
					result: null,
					current: fresh(),
					attempts: [],
					firstTries: {},
					startedAt: Date.now(),
					serverStarted: false,
					finished: false,
					newBadges: [],
				}),

			resume: () =>
				set((s) => ({
					index: Math.min(Math.max(s.index, s.attempts.length), Math.max(s.problems.length - 1, 0)),
					typed: "",
					phase: "ready",
					result: null,
					current: fresh(),
				})),

			begin: () => set({ phase: "answering", current: fresh() }),

			input: (key) => {
				const { phase, typed, problems, index } = get();
				if (phase !== "answering" && phase !== "retry") return;
				const answer = problems[index]?.answer;
				if (!answer) return;
				// Comparison answers are a single symbol: pressing one replaces the other.
				if (answer.kind === "choice") {
					if (key === "<" || key === "=" || key === ">") set({ typed: key, result: null });
					return;
				}
				if (!/^[0-9]$/.test(key) && !(key === "/" && answer.kind === "frac") && !(key === "." && answer.kind === "dec")) return;
				if ((key === "/" || key === ".") && (typed.includes(key) || typed === "")) return;
				if (typed.length >= MAX_LEN) return;
				set({ typed: typed + key, result: null });
			},

			backspace: () => {
				const { phase, typed } = get();
				if (phase !== "answering" && phase !== "retry") return;
				set({ typed: typed.slice(0, -1), result: null });
			},

			replay: () => set((s) => ({ current: { ...s.current, replays: s.current.replays + 1 } })),

			check: () => {
				const s = get();
				const p = s.problems[s.index];
				if (!p || (s.phase !== "answering" && s.phase !== "retry") || !s.typed || /[/.]$/.test(s.typed)) return null;
				const result = checkAnswer(p.answer, s.typed);
				// A "nearly" (e.g. equal but not simplest) doesn't use up the try.
				if (!result.correct && result.hint && s.phase === "answering") {
					set({ result });
					return result;
				}
				const tries = s.current.tries + 1;
				const current = { ...s.current, tries, firstTyped: s.current.firstTyped ?? s.typed };
				const phase: MathPhase = result.correct ? "correct" : tries >= 2 ? "reveal" : "retry";
				const done = phase === "correct" || phase === "reveal";
				const clientId = crypto.randomUUID();
				const attempts = done
					? [
							...s.attempts,
							{
								clientId,
								word: p.key,
								typed: result.correct ? s.typed : (current.firstTyped ?? s.typed),
								correct: result.correct,
								tries,
								hintsUsed: 0,
								replays: current.replays,
								ms: Math.min(Date.now() - current.startedAt, 3_600_000),
								skill: p.skill,
								level: p.level,
							},
						]
					: s.attempts;
				const firstTries = done && tries > 1 && current.firstTyped ? { ...s.firstTries, [clientId]: current.firstTyped } : s.firstTries;
				set({ result, phase, current, attempts, firstTries, typed: phase === "retry" ? "" : s.typed });
				return result;
			},

			next: () => {
				const s = get();
				if (s.index + 1 >= s.problems.length) return "done";
				set({ index: s.index + 1, typed: "", phase: "answering", result: null, current: fresh() });
				return "next";
			},

			close: () => set({ finished: true }),
		}),
		{
			name: "jade.mathround",
			version: 1,
			storage: createJSONStorage(() => safeStorage),
			partialize: (s) => ({
				sessionId: s.sessionId,
				childId: s.childId,
				mode: s.mode,
				problems: s.problems,
				index: s.index,
				attempts: s.attempts,
				firstTries: s.firstTries,
				startedAt: s.startedAt,
				serverStarted: s.serverStarted,
				finished: s.finished,
				newBadges: s.newBadges,
			}),
		},
	),
);

export function resumableMath(childId: string) {
	const s = useMathRound.getState();
	const left = s.problems.length - s.attempts.length;
	if (s.finished || s.childId !== childId || left <= 0 || s.attempts.length === 0 || Date.now() - s.startedAt > 86_400_000) return null;
	return { mode: s.mode, done: s.attempts.length, total: s.problems.length, startedAt: s.startedAt };
}
