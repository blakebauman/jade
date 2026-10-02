import { describe, expect, it } from "vitest";
import { type Block, findPath, makeGrid, nearestFree } from "./path.ts";

const area = { w: 10, d: 8 };
/** Whether any point along the route (sampled finely) is inside a block. */
const crosses = (from: { x: number; z: number }, route: { x: number; z: number }[], blocks: Block[]) => {
	let at = from;
	for (const p of route) {
		for (let t = 0; t <= 1; t += 0.01) {
			const x = at.x + (p.x - at.x) * t;
			const z = at.z + (p.z - at.z) * t;
			if (blocks.some((b) => ("r" in b ? Math.hypot(x - b.cx, z - b.cz) < b.r : x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1))) return true;
		}
		at = p;
	}
	return false;
};

describe("walking round things", () => {
	it("walks straight when nothing is in the way", () => {
		const g = makeGrid(area, []);
		expect(findPath(g, { x: 2, z: 2 }, { x: 7, z: 6 })).toEqual([{ x: 7, z: 6 }]);
	});

	it("goes round a bed instead of through it", () => {
		const bed: Block = { x0: 3, z0: 1, x1: 6, z1: 6 };
		const g = makeGrid(area, [bed]);
		const from = { x: 1.5, z: 3 };
		const route = findPath(g, from, { x: 8, z: 3 });
		expect(route.length).toBeGreaterThan(1);
		expect(route.at(-1)).toEqual({ x: 8, z: 3 });
		expect(crosses(from, route, [bed])).toBe(false);
	});

	it("stops beside a thing when tapped on it, and keeps off the edges", () => {
		const pond: Block = { cx: 5, cz: 4, r: 2 };
		const g = makeGrid(area, [pond]);
		const stop = nearestFree(g, { x: 5, z: 4 });
		expect(Math.hypot(stop.x - 5, stop.z - 4)).toBeGreaterThan(2);
		const edge = nearestFree(g, { x: -3, z: 20 });
		expect(edge.x).toBeGreaterThanOrEqual(0.4);
		expect(edge.z).toBeLessThanOrEqual(area.d - 0.3);
	});

	it("can't get anywhere that's walled off", () => {
		const g = makeGrid(area, [{ x0: 4, z0: -1, x1: 5, z1: 9 }]);
		expect(findPath(g, { x: 1, z: 4 }, { x: 8, z: 4 })).toEqual([]);
	});
});

describe("the town's places", () => {
	it("lets Roxy reach every find from where she starts, without walking through anything", async () => {
		const { PLACES } = await import("@jade/core/roxy");
		const { FIND_SPOTS_FOR, findSpot, placeLayout } = await import("./PlaceScene.tsx");
		for (const place of PLACES) {
			const { area, start, blocks } = placeLayout(place);
			const g = makeGrid(area, blocks);
			expect(nearestFree(g, start), `${place} start is clear`).toEqual(start);
			for (const id of FIND_SPOTS_FOR(place)) {
				const want = findSpot(place, id)!;
				const route = findPath(g, start, want);
				expect(route.length, id).toBeGreaterThan(0);
				const end = route.at(-1)!;
				// Close enough to reach out and pick it up.
				expect(Math.hypot(end.x - want.x, end.z - want.z), id).toBeLessThan(1.3);
				expect(crosses(start, route, blocks), id).toBe(false);
			}
		}
	});
});
