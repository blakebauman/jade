import { describe, expect, it } from "vitest";
import { seeded } from "../math/rng.ts";
import {
	activeHolidays,
	canonicalLook,
	easter,
	fingerprint,
	HOLIDAYS,
	holidayWindow,
	ITEM,
	ITEMS,
	isOwned,
	type Look,
	lockedItemsIn,
	normalizeLook,
	PALETTES,
	REQUIRED_SLOTS,
	randomLook,
	SLOTS,
	starterLook,
	TABS,
	thanksgiving,
	wear,
	withoutHolidays,
} from "../roxy/index.ts";

describe("catalog", () => {
	it("has unique ids, known slots and valid default colours", () => {
		expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
		for (const item of ITEMS) {
			expect(SLOTS).toContain(item.slot);
			expect(item.cost).toBeGreaterThanOrEqual(0);
			item.defaults?.forEach((key, i) => {
				const palette = item.colors?.[i];
				expect(palette, `${item.id} default ${i}`).toBeDefined();
				expect(Object.keys(PALETTES[palette!]), `${item.id}`).toContain(key);
			});
		}
	});

	it("puts every slot in a tab", () => {
		expect(TABS.flatMap((t) => t.slots).sort()).toEqual([...SLOTS].sort());
	});

	it("gives every holiday a stage and exactly one gift", () => {
		for (const h of HOLIDAYS) {
			const items = ITEMS.filter((i) => i.holiday === h);
			expect(
				items.filter((i) => i.gift),
				h,
			).toHaveLength(1);
			expect(
				items.some((i) => i.slot === "background"),
				h,
			).toBe(true);
			expect(
				items.every((i) => i.cost > 0),
				h,
			).toBe(true);
		}
	});

	it("keeps a generous free starter set", () => {
		const base = ITEMS.filter((i) => !i.holiday);
		expect(base.filter((i) => i.cost === 0).length / base.length).toBeGreaterThan(0.55);
		for (const slot of REQUIRED_SLOTS)
			expect(
				base.some((i) => i.slot === slot && i.cost === 0),
				slot,
			).toBe(true);
	});
});

describe("looks", () => {
	const look = starterLook("child-1");

	it("starts every child from their own look, the same each time, from free items only", () => {
		expect(starterLook("child-1")).toEqual(look);
		expect(lockedItemsIn(look, new Set())).toEqual([]);
		const prints = new Set(Array.from({ length: 200 }, (_, i) => canonicalLook(starterLook(`kid-${i}`))));
		expect(prints.size).toBe(200);
		expect(normalizeLook(look)).toEqual(look);
	});

	it("fingerprints the same look the same way whatever the key order", async () => {
		const shuffled = JSON.parse(JSON.stringify({ slots: Object.fromEntries(Object.entries(look.slots).reverse()), skin: look.skin, v: 1 }));
		expect(await fingerprint(normalizeLook(shuffled)!)).toBe(await fingerprint(look));
		const changed = wear(look, "background", { item: "stage-night" });
		expect(await fingerprint(changed)).not.toBe(await fingerprint(wear(look, "background", { item: "stage-beach" })));
	});

	it("normalizes colours and rejects what can't be worn", () => {
		const { top: _t, bottom: _b, dress: _d, ...rest } = look.slots;
		const base: Look = { v: 1, skin: "s3", slots: rest };
		const fixed = normalizeLook({
			...base,
			slots: { ...base.slots, hair: { item: "hair-bob", c1: "zz" }, nose: { item: "nose-dot", c1: "f1" } },
		})!;
		expect(fixed.slots.hair).toEqual({ item: "hair-bob", c1: "h3" });
		expect(fixed.slots.nose).toEqual({ item: "nose-dot" });
		expect(normalizeLook({ ...base, slots: { ...base.slots, hair: { item: "top-tee" } } })).toBeNull();
		expect(normalizeLook({ ...base, slots: { ...base.slots, dress: { item: "dress-sun" }, top: { item: "top-tee" } } })).toBeNull();
		const { eyes: _, ...noEyes } = base.slots;
		expect(normalizeLook({ ...base, slots: noEyes })).toBeNull();
	});

	it("swaps a dress for separates and back", () => {
		const inDress = wear(wear(look, "top", { item: "top-tee" }), "dress", { item: "dress-sun" });
		expect(inDress.slots.top).toBeUndefined();
		expect(inDress.slots.bottom).toBeUndefined();
		expect(wear(inDress, "top", { item: "top-tank" }).slots.dress).toBeUndefined();
		// Required slots can't be taken off.
		expect(wear(look, "eyes", null).slots.eyes).toEqual(look.slots.eyes);
	});

	it("lists locked items, and only offers owned ones at random", () => {
		const crowned = wear(look, "hat", { item: "hat-crown" });
		expect(lockedItemsIn(crowned, new Set()).map((i) => i.id)).toEqual(["hat-crown"]);
		expect(lockedItemsIn(crowned, new Set(["hat-crown"]))).toEqual([]);
		const rng = seeded(7);
		for (let i = 0; i < 100; i++) expect(lockedItemsIn(randomLook(rng), new Set())).toEqual([]);
		expect(isOwned(ITEM.get("hat-santa")!, new Set())).toBe(false);
	});

	it("takes off what a family turned off, swapping a hidden stage for an everyday one", () => {
		const spooky = normalizeLook(
			wear(wear(wear(look, "background", { item: "stage-halloween" }), "hat", { item: "hat-witch" }), "glasses", { item: "glasses-round" }),
		)!;
		const off = new Set(["halloween"]);
		const out = withoutHolidays(spooky, off);
		expect(out.slots.hat).toBeUndefined();
		expect(out.slots.glasses).toEqual(spooky.slots.glasses);
		expect(ITEM.get(out.slots.background!.item)).toMatchObject({ cost: 0 });
		expect(ITEM.get(out.slots.background!.item)?.holiday).toBeUndefined();
		expect(normalizeLook(out)).toEqual(out);
		// Nothing hidden: the same look back.
		expect(withoutHolidays(spooky, new Set(["christmas"]))).toBe(spooky);
		// The pet stays; only its holiday hat goes.
		const pet = wear(wear(look, "pet", { item: "pet-cat" }), "petwear", { item: "petwear-santa" });
		expect(withoutHolidays(pet, new Set(["christmas"]))).toEqual(wear(pet, "petwear", null));
	});
});

describe("pets", () => {
	const base = wear(wear(starterLook("pet-owner"), "pet", null), "background", { item: "stage-felt" });

	it("wear accessories only with a pet, and forget the pet's name when it goes", () => {
		const withCollar = normalizeLook({ ...base, slots: { ...base.slots, petwear: { item: "petwear-collar" } } })!;
		expect(withCollar.slots.petwear).toBeUndefined();
		const pet = wear(wear(base, "pet", { item: "pet-gecko", c1: "p15", c2: "p8" }), "petwear", { item: "petwear-bow", c1: "f12" });
		const named = normalizeLook({ ...pet, petName: "  Ziggy " })!;
		expect(named.petName).toBe("Ziggy");
		const gone = wear(named, "pet", null);
		expect(gone.slots.petwear).toBeUndefined();
		expect(gone.petName).toBeUndefined();
	});

	it("doesn't count a new name as a new look", async () => {
		const pet = wear(base, "pet", { item: "pet-cat", c1: "p4", c2: "p6" });
		expect(await fingerprint({ ...pet, petName: "Biscuit" })).toBe(await fingerprint({ ...pet, petName: "Mochi" }));
		expect(await fingerprint(pet)).not.toBe(await fingerprint(wear(pet, "pet", { item: "pet-cat", c1: "p1", c2: "p6" })));
	});
});

describe("holidays", () => {
	it("knows Easter and Thanksgiving", () => {
		expect(easter(2026)).toBe("2026-04-05");
		expect(easter(2027)).toBe("2027-03-28");
		expect(easter(2030)).toBe("2030-04-21");
		expect(thanksgiving(2026)).toBe("2026-11-26");
		expect(thanksgiving(2027)).toBe("2027-11-25");
		expect(thanksgiving(2029)).toBe("2029-11-22");
	});

	it("has a date for every holiday through 2030", () => {
		for (const h of HOLIDAYS) for (let y = 2026; y <= 2030; y++) expect(holidayWindow(h, y), `${h} ${y}`).not.toBeNull();
	});

	it("opens a week before and closes after the last day", () => {
		expect(holidayWindow("diwali", 2026)).toEqual({ id: "diwali", start: "2026-11-01", first: "2026-11-08", end: "2026-11-12" });
		const ids = (day: string) => activeHolidays(day).map((w) => w.id);
		expect(ids("2026-10-24")).toEqual(["halloween"]);
		expect(ids("2026-10-31")).toEqual(["halloween", "diadelosmuertos"]);
		expect(ids("2026-11-01")).toEqual(["diadelosmuertos", "diwali"]);
		expect(ids("2026-11-13")).toEqual([]);
		expect(ids("2026-12-24")).toEqual(["christmas", "kwanzaa"]);
		// Across New Year: Kwanzaa runs to Jan 1, and New Year's window opened Dec 25.
		expect(ids("2027-01-01")).toEqual(["kwanzaa", "newyear"]);
		expect(ids("2026-12-05")).toContain("hanukkah");
	});
});
