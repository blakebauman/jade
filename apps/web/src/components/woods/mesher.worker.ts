/// <reference lib="webworker" />
import { CX, CZ, cellOf, unpackEdit, Volume } from "@jade/core/woods";
import { type ColumnMesh, columnsAround, meshColumn } from "./mesher.ts";

/**
 * Meshing off the main thread: the worker keeps its own copy of the island, takes the same edits the screen applies,
 * and sends back the columns they changed. A whole island goes nearest-the-camp first, a few columns at a time, so
 * the clearing appears straight away.
 */

export type ToMesher = { t: "load"; data: Uint8Array } | { t: "edits"; edits: Int32Array };
export type FromMesher = { t: "meshes"; meshes: ColumnMesh[]; done: boolean };

let vol = new Volume();
let generation = 0;

const post = (meshes: ColumnMesh[], done: boolean) => {
	const transfer = meshes.flatMap((m) =>
		[m.solid, m.clear].flatMap((b) => [b.position.buffer, b.normal.buffer, b.uv.buffer, b.color.buffer, b.index.buffer]),
	);
	(self as unknown as Worker).postMessage({ t: "meshes", meshes, done } satisfies FromMesher, transfer);
};

self.onmessage = async (e: MessageEvent<ToMesher>) => {
	const m = e.data;
	if (m.t === "load") {
		vol = new Volume(m.data);
		const mine = ++generation;
		const order: [number, number][] = [];
		for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) order.push([cx, cz]);
		order.sort((a, b) => Math.hypot(a[0] - 2.5, a[1] - 2.5) - Math.hypot(b[0] - 2.5, b[1] - 2.5));
		for (let k = 0; k < order.length; k += 4) {
			// A newer island arrived while this one was meshing (a reconnect): stop.
			if (mine !== generation) return;
			post(
				order.slice(k, k + 4).map(([cx, cz]) => meshColumn(vol, cx, cz)),
				k + 4 >= order.length,
			);
			await new Promise((r) => setTimeout(r, 0));
		}
	} else {
		const columns = new Set<number>();
		for (const packed of m.edits) {
			const [i, b] = unpackEdit(packed);
			vol.data[i] = b;
			const [x, , z] = cellOf(i);
			for (const c of columnsAround(x, z)) columns.add(c);
		}
		post(
			[...columns].map((c) => meshColumn(vol, c % CX, Math.floor(c / CX))),
			true,
		);
	}
};
