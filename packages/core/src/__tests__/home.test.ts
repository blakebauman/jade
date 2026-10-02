import { describe, expect, it } from "vitest";
import { FURNITURE, FURNITURE_BY_ID, fits, type Home, ITEM, lockedFurnitureIn, normalizeHome, ROOM, starterHome } from "../roxy/index.ts";

describe("homes", () => {
	it("has unique furniture with sensible footprints, and a free starter room", () => {
		expect(new Set(FURNITURE.map((x) => x.id)).size).toBe(FURNITURE.length);
		for (const x of FURNITURE) {
			expect(x.w).toBeGreaterThan(0);
			expect(x.w).toBeLessThanOrEqual(ROOM.w);
			if (x.kind !== "wall") expect(x.d).toBeGreaterThan(0);
		}
		// Unlocks for clothes and furniture share one table, so their ids must never collide.
		expect(FURNITURE.filter((x) => ITEM.has(x.id))).toEqual([]);
		const home = starterHome();
		expect(normalizeHome(home)).toEqual(home);
		expect(lockedFurnitureIn(home, new Set())).toEqual([]);
	});

	it("keeps furniture in the room and off other furniture, but lets rugs go under", () => {
		const home: Home = { ...starterHome(), items: [] };
		const bed = FURNITURE_BY_ID.get("bed")!;
		expect(fits(home, { x: 0, z: 0, rot: 0 }, bed)).toBe(true);
		expect(fits(home, { x: 9, z: 0, rot: 0 }, bed)).toBe(false);
		// Turned a quarter, the bed lies across (3 wide, 2 deep).
		expect(fits(home, { x: 7, z: 6, rot: 1 }, bed)).toBe(true);
		expect(fits(home, { x: 8, z: 6, rot: 1 }, bed)).toBe(false);

		const cleaned = normalizeHome({
			...home,
			items: [
				{ uid: "a", item: "bed", x: 0, z: 0, rot: 0 },
				{ uid: "b", item: "sofa", x: 1, z: 1, rot: 0 },
				{ uid: "c", item: "rug-round", x: 0, z: 0, rot: 0 },
				{ uid: "d", item: "window", x: 9, z: 0, rot: 0, wall: "back" },
				{ uid: "e", item: "window", x: 0, z: 0, rot: 0, wall: "left" },
				{ uid: "f", item: "spaceship", x: 5, z: 5, rot: 0 },
			],
		})!;
		expect(cleaned.items.map((p) => p.uid)).toEqual(["a", "c", "e"]);
		expect(cleaned.items[0]!.c1).toBe("f9");
	});

	it("lists furniture still to unlock", () => {
		const home = normalizeHome({ ...starterHome(), items: [{ uid: "p", item: "piano", x: 3, z: 3, rot: 0 }] })!;
		expect(lockedFurnitureIn(home, new Set()).map((x) => x.id)).toEqual(["piano"]);
		expect(lockedFurnitureIn(home, new Set(["piano"]))).toEqual([]);
	});
});

describe("town", () => {
	it("hides five things in every place, each with its own id", async () => {
		const { FINDS, PLACES } = await import("../roxy/index.ts");
		expect(new Set(FINDS.map((f) => f.id)).size).toBe(FINDS.length);
		for (const p of PLACES)
			expect(
				FINDS.filter((f) => f.place === p),
				p,
			).toHaveLength(5);
	});
});
