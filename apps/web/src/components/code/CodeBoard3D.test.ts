import { describe, expect, it } from "vitest";
import {
	buildScenery,
	buildTuck,
	CHARS,
	chalkOutlines,
	chalkPatches,
	headingY,
	hedgeShape,
	livePieceFor,
	meshesIn,
	pieceFor,
	triangles,
	viewBounds,
} from "./three/pieces.ts";

describe("3D garden pieces", () => {
	it.each(CHARS)("draws something for %s", (ch) => {
		const fixed = meshesIn(pieceFor(ch)).length;
		const live = livePieceFor(ch);
		expect(fixed + (live ? 1 : 0)).toBeGreaterThan(0);
		if (live) expect(triangles(live)).toBeGreaterThan(0);
	});

	it("keeps the grass off the pond and on every other square", () => {
		expect(meshesIn(pieceFor("~")).some((m) => m.position.y === -0.05)).toBe(false);
		for (const ch of CHARS.filter((c) => c !== "~")) expect(meshesIn(pieceFor(ch))[0]!.position.y).toBe(-0.05);
	});

	it("gives the changing squares their live part", () => {
		for (const ch of ["s", "L", "b", "o"]) expect(livePieceFor(ch)).not.toBeNull();
		for (const ch of [".", "#", "~", "F"]) expect(livePieceFor(ch)).toBeNull();
	});

	it("stays inside the triangle budget on a crowded 9×9 board", () => {
		const rows = Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => CHARS[(x * 7 + y * 3) % CHARS.length]).join(""));
		// Half hedges is far more than any puzzle has.
		const heavy = rows.map((r, y) => [...r].map((c, x) => ((x + y) % 2 ? "#" : c)).join(""));
		const scenery = meshesIn(buildScenery(heavy)).reduce((n, m) => n + triangles(m.geometry), 0);
		const tuck = buildTuck();
		const t = triangles(tuck.shell) + triangles(tuck.head) + triangles(tuck.pen) + 4 * triangles(tuck.foot);
		const live = heavy
			.join("")
			.split("")
			.reduce((n, c) => n + (livePieceFor(c) ? triangles(livePieceFor(c)!) : 0), 0);
		expect(scenery + t + live + triangles(hedgeShape())).toBeLessThan(60_000);
	});

	it("builds chalk as single shapes", () => {
		expect(chalkOutlines([])).toBeNull();
		expect(chalkPatches([{ x: 1, y: 2 }])!.attributes.position!.count).toBe(4);
		expect(triangles(chalkOutlines([{ x: 0, y: 0 }])!)).toBeGreaterThan(8);
	});

	it("turns Tuck clockwise from north, seen from above", () => {
		// Facing north is −z; a turn of 90° (east) must face +x.
		const east = headingY(90);
		expect(-Math.sin(east)).toBeCloseTo(1);
		expect(-Math.cos(east)).toBeCloseTo(0);
	});

	it("frames wider boards wider", () => {
		const small = viewBounds(3, 4);
		const big = viewBounds(9, 9);
		expect(big.width).toBeGreaterThan(small.width);
		expect(big.height).toBeGreaterThan(small.height);
		expect(small.width / small.height).toBeGreaterThan(0.5);
	});
});
