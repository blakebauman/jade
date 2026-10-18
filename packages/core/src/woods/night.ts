import { seeded } from "../math/rng.ts";
import { B, isPlant } from "./blocks.ts";
import { CAMP, groundAt } from "./terrain.ts";
import { D, SEA, type Volume, W } from "./volume.ts";

/**
 * What happens at night: animals lose their way in the woods, and the Night Deer circles the camp. Both are gentle.
 * Lost animals follow whoever finds them; the deer only ever snuffs torches, and only when the fire is low.
 */

export const ANIMALS = ["bunny", "fox", "owl", "lamb", "hedgehog", "duckling"] as const;
export type Animal = (typeof ANIMALS)[number];

export const ANIMAL_LABEL: Record<Animal, string> = {
	bunny: "bunny",
	fox: "fox cub",
	owl: "owlet",
	lamb: "lamb",
	hedgehog: "hedgehog",
	duckling: "duckling",
};

export type Lost = { id: string; animal: Animal; at: [number, number, number] };

export const LOST_PER_NIGHT = 3;
/** How close a figure has to be to a lost animal to pick it up, or to the fire to feed it. */
export const REACH_ANIMAL = 2.5;
export const REACH_FIRE = 3.5;

/**
 * The columns a figure can walk to from the camp without building: dry ground, steps of one block at most (a hop).
 * Trees block the way. Edits count, so a hill dug through opens up.
 */
export function walkable(v: Volume): Uint8Array {
	const ground = new Int16Array(W * D);
	for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) ground[x + W * z] = groundAt(v, x, z);
	const seen = new Uint8Array(W * D);
	const start = CAMP.x + W * (CAMP.z + 3);
	if (ground[start]! < SEA) return seen;
	const queue = [start];
	seen[start] = 1;
	while (queue.length) {
		const i = queue.pop()!;
		const x = i % W;
		const z = Math.floor(i / W);
		for (const [nx, nz] of [
			[x + 1, z],
			[x - 1, z],
			[x, z + 1],
			[x, z - 1],
		] as const) {
			if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
			const j = nx + W * nz;
			if (seen[j]) continue;
			const g = ground[j]!;
			if (g < SEA || Math.abs(g - ground[i]!) > 1) continue;
			// Two cubes of room to stand in.
			const above = v.get(nx, g + 1, nz);
			if (above !== B.air && above !== B.torch && !isPlant(above)) continue;
			if (v.get(nx, g + 2, nz) !== B.air && !isPlant(v.get(nx, g + 2, nz))) continue;
			seen[j] = 1;
			queue.push(j);
		}
	}
	return seen;
}

/** Tonight's lost animals: deep in the woods, somewhere a kid can walk to, never two in the same spot. */
export function lostAnimals(v: Volume, seed: number, night: number): Lost[] {
	const rng = seeded((seed ^ Math.imul(night, 0x9e3779b1)) >>> 0);
	const can = walkable(v);
	const spots: number[] = [];
	for (let i = 0; i < can.length; i++) {
		if (!can[i]) continue;
		const d = Math.hypot((i % W) + 0.5 - CAMP.x, Math.floor(i / W) + 0.5 - CAMP.z);
		if (d >= 16 && d <= 40) spots.push(i);
	}
	const out: Lost[] = [];
	for (let k = 0; k < LOST_PER_NIGHT && spots.length; k++) {
		const at = spots.splice(Math.floor(rng() * spots.length), 1)[0]!;
		const x = at % W;
		const z = Math.floor(at / W);
		const animal = ANIMALS[Math.floor(rng() * ANIMALS.length)]!;
		out.push({ id: `n${night}-${k}`, animal, at: [x + 0.5, groundAt(v, x, z) + 1, z + 0.5] });
		// Keep the next one away from this one.
		for (let s = spots.length - 1; s >= 0; s--) {
			const o = spots[s]!;
			if (Math.hypot((o % W) - x, Math.floor(o / W) - z) < 10) spots.splice(s, 1);
		}
	}
	return out;
}

/**
 * Where the Night Deer is, `t` seconds into a night: circling beyond the firelight, closer as `near` goes from 0 (the
 * fire is high) to 1 (the fire is low). The same on every screen, so it's never sent.
 */
export function deerAt(seed: number, night: number, t: number, near: number): { x: number; z: number; heading: number } {
	const start = seeded((seed ^ Math.imul(night, 0x85ebca6b)) >>> 0)() * Math.PI * 2;
	const speed = 0.045;
	const a = start + t * speed;
	const r = 28 - 16 * Math.min(1, Math.max(0, near)) + 2.5 * Math.sin(t * 0.21);
	return { x: CAMP.x + Math.cos(a) * r, z: CAMP.z + Math.sin(a) * r, heading: a + Math.PI / 2 };
}

/** Seconds between the deer snuffing torches while the fire is low. */
export const SNUFF_EVERY_S = 20;
/** Torches the deer can reach: those within this many blocks of the fire. */
export const SNUFF_RANGE = 14;
