/// <reference lib="webworker" />
import { B, CHUNK, CX, CZ, cellOf, H, unpackEdit, Volume } from "@jade/core/woods";
import { type ColumnMesh, columnsAround, LIGHT_REACH, meshColumn } from "./mesher.ts";

/**
 * Meshing off the main thread: the worker keeps its own copy of the island, takes the same edits the screen applies,
 * and sends back the columns they changed. A whole island goes nearest-the-camp first, a few columns at a time, so
 * the clearing appears straight away.
 */

export type ToMesher =
	| { t: "load"; data: Uint8Array; fire: [number, number, number]; lit: boolean }
	| { t: "edits"; edits: Int32Array }
	/** The campfire went out, or was lit again: its light comes and goes. */
	| { t: "fire"; lit: boolean };
export type FromMesher = { t: "meshes"; meshes: ColumnMesh[]; done: boolean };

let vol = new Volume();
let fireCell: [number, number, number] | undefined;
let fireLit = true;
/** The fire as a light: only while it burns. */
const fireLight = () => (fireLit ? fireCell : undefined);
let generation = 0;

const post = (meshes: ColumnMesh[], done: boolean) => {
	const transfer = meshes.flatMap((m) =>
		[m.solid, m.clear].flatMap((b) => [b.position.buffer, b.normal.buffer, b.uv.buffer, b.color.buffer, b.light.buffer, b.index.buffer]),
	);
	(self as unknown as Worker).postMessage({ t: "meshes", meshes, done } satisfies FromMesher, transfer);
};

/** Whether any light source is within reach of a cell (so an edit there can change how far light gets). */
function lightNear(x: number, y: number, z: number) {
	const r = LIGHT_REACH;
	const f = fireLight();
	if (f && Math.abs(f[0] - x) <= r && Math.abs(f[2] - z) <= r && Math.abs(f[1] - y) <= r) return true;
	for (let yy = Math.max(0, y - r); yy < Math.min(H, y + r + 1); yy++)
		for (let zz = z - r; zz <= z + r; zz++)
			for (let xx = x - r; xx <= x + r; xx++) {
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
		fireCell = m.fire;
		fireLit = m.lit;
		const mine = ++generation;
		const order: [number, number][] = [];
		for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) order.push([cx, cz]);
		order.sort((a, b) => Math.hypot(a[0] - 2.5, a[1] - 2.5) - Math.hypot(b[0] - 2.5, b[1] - 2.5));
		for (let k = 0; k < order.length; k += 4) {
			// A newer island arrived while this one was meshing (a reconnect): stop.
			if (mine !== generation) return;
			post(
				order.slice(k, k + 4).map(([cx, cz]) => meshColumn(vol, cx, cz, fireLight())),
				k + 4 >= order.length,
			);
			await new Promise((r) => setTimeout(r, 0));
		}
	} else if (m.t === "fire") {
		if (m.lit === fireLit || !fireCell) return;
		fireLit = m.lit;
		const cs = new Set(columnsWithin(fireCell[0], fireCell[2], LIGHT_REACH));
		post(
			[...cs].map((c) => meshColumn(vol, c % CX, Math.floor(c / CX), fireLight())),
			true,
		);
	} else {
		// The columns the edits are in come back first, so a block dug or built shows at once; the columns further
		// round, whose light it changed, follow in a second batch.
		const near = new Set<number>();
		const far = new Set<number>();
		const cells: [number, number, number][] = [];
		let lights = false;
		for (const packed of m.edits) {
			const [i, b] = unpackEdit(packed);
			const was = vol.data[i];
			vol.data[i] = b;
			const cell = cellOf(i);
			cells.push(cell);
			for (const c of columnsAround(cell[0], cell[2])) near.add(c);
			// A light put down or taken away changes the light round it.
			if (b === B.torch || b === B.gem || was === B.torch || was === B.gem) lights = true;
		}
		// Near any light, an edit can change how far the light gets (looked for once a batch: an undo can be thousands).
		if (!lights && cells.length) {
			const [x, y, z] = cells[0]!;
			lights = cells.length > 32 || lightNear(x, y, z);
		}
		if (lights) for (const [x, , z] of cells) for (const c of columnsWithin(x, z, LIGHT_REACH)) far.add(c);
		for (const c of near) far.delete(c);
		const mesh = (cs: Set<number>) => [...cs].map((c) => meshColumn(vol, c % CX, Math.floor(c / CX), fireLight()));
		post(mesh(near), far.size === 0);
		if (far.size) {
			const mine = generation;
			await new Promise((r) => setTimeout(r, 0));
			if (mine === generation) post(mesh(far), true);
		}
	}
};
