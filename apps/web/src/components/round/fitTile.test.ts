import { describe, expect, it } from "vitest";
import { fitTile } from "./AnswerRow.tsx";

describe("fitTile", () => {
	it("never makes a row wider than its space, gaps included", () => {
		for (let width = 120; width <= 1200; width += 7)
			for (let count = 1; count <= 20; count++) {
				const { size, gap } = fitTile(width, count);
				expect(count * size + (count - 1) * gap).toBeLessThanOrEqual(width);
			}
	});
	it("fits a 15-letter word at phone width, and caps the tile size", () => {
		expect(fitTile(343, 15).size).toBeGreaterThan(18);
		expect(fitTile(2000, 3, 88).size).toBe(88);
	});
	it("uses a 10% gap with a 3px floor", () => {
		expect(fitTile(1000, 5, 80)).toEqual({ size: 80, gap: 8 });
		expect(fitTile(200, 10).gap).toBe(3);
	});
});
