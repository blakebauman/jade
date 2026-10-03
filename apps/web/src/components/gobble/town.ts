import { type Rng, seeded } from "@jade/core/math";
import { KINDS, type KindId } from "./kinds.ts";

/**
 * Gobble Town's map: an 84×84 square with roads round the edge and three each way inside, leaving a 4×4 grid of
 * 16×16 blocks. Every block has a job (a park, houses, the plaza with the clock tower, the school, the pet shop), and what
 * stands where is scattered from a seed, so each round's town is the same shape but never quite the same.
 * The road at the edge counts as part of the town; holes stay inside it.
 */

export const SIZE = 84;
export const ROAD = 4;
/** Where each road band starts (x or z); it's ROAD wide. */
export const ROADS = [0, 20, 40, 60, 80] as const;
/** The pavement along each side of a block, inside it. */
export const PAVEMENT = 1;

export type BlockKind = "park" | "houses" | "plaza" | "school" | "petshop" | "carpark";
export type Block = { kind: BlockKind; x0: number; z0: number; x1: number; z1: number };

/** The blocks, by column then row. The player starts in the park at the top left. */
const LAYOUT: BlockKind[][] = [
	["park", "houses", "petshop", "houses"],
	["houses", "plaza", "park", "houses"],
	["school", "houses", "houses", "park"],
	["houses", "carpark", "park", "houses"],
];

export const BLOCKS: Block[] = LAYOUT.flatMap((row, j) =>
	row.map((kind, i) => {
		const x0 = ROADS[i]! + ROAD;
		const z0 = ROADS[j]! + ROAD;
		return { kind, x0, z0, x1: x0 + 16, z1: z0 + 16 };
	}),
);

/** One thing standing in the town. `rot` turns it about y; `tint` picks its paint from the kind's colours. */
export type Placed = { kind: KindId; x: number; z: number; rot: number; tint: number };

/** Where the player starts: on the path into the first park, among the flowers. */
export const PLAYER_START = { x: 8, z: 12 };

/** A flower bed or play corner inside a block: a rectangle things are scattered across. */
type Area = { x0: number; z0: number; x1: number; z1: number };

class Planner {
	readonly placed: Placed[] = [];
	constructor(readonly rng: Rng) {}
	/** Ground kept clear: where the player's hole starts, so it isn't under a tree. */
	readonly clear = [{ ...PLAYER_START, r: 0.8 }];

	/** Whether a thing of radius `r` at (x, z) would overlap anything already placed (with a little space between). */
	free(x: number, z: number, r: number, gap = 0.12) {
		for (const c of this.clear) if (Math.hypot(c.x - x, c.z - z) < c.r + r) return false;
		for (const p of this.placed) {
			const min = KINDS[p.kind].r + r + gap;
			const dx = p.x - x;
			const dz = p.z - z;
			if (dx * dx + dz * dz < min * min) return false;
		}
		return true;
	}

	/** Stands a thing at (x, z), unless something is already in the way. */
	put(kind: KindId, x: number, z: number, rot = 0) {
		if (!this.free(x, z, KINDS[kind].r, 0.05)) return;
		const tints = KINDS[kind].tint?.length ?? 1;
		this.placed.push({ kind, x, z, rot, tint: Math.floor(this.rng() * tints) });
	}

	/** Up to `n` of a kind scattered across an area, wherever they fit; returns how many went in. */
	scatter(kind: KindId, n: number, a: Area, opts: { rot?: () => number; gap?: number } = {}) {
		const r = KINDS[kind].r;
		let done = 0;
		for (let tries = 0; done < n && tries < n * 30; tries++) {
			const x = a.x0 + r + this.rng() * (a.x1 - a.x0 - 2 * r);
			const z = a.z0 + r + this.rng() * (a.z1 - a.z0 - 2 * r);
			if (!this.free(x, z, r, opts.gap)) continue;
			this.put(kind, x, z, opts.rot ? opts.rot() : this.rng() * Math.PI * 2);
			done++;
		}
		return done;
	}

	/** A tight bed of flowers round (x, z). */
	bed(x: number, z: number, n: number, spread = 1.1) {
		this.scatter("flower", n, { x0: x - spread, z0: z - spread, x1: x + spread, z1: z + spread }, { gap: 0.04 });
	}
}

const inset = (b: Area, d: number): Area => ({ x0: b.x0 + d, z0: b.z0 + d, x1: b.x1 - d, z1: b.z1 - d });
/** Facing a point: the angle about y that turns +x (a thing's front) toward (tx, tz). */
const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tz - z), tx - x);

function park(p: Planner, b: Block, big: boolean) {
	const cx = (b.x0 + b.x1) / 2;
	const cz = (b.z0 + b.z1) / 2;
	if (big) {
		p.put("fountain", cx, cz);
		p.put("slide", b.x1 - 4, b.z1 - 4, Math.PI * 0.75);
	} else {
		p.put("slide", cx + 3, cz - 3, -Math.PI / 4);
	}
	// Benches round the middle, looking in.
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		const x = cx + Math.cos(a) * 3.6;
		const z = cz + Math.sin(a) * 3.6;
		p.put("bench", x, z, facing(x, z, cx, cz));
	}
	for (const [dx, dz] of [
		[-4.5, -4.5],
		[4.5, 4.5],
		[-4.5, 4],
		[3.5, -5],
	] as const)
		p.bed(cx + dx, cz + dz, 9);
	p.scatter("tree", big ? 7 : 9, inset(b, PAVEMENT + 0.4));
	p.scatter("bush", 7, inset(b, PAVEMENT + 0.2));
	p.scatter("ball", 4, inset(b, 3));
	p.scatter("bin", 2, inset(b, PAVEMENT + 0.3));
	p.scatter("flower", 14, inset(b, PAVEMENT + 0.2), { gap: 0.05 });
}

function houses(p: Planner, b: Block) {
	// Four houses in a square, each facing the road nearest it, with a garden in front.
	for (const [qx, qz] of [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	] as const) {
		const x = b.x0 + 4.4 + qx * 7.2;
		const z = b.z0 + 4.4 + qz * 7.2;
		const tx = qx ? b.x1 + 2 : b.x0 - 2;
		const tz = qz ? b.z1 + 2 : b.z0 - 2;
		// Face whichever road is closer along the diagonal: front or side.
		const toFront = p.rng() < 0.5;
		p.put("cottage", x, z, toFront ? facing(x, z, x, tz) : facing(x, z, tx, z));
		p.bed(x + (qx ? 2.6 : -2.6), z + (qz ? 2.6 : -2.6), 4, 0.6);
	}
	p.scatter("bush", 6, inset(b, PAVEMENT + 0.2));
	p.scatter("tree", 3, inset(b, PAVEMENT + 0.4));
	p.scatter("bin", 4, inset(b, PAVEMENT + 0.2));
	p.scatter("postbox", 1, inset(b, PAVEMENT + 0.2));
	p.scatter("ball", 2, inset(b, PAVEMENT + 0.5));
	p.scatter("flower", 12, inset(b, PAVEMENT), { gap: 0.05 });
}

function plaza(p: Planner, b: Block) {
	const cx = (b.x0 + b.x1) / 2;
	const cz = (b.z0 + b.z1) / 2;
	p.put("tower", cx, cz);
	p.put("fountain", b.x0 + 3.2, b.z1 - 3.2);
	p.put("fountain", b.x1 - 3.2, b.z0 + 3.2);
	p.put("kiosk", b.x0 + 3, b.z0 + 3, Math.PI / 4);
	p.put("kiosk", b.x1 - 3, b.z1 - 3, (-3 * Math.PI) / 4);
	for (const [x, z] of [
		[cx, b.z0 + 2],
		[cx, b.z1 - 2],
		[b.x0 + 2, cz],
		[b.x1 - 2, cz],
	] as const)
		p.put("bench", x, z, facing(x, z, cx, cz));
	for (const [x, z] of [
		[b.x0 + 2, b.z0 + 7],
		[b.x1 - 2, b.z1 - 7],
		[b.x0 + 5.5, b.z1 - 2],
		[b.x1 - 5.5, b.z0 + 2],
	] as const)
		p.put("lamp", x, z);
	p.scatter("flower", 22, inset(b, PAVEMENT), { gap: 0.05 });
	p.scatter("ball", 3, inset(b, PAVEMENT + 1));
	p.scatter("bin", 3, inset(b, PAVEMENT + 0.2));
}

function school(p: Planner, b: Block) {
	p.put("school", b.x0 + 5.2, b.z0 + 5.2, facing(0, 0, 1, 0));
	p.put("slide", b.x1 - 3.4, b.z0 + 3.6, Math.PI / 2);
	// The playground: balls and cones for games.
	const yard = { x0: b.x0 + 8.5, z0: b.z0 + 8, x1: b.x1 - 1.5, z1: b.z1 - 1.5 };
	p.scatter("ball", 8, yard);
	p.scatter("cone", 8, yard);
	p.scatter("bench", 2, { x0: b.x0 + 1.5, z0: b.z1 - 4, x1: b.x0 + 8, z1: b.z1 - 1.5 }, { rot: () => 0 });
	p.scatter("tree", 4, inset(b, PAVEMENT + 0.4));
	p.scatter("bush", 4, inset(b, PAVEMENT + 0.2));
	p.scatter("bin", 2, inset(b, PAVEMENT + 0.2));
	p.scatter("flower", 14, inset(b, PAVEMENT), { gap: 0.05 });
}

function petshop(p: Planner, b: Block) {
	p.put("petshop", b.x0 + 5.5, b.z1 - 5.5, facing(0, 0, 0, 1));
	p.put("kiosk", b.x1 - 3, b.z1 - 3);
	// A little car park in the corner.
	for (let i = 0; i < 3; i++) p.put("car", b.x1 - 2.4, b.z0 + 2.4 + i * 2.3, 0);
	p.scatter("tree", 4, inset(b, PAVEMENT + 0.4));
	p.scatter("bush", 5, inset(b, PAVEMENT + 0.2));
	p.scatter("bench", 2, inset(b, PAVEMENT + 0.5));
	p.scatter("bin", 3, inset(b, PAVEMENT + 0.2));
	p.scatter("postbox", 1, inset(b, PAVEMENT + 0.2));
	p.scatter("flower", 16, inset(b, PAVEMENT), { gap: 0.05 });
}

function carpark(p: Planner, b: Block) {
	// Rows of parked cars with a bus bay, trees between, and a kiosk by the gate.
	for (let row = 0; row < 3; row++)
		for (let i = 0; i < 6; i++) {
			const x = b.x0 + 2.2 + i * 2.1;
			const z = b.z0 + 3 + row * 4.6;
			if (p.rng() < 0.8) p.put("car", x, z, row % 2 ? Math.PI / 2 : -Math.PI / 2);
		}
	for (let i = 0; i < 2; i++) p.put("bus", b.x1 - 2.4, b.z0 + 4 + i * 4.2, Math.PI / 2);
	p.put("kiosk", b.x1 - 2.6, b.z1 - 2.6);
	p.scatter("cone", 6, inset(b, PAVEMENT));
	p.scatter("tree", 3, inset(b, PAVEMENT + 0.4));
	p.scatter("bin", 3, inset(b, PAVEMENT + 0.2));
	p.scatter("sign", 2, inset(b, PAVEMENT + 0.2));
	p.scatter("flower", 10, inset(b, PAVEMENT), { gap: 0.05 });
}

/** The roads: parked cars and buses along the kerbs, lamp posts and hydrants on the corners, a few roadworks. */
function streets(p: Planner) {
	const rng = p.rng;
	for (const along of ["x", "z"] as const) {
		for (const band of ROADS) {
			// A parked lane on one side of each road; cars face along it.
			const lane = band + (band === 0 || band === SIZE - ROAD ? 2 : rng() < 0.5 ? 1.3 : 2.7);
			for (let t = 6; t < SIZE - 6; t += 3.2 + rng() * 4) {
				if (ROADS.some((r) => t > r - 1.5 && t < r + ROAD + 1.5)) continue;
				const kind: KindId = rng() < 0.15 ? "bus" : "car";
				const [x, z] = along === "x" ? [t, lane] : [lane, t];
				const rot = along === "x" ? (rng() < 0.5 ? 0 : Math.PI) : rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
				p.put(kind, x, z, rot);
				if (kind === "bus") t += 2;
			}
		}
	}
	// Lamp posts on the pavement corners of every block, hydrants and signs here and there.
	for (const b of BLOCKS) {
		for (const [x, z] of [
			[b.x0 + 0.5, b.z0 + 0.5],
			[b.x1 - 0.5, b.z1 - 0.5],
			[b.x0 + 0.5, b.z1 - 0.5],
			[b.x1 - 0.5, b.z0 + 0.5],
		] as const)
			p.put("lamp", x, z, rng() * Math.PI * 2);
		const mid = (b.x0 + b.x1) / 2;
		p.put("hydrant", mid + (rng() - 0.5) * 6, b.z0 + 0.5, 0);
		if (rng() < 0.5) p.put("sign", b.x0 + 0.5, (b.z0 + b.z1) / 2, Math.PI / 2);
		else p.put("sign", b.x1 - 0.5, (b.z0 + b.z1) / 2, -Math.PI / 2);
	}
	// Roadworks: a few rows of cones across the inner roads.
	for (let i = 0; i < 6; i++) {
		const band = ROADS[1 + Math.floor(rng() * (ROADS.length - 2))]!;
		const t = 6 + rng() * (SIZE - 12);
		if (ROADS.some((r) => t > r - 1 && t < r + ROAD + 1)) continue;
		const horizontal = rng() < 0.5;
		for (let k = 0; k < 4; k++) {
			const x = horizontal ? t + k * 0.6 : band + 0.6 + k * 0.9;
			const z = horizontal ? band + 0.6 + k * 0.9 : t + k * 0.6;
			p.put("cone", x, z, 0);
		}
	}
}

/** The town for one round. The same seed always gives the same town. */
export function buildTown(seed: number): Placed[] {
	const p = new Planner(seeded(seed));
	// Big things first, so the scatter fills in round them.
	let parks = 0;
	for (const b of BLOCKS) {
		if (b.kind === "plaza") plaza(p, b);
		else if (b.kind === "school") school(p, b);
		else if (b.kind === "petshop") petshop(p, b);
		else if (b.kind === "houses") houses(p, b);
		else if (b.kind === "carpark") carpark(p, b);
		else park(p, b, parks++ > 0);
	}
	streets(p);
	// The player's first few seconds: a sweep of small things right where they start.
	const s = PLAYER_START;
	p.scatter("flower", 12, { x0: s.x - 2.5, z0: s.z - 2.5, x1: s.x + 2.5, z1: s.z + 2.5 }, { gap: 0.04 });
	p.scatter("cone", 3, { x0: s.x - 3, z0: s.z - 3, x1: s.x + 3, z1: s.z + 3 });
	return p.placed;
}
