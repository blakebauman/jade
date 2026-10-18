import { B, inBounds, indexOf, REACH, type Volume } from "@jade/core/woods";
import type { Vec3 } from "./physics.ts";

export type Hit = {
	cell: Vec3;
	i: number;
	block: number;
	/** The face hit, pointing out of the block: where a new block goes. */
	normal: Vec3;
};

/**
 * The block a ray from `from` along `dir` hits first, stepping cell by cell (so it never skips a corner). Air and
 * water are looked through. Null past `reach`.
 */
export function raycast(vol: Volume, from: Vec3, dir: Vec3, reach = REACH): Hit | null {
	const len = Math.hypot(dir[0], dir[1], dir[2]);
	if (len === 0) return null;
	const d: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
	const cell: Vec3 = [Math.floor(from[0]), Math.floor(from[1]), Math.floor(from[2])];
	const stepOf = (k: number) => (d[k]! > 0 ? 1 : d[k]! < 0 ? -1 : 0);
	const step: Vec3 = [stepOf(0), stepOf(1), stepOf(2)];
	const delta: Vec3 = [Math.abs(1 / d[0]), Math.abs(1 / d[1]), Math.abs(1 / d[2])];
	const next: Vec3 = [0, 0, 0];
	for (let k = 0; k < 3; k++) {
		const edge = step[k]! > 0 ? cell[k]! + 1 - from[k]! : from[k]! - cell[k]!;
		next[k] = step[k] === 0 ? Number.POSITIVE_INFINITY : edge * delta[k]!;
	}
	const normal: Vec3 = [0, 0, 0];
	let t = 0;
	while (t <= reach) {
		const b = vol.get(cell[0], cell[1], cell[2]);
		if (b !== B.air && b !== B.water && inBounds(cell[0], cell[1], cell[2]))
			return { cell: [...cell], i: indexOf(cell[0], cell[1], cell[2]), block: b, normal: [...normal] };
		const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : next[1] < next[2] ? 1 : 2;
		t = next[k]!;
		next[k] += delta[k]!;
		cell[k] += step[k]!;
		normal[0] = normal[1] = normal[2] = 0;
		normal[k] = -step[k]!;
	}
	return null;
}
