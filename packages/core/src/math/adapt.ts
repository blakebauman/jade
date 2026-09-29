/** One answered problem, oldest first in a history. `ms` is time to the first check. */
export type SkillResult = { correct: boolean; tries: number; ms: number; level: number };

/** How quickly a fluent 8–11 year old answers, per skill. Speed only ever nudges levels; kids never see a timer. */
export const FLUENT_MS: Record<string, number> = {
	mul: 5000,
	div: 6000,
	addsub: 8000,
	mixed: 12000,
	fractions: 15000,
	decimals: 15000,
	problems: 30000,
};

/**
 * Next level for a skill from recent answers at the current level:
 * up after 5 of the last 6 right first time (and mostly fluent), down after 2 misses in the last 4.
 */
export function adaptLevel(level: number, history: SkillResult[], skill: string): number {
	const at = history.filter((h) => h.level === level);
	const last4 = at.slice(-4);
	const misses = last4.filter((h) => !h.correct || h.tries > 1).length;
	if (misses >= 2) return Math.max(1, level - 1);
	const last6 = at.slice(-6);
	if (last6.length >= 6) {
		const firstTry = last6.filter((h) => h.correct && h.tries === 1);
		const fluent = firstTry.filter((h) => h.ms <= (FLUENT_MS[skill] ?? 15000)).length;
		if (firstTry.length >= 5 && fluent >= 4) return Math.min(5, level + 1);
	}
	return level;
}
