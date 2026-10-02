/**
 * Places in Roxy's town, each with things hidden in it to find. Finding things is for fun, a collection to fill;
 * it never earns stars (stars come only from practice).
 */

export const PLACES = ["park", "petshop", "school"] as const;
export type PlaceId = (typeof PLACES)[number];

export type PlaceInfo = { id: PlaceId; label: string; note: string; area: { w: number; d: number } };

export const PLACE_INFO: Record<PlaceId, PlaceInfo> = {
	park: { id: "park", label: "The park", note: "Trees, a pond and a playground", area: { w: 14, d: 10 } },
	petshop: { id: "petshop", label: "Pet shop", note: "Meet the animals and pick a pet", area: { w: 10, d: 8 } },
	school: { id: "school", label: "School", note: "Desks, books and the big chalkboard", area: { w: 12, d: 9 } },
};

export type Find = { id: string; place: PlaceId; label: string };

/** Five finds per place. Where each one hides is the scene's business; this is what can be found. */
export const FINDS: readonly Find[] = [
	{ id: "park-acorn", place: "park", label: "Golden acorn" },
	{ id: "park-shell", place: "park", label: "Pond shell" },
	{ id: "park-kite", place: "park", label: "Lost kite" },
	{ id: "park-ladybug", place: "park", label: "Ladybug" },
	{ id: "park-feather", place: "park", label: "Blue feather" },
	{ id: "petshop-bone", place: "petshop", label: "Squeaky bone" },
	{ id: "petshop-yarn", place: "petshop", label: "Ball of yarn" },
	{ id: "petshop-carrot", place: "petshop", label: "Bunny carrot" },
	{ id: "petshop-fishfood", place: "petshop", label: "Fish flakes" },
	{ id: "petshop-collar", place: "petshop", label: "Sparkly collar" },
	{ id: "school-pencil", place: "school", label: "Lucky pencil" },
	{ id: "school-star", place: "school", label: "Gold star sticker" },
	{ id: "school-apple", place: "school", label: "Shiny apple" },
	{ id: "school-book", place: "school", label: "Secret book" },
	{ id: "school-globe", place: "school", label: "Tiny globe" },
];
export const FIND_BY_ID: ReadonlyMap<string, Find> = new Map(FINDS.map((f) => [f.id, f]));
