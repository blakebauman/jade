import { FURNITURE } from "@jade/core/roxy";
import { describe, expect, it } from "vitest";
import { FURNITURE_ART } from "./Furniture.tsx";

describe("Roxy's home", () => {
	it("has a model for every piece of furniture, and nothing else", () => {
		const ids = FURNITURE.map((f) => f.id);
		expect(ids.filter((id) => !FURNITURE_ART.has(id))).toEqual([]);
		expect([...FURNITURE_ART].filter((id) => !ids.includes(id))).toEqual([]);
	});
});
