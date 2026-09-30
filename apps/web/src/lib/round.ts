import { type AttemptInput, type GradeResult, gradeAttempt, type Mode, normalizeWord, starsForWord } from "@jade/core";
import type { Problem } from "@jade/core/math";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { BadgeView, RoundSummary } from "./api.ts";

export type RoundWord = { word: string; sentence?: string | null; definition?: string | null };

/**
 * ready     → waiting for the first tap (unlocks audio on iPad)
 * spelling  → typing / placing tiles
 * retry     → first try missed; wrong positions marked, letters not given away
 * correct   → spelled right; tiles flip marigold
 * reveal    → second miss; the right spelling cascades in tile by tile
 * study     → Learn mode: word shown with syllables before it is covered
 */
export type Phase = "ready" | "spelling" | "retry" | "correct" | "reveal" | "study";

type WordState = { tries: number; hintsUsed: number; replays: number; startedAt: number; firstTyped: string | null };

/** One answered math problem, as shown on the results screen. */
export type MathResultItem = {
	key: string;
	prompt: string;
	answer: string;
	typed: string;
	correct: boolean;
	firstTry: boolean;
	explain: string;
	/** The problem as asked, so results can offer it again ("Practice these now"). Missing on older saved rounds. */
	problem?: Problem;
};

export type FinishedRound = {
	subject?: "spelling" | "math";
	/** Math rounds: the problems as asked (attempt `word`s are problem keys, not displayable). */
	items?: MathResultItem[];
	/** Math rounds: the topic, for "practice again". */
	mathMode?: string;
	sessionId: string;
	childId: string;
	listId: string | null;
	mode: Mode;
	attempts: AttemptInput[];
	/** Words in the round; more than `attempts.length` when the speller stopped early. */
	planned: number;
	summary: RoundSummary | null;
	/** Badges earned along the way (each saved answer can earn one), plus any from finishing. */
	newBadges: BadgeView[];
	queued: boolean;
	/**
	 * First answers for items that took two tries, by attempt `clientId`. Device-only: the attempt itself records
	 * the final answer, so without this the results would show the right answer as the "first try".
	 */
	firstTries?: Record<string, string>;
};

type RoundState = {
	sessionId: string;
	childId: string;
	listId: string | null;
	mode: Mode;
	/** List name, for the "Continue your round" card. */
	name: string;
	words: RoundWord[];
	index: number;
	typed: string;
	phase: Phase;
	grade: GradeResult | null;
	/** Letters revealed by the "show a letter" hint, from the start of the word. */
	revealed: number;
	current: WordState;
	attempts: AttemptInput[];
	/** First answers of words that took two tries, by attempt `clientId` (see FinishedRound.firstTries). */
	firstTries: Record<string, string>;
	startedAt: number;
	/** The server has the session row (sent once, on the first tap). */
	serverStarted: boolean;
	/** Round closed (finished or stopped); nothing left to resume. */
	finished: boolean;
	newBadges: BadgeView[];
	lastRound: FinishedRound | null;

	start(cfg: { childId: string; listId: string | null; mode: Mode; name: string; words: RoundWord[] }): void;
	/** Pick an interrupted round back up at the next unanswered word (after an app close or reload). */
	resume(): void;
	begin(): void;
	setTyped(value: string): void;
	check(): GradeResult | null;
	hint(): void;
	replay(): void;
	cover(): void;
	next(): "next" | "done";
	finishRound(r: FinishedRound): void;
};

const freshWord = (): WordState => ({ tries: 0, hintsUsed: 0, replays: 0, startedAt: Date.now(), firstTyped: null });

export const cleanTyped = (v: string) =>
	v
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/[^a-z'-]/g, "")
		.slice(0, 40);

/** localStorage can throw (private mode, storage full, blocked site data); a round must still work without it. */
export const safeStorage: StateStorage = {
	getItem: (k) => {
		try {
			return localStorage.getItem(k);
		} catch {
			return null;
		}
	},
	setItem: (k, v) => {
		try {
			localStorage.setItem(k, v);
		} catch {}
	},
	removeItem: (k) => {
		try {
			localStorage.removeItem(k);
		} catch {}
	},
};

export const useRound = create<RoundState>()(
	persist(
		(set, get) => ({
			sessionId: "",
			childId: "",
			listId: null,
			mode: "bee",
			words: [],
			index: 0,
			typed: "",
			phase: "ready",
			grade: null,
			revealed: 0,
			current: freshWord(),
			attempts: [],
			firstTries: {},
			startedAt: 0,
			serverStarted: false,
			finished: true,
			newBadges: [],
			lastRound: null,
			name: "",

			start: ({ childId, listId, mode, name, words }) =>
				set({
					sessionId: crypto.randomUUID(),
					childId,
					listId,
					mode,
					name,
					words,
					serverStarted: false,
					finished: false,
					newBadges: [],
					index: 0,
					typed: "",
					phase: "ready",
					grade: null,
					revealed: 0,
					current: freshWord(),
					attempts: [],
					firstTries: {},
					startedAt: Date.now(),
				}),

			resume: () =>
				set((s) => ({
					index: Math.min(Math.max(s.index, s.attempts.length), Math.max(s.words.length - 1, 0)),
					typed: "",
					phase: "ready",
					grade: null,
					revealed: 0,
					current: freshWord(),
				})),

			begin: () => set({ phase: get().mode === "learn" ? "study" : "spelling", current: freshWord() }),

			setTyped: (value) => {
				const { phase } = get();
				if (phase !== "spelling" && phase !== "retry") return;
				set({ typed: cleanTyped(value) });
			},

			check: () => {
				const s = get();
				const target = s.words[s.index];
				if (!target || (s.phase !== "spelling" && s.phase !== "retry") || s.typed.length === 0) return null;
				const grade = gradeAttempt(target.word, s.typed);
				const tries = s.current.tries + 1;
				const current = { ...s.current, tries, firstTyped: s.current.firstTyped ?? s.typed };
				// Learn mode is study: one look at the answer is enough; no second try.
				const maxTries = s.mode === "learn" ? 1 : 2;
				const phase: Phase = grade.correct ? "correct" : tries >= maxTries ? "reveal" : "retry";
				const done = phase === "correct" || phase === "reveal";
				const clientId = crypto.randomUUID();
				const attempts = done
					? [
							...s.attempts,
							{
								clientId,
								word: normalizeWord(target.word),
								typed: grade.correct ? s.typed : (current.firstTyped ?? s.typed),
								correct: grade.correct,
								tries,
								hintsUsed: current.hintsUsed,
								replays: current.replays,
								ms: Math.min(Date.now() - current.startedAt, 3_600_000),
							},
						]
					: s.attempts;
				const firstTries = done && tries > 1 && current.firstTyped ? { ...s.firstTries, [clientId]: current.firstTyped } : s.firstTries;
				set({ grade, phase, current, attempts, firstTries });
				return grade;
			},

			hint: () => {
				const s = get();
				const target = s.words[s.index];
				if (!target || (s.phase !== "spelling" && s.phase !== "retry")) return;
				const revealed = Math.min(s.revealed + 1, target.word.length - 1);
				set({
					revealed,
					typed: target.word.slice(0, revealed),
					current: { ...s.current, hintsUsed: s.current.hintsUsed + 1 },
				});
			},

			replay: () => set((s) => ({ current: { ...s.current, replays: s.current.replays + 1 } })),

			cover: () => set({ phase: "spelling", typed: "" }),

			next: () => {
				const s = get();
				if (s.index + 1 >= s.words.length) return "done";
				set({
					index: s.index + 1,
					typed: "",
					grade: null,
					revealed: 0,
					phase: s.mode === "learn" ? "study" : "spelling",
					current: freshWord(),
				});
				return "next";
			},

			finishRound: (r) => set({ lastRound: r, finished: true }),
		}),
		{
			name: "jade.round",
			version: 1,
			storage: createJSONStorage(() => safeStorage),
			// Enough to resume a round after the app is closed, and to show its results after a reload.
			partialize: (s) => ({
				sessionId: s.sessionId,
				childId: s.childId,
				listId: s.listId,
				mode: s.mode,
				name: s.name,
				words: s.words,
				index: s.index,
				attempts: s.attempts,
				firstTries: s.firstTries,
				startedAt: s.startedAt,
				serverStarted: s.serverStarted,
				finished: s.finished,
				newBadges: s.newBadges,
				lastRound: s.lastRound,
			}),
		},
	),
);

/** An unfinished round for this child worth offering to continue (started in the last day, with words left). */
export function resumableRound(childId: string) {
	const s = useRound.getState();
	const left = s.words.length - s.attempts.length;
	if (s.finished || s.childId !== childId || left <= 0 || s.attempts.length === 0 || Date.now() - s.startedAt > 86_400_000) return null;
	return { listId: s.listId, mode: s.mode, name: s.name, done: s.attempts.length, total: s.words.length, startedAt: s.startedAt };
}

export const wordStars = (a: AttemptInput) => starsForWord(a);

export function shuffle<T>(xs: T[], seed = Math.random()): T[] {
	const out = [...xs];
	let r = seed;
	for (let i = out.length - 1; i > 0; i--) {
		r = (r * 9301 + 49297) % 233280;
		const j = Math.floor((r / 233280) * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}
