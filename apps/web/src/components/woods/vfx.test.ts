import { B, BLOCKS } from "@jade/core/woods";
import { InstancedMesh, PerspectiveCamera, Points } from "three";
import { describe, expect, it } from "vitest";
import { BLOCK_COLOURS, Effects, POOL } from "./vfx.ts";

const camera = new PerspectiveCamera();
const hex = /^#[0-9a-f]{6}$/i;

/** Runs the effects on for a while in even steps. */
function run(fx: Effects, seconds: number, from = 0, step = 1 / 30) {
	let t = from;
	for (let n = 0; n < Math.round(seconds / step); n++) {
		t += step;
		fx.update(step, camera, t);
	}
	return t;
}

const cubes = (fx: Effects) => fx.group.children.find((c) => c instanceof InstancedMesh) as InstancedMesh;
const layers = (fx: Effects) => fx.group.children.filter((c) => c instanceof Points) as Points[];

describe("woods effects", () => {
	it("has two colours for every block", () => {
		for (const b of BLOCKS) {
			const c = BLOCK_COLOURS[b.id];
			expect(c, b.key).toBeDefined();
			expect(c![0]).toMatch(hex);
			expect(c![1]).toMatch(hex);
		}
	});

	it("draws with the same three objects however busy it gets", () => {
		const fx = new Effects();
		expect(fx.drawObjects()).toBe(3);
		expect(fx.group.userData.noCast).toBe(true);
		for (const c of fx.group.children) {
			expect(c.castShadow).toBe(false);
			expect(c.frustumCulled).toBe(false);
		}
		for (let n = 0; n < 40; n++) {
			fx.burst([n, 4, 0], B.stone);
			fx.sparks([0, 4, 0], 1);
			fx.stars([0, 4, 0]);
		}
		fx.setFire([0, 4, 0], 1);
		fx.setFireflies(1, [0, 5, 0]);
		run(fx, 1);
		expect(fx.drawObjects()).toBe(3);
		expect(fx.group.children).toHaveLength(3);
		fx.dispose();
	});

	it("reuses the oldest slots once a pool is full", () => {
		const fx = new Effects();
		for (let n = 0; n < 100; n++) fx.burst([0, 4, 0], B.dirt);
		for (let n = 0; n < 100; n++) fx.sparks([0, 4, 0]);
		fx.update(1 / 60, camera, 0);
		expect(cubes(fx).count).toBe(POOL.cubes);
		expect(fx.live()).toBeLessThanOrEqual(POOL.cubes + POOL.glow + POOL.soft);
		for (const p of layers(fx)) expect(p.geometry.drawRange.count).toBeLessThanOrEqual(POOL.glow + POOL.fireflies);
		fx.dispose();
	});

	it("lets everything burn out once it's had its time", () => {
		const fx = new Effects();
		fx.chips([0, 4, 0], B.grass, [1, 0, 0]);
		fx.burst([0, 4, 0], B.log);
		fx.pop([1, 4, 0]);
		fx.sparks([0, 4, 0]);
		fx.smokePuff([2, 4, 0]);
		fx.stars([0, 4, 0]);
		fx.update(1 / 60, camera, 0);
		expect(fx.live()).toBeGreaterThan(30);
		expect(cubes(fx).count).toBeGreaterThan(0);
		run(fx, 4);
		expect(fx.live()).toBe(0);
		expect(cubes(fx).count).toBe(0);
		for (const p of layers(fx)) expect(p.geometry.drawRange.count).toBe(0);
		fx.dispose();
	});

	it("keeps a slow frame from flinging things: one long step is clamped", () => {
		const fx = new Effects();
		fx.burst([0, 4, 0], B.stone);
		fx.update(5, camera, 5);
		expect(fx.live()).toBeGreaterThan(0);
		fx.dispose();
	});

	it("keeps the campfire going while it burns, and lets it settle when it's taken away", () => {
		const fx = new Effects();
		fx.setFire([0, 4, 0], 1);
		const t = run(fx, 2);
		const burning = fx.live();
		expect(burning).toBeGreaterThan(10);
		fx.setFire([0, 4, 0], 0);
		run(fx, 5, t);
		// Out: no embers, only a wisp of smoke.
		expect(fx.live()).toBeGreaterThan(0);
		expect(fx.live()).toBeLessThan(burning);
		fx.setFire(null, 0);
		run(fx, 5, t + 5);
		expect(fx.live()).toBe(0);
		fx.dispose();
	});

	it("brings fireflies out round the kid, fewer on a phone", () => {
		const fx = new Effects();
		const phone = new Effects({ mobile: true });
		for (const f of [fx, phone]) {
			f.setFireflies(1, [10, 5, 10]);
			run(f, 8);
		}
		const glow = (f: Effects) => layers(f).reduce((n, p) => n + p.geometry.drawRange.count, 0);
		expect(glow(fx)).toBe(POOL.fireflies);
		expect(glow(phone)).toBeLessThan(POOL.fireflies);
		const pos = layers(fx).flatMap((p) => {
			const a = p.geometry.getAttribute("position");
			return Array.from({ length: p.geometry.drawRange.count }, (_, i) => [a.getX(i), a.getZ(i)] as const);
		});
		for (const [x, z] of pos) expect(Math.hypot(x - 10, z - 10)).toBeLessThan(14);
		fx.setFireflies(0, [10, 5, 10]);
		run(fx, 12, 8);
		expect(glow(fx)).toBe(0);
		fx.dispose();
		phone.dispose();
	});

	it("makes fewer bits with reduced motion and skips the spark shower", () => {
		const full = new Effects();
		const calm = new Effects({ reducedMotion: true });
		for (const f of [full, calm]) {
			f.burst([0, 4, 0], B.stone);
			f.sparks([0, 4, 0]);
		}
		expect(calm.live()).toBeLessThan(full.live() / 2);
		const sparksOnly = new Effects({ reducedMotion: true });
		sparksOnly.sparks([0, 4, 0]);
		expect(sparksOnly.live()).toBe(1);
		for (const f of [full, calm, sparksOnly]) f.dispose();
	});
});
