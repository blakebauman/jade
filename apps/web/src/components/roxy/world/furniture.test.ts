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

describe("Roxy's town", () => {
	it("hides every find somewhere in its place's scene", async () => {
		const { FINDS, PLACES } = await import("@jade/core/roxy");
		const { FIND_SPOTS_FOR } = await import("./PlaceScene.tsx");
		for (const p of PLACES)
			expect(FIND_SPOTS_FOR(p).sort(), p).toEqual(
				FINDS.filter((f) => f.place === p)
					.map((f) => f.id)
					.sort(),
			);
	});
});
