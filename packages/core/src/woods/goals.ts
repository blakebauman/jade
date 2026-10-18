/**
 * Goals pay tickets once each, ever (the key is `woods:<id>`, and the server pays a key once). They're counted per kid
 * on whichever island they play.
 */

export type WoodsStats = { logs: number; gems: number; placed: number; rescued: number; nights: number };
export const NO_STATS: WoodsStats = { logs: 0, gems: 0, placed: 0, rescued: 0, nights: 0 };

export type Goal = { id: string; label: string; tickets: number; stat: keyof WoodsStats; need: number };

export const GOALS: readonly Goal[] = [
	{ id: "first-log", label: "Your first log", tickets: 5, stat: "logs", need: 1 },
	{ id: "placed-100", label: "100 blocks built", tickets: 10, stat: "placed", need: 100 },
	{ id: "first-gem", label: "Your first gem", tickets: 10, stat: "gems", need: 1 },
	{ id: "rescue-1", label: "Brought a lost animal home", tickets: 5, stat: "rescued", need: 1 },
	{ id: "rescue-10", label: "10 animals brought home", tickets: 15, stat: "rescued", need: 10 },
	{ id: "night-1", label: "Your first night by the fire", tickets: 5, stat: "nights", need: 1 },
	{ id: "night-5", label: "5 nights by the fire", tickets: 10, stat: "nights", need: 5 },
	{ id: "night-10", label: "10 nights by the fire", tickets: 15, stat: "nights", need: 10 },
	{ id: "night-25", label: "25 nights by the fire", tickets: 20, stat: "nights", need: 25 },
	{ id: "night-50", label: "50 nights by the fire", tickets: 25, stat: "nights", need: 50 },
	{ id: "night-99", label: "99 nights by the fire", tickets: 30, stat: "nights", need: 99 },
];

/** Goals newly met going from `before` to `after`. */
export const goalsMet = (before: WoodsStats, after: WoodsStats): Goal[] =>
	GOALS.filter((g) => before[g.stat] < g.need && after[g.stat] >= g.need);

export const goalKey = (g: Goal) => `woods:${g.id}`;
