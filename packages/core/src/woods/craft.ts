import { B } from "./blocks.ts";

/**
 * Making things at camp: split a log into planks, make torches from coal and planks, and, in the fire's heat, melt
 * sand into glass and bake stone into brick. Each recipe takes blocks from the bag and gives others back.
 */

export type Recipe = {
	id: string;
	label: string;
	/** Blocks used, by id and how many (any of `or` will do for the first). */
	takes: { b: number; n: number; or?: number[] }[];
	gives: { b: number; n: number };
	/** Needs the fire's heat: only by the campfire, and only while it's lit. */
	fire: boolean;
};

export const RECIPES: readonly Recipe[] = [
	{ id: "planks", label: "Planks", takes: [{ b: B.log, n: 1, or: [B.birchLog] }], gives: { b: B.planks, n: 4 }, fire: false },
	{
		id: "torches",
		label: "Torches",
		takes: [
			{ b: B.coal, n: 1 },
			{ b: B.planks, n: 1 },
		],
		gives: { b: B.torch, n: 4 },
		fire: false,
	},
	{ id: "glass", label: "Glass", takes: [{ b: B.sand, n: 2 }], gives: { b: B.glass, n: 1 }, fire: true },
	{ id: "brick", label: "Brick", takes: [{ b: B.stone, n: 2, or: [B.mossyStone] }], gives: { b: B.brick, n: 1 }, fire: true },
];

export const RECIPE_BY_ID: Readonly<Record<string, Recipe>> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/**
 * Which blocks a recipe would use from this bag (the first of each `or` choice there's enough of), or null if the
 * bag can't make it.
 */
export function craftUses(r: Recipe, inv: Readonly<Record<number, number>>): { b: number; n: number }[] | null {
	const uses: { b: number; n: number }[] = [];
	for (const t of r.takes) {
		const pick = [t.b, ...(t.or ?? [])].find((b) => (inv[b] ?? 0) >= t.n);
		if (pick === undefined) return null;
		uses.push({ b: pick, n: t.n });
	}
	return uses;
}
