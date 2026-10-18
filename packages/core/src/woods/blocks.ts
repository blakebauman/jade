/**
 * Campfire Woods blocks. Ids are bytes in the world volume and on the wire, so never renumber one; add new blocks at
 * the end. Tiles name the pixel-art squares the client draws for each face.
 */

export const B = {
	air: 0,
	grass: 1,
	dirt: 2,
	stone: 3,
	sand: 4,
	log: 5,
	leaves: 6,
	planks: 7,
	glass: 8,
	brick: 9,
	coal: 10,
	iron: 11,
	gold: 12,
	gem: 13,
	torch: 14,
	water: 15,
	bedrock: 16,
	woolWhite: 17,
	woolRed: 18,
	woolYellow: 19,
	woolGreen: 20,
	woolBlue: 21,
	woolPink: 22,
	birchLog: 23,
	birchLeaves: 24,
	pineLeaves: 25,
	tallGrass: 26,
	flowerRed: 27,
	flowerYellow: 28,
	flowerBlue: 29,
	mushroom: 30,
} as const;
export type BlockId = (typeof B)[keyof typeof B];

/**
 * How a block is drawn: solid cubes, cubes you can see through the gaps of, clear glass, still water, a small torch,
 * or a plant (two crossed pictures, walked through).
 */
export type BlockDraw = "none" | "solid" | "cutout" | "glass" | "water" | "torch" | "plant";

export type BlockInfo = {
	id: number;
	key: string;
	label: string;
	draw: BlockDraw;
	/** Walls the player; water and torches don't. */
	solid: boolean;
	/** Seconds of holding to mine it by hand. Infinity can't be mined. */
	hardness: number;
	/** What mining it puts in the inventory (null: nothing). */
	drop: number | null;
	/** Seconds of campfire it's worth when fed in (0: won't burn). */
	fuel: number;
	/** Light it gives off, 0 to 1. */
	light: number;
	tiles: { top: string; side: string; bottom: string };
};

const tiles = (all: string, top = all, bottom = all) => ({ top, side: all, bottom });
/** Grass, flowers and toadstools: walked through, picked in a moment. */
const plant = { draw: "plant", solid: false, hardness: 0.05 } as const;

const info = (id: number, key: string, label: string, rest: Partial<BlockInfo> & Pick<BlockInfo, "tiles">): BlockInfo => ({
	id,
	key,
	label,
	draw: "solid",
	solid: true,
	hardness: 0.6,
	drop: id,
	fuel: 0,
	light: 0,
	...rest,
});

export const BLOCKS: readonly BlockInfo[] = [
	info(B.air, "air", "Air", { draw: "none", solid: false, hardness: Number.POSITIVE_INFINITY, drop: null, tiles: tiles("") }),
	info(B.grass, "grass", "Grass", { drop: B.dirt, tiles: tiles("grass_side", "grass_top", "dirt") }),
	info(B.dirt, "dirt", "Dirt", { hardness: 0.5, tiles: tiles("dirt") }),
	info(B.stone, "stone", "Stone", { hardness: 1.2, tiles: tiles("stone") }),
	info(B.sand, "sand", "Sand", { hardness: 0.4, tiles: tiles("sand") }),
	info(B.log, "log", "Log", { hardness: 0.9, fuel: 45, tiles: tiles("log_side", "log_top", "log_top") }),
	info(B.leaves, "leaves", "Leaves", { draw: "cutout", hardness: 0.2, tiles: tiles("leaves") }),
	info(B.planks, "planks", "Planks", { hardness: 0.7, fuel: 20, tiles: tiles("planks") }),
	info(B.glass, "glass", "Glass", { draw: "glass", hardness: 0.3, tiles: tiles("glass") }),
	info(B.brick, "brick", "Brick", { hardness: 1.2, tiles: tiles("brick") }),
	info(B.coal, "coal", "Coal", { hardness: 1.4, fuel: 60, tiles: tiles("coal") }),
	info(B.iron, "iron", "Iron", { hardness: 1.6, tiles: tiles("iron") }),
	info(B.gold, "gold", "Gold", { hardness: 1.8, tiles: tiles("gold") }),
	info(B.gem, "gem", "Gem", { hardness: 2, light: 0.3, tiles: tiles("gem") }),
	info(B.torch, "torch", "Torch", { draw: "torch", solid: false, hardness: 0.05, light: 1, tiles: tiles("torch") }),
	info(B.water, "water", "Water", {
		draw: "water",
		solid: false,
		hardness: Number.POSITIVE_INFINITY,
		drop: null,
		tiles: tiles("water"),
	}),
	info(B.bedrock, "bedrock", "Bedrock", { hardness: Number.POSITIVE_INFINITY, drop: null, tiles: tiles("bedrock") }),
	info(B.woolWhite, "wool-white", "White wool", { hardness: 0.3, tiles: tiles("wool_white") }),
	info(B.woolRed, "wool-red", "Red wool", { hardness: 0.3, tiles: tiles("wool_red") }),
	info(B.woolYellow, "wool-yellow", "Yellow wool", { hardness: 0.3, tiles: tiles("wool_yellow") }),
	info(B.woolGreen, "wool-green", "Green wool", { hardness: 0.3, tiles: tiles("wool_green") }),
	info(B.woolBlue, "wool-blue", "Blue wool", { hardness: 0.3, tiles: tiles("wool_blue") }),
	info(B.woolPink, "wool-pink", "Pink wool", { hardness: 0.3, tiles: tiles("wool_pink") }),
	info(B.birchLog, "birch-log", "Birch log", { hardness: 0.9, fuel: 45, tiles: tiles("birch_side", "birch_top", "birch_top") }),
	info(B.birchLeaves, "birch-leaves", "Birch leaves", { draw: "cutout", hardness: 0.2, tiles: tiles("birch_leaves") }),
	info(B.pineLeaves, "pine-leaves", "Pine needles", { draw: "cutout", hardness: 0.2, tiles: tiles("pine_leaves") }),
	info(B.tallGrass, "tall-grass", "Tall grass", { ...plant, tiles: tiles("tall_grass") }),
	info(B.flowerRed, "flower-red", "Poppy", { ...plant, tiles: tiles("flower_red") }),
	info(B.flowerYellow, "flower-yellow", "Buttercup", { ...plant, tiles: tiles("flower_yellow") }),
	info(B.flowerBlue, "flower-blue", "Bluebell", { ...plant, tiles: tiles("flower_blue") }),
	info(B.mushroom, "mushroom", "Toadstool", { ...plant, tiles: tiles("mushroom") }),
];

export const BLOCK_COUNT = BLOCKS.length;

export const blockInfo = (id: number): BlockInfo => BLOCKS[id] ?? BLOCKS[B.air]!;
export const isSolid = (id: number) => blockInfo(id).solid;
export const isPlant = (id: number) => blockInfo(id).draw === "plant";
/** Leaves of any tree. */
export const isLeaves = (id: number) => id === B.leaves || id === B.birchLeaves || id === B.pineLeaves;
/** A trunk of any tree. */
export const isLog = (id: number) => id === B.log || id === B.birchLog;
/** Faces next to this block are drawn (it doesn't hide what's behind it). */
export const showsThrough = (id: number) => blockInfo(id).draw !== "solid";
export const canMine = (id: number) => Number.isFinite(blockInfo(id).hardness);
/** Placeable from the inventory: anything that drops as itself. */
export const canPlace = (id: number) => id !== B.air && blockInfo(id).drop === id;

/** Every tile name the client has to draw. */
export const TILE_NAMES: readonly string[] = [
	...new Set(BLOCKS.flatMap((b) => [b.tiles.top, b.tiles.side, b.tiles.bottom]).filter(Boolean)),
];

/**
 * Wool is made from nothing (there are no sheep to shear); it's the colour palette for building, so each kid keeps a
 * supply that refills. Torches are the same: a few to light the night with.
 */
export const REFILLS: Readonly<Record<number, number>> = {
	[B.woolWhite]: 64,
	[B.woolRed]: 64,
	[B.woolYellow]: 64,
	[B.woolGreen]: 64,
	[B.woolBlue]: 64,
	[B.woolPink]: 64,
	[B.torch]: 16,
};

/** The most of one block a kid can carry. */
export const STACK_MAX = 999;
