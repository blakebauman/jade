import { describe, expect, it } from "vitest";
import { keysToInput, stepFree, toWorld } from "./drive.ts";
import { makeGrid } from "./path.ts";

describe("walking Roxy with the keys", () => {
	it("reads WASD and the arrows, and a diagonal is no faster", () => {
		expect(keysToInput(new Set(["KeyD"]))).toEqual({ x: 1, y: 0, hop: false });
		expect(keysToInput(new Set(["ArrowUp", "Space"]))).toEqual({ x: 0, y: 1, hop: true });
		const diag = keysToInput(new Set(["KeyW", "ArrowRight"]));
		expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
		expect(keysToInput(new Set(["KeyA", "KeyD"]))).toEqual({ x: 0, y: 0, hop: false });
	});

	it("turns screen directions into floor directions for the camera", () => {
		// Looking straight down -z: right is +x, up the screen is -z.
		const right = toWorld({ x: 1, y: 0 }, 0);
		expect(right.x).toBeCloseTo(1);
		expect(right.z).toBeCloseTo(0);
		const up = toWorld({ x: 0, y: 1 }, 0);
		expect(up.x).toBeCloseTo(0);
		expect(up.z).toBeCloseTo(-1);
		// The corner camera (offset 8, 9, 10.5): up the screen heads away from it, toward the back-left.
		const yaw = Math.atan2(8, 10.5);
		const away = toWorld({ x: 0, y: 1 }, yaw);
		expect(away.x).toBeLessThan(0);
		expect(away.z).toBeLessThan(0);
	});

	it("slides along a wall instead of stopping", () => {
		const g = makeGrid({ w: 10, d: 8 }, [{ x0: 0, z0: 0, x1: 10, z1: 3 }]);
		const from = { x: 5, z: 3.5 };
		const to = stepFree(g, from, { x: 0.2, z: -0.3 });
		expect(to).toEqual({ x: 5.2, z: 3.5 });
		expect(stepFree(g, from, { x: 0, z: -0.3 })).toEqual(from);
	});
});
