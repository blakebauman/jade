import { B, BLOCKS, blockInfo, CHUNK, CX, CZ, H, isLeaves, TILE_NAMES, type Volume } from "@jade/core/woods";

/**
 * Turns the island into meshes, one per 16×16 column of it (full height, so the whole island is at most 36 solid
 * meshes and 36 see-through ones). Only faces that can be seen are built: a face is skipped when the block beside it
 * hides it. Each corner is darkened by the blocks round it (ambient occlusion), which gives the cubes their shape
 * without shadows. Pure: it runs in a worker, and in tests.
 */

/** The atlas is a grid of 16px tiles, this many across. */
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
const TILE_INDEX = new Map(TILE_NAMES.map((n, i) => [n, i]));

/** A tile's square in the atlas, in UV (v up), pulled in a hair so neighbours never bleed in. */
export function tileUv(name: string): [number, number, number, number] {
	const i = TILE_INDEX.get(name) ?? 0;
	const col = i % ATLAS_COLS;
	const row = Math.floor(i / ATLAS_COLS);
	const du = 1 / ATLAS_COLS;
	const dv = 1 / ATLAS_ROWS;
	const e = 0.25 / (16 * ATLAS_COLS);
	return [col * du + e, 1 - (row + 1) * dv + e, (col + 1) * du - e, 1 - row * dv - e];
}

export type Buffers = {
	position: Float32Array;
	normal: Float32Array;
	uv: Float32Array;
	color: Float32Array;
	/** Firelight reaching each corner, 0 to 1 (torches, the campfire, gems): the scene adds it as a warm glow. */
	light: Float32Array;
	index: Uint32Array;
};
export type ColumnMesh = { key: number; solid: Buffers; clear: Buffers };

export const columnKey = (cx: number, cz: number) => cx + CX * cz;
export const columnOf = (x: number, z: number) => columnKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
export const COLUMNS = CX * CZ;

type Face = {
	n: [number, number, number];
	/** The two axes across the face. */
	u: [number, number, number];
	v: [number, number, number];
	/** Corner offsets from the cell's origin, counter-clockwise seen from outside. */
	corners: [number, number, number][];
	/** Which corner of the tile each corner takes, as (u, v) in 0…1. */
	uvs: [number, number][];
	tile: "top" | "side" | "bottom";
	shade: number;
};

function face(
	n: [number, number, number],
	u: [number, number, number],
	v: [number, number, number],
	tile: Face["tile"],
	shade: number,
): Face {
	const base: [number, number, number] = [Math.max(0, n[0]), Math.max(0, n[1]), Math.max(0, n[2])];
	const at = (a: number, b: number): [number, number, number] => [
		base[0] + u[0] * a + v[0] * b,
		base[1] + u[1] * a + v[1] * b,
		base[2] + u[2] * a + v[2] * b,
	];
	let corners = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
	let uvs: [number, number][] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1],
	];
	// Wind every face to look outward.
	const e1 = corners[1]!.map((c, k) => c - corners[0]![k]!);
	const e2 = corners[3]!.map((c, k) => c - corners[0]![k]!);
	const cross = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
	if (cross[0]! * n[0] + cross[1]! * n[1] + cross[2]! * n[2] < 0) {
		corners = [corners[0]!, corners[3]!, corners[2]!, corners[1]!];
		uvs = [uvs[0]!, uvs[3]!, uvs[2]!, uvs[1]!];
	}
	return { n, u, v, corners, uvs, tile, shade };
}

const X: [number, number, number] = [1, 0, 0];
const Y: [number, number, number] = [0, 1, 0];
const Z: [number, number, number] = [0, 0, 1];
export const FACES: readonly Face[] = [
	face([1, 0, 0], Z, Y, "side", 0.82),
	face([-1, 0, 0], Z, Y, "side", 0.82),
	face([0, 1, 0], X, Z, "top", 1),
	face([0, -1, 0], X, Z, "bottom", 0.6),
	face([0, 0, 1], X, Y, "side", 0.92),
	face([0, 0, -1], X, Y, "side", 0.92),
];

/** How much each count of crowding blocks darkens a corner. */
const AO = [1, 0.8, 0.66, 0.52];
/** Water's surface sits a little below the top of its cell. */
export const WATER_TOP = 0.875;

const draws = BLOCKS.map((b) => b.draw);
/** Blocks that hide what's behind them and crowd corners. */
const opaque = (b: number) => draws[b] === "solid" || draws[b] === "cutout";

/** Whether `b`'s face toward `n` (the block beside it) is drawn. */
export function showsFace(b: number, n: number): boolean {
	const self = draws[b];
	const other = draws[n];
	if (self === "none" || self === "torch" || self === "plant") return false;
	if (other === "solid") return false;
	if (self === "water") return n !== B.water && other !== "cutout" && other !== "glass";
	if (self === "glass" || self === "cutout") return n !== b;
	return true;
}

class Builder {
	position: number[] = [];
	normal: number[] = [];
	uv: number[] = [];
	color: number[] = [];
	light: number[] = [];
	index: number[] = [];
	quad(
		pts: [number, number, number][],
		n: [number, number, number],
		uvs: [number, number][],
		shades: number[],
		tint: Tint = WHITE,
		glow = 0,
	) {
		const base = this.position.length / 3;
		for (let k = 0; k < 4; k++) {
			this.position.push(...pts[k]!);
			this.normal.push(...n);
			this.uv.push(...uvs[k]!);
			const s = shades[k]!;
			this.color.push(s * tint[0], s * tint[1], s * tint[2]);
			this.light.push(glow);
		}
		// Split along the brighter diagonal, so occlusion shades evenly.
		if (shades[0]! + shades[2]! < shades[1]! + shades[3]!) this.index.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
		else this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	done(): Buffers {
		return {
			position: new Float32Array(this.position),
			normal: new Float32Array(this.normal),
			uv: new Float32Array(this.uv),
			color: new Float32Array(this.color),
			light: new Float32Array(this.light),
			index: new Uint32Array(this.index),
		};
	}
}

export function meshColumn(vol: Volume, cx: number, cz: number, fire?: readonly [number, number, number]): ColumnMesh {
	const solid = new Builder();
	const clear = new Builder();
	const x0 = cx * CHUNK;
	const z0 = cz * CHUNK;
	const lit = lightAround(vol, x0, z0, fire);
	for (let y = 0; y < H; y++) {
		for (let z = z0; z < z0 + CHUNK; z++) {
			for (let x = x0; x < x0 + CHUNK; x++) {
				const b = vol.get(x, y, z);
				if (b === B.air) continue;
				const info = blockInfo(b);
				if (info.draw === "torch") {
					torch(solid, x, y, z);
					continue;
				}
				if (info.draw === "plant") {
					plant(solid, x, y, z, info.tiles.side, b === B.tallGrass ? tintAt(x, z) : WHITE, lit.at(x, y, z));
					continue;
				}
				// Each block a shade lighter or darker than its neighbours, so a wall of one kind isn't a flat repeat.
				const jitter = info.draw === "solid" ? 0.95 + 0.08 * hash3(x, y, z) : 1;
				const tinted = b === B.grass || isLeaves(b) ? tintAt(x, z) : WHITE;
				const into = info.draw === "glass" || info.draw === "water" ? clear : solid;
				for (const f of FACES) {
					const nb = vol.get(x + f.n[0], y + f.n[1], z + f.n[2]);
					if (!showsFace(b, nb)) continue;
					const [u0, v0, u1, v1] = tileUv(info.tiles[f.tile]);
					const uvs = f.uvs.map(([a, c]) => [u0 + (u1 - u0) * a, v0 + (v1 - v0) * c] as [number, number]);
					const lowered = info.draw === "water" && vol.get(x, y + 1, z) !== B.water;
					const pts = f.corners.map(([a, c, d]) => [x + a, y + (lowered && c === 1 ? WATER_TOP : c), z + d] as [number, number, number]);
					const shades = f.corners.map((corner) => jitter * f.shade * (info.draw === "water" ? 1 : occlusion(vol, x, y, z, f, corner)));
					// Light reaching a face is the light in the open cell it faces.
					const glow = lit.at(x + f.n[0], y + f.n[1], z + f.n[2]);
					// Grass only takes the meadow's colour on top (its sides are mostly soil).
					into.quad(pts, f.n, uvs, shades, b === B.grass && f.tile !== "top" ? WHITE : tinted, glow);
				}
			}
		}
	}
	return { key: columnKey(cx, cz), solid: solid.done(), clear: clear.done() };
}

/** Darkening at one corner of a face, from the three blocks that crowd it on the outside. */
function occlusion(vol: Volume, x: number, y: number, z: number, f: Face, corner: [number, number, number]) {
	const ox = x + f.n[0];
	const oy = y + f.n[1];
	const oz = z + f.n[2];
	// Which way along u and v this corner lies.
	const su = corner[0] * f.u[0] + corner[1] * f.u[1] + corner[2] * f.u[2] > 0 ? 1 : -1;
	const sv = corner[0] * f.v[0] + corner[1] * f.v[1] + corner[2] * f.v[2] > 0 ? 1 : -1;
	const at = (a: number, c: number) => vol.get(ox + f.u[0] * a + f.v[0] * c, oy + f.u[1] * a + f.v[1] * c, oz + f.u[2] * a + f.v[2] * c);
	const s1 = opaque(at(su, 0)) ? 1 : 0;
	const s2 = opaque(at(0, sv)) ? 1 : 0;
	const c = opaque(at(su, sv)) ? 1 : 0;
	return AO[s1 && s2 ? 3 : s1 + s2 + c]!;
}

/** Light levels, as blocks count it: a source starts at its level and loses one a block through open space. */
export const LIGHT_LEVELS = { torch: 11, fire: 12, gem: 5 } as const;
const MAX_LIGHT = 15;

/**
 * How much firelight reaches each open cell round one column: spread out from every torch, gem and the campfire within
 * reach, a level less each block, through air, water, glass, leaves and plants but not solid blocks (so it never leaks
 * through a wall). Worked out over the column and a margin wide enough for the farthest light to reach in.
 */
export function lightAround(vol: Volume, x0: number, z0: number, fire?: readonly [number, number, number]) {
	const m = MAX_LIGHT;
	const ox = x0 - m;
	const oz = z0 - m;
	const w = CHUNK + m * 2;
	const size = w * w * H;
	const level = new Uint8Array(size);
	const queue = new Int32Array(size);
	let head = 0;
	let tail = 0;
	const idx = (x: number, y: number, z: number) => x - ox + w * (z - oz + w * y);
	const seed = (x: number, y: number, z: number, l: number) => {
		if (x < ox || z < oz || x >= ox + w || z >= oz + w || y < 0 || y >= H) return;
		const i = idx(x, y, z);
		if (level[i]! >= l) return;
		level[i] = l;
		queue[tail++] = i;
	};
	for (let y = 0; y < H; y++)
		for (let z = oz; z < oz + w; z++)
			for (let x = ox; x < ox + w; x++) {
				const b = vol.get(x, y, z);
				if (b === B.torch) seed(x, y, z, LIGHT_LEVELS.torch);
				else if (b === B.gem) seed(x, y, z, LIGHT_LEVELS.gem);
			}
	if (fire) seed(fire[0], fire[1], fire[2], LIGHT_LEVELS.fire);
	const steps = [1, -1, w, -w, w * w, -w * w];
	while (head < tail) {
		const i = queue[head++]!;
		const l = level[i]! - 1;
		if (l <= 0) continue;
		const x = (i % w) + ox;
		const z = (Math.floor(i / w) % w) + oz;
		const y = Math.floor(i / (w * w));
		for (let k = 0; k < 6; k++) {
			const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
			const nz = z + (k === 2 ? 1 : k === 3 ? -1 : 0);
			const ny = y + (k === 4 ? 1 : k === 5 ? -1 : 0);
			if (nx < ox || nz < oz || nx >= ox + w || nz >= oz + w || ny < 0 || ny >= H) continue;
			const j = i + steps[k]!;
			if (level[j]! >= l) continue;
			if (draws[vol.get(nx, ny, nz)] === "solid") continue;
			level[j] = l;
			queue[tail++] = j;
		}
	}
	return {
		at(x: number, y: number, z: number) {
			if (x < ox || z < oz || x >= ox + w || z >= oz + w || y < 0 || y >= H) return 0;
			return level[idx(x, y, z)]! / MAX_LIGHT;
		},
	};
}

function hash3(x: number, y: number, z: number) {
	let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Tint = readonly [number, number, number];
const WHITE: Tint = [1, 1, 1];

function hash2(x: number, z: number) {
	let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x: number, z: number) {
	const x0 = Math.floor(x);
	const z0 = Math.floor(z);
	const fx = x - x0;
	const fz = z - z0;
	const sx = fx * fx * (3 - 2 * fx);
	const sz = fz * fz * (3 - 2 * fz);
	const a = hash2(x0, z0);
	const b = hash2(x0 + 1, z0);
	const c = hash2(x0, z0 + 1);
	const d = hash2(x0 + 1, z0 + 1);
	return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/**
 * The meadow's colour where a column stands: grass and leaves drift from a cool green to a sunny yellow-green across
 * the island, in patches about twenty blocks wide, so the ground never reads as one repeated tile.
 */
export function tintAt(x: number, z: number): Tint {
	const n = smoothNoise(x / 19, z / 19) * 0.7 + smoothNoise(x / 6 + 40, z / 6) * 0.3;
	const warm = Math.min(1, Math.max(0, (n - 0.25) / 0.6));
	return [0.9 + 0.16 * warm, 1.02 - 0.02 * warm, 0.92 - 0.14 * warm];
}

/** A plant: two pictures crossed corner to corner, each drawn from both sides (no lighting tricks, nothing to cull). */
function plant(into: Builder, x: number, y: number, z: number, tile: string, tint: Tint, glow: number) {
	const [u0, v0, u1, v1] = tileUv(tile);
	const uvs: [number, number][] = [
		[u0, v0],
		[u1, v0],
		[u1, v1],
		[u0, v1],
	];
	const back: [number, number][] = [uvs[1]!, uvs[0]!, uvs[3]!, uvs[2]!];
	const i = 0.15;
	const o = 0.85;
	const up: [number, number, number] = [0, 1, 0];
	const diagonals: [[number, number], [number, number]][] = [
		[
			[i, i],
			[o, o],
		],
		[
			[i, o],
			[o, i],
		],
	];
	for (const [[ax, az], [bx, bz]] of diagonals) {
		const front: [number, number, number][] = [
			[x + ax, y, z + az],
			[x + bx, y, z + bz],
			[x + bx, y + 1, z + bz],
			[x + ax, y + 1, z + az],
		];
		into.quad(front, up, uvs, [0.95, 0.95, 1.05, 1.05], tint, glow);
		into.quad([front[1]!, front[0]!, front[3]!, front[2]!], up, back, [0.95, 0.95, 1.05, 1.05], tint, glow);
	}
}

/** A torch: a thin stick, its tile's middle mapped onto each side and its flame on top. */
function torch(into: Builder, x: number, y: number, z: number) {
	const [u0, v0, u1, v1] = tileUv("torch");
	const lo = 7 / 16;
	const hi = 9 / 16;
	const top = 10 / 16;
	const su = (a: number) => u0 + (u1 - u0) * a;
	const sv = (a: number) => v0 + (v1 - v0) * a;
	for (const f of FACES) {
		const pts = f.corners.map(([a, c, d]) => [x + lo + (hi - lo) * a, y + top * c, z + lo + (hi - lo) * d] as [number, number, number]);
		const uvs = f.uvs.map(([a, c]) =>
			f.tile === "side"
				? ([su(lo + (hi - lo) * a), sv(top * c)] as [number, number])
				: ([su(lo + (hi - lo) * a), sv(top - 2 / 16 + (2 / 16) * c)] as [number, number]),
		);
		into.quad(pts, f.n, uvs, [1, 1, 1, 1], WHITE, 1);
	}
}

/** The columns an edit at (x, z) changes: its own, and any beside it when it's on a column's edge. */
export function columnsAround(x: number, z: number): number[] {
	const out = new Set<number>();
	for (const [dx, dz] of [
		[0, 0],
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
	] as const) {
		const nx = x + dx;
		const nz = z + dz;
		if (nx < 0 || nz < 0 || nx >= CX * CHUNK || nz >= CZ * CHUNK) continue;
		out.add(columnOf(nx, nz));
	}
	return [...out];
}
