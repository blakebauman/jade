/**
 * Leitner spaced repetition. Five boxes; a correct answer promotes one box, a miss sends the word back to box 1.
 * A word is "due" once `dueAt` has passed. Box 1 is due immediately so misses come back in the next review round;
 * a new word spelled right starts in box 2 (tomorrow), so it doesn't land in review the moment it was learned.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length;
const DAY_MS = 86_400_000;

export type WordProgress = { word: string; box: number; dueAt: number; streak: number; lastSeen: number };

export function applyAnswer(prev: WordProgress | undefined, word: string, correct: boolean, now: number): WordProgress {
	const box = correct ? Math.min((prev?.box ?? 1) + 1, MAX_BOX) : 1;
	const interval = BOX_INTERVAL_DAYS[box - 1] ?? 0;
	return {
		word,
		box,
		dueAt: now + interval * DAY_MS,
		streak: correct ? (prev?.streak ?? 0) + 1 : 0,
		lastSeen: now,
	};
}

/** Due words, most-struggled first (lowest box, then longest overdue). */
export function buildReviewRound(progress: WordProgress[], now: number, limit = 10): string[] {
	return progress
		.filter((p) => p.dueAt <= now && p.box < MAX_BOX)
		.sort((a, b) => a.box - b.box || a.dueAt - b.dueAt)
		.slice(0, limit)
		.map((p) => p.word);
}
