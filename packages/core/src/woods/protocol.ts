import { z } from "zod";
import { BLOCK_COUNT } from "./blocks.ts";
import type { WoodsStats } from "./goals.ts";
import type { Animal, Lost } from "./night.ts";
import { CELLS, H, W } from "./volume.ts";

/**
 * What a Campfire Woods screen and its island say to each other over the WebSocket. Text frames are JSON; the one
 * binary frame type is a run of packed edits (see `packEdit`), sent on joining and after an undo.
 */

export const EMOTES = ["wave", "heart", "star", "here"] as const;
export type Emote = (typeof EMOTES)[number];

/** Players on one island at once. */
export const ISLAND_MAX = 8;
/** Moves are sent this often. */
export const MOVE_HZ = 10;
/** How far a figure can reach to mine or build, in blocks. */
export const REACH = 6;
/** Edits one screen can make in a second. */
export const EDITS_PER_S = 20;
/** Edits one island keeps; past it, building is refused (mining what's been built still works). */
export const EDITS_MAX = 200_000;

const cell = z.number().int().nonnegative().lt(CELLS);
const block = z.number().int().positive().lt(BLOCK_COUNT);
/** Positions may stray a little off the island (a kid who walks into the sea), but not far. */
const FAR = W * 2;
const TALL = H * 2;
const across = z.number().gte(-W).lte(FAR);
const pos = z.tuple([across, z.number().gte(-H).lte(TALL), across]);

export const clientMsg = z.discriminatedUnion("t", [
	z.object({ t: z.literal("move"), p: pos, yaw: z.number() }),
	z.object({ t: z.literal("mine"), i: cell }),
	z.object({ t: z.literal("place"), i: cell, b: block }),
	z.object({ t: z.literal("feed"), b: block }),
	z.object({ t: z.literal("pickup"), id: z.string().max(16) }),
	z.object({ t: z.literal("emote"), e: z.enum(EMOTES) }),
	z.object({ t: z.literal("craft"), recipe: z.string().max(24) }),
]);
export type ClientMsg = z.infer<typeof clientMsg>;

/** Someone on the island. Friends see only an initial; family see the name. */
export type Figure = { seat: number; label: string; colour: string; guest: boolean; p: [number, number, number]; yaw: number };
export type Inventory = Record<number, number>;
export type Clock = {
	elapsed: number;
	fuel: number;
	/** Nights the fire stayed lit all night, on this island, ever. */
	nights: number;
};

export type ServerMsg =
	| {
			t: "welcome";
			seat: number;
			seed: number;
			/** How the island was made from its seed (`generate(seed, gen)`). */
			gen: number;
			island: { label: string; mine: boolean; build: boolean };
			figures: Figure[];
			inv: Inventory;
			stats: WoodsStats;
			clock: Clock;
			lost: (Lost & { follows: number | null })[];
			home: Animal[];
	  }
	| { t: "join"; figure: Figure }
	| { t: "leave"; seat: number }
	| { t: "move"; seat: number; p: [number, number, number]; yaw: number }
	| { t: "edit"; i: number; b: number; seat: number }
	| { t: "refused"; i: number; b: number; why: "reach" | "inventory" | "occupied" | "visit" | "full" | "fast" | "fixed" }
	| { t: "crafted"; recipe: string; ok: boolean; why?: "inventory" | "fire" }
	/** To the kid who fed the fire: it took the log. */
	| { t: "fed" }
	| { t: "inv"; inv: Inventory; stats: WoodsStats }
	| { t: "tick"; clock: Clock }
	| { t: "night"; night: number; lost: Lost[] }
	| { t: "dawn"; night: number; kept: boolean }
	| { t: "lost"; id: string; follows: number | null }
	| { t: "home"; id: string; animal: Animal; seat: number }
	| { t: "goal"; id: string; key: string; tickets: number; label: string }
	| { t: "emote"; seat: number; e: Emote }
	| { t: "kicked"; why: "friends" | "full" | "elsewhere" };
