import type { Spot } from "./stage.tsx";

/** Something Roxy can do when she's beside it: pick up a find, or use a hotspot (read the chalkboard…). */
export type Target = { kind: "find" | "hotspot"; id: string; stand: Spot };

/** How close she has to be to where you'd stand to use it. */
export const REACH = 1.1;

/** The closest target within reach of where Roxy is, or null. */
export function nearest(at: Spot, targets: readonly Target[], reach = REACH): Target | null {
	let best: Target | null = null;
	let bestD = reach;
	for (const t of targets) {
		const d = Math.hypot(t.stand.x - at.x, t.stand.z - at.z);
		if (d <= bestD) {
			bestD = d;
			best = t;
		}
	}
	return best;
}
