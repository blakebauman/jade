import { B, BLOCKS, blockInfo, CHUNK, CX, CZ, H, TILE_NAMES, type Volume } from "@jade/core/woods";

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

export type Buffers = { position: Float32Array; normal: Float32Array; uv: Float32Array; color: Float32Array; index: Uint32Array };
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
	if (self === "none" || self === "torch") return false;
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
	index: number[] = [];
	quad(pts: [number, number, number][], n: [number, number, number], uvs: [number, number][], shades: number[]) {
		const base = this.position.length / 3;
		for (let k = 0; k < 4; k++) {
			this.position.push(...pts[k]!);
			this.normal.push(...n);
			this.uv.push(...uvs[k]!);
			const s = shades[k]!;
			this.color.push(s, s, s);
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
			index: new Uint32Array(this.index),
		};
	}
}

export function meshColumn(vol: Volume, cx: number, cz: number): ColumnMesh {
	const solid = new Builder();
	const clear = new Builder();
	const x0 = cx * CHUNK;
	const z0 = cz * CHUNK;
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
				const into = info.draw === "glass" || info.draw === "water" ? clear : solid;
				for (const f of FACES) {
					const nb = vol.get(x + f.n[0], y + f.n[1], z + f.n[2]);
					if (!showsFace(b, nb)) continue;
					const [u0, v0, u1, v1] = tileUv(info.tiles[f.tile]);
					const uvs = f.uvs.map(([a, c]) => [u0 + (u1 - u0) * a, v0 + (v1 - v0) * c] as [number, number]);
					const lowered = info.draw === "water" && vol.get(x, y + 1, z) !== B.water;
					const pts = f.corners.map(([a, c, d]) => [x + a, y + (lowered && c === 1 ? WATER_TOP : c), z + d] as [number, number, number]);
					const shades = f.corners.map((corner) => f.shade * (info.draw === "water" ? 1 : occlusion(vol, x, y, z, f, corner)));
					into.quad(pts, f.n, uvs, shades);
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
		into.quad(pts, f.n, uvs, [1, 1, 1, 1]);
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
