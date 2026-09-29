/**
 * Daily practice streaks, counted in the family's local calendar days. `dayKey` is "YYYY-MM-DD" in that timezone,
 * computed on the client (which knows the zone) and sent with the finished session.
 */
export type StreakState = { current: number; best: number; lastDay: string | null };

export function dayKeyFor(date: Date, timeZone?: string): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function advanceStreak(prev: StreakState, today: string): StreakState {
	if (prev.lastDay === today) return prev;
	const gap = prev.lastDay ? daysBetween(prev.lastDay, today) : Number.POSITIVE_INFINITY;
	// A clock skew backwards should never reset a streak.
	if (gap < 0) return prev;
	const current = gap === 1 ? prev.current + 1 : 1;
	return { current, best: Math.max(prev.best, current), lastDay: today };
}

/** `icon` is a lucide icon name; the web app maps it to a component. */
export type Badge = { id: string; label: string; icon: string };

export type BadgeStats = {
	streak: number;
	totalStars: number;
	perfectRounds: number;
	words: number;
	/** Math: times-table/division facts at Leitner box 4+, and the fractions skill level. */
	factsMastered?: number;
	fractionsLevel?: number;
};

export const BADGES: (Badge & { earned: (s: BadgeStats) => boolean })[] = [
	{ id: "first-round", label: "First round!", icon: "sprout", earned: (s) => s.words > 0 },
	{ id: "perfect", label: "Perfect round", icon: "sparkles", earned: (s) => s.perfectRounds >= 1 },
	{ id: "streak-3", label: "3-day streak", icon: "flame", earned: (s) => s.streak >= 3 },
	{ id: "streak-7", label: "Week of practice", icon: "medal", earned: (s) => s.streak >= 7 },
	{ id: "stars-50", label: "50 stars", icon: "star", earned: (s) => s.totalStars >= 50 },
	{ id: "stars-250", label: "Star collector", icon: "trophy", earned: (s) => s.totalStars >= 250 },
	{ id: "words-100", label: "100 right answers", icon: "library", earned: (s) => s.words >= 100 },
	{ id: "facts-30", label: "Times-table star", icon: "grid", earned: (s) => (s.factsMastered ?? 0) >= 30 },
	{ id: "fractions-3", label: "Fraction friend", icon: "pie", earned: (s) => (s.fractionsLevel ?? 0) >= 3 },
];
