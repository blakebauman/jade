/// <reference lib="webworker" />
import { B, CHUNK, CX, CZ, cellOf, H, unpackEdit, Volume } from "@jade/core/woods";
import { type ColumnMesh, columnsAround, meshColumn } from "./mesher.ts";

/**
 * Meshing off the main thread: the worker keeps its own copy of the island, takes the same edits the screen applies,
 * and sends back the columns they changed. A whole island goes nearest-the-camp first, a few columns at a time, so
 * the clearing appears straight away.
 */

export type ToMesher = { t: "load"; data: Uint8Array; fire: [number, number, number] } | { t: "edits"; edits: Int32Array };
export type FromMesher = { t: "meshes"; meshes: ColumnMesh[]; done: boolean };

let vol = new Volume();
let fire: [number, number, number] | undefined;
let generation = 0;

const post = (meshes: ColumnMesh[], done: boolean) => {
	const transfer = meshes.flatMap((m) =>
		[m.solid, m.clear].flatMap((b) => [b.position.buffer, b.normal.buffer, b.uv.buffer, b.color.buffer, b.light.buffer, b.index.buffer]),
	);
	(self as unknown as Worker).postMessage({ t: "meshes", meshes, done } satisfies FromMesher, transfer);
};

/** Whether any light source is within reach of a cell (so an edit there can change how far light gets). */
function lightNear(x: number, y: number, z: number) {
	if (fire && Math.abs(fire[0] - x) <= 15 && Math.abs(fire[2] - z) <= 15 && Math.abs(fire[1] - y) <= 15) return true;
	for (let yy = Math.max(0, y - 14); yy < Math.min(H, y + 15); yy++)
		for (let zz = z - 14; zz <= z + 14; zz++)
			for (let xx = x - 14; xx <= x + 14; xx++) {
				const b = vol.get(xx, yy, zz);
				if (b === B.torch || b === B.gem) return true;
			}
	return false;
}

function columnsWithin(x: number, z: number, r: number) {
	const out: number[] = [];
	for (let cz = Math.max(0, Math.floor((z - r) / CHUNK)); cz <= Math.min(CZ - 1, Math.floor((z + r) / CHUNK)); cz++)
		for (let cx = Math.max(0, Math.floor((x - r) / CHUNK)); cx <= Math.min(CX - 1, Math.floor((x + r) / CHUNK)); cx++)
			out.push(cx + CX * cz);
	return out;
}

self.onmessage = async (e: MessageEvent<ToMesher>) => {
	const m = e.data;
	if (m.t === "load") {
		vol = new Volume(m.data);
		fire = m.fire;
		const mine = ++generation;
		const order: [number, number][] = [];
		for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) order.push([cx, cz]);
		order.sort((a, b) => Math.hypot(a[0] - 2.5, a[1] - 2.5) - Math.hypot(b[0] - 2.5, b[1] - 2.5));
		for (let k = 0; k < order.length; k += 4) {
			// A newer island arrived while this one was meshing (a reconnect): stop.
			if (mine !== generation) return;
			post(
				order.slice(k, k + 4).map(([cx, cz]) => meshColumn(vol, cx, cz, fire)),
				k + 4 >= order.length,
			);
			await new Promise((r) => setTimeout(r, 0));
		}
	} else {
		const columns = new Set<number>();
		for (const packed of m.edits) {
			const [i, b] = unpackEdit(packed);
			const was = vol.data[i];
			vol.data[i] = b;
			if (was === B.torch) for (const c of columnsWithin(i % (CX * CHUNK), Math.floor(i / (CX * CHUNK)) % (CZ * CHUNK), 15)) columns.add(c);
			const [x, y, z] = cellOf(i);
			for (const c of columnsAround(x, z)) columns.add(c);
			// Near a torch, gem or the fire (or a torch itself), light changes further out: redraw the columns round it.
			if (b === B.torch || lightNear(x, y, z)) for (const c of columnsWithin(x, z, 15)) columns.add(c);
		}
		post(
			[...columns].map((c) => meshColumn(vol, c % CX, Math.floor(c / CX), fire)),
			true,
		);
	}
};
