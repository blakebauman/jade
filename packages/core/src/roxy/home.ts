import { z } from "zod";
import type { HolidayId } from "./holidays.ts";
import { FABRIC } from "./palettes.ts";

/**
 * Roxy's home: one room on a grid, seen from above at an angle. Floor furniture sits on whole grid squares; wall
 * things hang on the back or left wall. Like looks, a home stores palette keys and catalog ids, never geometry.
 */

/** Room size in grid squares: across (x) and deep (z). */
export const ROOM = { w: 10, d: 8 } as const;
export const MAX_FURNITURE = 40;

export type FurnitureKind = "floor" | "rug" | "wall";
export type Furniture = {
	id: string;
	label: string;
	kind: FurnitureKind;
	/** Footprint in grid squares (across, deep) when not turned; for wall things, `w` is the width along the wall. */
	w: number;
	d: number;
	/** Stars to unlock; 0 is in the starter set. */
	cost: number;
	/** Has a fabric colour the child can change. */
	colour?: string;
	holiday?: HolidayId;
	/** Which room it suits, for grouping in the picker. */
	room: "bedroom" | "living" | "music" | "gym" | "art" | "pets" | "holiday";
};

const f = (
	id: string,
	label: string,
	kind: FurnitureKind,
	w: number,
	d: number,
	room: Furniture["room"],
	cost = 0,
	colour?: string,
	holiday?: HolidayId,
): Furniture => ({
	id,
	label,
	kind,
	w,
	d,
	cost,
	room,
	...(colour && { colour }),
	...(holiday && { holiday }),
});

export const FURNITURE: readonly Furniture[] = [
	// Bedroom
	f("bed", "Bed", "floor", 2, 3, "bedroom", 0, "f9"),
	f("bunkbed", "Bunk bed", "floor", 2, 3, "bedroom", 30, "f3"),
	f("dresser", "Dresser", "floor", 2, 1, "bedroom"),
	f("wardrobe", "Wardrobe", "floor", 2, 1, "bedroom", 20),
	f("nightstand", "Nightstand", "floor", 1, 1, "bedroom"),
	f("lamp", "Floor lamp", "floor", 1, 1, "bedroom", 0, "f5"),
	f("toybox", "Toy box", "floor", 1, 1, "bedroom", 0, "f12"),
	f("rug-round", "Round rug", "rug", 3, 3, "bedroom", 0, "f13"),
	f("rug-long", "Long rug", "rug", 3, 2, "living", 0, "f8"),
	// Living room
	f("sofa", "Sofa", "floor", 3, 1, "living", 0, "f11"),
	f("armchair", "Armchair", "floor", 1, 1, "living", 0, "f4"),
	f("beanbag", "Beanbag", "floor", 1, 1, "living", 0, "f12"),
	f("table", "Round table", "floor", 2, 2, "living"),
	f("chair", "Chair", "floor", 1, 1, "living", 0, "f7"),
	f("bookshelf", "Bookshelf", "floor", 2, 1, "living"),
	f("tv", "TV stand", "floor", 2, 1, "living", 15),
	f("plant", "Big plant", "floor", 1, 1, "living"),
	f("plant-small", "Little plant", "floor", 1, 1, "living"),
	f("desk", "Desk", "floor", 2, 1, "living", 10),
	// Music, gym and art rooms
	f("piano", "Piano", "floor", 2, 1, "music", 30),
	f("drums", "Drum kit", "floor", 2, 2, "music", 25),
	f("guitar", "Guitar stand", "floor", 1, 1, "music", 15),
	f("bike", "Exercise bike", "floor", 1, 2, "gym", 20),
	f("yoga", "Yoga mat", "rug", 1, 2, "gym", 0, "f6"),
	f("weights", "Weights rack", "floor", 2, 1, "gym", 15),
	f("easel", "Easel", "floor", 1, 1, "art", 10),
	f("telescope", "Telescope", "floor", 1, 1, "art", 25),
	// Pets
	f("petbed", "Pet bed", "floor", 1, 1, "pets", 0, "f13"),
	f("cattree", "Cat tree", "floor", 1, 1, "pets", 15),
	f("aquarium", "Aquarium", "floor", 2, 1, "pets", 25),
	// On the walls
	f("window", "Window", "wall", 2, 0, "bedroom"),
	f("picture", "Picture", "wall", 1, 0, "living", 0, "f8"),
	f("clock", "Clock", "wall", 1, 0, "living"),
	f("shelf", "Wall shelf", "wall", 2, 0, "living"),
	f("mirror", "Mirror", "wall", 1, 0, "bedroom", 10),
	f("lights", "String lights", "wall", 3, 0, "bedroom", 15),
	// Holiday decorations (any time of year, for stars)
	f("xmas-tree", "Holiday tree", "floor", 1, 1, "holiday", 20, undefined, "christmas"),
	f("menorah", "Menorah", "floor", 1, 1, "holiday", 20, undefined, "hanukkah"),
	f("kinara", "Kinara", "floor", 1, 1, "holiday", 20, undefined, "kwanzaa"),
	f("diyas", "Diya lamps", "floor", 1, 1, "holiday", 20, undefined, "diwali"),
	f("pumpkins", "Pumpkins", "floor", 1, 1, "holiday", 20, undefined, "halloween"),
	f("lanterns", "Lantern string", "wall", 3, 0, "holiday", 20, undefined, "lunarnewyear"),
	f("crescent", "Crescent lantern", "wall", 1, 0, "holiday", 20, undefined, "eidalfitr"),
];
export const FURNITURE_BY_ID: ReadonlyMap<string, Furniture> = new Map(FURNITURE.map((x) => [x.id, x]));

export const WALLPAPERS = ["plain", "stripes", "dots", "stars", "hearts"] as const;
export const FLOORS = ["wood", "darkwood", "checker", "carpet"] as const;

const fabric = z.enum(Object.keys(FABRIC) as [string, ...string[]]);
export const PlacedSchema = z.object({
	/** Unique within the home, so one item can be picked out. */
	uid: z.string().min(1).max(16),
	item: z.string().max(24),
	x: z.number().int(),
	z: z.number().int(),
	/** Quarter turns. */
	rot: z.number().int().min(0).max(3).default(0),
	/** Wall things only: which wall. */
	wall: z.enum(["back", "left"]).optional(),
	c1: fabric.optional(),
});
export type Placed = z.infer<typeof PlacedSchema>;

export const HomeSchema = z.object({
	v: z.literal(1),
	wall: z.object({ pattern: z.enum(WALLPAPERS), c1: fabric }),
	floor: z.object({ style: z.enum(FLOORS), c1: fabric.optional() }),
	items: z.array(PlacedSchema).max(MAX_FURNITURE),
});
export type Home = z.infer<typeof HomeSchema>;

/** Grid squares a floor item covers, given its quarter turns. */
export function footprint(p: Pick<Placed, "x" | "z" | "rot">, item: Furniture) {
	const turned = p.rot % 2 === 1;
	const w = turned ? item.d : item.w;
	const d = turned ? item.w : item.d;
	return { x0: p.x, z0: p.z, x1: p.x + w - 1, z1: p.z + d - 1, w, d };
}

/** Whether an item can go here: inside the room and, for furniture, not on top of other furniture (rugs go under). */
export function fits(home: Home, p: Pick<Placed, "x" | "z" | "rot" | "wall"> & { uid?: string }, item: Furniture): boolean {
	if (item.kind === "wall") {
		const along = p.wall === "left" ? ROOM.d : ROOM.w;
		const at = p.wall === "left" ? p.z : p.x;
		if (!p.wall || at < 0 || at + item.w > along) return false;
		return home.items.every((o) => {
			const other = FURNITURE_BY_ID.get(o.item);
			if (!other || other.kind !== "wall" || o.uid === p.uid || o.wall !== p.wall) return true;
			const oat = o.wall === "left" ? o.z : o.x;
			return at + item.w <= oat || oat + other.w <= at;
		});
	}
	const a = footprint(p, item);
	if (a.x0 < 0 || a.z0 < 0 || a.x1 >= ROOM.w || a.z1 >= ROOM.d) return false;
	if (item.kind === "rug") return true;
	return home.items.every((o) => {
		const other = FURNITURE_BY_ID.get(o.item);
		if (!other || other.kind !== "floor" || o.uid === p.uid) return true;
		const b = footprint(o, other);
		return a.x1 < b.x0 || b.x1 < a.x0 || a.z1 < b.z0 || b.z1 < a.z0;
	});
}

/**
 * Checks a home and returns it cleaned up: unknown items, things outside the room and furniture stacked on furniture
 * are dropped (in order, so the first one placed keeps its spot). Returns null if the home itself doesn't parse.
 */
export function normalizeHome(input: unknown): Home | null {
	const parsed = HomeSchema.safeParse(input);
	if (!parsed.success) return null;
	const home: Home = { ...parsed.data, items: [] };
	const seen = new Set<string>();
	for (const p of parsed.data.items) {
		const item = FURNITURE_BY_ID.get(p.item);
		if (!item || seen.has(p.uid)) continue;
		const placed: Placed = { uid: p.uid, item: p.item, x: p.x, z: p.z, rot: item.kind === "wall" ? 0 : p.rot };
		if (item.kind === "wall") placed.wall = p.wall ?? "back";
		if (item.colour) placed.c1 = p.c1 ?? item.colour;
		if (!fits(home, placed, item)) continue;
		home.items.push(placed);
		seen.add(p.uid);
	}
	return home;
}

/** Furniture in the home the child doesn't own yet. */
export const lockedFurnitureIn = (home: Home, unlocked: ReadonlySet<string>) =>
	[...new Set(home.items.map((p) => p.item))].map((id) => FURNITURE_BY_ID.get(id)!).filter((x) => x.cost > 0 && !unlocked.has(x.id));

/** Everyone's first home: a bed, a rug, a lamp, a plant, a window and a picture. */
export const starterHome = (): Home => ({
	v: 1,
	wall: { pattern: "stripes", c1: "f14" },
	floor: { style: "wood" },
	items: [
		{ uid: "w1", item: "window", x: 4, z: 0, rot: 0, wall: "back" },
		{ uid: "w2", item: "picture", x: 2, z: 0, rot: 0, wall: "left", c1: "f8" },
		{ uid: "f1", item: "bed", x: 0, z: 0, rot: 0, c1: "f9" },
		{ uid: "f2", item: "nightstand", x: 2, z: 0, rot: 0 },
		{ uid: "f3", item: "rug-round", x: 4, z: 3, rot: 0, c1: "f13" },
		{ uid: "f4", item: "lamp", x: 9, z: 0, rot: 0, c1: "f5" },
		{ uid: "f5", item: "plant", x: 9, z: 7, rot: 0 },
		{ uid: "f6", item: "beanbag", x: 7, z: 2, rot: 0, c1: "f12" },
	],
});
