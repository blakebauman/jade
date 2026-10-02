import { ITEMS, type Slot } from "@jade/core/roxy";
import { describe, expect, it } from "vitest";
import { BAGS_3D, EARRINGS_3D, GLASSES_3D, HATS_3D, NECKLACES_3D } from "./accessories.tsx";
import { PETS_3D, PETWEAR_3D } from "./animals.tsx";
import { CLOTHES_3D, SHOES_3D, SOCKS_3D } from "./clothes.tsx";
import { HAIR_3D } from "./hair.tsx";

/** Slots whose items are each built in 3D. Faces and makeup are drawn on the head; gems, forms and stages are by kind. */
const BUILT: Partial<Record<Slot, ReadonlySet<string>>> = {
	hair: HAIR_3D,
	top: CLOTHES_3D,
	bottom: CLOTHES_3D,
	dress: CLOTHES_3D,
	outer: CLOTHES_3D,
	socks: SOCKS_3D,
	shoes: SHOES_3D,
	hat: HATS_3D,
	glasses: GLASSES_3D,
	earrings: EARRINGS_3D,
	necklace: NECKLACES_3D,
	bag: BAGS_3D,
	pet: new Set(Object.keys(PETS_3D)),
	petwear: PETWEAR_3D,
};

describe("3D Roxy", () => {
	it("has a 3D model for everything she can wear", () => {
		const missing = ITEMS.filter((i) => BUILT[i.slot] && !BUILT[i.slot]!.has(i.id)).map((i) => i.id);
		expect(missing).toEqual([]);
	});
});
