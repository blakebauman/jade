import type { Area, Spot } from "./stage.tsx";

/**
 * Walking round things. A place lists what's in the way as blocks on the floor; Roxy's route is found on a fine grid
 * over the area (A*, eight ways), then straightened so she walks in long lines rather than grid steps.
 */

/** Something in the way: a box from (x0, z0) to (x1, z1), or a round thing. */
export type Block = { x0: number; z0: number; x1: number; z1: number } | { cx: number; cz: number; r: number };

/** How much room Roxy takes up, kept clear round every block. */
const BODY = 0.3;
/** Grid squares per area square. */
const FINE = 4;
/** How far in from the edge she can go (the edge of the ground, or the back wall). */
const EDGE = { x0: 0.4, z0: 0.5, x1: 0.4, z1: 0.3 };

export type Grid = { area: Area; cols: number; rows: number; blocked: Uint8Array };

const inBlock = (b: Block, x: number, z: number, pad: number) =>
	"r" in b ? (x - b.cx) ** 2 + (z - b.cz) ** 2 < (b.r + pad) ** 2 : x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

export function makeGrid(area: Area, blocks: readonly Block[]): Grid {
	const cols = Math.round(area.w * FINE);
	const rows = Math.round(area.d * FINE);
	const blocked = new Uint8Array(cols * rows);
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const x = (c + 0.5) / FINE;
			const z = (r + 0.5) / FINE;
			const out = x < EDGE.x0 || z < EDGE.z0 || x > area.w - EDGE.x1 || z > area.d - EDGE.z1;
			if (out || blocks.some((b) => inBlock(b, x, z, BODY))) blocked[r * cols + c] = 1;
		}
	return { area, cols, rows, blocked };
}

const cellOf = (g: Grid, s: Spot) => ({
	c: Math.min(g.cols - 1, Math.max(0, Math.floor(s.x * FINE))),
	r: Math.min(g.rows - 1, Math.max(0, Math.floor(s.z * FINE))),
});
const centreOf = (c: number, r: number): Spot => ({ x: (c + 0.5) / FINE, z: (r + 0.5) / FINE });
const free = (g: Grid, c: number, r: number) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];

/** The nearest spot Roxy can stand on: the spot itself when it's clear. */
export function nearestFree(g: Grid, s: Spot): Spot {
	const { c, r } = cellOf(g, s);
	if (free(g, c, r))
		return { x: Math.min(g.area.w - EDGE.x1, Math.max(EDGE.x0, s.x)), z: Math.min(g.area.d - EDGE.z1, Math.max(EDGE.z0, s.z)) };
	let best: Spot | null = null;
	let bestD = Number.POSITIVE_INFINITY;
	for (let rr = 0; rr < g.rows; rr++)
		for (let cc = 0; cc < g.cols; cc++) {
			if (!free(g, cc, rr)) continue;
			const p = centreOf(cc, rr);
			const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
			if (d < bestD) {
				bestD = d;
				best = p;
			}
		}
	return best ?? s;
}

/** Whether a straight walk from a to b stays clear (sampled every quarter of a fine square). */
function clearLine(g: Grid, a: Spot, b: Spot) {
	const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * FINE * 4);
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		const { c, r } = cellOf(g, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
		if (!free(g, c, r)) return false;
	}
	return true;
}

/**
 * The waypoints from `from` to `to` (the last one is where she stops: `to`, or the nearest clear spot to it).
 * Empty when there is no way there; a straight walk needs one waypoint.
 */
export function findPath(g: Grid, from: Spot, to: Spot): Spot[] {
	const goal = nearestFree(g, to);
	if (clearLine(g, from, goal)) return [goal];
	// Start from the nearest clear square if she's somehow standing in something (a piece was just placed on her).
	const s = cellOf(g, nearestFree(g, from));
	const e = cellOf(g, goal);
	const n = g.cols * g.rows;
	const cost = new Float32Array(n).fill(Number.POSITIVE_INFINITY);
	const prev = new Int32Array(n).fill(-1);
	const done = new Uint8Array(n);
	const start = s.r * g.cols + s.c;
	const end = e.r * g.cols + e.c;
	cost[start] = 0;
	// The grids are small (a few thousand squares), so a plain array works as the open list.
	const open: number[] = [start];
	const h = (i: number) => Math.hypot((i % g.cols) - e.c, Math.floor(i / g.cols) - e.r);
	while (open.length) {
		let k = 0;
		for (let j = 1; j < open.length; j++) if (cost[open[j]!]! + h(open[j]!) < cost[open[k]!]! + h(open[k]!)) k = j;
		const i = open.splice(k, 1)[0]!;
		if (i === end) break;
		if (done[i]) continue;
		done[i] = 1;
		const c = i % g.cols;
		const r = Math.floor(i / g.cols);
		for (let dr = -1; dr <= 1; dr++)
			for (let dc = -1; dc <= 1; dc++) {
				if (!dc && !dr) continue;
				const nc = c + dc;
				const nr = r + dr;
				if (!free(g, nc, nr)) continue;
				// No cutting corners past a block.
				if (dc && dr && (!free(g, c + dc, r) || !free(g, c, r + dr))) continue;
				const j = nr * g.cols + nc;
				const step = dc && dr ? Math.SQRT2 : 1;
				if (cost[i]! + step < cost[j]!) {
					cost[j] = cost[i]! + step;
					prev[j] = i;
					open.push(j);
				}
			}
	}
	if (prev[end] === -1 && start !== end) return [];
	const cells: Spot[] = [];
	for (let i = end; i !== -1 && i !== start; i = prev[i]!) cells.unshift(centreOf(i % g.cols, Math.floor(i / g.cols)));
	cells[cells.length - 1] = goal;
	// Straighten: from each point, go to the furthest waypoint she can see.
	const out: Spot[] = [];
	let at = from;
	let i = 0;
	while (i < cells.length) {
		let far = i;
		for (let j = cells.length - 1; j > i; j--)
			if (clearLine(g, at, cells[j]!)) {
				far = j;
				break;
			}
		out.push(cells[far]!);
		at = cells[far]!;
		i = far + 1;
	}
	return out;
}
