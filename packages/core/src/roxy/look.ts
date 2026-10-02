import { z } from "zod";
import { pick, type Rng, seeded } from "../math/rng.ts";
import { EXCLUSIVE, ITEM, ITEMS, type Item, NEEDS, REQUIRED_SLOTS, SLOTS, type Slot } from "./catalog.ts";
import { PALETTES, SKIN, type SkinId } from "./palettes.ts";

const PET_NAME_MAX_ = 16;
const colorKey = z.string().max(4).optional();
export const WornSchema = z.object({ item: z.string().max(40), c1: colorKey, c2: colorKey });
export type Worn = z.infer<typeof WornSchema>;

/** How Roxy stands in 3D. Saved with the look but not part of its fingerprint, like the pet's name. */
export const POSES = ["stand", "wave", "hips", "cheer", "twirl"] as const;
export type Pose = (typeof POSES)[number];
export const POSE_LABEL: Record<Pose, string> = { stand: "Stand", wave: "Wave", hips: "Hands on hips", cheer: "Cheer", twirl: "Twirl" };

export const LookSchema = z.object({
	v: z.literal(1),
	skin: z.enum(Object.keys(SKIN) as [SkinId, ...SkinId[]]),
	slots: z.partialRecord(z.enum(SLOTS), WornSchema),
	/** The pet's name. It isn't part of the fingerprint: renaming a pet doesn't make a new look. */
	petName: z.string().trim().max(PET_NAME_MAX_).optional(),
	pose: z.enum(POSES).optional(),
});
export type Look = z.infer<typeof LookSchema>;

export const LOOK_NAME_MAX = 24;
export const PET_NAME_MAX = PET_NAME_MAX_;
export const MAX_SAVED_LOOKS = 12;

/** Items that are free, or that this child has unlocked. Holiday gifts are never free: they're claimed. */
export const isOwned = (item: Item, unlocked: ReadonlySet<string>) => item.cost === 0 || unlocked.has(item.id);

/**
 * Checks a look against the catalog and returns it in canonical form: every item in its own slot, colours from
 * the item's palettes (missing ones filled with the item's defaults, extra ones dropped), and no dress worn with a
 * top or bottom. Returns null when it can't be fixed.
 */
export function normalizeLook(input: unknown): Look | null {
	const parsed = LookSchema.safeParse(input);
	if (!parsed.success) return null;
	const slots: Look["slots"] = {};
	for (const slot of SLOTS) {
		const worn = parsed.data.slots[slot];
		if (!worn) continue;
		const item = ITEM.get(worn.item);
		if (!item || item.slot !== slot) return null;
		const out: Worn = { item: item.id };
		item.colors?.forEach((palette, i) => {
			const key = i === 0 ? worn.c1 : worn.c2;
			const valid = key && key in PALETTES[palette];
			const value = valid ? key : item.defaults?.[i];
			if (value) out[i === 0 ? "c1" : "c2"] = value;
		});
		slots[slot] = out;
	}
	if (slots.dress && (slots.top || slots.bottom)) return null;
	for (const slot of REQUIRED_SLOTS) if (!slots[slot]) return null;
	for (const [slot, needs] of Object.entries(NEEDS) as [Slot, Slot][]) if (!slots[needs]) delete slots[slot];
	const petName = slots.pet ? parsed.data.petName?.trim() : undefined;
	const pose = parsed.data.pose && parsed.data.pose !== "stand" ? parsed.data.pose : undefined;
	return { v: 1, skin: parsed.data.skin, slots, ...(petName && { petName }), ...(pose && { pose }) };
}

/** Every item in the look that the child doesn't own yet. */
export function lockedItemsIn(look: Look, unlocked: ReadonlySet<string>): Item[] {
	return Object.values(look.slots)
		.map((w) => ITEM.get(w.item))
		.filter((item): item is Item => !!item && !isOwned(item, unlocked));
}

/** Put an item on (or take a slot off with `null`), keeping dresses and separates apart. */
export function wear(look: Look, slot: Slot, worn: Worn | null): Look {
	const slots = { ...look.slots };
	if (worn) {
		slots[slot] = worn;
		for (const other of EXCLUSIVE[slot] ?? []) delete slots[other];
	} else if (!(REQUIRED_SLOTS as readonly Slot[]).includes(slot)) {
		delete slots[slot];
		for (const [other, needs] of Object.entries(NEEDS) as [Slot, Slot][]) if (needs === slot) delete slots[other];
		if (slot === "pet") {
			const { petName: _, ...rest } = look;
			return { ...rest, slots };
		}
	}
	return { ...look, slots };
}

/** The same look always gives the same string, whatever order its keys were written in. */
export function canonicalLook(look: Look): string {
	const slots = SLOTS.filter((s) => look.slots[s]).map((s) => {
		const w = look.slots[s]!;
		return [s, w.item, w.c1 ?? "", w.c2 ?? ""].join(":");
	});
	return `v${look.v}|${look.skin}|${slots.join("|")}`;
}

/** A short hash of the canonical look. No two saved looks anywhere share one. */
export async function fingerprint(look: Look): Promise<string> {
	const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalLook(look))));
	return [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** FNV-1a, to turn a child id into a seed. */
export function seedFrom(text: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

const keys = (palette: keyof typeof PALETTES) => Object.keys(PALETTES[palette]);

function dressUp(slot: Slot, rng: Rng, owned: (i: Item) => boolean): Worn | undefined {
	const choices = ITEMS.filter((i) => i.slot === slot && !i.holiday && owned(i));
	if (choices.length === 0) return undefined;
	const item = pick(rng, choices);
	const worn: Worn = { item: item.id };
	item.colors?.forEach((palette, i) => {
		worn[i === 0 ? "c1" : "c2"] = pick(rng, keys(palette));
	});
	return worn;
}

/** A random look from what the child owns. Used for each child's first look and for "Surprise me". */
export function randomLook(rng: Rng, unlocked: ReadonlySet<string> = new Set()): Look {
	const owned = (i: Item) => isOwned(i, unlocked);
	const slots: Look["slots"] = {};
	const put = (slot: Slot) => {
		const w = dressUp(slot, rng, owned);
		if (w) slots[slot] = w;
	};
	for (const slot of REQUIRED_SLOTS) put(slot);
	// Brows match the hair.
	put("hair");
	if (slots.hair?.c1 && slots.brows) slots.brows.c1 = slots.hair.c1;
	if (rng() < 0.35) put("dress");
	else {
		put("top");
		put("bottom");
	}
	put("shoes");
	for (const [slot, chance] of [
		["socks", 0.5],
		["outer", 0.2],
		["hat", 0.25],
		["glasses", 0.2],
		["earrings", 0.3],
		["necklace", 0.2],
		["marks", 0.3],
		["blush", 0.4],
		["pet", 0.4],
	] as const) {
		if (rng() < chance) put(slot);
	}
	if (slots.pet && rng() < 0.5) put("petwear");
	return { v: 1, skin: pick(rng, Object.keys(SKIN) as SkinId[]), slots };
}

/** Each child's first look, the same every time for that child and different from everyone else's. */
export const starterLook = (childId: string): Look => randomLook(seeded(seedFrom(childId)));
