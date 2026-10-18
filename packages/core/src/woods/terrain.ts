import { type Rng, seeded } from "../math/rng.ts";
import { B } from "./blocks.ts";
import { D, H, SEA, Volume, W } from "./volume.ts";

/**
 * The island, made from a seed: a camp clearing in the middle, a ring of forest round it, hills further out, then
 * beach and sea. Stone and ores underneath, bedrock at the floor. The same seed always makes the same island, so the
 * server stores only what kids have changed.
 */

/** The campfire, in the middle of the clearing. */
export const CAMP = { x: W / 2, z: D / 2 } as const;
/** The clearing round the fire: no trees, flat ground. */
export const CLEARING = 8;

export type Island = {
	volume: Volume;
	seed: number;
	/** The cell the fire burns in (air, never built on). */
	fire: [number, number, number];
};

function hash2(seed: number, x: number, z: number) {
	let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

function noise(seed: number, x: number, z: number) {
	const x0 = Math.floor(x);
	const z0 = Math.floor(z);
	const fx = smooth(x - x0);
	const fz = smooth(z - z0);
	const a = hash2(seed, x0, z0);
	const b = hash2(seed, x0 + 1, z0);
	const c = hash2(seed, x0, z0 + 1);
	const d = hash2(seed, x0 + 1, z0 + 1);
	return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(seed: number, x: number, z: number) {
	return noise(seed, x / 22, z / 22) * 0.6 + noise(seed + 1, x / 11, z / 11) * 0.3 + noise(seed + 2, x / 5, z / 5) * 0.1;
}

/** Distance from the camp, as a share of the way to the island's edge. */
const fromCamp = (x: number, z: number) => Math.hypot(x + 0.5 - CAMP.x, z + 0.5 - CAMP.z);

function rawHeight(seed: number, x: number, z: number) {
	const d = fromCamp(x, z) / (W / 2 - 2);
	const land = 1 - smoothstep(0.66, 1, d);
	const hills = smoothstep(0.3, 0.6, d) * (1 - smoothstep(0.66, 0.86, d)) * 9 * noise(seed + 7, x / 14, z / 14);
	return SEA - 6 + land * (9 + 10 * fbm(seed, x, z) + hills);
}

/** The top solid block of each column, before anything is built or dug. */
export function heights(seed: number): Int16Array {
	const out = new Int16Array(W * D);
	const camp = Math.max(SEA + 3, Math.round(rawHeight(seed, CAMP.x, CAMP.z)));
	for (let z = 0; z < D; z++) {
		for (let x = 0; x < W; x++) {
			const flat = smoothstep(CLEARING, CLEARING + 5, fromCamp(x, z));
			out[x + W * z] = Math.round(camp + (rawHeight(seed, x, z) - camp) * flat);
		}
	}
	return out;
}

export function generate(seed: number): Island {
	const v = new Volume();
	const hs = heights(seed);
	const rng = seeded(seed ^ 0x5eed);
	for (let z = 0; z < D; z++) {
		for (let x = 0; x < W; x++) {
			const h = hs[x + W * z]!;
			const beach = h <= SEA + 1;
			for (let y = 0; y < H; y++) {
				let b: number = B.air;
				if (y === 0) b = B.bedrock;
				else if (y < h - 3) b = B.stone;
				else if (y < h) b = beach ? B.sand : B.dirt;
				else if (y === h) b = beach ? B.sand : B.grass;
				else if (y <= SEA) b = B.water;
				if (b !== B.air) v.set(x, y, z, b);
			}
		}
	}
	ores(v, hs, rng);
	trees(v, hs, rng);
	const fireY = hs[CAMP.x + W * CAMP.z]! + 1;
	return { volume: v, seed, fire: [CAMP.x, fireY, CAMP.z] };
}

const VEINS: readonly { block: number; count: number; maxY: number; size: number }[] = [
	{ block: B.coal, count: 90, maxY: 30, size: 6 },
	{ block: B.iron, count: 50, maxY: 18, size: 5 },
	{ block: B.gold, count: 22, maxY: 11, size: 4 },
	{ block: B.gem, count: 14, maxY: 7, size: 3 },
];

function ores(v: Volume, hs: Int16Array, rng: Rng) {
	for (const vein of VEINS) {
		for (let n = 0; n < vein.count; n++) {
			let x = Math.floor(rng() * W);
			let z = Math.floor(rng() * D);
			let y = 1 + Math.floor(rng() * vein.maxY);
			for (let s = 0; s < vein.size; s++) {
				if (v.get(x, y, z) === B.stone && y < hs[x + W * z]! - 2) v.set(x, y, z, vein.block);
				const step = Math.floor(rng() * 6);
				if (step === 0) x++;
				else if (step === 1) x--;
				else if (step === 2) z++;
				else if (step === 3) z--;
				else if (step === 4) y = Math.min(vein.maxY, y + 1);
				else y = Math.max(1, y - 1);
			}
		}
	}
}

/** Thick woods round the clearing, thinning out toward the hills. Trunks keep two squares apart. */
function trees(v: Volume, hs: Int16Array, rng: Rng) {
	const trunks: [number, number][] = [];
	for (let z = 3; z < D - 3; z++) {
		for (let x = 3; x < W - 3; x++) {
			const d = fromCamp(x, z);
			if (d < CLEARING + 1) continue;
			const h = hs[x + W * z]!;
			if (v.get(x, h, z) !== B.grass) continue;
			const chance = d < 30 ? 0.045 : 0.01;
			if (rng() >= chance) continue;
			if (trunks.some(([tx, tz]) => Math.abs(tx - x) <= 2 && Math.abs(tz - z) <= 2)) continue;
			trunks.push([x, z]);
			tree(v, x, h + 1, z, 4 + Math.floor(rng() * 3), rng);
		}
	}
}

function tree(v: Volume, x: number, y: number, z: number, tall: number, rng: Rng) {
	const top = y + tall - 1;
	for (let dy = -2; dy <= 1; dy++) {
		const r = dy === 1 ? 1 : 2;
		for (let dz = -r; dz <= r; dz++) {
			for (let dx = -r; dx <= r; dx++) {
				// Round the canopy's corners, some of them.
				if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && rng() < 0.7) continue;
				if (v.get(x + dx, top + dy, z + dz) === B.air) v.set(x + dx, top + dy, z + dz, B.leaves);
			}
		}
	}
	for (let k = 0; k < tall; k++) v.set(x, y + k, z, B.log);
}

/** The ground a figure stands on in a column: the top block that isn't a tree, water or air (-1 if under the sea). */
export function groundAt(v: Volume, x: number, z: number): number {
	for (let y = H - 1; y > 0; y--) {
		const b = v.get(x, y, z);
		if (b === B.air || b === B.leaves || b === B.torch) continue;
		if (b === B.water || b === B.log) return -1;
		return y;
	}
	return -1;
}

/** Where kids arrive: just south of the fire, standing on the clearing. */
export function spawnPoint(island: Island): [number, number, number] {
	const [x, , z] = island.fire;
	const g = groundAt(island.volume, x, z + 3);
	return [x + 0.5, Math.max(g, island.fire[1] - 1) + 1, z + 3.5];
}
