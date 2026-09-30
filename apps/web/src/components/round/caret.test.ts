import { describe, expect, it } from "vitest";
import { gapFromX, rekey } from "./caret.ts";

// Three 40px tiles with 4px gaps: [0,40] [44,84] [88,128].
const tiles = [0, 44, 88].map((left) => ({ left, right: left + 40 }));

describe("gapFromX", () => {
	it("finds the gap nearest the tap", () => {
		expect(gapFromX(-10, tiles)).toBe(0);
		expect(gapFromX(10, tiles)).toBe(0);
		expect(gapFromX(30, tiles)).toBe(1);
		expect(gapFromX(42, tiles)).toBe(1);
		expect(gapFromX(70, tiles)).toBe(2);
		expect(gapFromX(100, tiles)).toBe(2);
	});

	it("lands at the end past the last tile's middle (over the squares)", () => {
		expect(gapFromX(120, tiles)).toBe(3);
		expect(gapFromX(400, tiles)).toBe(3);
	});

	it("is 0 on an empty row", () => {
		expect(gapFromX(50, [])).toBe(0);
	});
});

describe("rekey", () => {
	const counter = () => {
		let n = 0;
		return () => `k${++n}`;
	};

	it("keeps the tiles around a letter inserted mid-word", () => {
		expect(rekey("necesary", ["a", "b", "c", "d", "e", "f", "g", "h"], "necessary", counter())).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
			"k1",
			"f",
			"g",
			"h",
		]);
	});

	it("drops a deleted letter's key and keeps the rest", () => {
		expect(rekey("cat", ["a", "b", "c"], "ct", counter())).toEqual(["a", "c"]);
	});

	it("gives a whole new word new keys", () => {
		expect(rekey("cat", ["a", "b", "c"], "dog", counter())).toEqual(["k1", "k2", "k3"]);
	});

	it("appends at the end like typing", () => {
		expect(rekey("ca", ["a", "b"], "cat", counter())).toEqual(["a", "b", "k1"]);
		expect(rekey("", [], "c", counter())).toEqual(["k1"]);
	});
});
