import { B } from "./blocks.ts";

/** The island: x and z across, y up. Small enough to hold whole in memory on a phone and in a Durable Object. */
export const W = 96;
export const D = 96;
export const H = 48;
export const CELLS = W * D * H;
/** Water fills up to this height. */
export const SEA = 14;

/** Chunks are 16 cubes a side: the unit the client meshes and redraws. */
export const CHUNK = 16;
export const CX = W / CHUNK;
export const CY = H / CHUNK;
export const CZ = D / CHUNK;

export const inBounds = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
export const indexOf = (x: number, y: number, z: number) => x + W * (z + D * y);
export const cellOf = (i: number): [number, number, number] => [i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D];

export const chunkKey = (cx: number, cy: number, cz: number) => cx + CX * (cz + CZ * cy);
export const chunkOfCell = (x: number, y: number, z: number) =>
	chunkKey(Math.floor(x / CHUNK), Math.floor(y / CHUNK), Math.floor(z / CHUNK));

/** One edit on the wire: the cell index and the block, packed into one int (cells fit in 19 bits, blocks in 6). */
export const packEdit = (i: number, b: number) => (i << 6) | b;
export const unpackEdit = (e: number): [number, number] => [e >>> 6, e & 63];

export class Volume {
	readonly data: Uint8Array;
	constructor(data?: Uint8Array) {
		this.data = data ?? new Uint8Array(CELLS);
	}
	/** Outside the island is air, except below the floor, which is bedrock (so nothing falls out). */
	get(x: number, y: number, z: number): number {
		if (y < 0) return B.bedrock;
		if (!inBounds(x, y, z)) return B.air;
		return this.data[indexOf(x, y, z)]!;
	}
	set(x: number, y: number, z: number, b: number) {
		if (inBounds(x, y, z)) this.data[indexOf(x, y, z)] = b;
	}
	clone() {
		return new Volume(this.data.slice());
	}
	/** Applies packed edits; returns the chunks they touched, with the neighbours whose faces they change. */
	apply(edits: ArrayLike<number>): Set<number> {
		const touched = new Set<number>();
		for (let k = 0; k < edits.length; k++) {
			const [i, b] = unpackEdit(edits[k]!);
			if (i >= CELLS) continue;
			this.data[i] = b;
			for (const c of chunksAround(i)) touched.add(c);
		}
		return touched;
	}
}

/** The chunk a cell is in, and any chunk beside it when the cell sits on a chunk's edge. */
export function chunksAround(i: number): number[] {
	const [x, y, z] = cellOf(i);
	const out = new Set([chunkOfCell(x, y, z)]);
	for (const [dx, dy, dz] of [
		[1, 0, 0],
		[-1, 0, 0],
		[0, 1, 0],
		[0, -1, 0],
		[0, 0, 1],
		[0, 0, -1],
	] as const) {
		if (inBounds(x + dx, y + dy, z + dz)) out.add(chunkOfCell(x + dx, y + dy, z + dz));
	}
	return [...out];
}
