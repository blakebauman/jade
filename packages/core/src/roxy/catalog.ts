import type { HolidayId } from "./holidays.ts";
import type { PaletteName } from "./palettes.ts";

/**
 * Everything a Roxy can wear, by slot. The art for each id lives in apps/web (components/roxy/art); a web test
 * checks that every id here has art. Slots are what a look stores — the stage decides the layer order.
 */
export const SLOTS = [
	"background",
	"body",
	"face",
	"eyes",
	"brows",
	"nose",
	"mouth",
	"marks",
	"blush",
	"eyeshadow",
	"lips",
	"facepaint",
	"hair",
	"top",
	"bottom",
	"dress",
	"outer",
	"socks",
	"shoes",
	"hat",
	"glasses",
	"earrings",
	"necklace",
	"bag",
	"gem",
	"form",
	"pet",
	"petwear",
] as const;
export type Slot = (typeof SLOTS)[number];

/** Every look has one of each of these. */
export const REQUIRED_SLOTS = ["background", "body", "face", "eyes", "brows", "nose", "mouth"] as const satisfies readonly Slot[];

/** Pet accessories need a pet to wear them. */
export const NEEDS: Partial<Record<Slot, Slot>> = { petwear: "pet" };

/** A dress replaces a top and bottom, and the other way round. */
export const EXCLUSIVE: Partial<Record<Slot, readonly Slot[]>> = { dress: ["top", "bottom"], top: ["dress"], bottom: ["dress"] };

export const ANIMALS = ["fox", "cat", "bunny", "puppy", "panda", "bear"] as const;
export type Animal = (typeof ANIMALS)[number];

export type Item = {
	id: string;
	slot: Slot;
	label: string;
	/** Stars to unlock. 0 is in the starter set. */
	cost: number;
	/** Palettes for the item's colourable parts, c1 then c2. */
	colors?: readonly PaletteName[];
	/** Default colour keys, matching `colors`. */
	defaults?: readonly string[];
	/** Part of a holiday's collection. */
	holiday?: HolidayId;
	/** The collection's free gift while the holiday's window is open. */
	gift?: boolean;
	/** Animal for gems (ears and tail) and forms (the whole character). */
	animal?: Animal;
};

type Spec = Omit<Item, "slot" | "cost"> & { cost?: number };
const group = (slot: Slot, specs: Spec[], base: Partial<Item> = {}): Item[] =>
	specs.map((s) => ({ ...base, ...s, slot, cost: s.cost ?? base.cost ?? 0 }) as Item);

const FAB = ["fabric", "fabric"] as const;
const FAB1 = ["fabric"] as const;

const BASE: Item[] = [
	...group("background", [
		{ id: "stage-felt", label: "Jade felt" },
		{ id: "stage-meadow", label: "Meadow" },
		{ id: "stage-beach", label: "Beach" },
		{ id: "stage-night", label: "Starry night" },
		{ id: "stage-city", label: "City", cost: 20 },
		{ id: "stage-castle", label: "Castle", cost: 30 },
	]),
	...group("body", [
		{ id: "body-slim", label: "Slim" },
		{ id: "body-mid", label: "Medium" },
		{ id: "body-round", label: "Round" },
	]),
	...group("face", [
		{ id: "face-oval", label: "Oval" },
		{ id: "face-round", label: "Round" },
		{ id: "face-heart", label: "Heart" },
		{ id: "face-square", label: "Square" },
	]),
	...group(
		"eyes",
		[
			{ id: "eyes-round", label: "Round" },
			{ id: "eyes-almond", label: "Almond" },
			{ id: "eyes-big", label: "Big and bright" },
			{ id: "eyes-sleepy", label: "Sleepy" },
			{ id: "eyes-lashes", label: "Lashes" },
			{ id: "eyes-happy", label: "Happy" },
			{ id: "eyes-wide", label: "Wide" },
			{ id: "eyes-star", label: "Starry", cost: 15 },
		],
		{ colors: ["eye"], defaults: ["e2"] },
	),
	...group(
		"brows",
		[
			{ id: "brows-soft", label: "Soft" },
			{ id: "brows-arched", label: "Arched" },
			{ id: "brows-straight", label: "Straight" },
			{ id: "brows-bold", label: "Bold" },
			{ id: "brows-thin", label: "Thin" },
		],
		{ colors: ["hair"], defaults: ["h2"] },
	),
	...group("nose", [
		{ id: "nose-button", label: "Button" },
		{ id: "nose-dot", label: "Dot" },
		{ id: "nose-round", label: "Round" },
		{ id: "nose-line", label: "Line" },
	]),
	...group("mouth", [
		{ id: "mouth-smile", label: "Smile" },
		{ id: "mouth-grin", label: "Grin" },
		{ id: "mouth-open", label: "Laugh" },
		{ id: "mouth-o", label: "Ooh" },
		{ id: "mouth-tongue", label: "Silly" },
		{ id: "mouth-smirk", label: "Smirk" },
		{ id: "mouth-teeth", label: "Toothy" },
		{ id: "mouth-cat", label: "Cat smile" },
	]),
	...group("marks", [
		{ id: "marks-freckles", label: "Freckles" },
		{ id: "marks-beauty", label: "Beauty mark" },
		{ id: "marks-dimples", label: "Dimples" },
	]),
	...group(
		"blush",
		[
			{ id: "blush-round", label: "Rosy" },
			{ id: "blush-soft", label: "Soft" },
			{ id: "blush-stripes", label: "Stripes" },
			{ id: "blush-hearts", label: "Hearts", cost: 10 },
		],
		{ colors: ["makeup"], defaults: ["m1"] },
	),
	...group(
		"eyeshadow",
		[
			{ id: "shadow-soft", label: "Soft" },
			{ id: "shadow-wing", label: "Wing" },
			{ id: "shadow-glitter", label: "Glitter", cost: 15 },
			{ id: "shadow-rainbow", label: "Rainbow", cost: 25 },
		],
		{ colors: ["makeup"], defaults: ["m6"] },
	),
	...group(
		"lips",
		[
			{ id: "lips-gloss", label: "Gloss" },
			{ id: "lips-bold", label: "Bold" },
			{ id: "lips-ombre", label: "Ombre", cost: 10 },
			{ id: "lips-heart", label: "Heart", cost: 15 },
		],
		{ colors: ["makeup"], defaults: ["m2"] },
	),
	...group(
		"facepaint",
		[
			{ id: "paint-star", label: "Star" },
			{ id: "paint-flower", label: "Flower" },
			{ id: "paint-hearts", label: "Hearts" },
			{ id: "paint-lightning", label: "Lightning", cost: 10 },
			{ id: "paint-rainbow", label: "Rainbow", cost: 15 },
			{ id: "paint-butterfly", label: "Butterfly", cost: 20 },
		],
		{ colors: ["makeup"], defaults: ["m7"] },
	),
	...group(
		"hair",
		[
			{ id: "hair-buzz", label: "Buzz" },
			{ id: "hair-pixie", label: "Pixie" },
			{ id: "hair-bob", label: "Bob" },
			{ id: "hair-long", label: "Long" },
			{ id: "hair-wavy", label: "Wavy" },
			{ id: "hair-curly", label: "Curly" },
			{ id: "hair-coily", label: "Coily" },
			{ id: "hair-puffs", label: "Puffs" },
			{ id: "hair-locs", label: "Locs" },
			{ id: "hair-braids", label: "Braids" },
			{ id: "hair-cornrows", label: "Cornrows" },
			{ id: "hair-pigtails", label: "Pigtails" },
			{ id: "hair-ponytail", label: "Ponytail" },
			{ id: "hair-bun", label: "Top bun" },
			{ id: "hair-spacebuns", label: "Space buns", cost: 10 },
			{ id: "hair-side", label: "Side sweep", cost: 10 },
			{ id: "hair-mohawk", label: "Mohawk", cost: 20 },
			{ id: "hair-princess", label: "Very long", cost: 25 },
		],
		{ colors: ["hair"], defaults: ["h3"] },
	),
	...group(
		"top",
		[
			{ id: "top-tee", label: "T-shirt", colors: FAB1, defaults: ["f9"] },
			{ id: "top-stripes", label: "Stripes", defaults: ["f1", "f10"] },
			{ id: "top-tank", label: "Tank top", colors: FAB1, defaults: ["f12"] },
			{ id: "top-long", label: "Long sleeves", colors: FAB1, defaults: ["f7"] },
			{ id: "top-crop", label: "Crop top", colors: FAB1, defaults: ["f13"] },
			{ id: "top-polo", label: "Polo", defaults: ["f8", "f1"] },
			{ id: "top-ruffle", label: "Ruffles", colors: FAB1, defaults: ["f16"] },
			{ id: "top-star", label: "Star tee", defaults: ["f10", "f5"] },
			{ id: "top-heart", label: "Heart tee", defaults: ["f1", "f3"] },
			{ id: "top-hoodie", label: "Hoodie", defaults: ["f11", "f1"] },
			{ id: "top-sweater", label: "Sweater", defaults: ["f4", "f1"], cost: 10 },
			{ id: "top-sequin", label: "Sequins", colors: FAB1, defaults: ["f12"], cost: 25 },
		],
		{ colors: FAB },
	),
	...group(
		"bottom",
		[
			{ id: "bottom-jeans", label: "Jeans", defaults: ["f9"] },
			{ id: "bottom-leggings", label: "Leggings", defaults: ["f2"] },
			{ id: "bottom-shorts", label: "Shorts", defaults: ["f18"] },
			{ id: "bottom-skirt", label: "Skirt", defaults: ["f12"] },
			{ id: "bottom-pleated", label: "Pleated skirt", defaults: ["f10"] },
			{ id: "bottom-cargo", label: "Cargo pants", defaults: ["f17"] },
			{ id: "bottom-overalls", label: "Overalls", defaults: ["f9"], cost: 10 },
			{ id: "bottom-tutu", label: "Tutu", defaults: ["f13"], cost: 20 },
		],
		{ colors: FAB1 },
	),
	...group(
		"dress",
		[
			{ id: "dress-simple", label: "Everyday", colors: FAB1, defaults: ["f7"] },
			{ id: "dress-sun", label: "Sundress", defaults: ["f5", "f1"] },
			{ id: "dress-stripe", label: "Striped", defaults: ["f1", "f3"] },
			{ id: "dress-dots", label: "Polka dots", defaults: ["f9", "f1"] },
			{ id: "dress-tiered", label: "Tiered", defaults: ["f13", "f12"] },
			{ id: "dress-jumpsuit", label: "Jumpsuit", colors: FAB1, defaults: ["f8"] },
			{ id: "dress-party", label: "Party", defaults: ["f11", "f5"], cost: 20 },
			{ id: "dress-gown", label: "Ball gown", defaults: ["f14", "f1"], cost: 35 },
		],
		{ colors: FAB },
	),
	...group(
		"outer",
		[
			{ id: "outer-denim", label: "Denim jacket", defaults: ["f9"] },
			{ id: "outer-cardigan", label: "Cardigan", defaults: ["f15"] },
			{ id: "outer-raincoat", label: "Raincoat", defaults: ["f5"] },
			{ id: "outer-puffer", label: "Puffer", defaults: ["f3"], cost: 10 },
			{ id: "outer-blazer", label: "Blazer", defaults: ["f10"], cost: 15 },
			{ id: "outer-cape", label: "Cape", defaults: ["f11"], cost: 25 },
		],
		{ colors: FAB1 },
	),
	...group(
		"socks",
		[
			{ id: "socks-ankle", label: "Ankle socks", defaults: ["f1"] },
			{ id: "socks-knee", label: "Knee socks", defaults: ["f10"] },
			{ id: "socks-stripe", label: "Striped socks", colors: FAB, defaults: ["f1", "f12"] },
			{ id: "socks-tights", label: "Tights", defaults: ["f11"] },
		],
		{ colors: FAB1 },
	),
	...group(
		"shoes",
		[
			{ id: "shoes-sneakers", label: "Sneakers", colors: FAB, defaults: ["f1", "f3"] },
			{ id: "shoes-hightops", label: "High-tops", colors: FAB, defaults: ["f2", "f1"] },
			{ id: "shoes-flats", label: "Flats", defaults: ["f12"] },
			{ id: "shoes-sandals", label: "Sandals", defaults: ["f17"] },
			{ id: "shoes-boots", label: "Boots", defaults: ["f17"] },
			{ id: "shoes-rainboots", label: "Rain boots", defaults: ["f5"] },
			{ id: "shoes-maryjanes", label: "Mary Janes", defaults: ["f2"] },
			{ id: "shoes-cowboy", label: "Cowboy boots", defaults: ["f20"], cost: 10 },
			{ id: "shoes-slippers", label: "Bunny slippers", defaults: ["f13"], cost: 15 },
			{ id: "shoes-skates", label: "Roller skates", colors: FAB, defaults: ["f8", "f12"], cost: 25 },
		],
		{ colors: FAB1 },
	),
	...group(
		"hat",
		[
			{ id: "hat-cap", label: "Cap", defaults: ["f3"] },
			{ id: "hat-beanie", label: "Beanie", defaults: ["f8"] },
			{ id: "hat-bow", label: "Bow", defaults: ["f12"] },
			{ id: "hat-headband", label: "Headband", defaults: ["f5"] },
			{ id: "hat-hijab", label: "Hijab", defaults: ["f11"] },
			{ id: "hat-headwrap", label: "Head wrap", colors: FAB, defaults: ["f4", "f5"] },
			{ id: "hat-flowers", label: "Flower crown", cost: 15, colors: undefined },
			{ id: "hat-crown", label: "Crown", cost: 30, colors: undefined },
		],
		{ colors: FAB1 },
	),
	...group(
		"glasses",
		[
			{ id: "glasses-round", label: "Round" },
			{ id: "glasses-square", label: "Square" },
			{ id: "glasses-heart", label: "Hearts", cost: 10 },
			{ id: "glasses-star", label: "Stars", cost: 15 },
		],
		{ colors: FAB1, defaults: ["f2"] },
	),
	...group("earrings", [
		{ id: "earrings-studs", label: "Studs" },
		{ id: "earrings-hoops", label: "Hoops" },
		{ id: "earrings-stars", label: "Stars" },
		{ id: "earrings-drops", label: "Drops", cost: 10 },
		{ id: "earrings-pearls", label: "Pearls", cost: 10 },
	]),
	...group("necklace", [
		{ id: "necklace-heart", label: "Heart locket" },
		{ id: "necklace-beads", label: "Beads", colors: ["fabric"], defaults: ["f8"] },
		{ id: "necklace-pearls", label: "Pearls", cost: 10 },
		{ id: "necklace-choker", label: "Choker", colors: ["fabric"], defaults: ["f2"] },
	]),
	...group(
		"bag",
		[
			{ id: "bag-backpack", label: "Backpack", defaults: ["f9"] },
			{ id: "bag-purse", label: "Purse", defaults: ["f12"] },
			{ id: "bag-tote", label: "Tote", defaults: ["f18"], cost: 10 },
		],
		{ colors: FAB1 },
	),
	// Small gems give the character an animal's ears and tail; the moon gem (forms) turns them into the animal.
	...group(
		"gem",
		[
			{ id: "gem-cat", label: "Sapphire: cat", animal: "cat", cost: 0 },
			{ id: "gem-fox", label: "Ruby: fox", animal: "fox" },
			{ id: "gem-bunny", label: "Emerald: bunny", animal: "bunny" },
			{ id: "gem-puppy", label: "Topaz: puppy", animal: "puppy" },
			{ id: "gem-panda", label: "Pearl: panda", animal: "panda" },
			{ id: "gem-bear", label: "Amber: bear", animal: "bear" },
		],
		{ cost: 20, colors: ["hair"], defaults: ["h9"] },
	),
	...group(
		"form",
		ANIMALS.map((a) => ({ id: `form-${a}`, label: a[0]!.toUpperCase() + a.slice(1), animal: a })),
		{ cost: 40, colors: ["hair"], defaults: ["h9"] },
	),
	// A pet stands beside the character. Its coat is c1 and its markings c2.
	...group(
		"pet",
		[
			{ id: "pet-cat", label: "Cat", defaults: ["p4", "p6"] },
			{ id: "pet-dog", label: "Dog", defaults: ["p3", "p2"] },
			{ id: "pet-bunny", label: "Bunny", defaults: ["p6", "p5"] },
			{ id: "pet-hamster", label: "Hamster", defaults: ["p4", "p6"] },
			{ id: "pet-goldfish", label: "Goldfish", defaults: ["p8", "p15"] },
			{ id: "pet-turtle", label: "Turtle", defaults: ["p10", "p9"] },
			{ id: "pet-frog", label: "Frog", defaults: ["p9", "p15"], cost: 10 },
			{ id: "pet-hedgehog", label: "Hedgehog", defaults: ["p5", "p2"], cost: 15 },
			{ id: "pet-parrot", label: "Parrot", defaults: ["p9", "p12"], cost: 15 },
			{ id: "pet-gecko", label: "Gecko", defaults: ["p15", "p8"], cost: 20 },
			{ id: "pet-snake", label: "Snake", defaults: ["p16", "p15"], cost: 20 },
			{ id: "pet-dragon", label: "Bearded dragon", defaults: ["p11", "p8"], cost: 30 },
		],
		{ colors: ["pet", "pet"] },
	),
	...group(
		"petwear",
		[
			{ id: "petwear-collar", label: "Collar", defaults: ["f3"] },
			{ id: "petwear-bow", label: "Bow", defaults: ["f12"] },
			{ id: "petwear-bandana", label: "Bandana", defaults: ["f9"] },
			{ id: "petwear-scarf", label: "Scarf", defaults: ["f7"], cost: 10 },
			{ id: "petwear-partyhat", label: "Party hat", defaults: ["f11"], cost: 10 },
			{ id: "petwear-crown", label: "Tiny crown", cost: 25, colors: undefined },
		],
		{ colors: FAB1 },
	),
];

/** Holiday collections. Each has a stage and a gift; the rest unlock with stars any time of year. */
const HOLIDAY_ITEMS: Item[] = (
	[
		[
			"newyear",
			"stage-newyear",
			"New Year night",
			"hat-newyear",
			"Party tiara",
			[
				["dress-newyear", "dress", "Midnight sparkle", ["f10", "f5"]],
				["glasses-newyear", "glasses", "Party glasses", ["f5"]],
			],
		],
		[
			"lunarnewyear",
			"stage-lunar",
			"Lantern street",
			"earrings-lantern",
			"Lantern earrings",
			[
				["dress-qipao", "dress", "Qipao", ["f3", "f5"]],
				["top-lunar", "top", "Knot-button jacket", ["f3", "f5"]],
				["bag-fan", "bag", "Paper fan", undefined],
			],
		],
		[
			"valentines",
			"stage-valentines",
			"Hearts",
			"hat-hearts",
			"Heart headband",
			[
				["dress-valentine", "dress", "Heart dress", ["f13", "f3"]],
				["bag-heart", "bag", "Heart purse", ["f3"]],
				["petwear-hearts", "petwear", "Heart collar", undefined],
			],
		],
		[
			"holi",
			"stage-holi",
			"Festival of colours",
			"paint-holi",
			"Colour splash",
			[
				["top-holi", "top", "Holi kurta", ["f1", "f12"]],
				["necklace-marigold", "necklace", "Flower garland", undefined],
			],
		],
		[
			"eidalfitr",
			"stage-eid",
			"Crescent lanterns",
			"earrings-crescent",
			"Crescent earrings",
			[
				["dress-abaya", "dress", "Festive abaya", ["f10", "f5"]],
				["bag-lantern", "bag", "Lantern purse", undefined],
			],
		],
		[
			"passover",
			"stage-passover",
			"Spring table",
			"hat-springflowers",
			"Spring flowers",
			[
				["top-passover", "top", "Spring blouse", ["f14", "f1"]],
				["dress-spring", "dress", "Spring dress", ["f15", "f1"]],
			],
		],
		[
			"easter",
			"stage-easter",
			"Egg hunt",
			"hat-bunnyears",
			"Bunny ears",
			[
				["dress-easter", "dress", "Pastel dress", ["f16", "f5"]],
				["bag-basket", "bag", "Egg basket", undefined],
			],
		],
		[
			"earthday",
			"stage-earth",
			"Our planet",
			"top-earth",
			"Planet tee",
			[
				["hat-leaves", "hat", "Leaf crown", undefined],
				["bag-earthtote", "bag", "Reusable tote", ["f6"]],
			],
		],
		[
			"eidaladha",
			"stage-eidaladha",
			"Starry feast",
			"necklace-crescent",
			"Crescent necklace",
			[
				["dress-kaftan", "dress", "Kaftan", ["f7", "f5"]],
				["hat-hijab-gold", "hat", "Gold-trim hijab", ["f1"]],
			],
		],
		[
			"halloween",
			"stage-halloween",
			"Pumpkin patch",
			"hat-witch",
			"Witch hat",
			[
				["outer-bat", "outer", "Bat cape", ["f2"]],
				["dress-pumpkin", "dress", "Pumpkin dress", ["f4", "f2"]],
				["paint-skeleton", "facepaint", "Skeleton paint", undefined],
				["petwear-pumpkin", "petwear", "Pumpkin bandana", undefined],
			],
		],
		[
			"diadelosmuertos",
			"stage-dia",
			"Marigold garlands",
			"paint-catrina",
			"Calavera paint",
			[
				["hat-marigolds", "hat", "Marigold crown", undefined],
				["dress-dia", "dress", "Embroidered dress", ["f1", "f3"]],
			],
		],
		[
			"diwali",
			"stage-diwali",
			"Diya lights",
			"paint-bindi",
			"Bindi gem",
			[
				["dress-lehenga", "dress", "Lehenga", ["f12", "f5"]],
				["earrings-jhumka", "earrings", "Jhumka earrings", undefined],
			],
		],
		[
			"thanksgiving",
			"stage-autumn",
			"Autumn leaves",
			"top-flannel",
			"Flannel shirt",
			[
				["outer-vest", "outer", "Puffy vest", ["f17"]],
				["hat-autumnbeanie", "hat", "Leaf beanie", ["f4"]],
			],
		],
		[
			"hanukkah",
			"stage-hanukkah",
			"Menorah lights",
			"top-hanukkah",
			"Blue and silver sweater",
			[
				["necklace-scarf", "necklace", "Cozy scarf", ["f9"]],
				["hat-pompom", "hat", "Pom-pom hat", ["f9"]],
			],
		],
		[
			"christmas",
			"stage-christmas",
			"Snowy tree",
			"hat-santa",
			"Holiday hat",
			[
				["top-xmas", "top", "Holiday sweater", ["f3", "f7"]],
				["shoes-elf", "shoes", "Curly slippers", ["f7"]],
				["petwear-santa", "petwear", "Pet holiday hat", undefined],
			],
		],
		[
			"kwanzaa",
			"stage-kwanzaa",
			"Kinara candles",
			"top-kente",
			"Kente top",
			[
				["hat-gele", "hat", "Gele head wrap", ["f5"]],
				["necklace-kwanzaa", "necklace", "Bead necklace", undefined],
			],
		],
	] as const
).flatMap(([holiday, stage, stageLabel, gift, giftLabel, rest]) => {
	const colorsFor = (d: readonly string[] | undefined) => (d ? (d.length === 2 ? FAB : FAB1) : undefined);
	return [
		{ id: stage, slot: "background" as Slot, label: stageLabel, cost: 30, holiday },
		{ id: gift, slot: slotOf(gift), label: giftLabel, cost: 20, holiday, gift: true },
		...rest.map(([id, slot, label, defaults]) => ({
			id,
			slot: slot as Slot,
			label,
			cost: 25,
			holiday,
			...(defaults && { colors: colorsFor(defaults), defaults }),
		})),
	];
});

function slotOf(id: string): Slot {
	const prefix = id.split("-")[0]!;
	return ({ hat: "hat", earrings: "earrings", paint: "facepaint", top: "top", necklace: "necklace" } as Record<string, Slot>)[prefix]!;
}

export const ITEMS: readonly Item[] = [...BASE, ...HOLIDAY_ITEMS];
export const ITEM: ReadonlyMap<string, Item> = new Map(ITEMS.map((i) => [i.id, i]));

export const SLOT_LABEL: Record<Slot, string> = {
	background: "Stage",
	body: "Body",
	face: "Face shape",
	eyes: "Eyes",
	brows: "Brows",
	nose: "Nose",
	mouth: "Mouth",
	marks: "Freckles",
	blush: "Blush",
	eyeshadow: "Eye shadow",
	lips: "Lips",
	facepaint: "Face paint",
	hair: "Hair",
	top: "Tops",
	bottom: "Bottoms",
	dress: "Dresses",
	outer: "Jackets",
	socks: "Socks",
	shoes: "Shoes",
	hat: "Hats",
	glasses: "Glasses",
	earrings: "Earrings",
	necklace: "Necklaces",
	bag: "Bags",
	gem: "Gems",
	form: "Moon gem",
	pet: "Pets",
	petwear: "Pet accessories",
};

/** Studio tabs, each a few slots. Holiday collections get their own tab while one is on. */
export const TABS = [
	{ id: "body", label: "Body", slots: ["body", "face"] },
	{ id: "face", label: "Face", slots: ["eyes", "brows", "nose", "mouth", "marks"] },
	{ id: "makeup", label: "Makeup", slots: ["eyeshadow", "blush", "lips", "facepaint"] },
	{ id: "hair", label: "Hair", slots: ["hair"] },
	{ id: "clothes", label: "Clothes", slots: ["top", "bottom", "dress", "outer"] },
	{ id: "shoes", label: "Shoes", slots: ["shoes", "socks"] },
	{ id: "extras", label: "Extras", slots: ["hat", "glasses", "earrings", "necklace", "bag"] },
	{ id: "gems", label: "Gems", slots: ["gem", "form"] },
	{ id: "pets", label: "Pets", slots: ["pet", "petwear"] },
	{ id: "stage", label: "Stage", slots: ["background"] },
] as const satisfies readonly { id: string; label: string; slots: readonly Slot[] }[];
