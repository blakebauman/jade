import { B, generate, indexOf, spawnPoint, TILE_NAMES, Volume } from "@jade/core/woods";
import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PAINTED } from "./atlas.ts";
import { columnsAround, LIGHT_LEVELS, lightAround, meshColumn, showsFace, tileUv, WATER_TOP } from "./mesher.ts";
import { newBody, overlaps, step } from "./physics.ts";
import { Rain } from "./rain.ts";
import { raycast } from "./raycast.ts";

const faces = (m: { index: Uint32Array }) => m.index.length / 6;

describe("woods mesher", () => {
	it("builds only the faces that can be seen", () => {
		const v = new Volume();
		v.set(4, 4, 4, B.stone);
		expect(faces(meshColumn(v, 0, 0).solid)).toBe(6);
		v.set(5, 4, 4, B.stone);
		expect(faces(meshColumn(v, 0, 0).solid)).toBe(10);
	});

	it("draws leaves and glass against air but not against their own kind", () => {
		expect(showsFace(B.leaves, B.air)).toBe(true);
		expect(showsFace(B.leaves, B.leaves)).toBe(false);
		expect(showsFace(B.glass, B.glass)).toBe(false);
		expect(showsFace(B.stone, B.glass)).toBe(true);
		expect(showsFace(B.water, B.stone)).toBe(false);
	});

	it("puts glass and water in the see-through mesh, with water's top a little low", () => {
		const v = new Volume();
		v.set(2, 2, 2, B.water);
		v.set(6, 2, 2, B.glass);
		const m = meshColumn(v, 0, 0);
		expect(faces(m.solid)).toBe(0);
		expect(faces(m.clear)).toBe(12);
		const ys = [...m.clear.position].filter((_, k) => k % 3 === 1);
		expect(ys).toContain(2 + WATER_TOP);
	});

	it("shades a corner tucked into a wall darker than an open one", () => {
		const v = new Volume();
		v.set(4, 4, 4, B.stone);
		const open = Math.min(...meshColumn(v, 0, 0).solid.color);
		v.set(4, 5, 5, B.stone);
		const tucked = Math.min(...meshColumn(v, 0, 0).solid.color);
		expect(tucked).toBeLessThan(open);
	});

	it("paints every tile a block uses", () => {
		for (const name of TILE_NAMES) expect(PAINTED).toContain(name);
	});

	it("spreads torchlight a level a block, and never through a wall", () => {
		const v = new Volume();
		v.set(8, 5, 8, B.torch);
		const lit = lightAround(v, 0, 0);
		expect(lit.at(8, 5, 8)).toBeCloseTo(LIGHT_LEVELS.torch / 15);
		expect(lit.at(11, 5, 8)).toBeCloseTo((LIGHT_LEVELS.torch - 3) / 15);
		expect(lit.at(8 + LIGHT_LEVELS.torch, 5, 8)).toBe(0);
		// A sealed stone room next door stays dark.
		for (let y = 3; y <= 7; y++) for (let z = 6; z <= 10; z++) for (let x = 12; x <= 16; x++) v.set(x, y, z, B.stone);
		for (let y = 4; y <= 6; y++) for (let z = 7; z <= 9; z++) for (let x = 13; x <= 15; x++) v.set(x, y, z, B.air);
		expect(lightAround(v, 0, 0).at(14, 5, 8)).toBe(0);
	});

	it("maps each tile inside the atlas", () => {
		const [u0, v0, u1, v1] = tileUv("grass_top");
		expect(u0).toBeGreaterThanOrEqual(0);
		expect(v1).toBeLessThanOrEqual(1);
		expect(u1).toBeGreaterThan(u0);
		expect(v1).toBeGreaterThan(v0);
	});

	it("redraws the column beside an edge edit", () => {
		expect(columnsAround(5, 5)).toHaveLength(1);
		expect(columnsAround(15, 5)).toHaveLength(2);
	});

	it("meshes a whole island within the phone budget", () => {
		const { volume } = generate(4242);
		let tris = 0;
		for (let cz = 0; cz < 6; cz++)
			for (let cx = 0; cx < 6; cx++) {
				const m = meshColumn(volume, cx, cz);
				tris += (m.solid.index.length + m.clear.index.length) / 3;
			}
		expect(tris).toBeLessThan(300_000);
	});
});

describe("woods physics", () => {
	const flat = () => {
		const v = new Volume();
		for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) v.set(x, 0, z, B.stone);
		return v;
	};

	it("falls and lands on the ground", () => {
		const v = flat();
		const body = newBody([5.5, 4, 5.5]);
		for (let k = 0; k < 120; k++) step(v, body, { x: 0, z: 0, jump: false }, 1 / 60);
		expect(body.ground).toBe(true);
		expect(body.p[1]).toBeCloseTo(1, 5);
	});

	it("stops at a wall two blocks high, and hops up a single step", () => {
		const v = flat();
		v.set(8, 1, 5, B.stone);
		v.set(8, 2, 5, B.stone);
		const body = newBody([5.5, 1, 5.5]);
		for (let k = 0; k < 120; k++) step(v, body, { x: 1, z: 0, jump: false }, 1 / 60);
		expect(body.p[0]).toBeLessThan(8 - 0.29);
		expect(overlaps(v, body.p)).toBe(false);

		const w = flat();
		for (let x = 8; x < 20; x++) w.set(x, 1, 5, B.stone);
		const hopper = newBody([5.5, 1, 5.5]);
		for (let k = 0; k < 120; k++) step(w, hopper, { x: 1, z: 0, jump: false }, 1 / 60);
		expect(hopper.p[0]).toBeGreaterThan(8.5);
		expect(hopper.p[1]).toBeCloseTo(2, 3);
	});

	it("starts a kid on solid ground at camp", () => {
		const island = generate(99);
		const body = newBody(spawnPoint(island));
		for (let k = 0; k < 60; k++) step(island.volume, body, { x: 0, z: 0, jump: false }, 1 / 60);
		expect(body.ground).toBe(true);
	});
});

describe("woods raycast", () => {
	it("finds the block in front and the face it came in through", () => {
		const v = new Volume();
		v.set(5, 5, 5, B.stone);
		const hit = raycast(v, [5.5, 5.5, 1.5], [0, 0, 1]);
		expect(hit).toMatchObject({ cell: [5, 5, 5], i: indexOf(5, 5, 5), block: B.stone, normal: [0, 0, -1] });
		expect(raycast(v, [5.5, 5.5, 1.5], [0, 0, -1])).toBeNull();
		expect(raycast(v, [5.5, 5.5, -3.5], [0, 0, 1])).toBeNull();
	});

	it("looks through water at what's under it", () => {
		const v = new Volume();
		v.set(5, 3, 5, B.sand);
		v.set(5, 4, 5, B.water);
		expect(raycast(v, [5.5, 6.5, 5.5], [0, -1, 0])?.block).toBe(B.sand);
	});
});

describe("woods rain", () => {
	it("falls in the open, and not under a roof", () => {
		const rain = new Rain();
		const camera = { position: new Vector3(40, 20, 40) };
		const visible = () => {
			const m = new Matrix4();
			let n = 0;
			for (let k = 0; k < rain.mesh.count; k++) {
				rain.mesh.getMatrixAt(k, m);
				if (m.elements[0] !== 0) n++;
			}
			return n;
		};
		rain.update(0.016, camera, 1, () => -1);
		expect(visible()).toBeGreaterThan(100);
		rain.update(0.016, camera, 1, () => 100);
		expect(visible()).toBe(0);
		rain.update(0.016, camera, 0);
		expect(rain.mesh.visible).toBe(false);
	});
});
