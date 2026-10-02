import { describe, expect, it } from "vitest";
import { nearest, type Target } from "./near.ts";

const acorn: Target = { kind: "find", id: "park-acorn", stand: { x: 3, z: 4 } };
const board: Target = { kind: "hotspot", id: "chalkboard", stand: { x: 6, z: 1 } };

describe("what Roxy is beside", () => {
	it("finds the closest thing within reach", () => {
		expect(nearest({ x: 3.4, z: 4.3 }, [acorn, board])).toBe(acorn);
		expect(nearest({ x: 5.8, z: 1.5 }, [acorn, board])).toBe(board);
	});

	it("is nothing when she's too far, or when it's already found (left out of the targets)", () => {
		expect(nearest({ x: 9, z: 7 }, [acorn, board])).toBeNull();
		expect(nearest({ x: 3, z: 4 }, [board])).toBeNull();
	});
});
