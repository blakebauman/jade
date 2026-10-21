import { describe, expect, it } from "vitest";
import {
	B,
	BLOCKS,
	CAMP,
	CELLS,
	CLEARING,
	CYCLE_S,
	cellOf,
	chunksAround,
	clientMsg,
	craftUses,
	DAY_S,
	deerAt,
	FUEL_MAX,
	feed,
	fireRadius,
	GOALS,
	generate,
	goalsMet,
	groundAt,
	indexOf,
	LOST_PER_NIGHT,
	lostAnimals,
	NIGHT_S,
	NO_STATS,
	packEdit,
	phaseAt,
	RECIPE_BY_ID,
	RECIPES,
	rainAt,
	SEA,
	spawnPoint,
	TILE_NAMES,
	unpackEdit,
	W,
	walkable,
} from "../woods/index.ts";

describe("woods blocks", () => {
	it("numbers every block by its place in the list", () => {
		expect(BLOCKS.map((b) => b.id)).toEqual(BLOCKS.map((_, i) => i));
		expect(BLOCKS.length).toBeLessThanOrEqual(64);
	});
	it("names a tile for every face it draws", () => {
		for (const b of BLOCKS) if (b.draw !== "none") expect(b.tiles.side).not.toBe("");
		expect(TILE_NAMES).toContain("grass_top");
	});
});

describe("woods volume", () => {
	it("packs an edit into one int and back", () => {
		const i = indexOf(95, 47, 95);
		expect(i).toBe(CELLS - 1);
		expect(unpackEdit(packEdit(i, B.woolPink))).toEqual([i, B.woolPink]);
		expect(cellOf(indexOf(3, 7, 11))).toEqual([3, 7, 11]);
	});
	it("redraws the chunk beside an edge cell too", () => {
		expect(chunksAround(indexOf(5, 5, 5))).toHaveLength(1);
		expect(chunksAround(indexOf(15, 5, 5))).toHaveLength(2);
		expect(chunksAround(indexOf(16, 16, 16))).toHaveLength(4);
	});
});

describe("woods terrain", () => {
	const island = generate(12345);
	const v = island.volume;

	// Byte by byte in a loop: toEqual walks a 442k-cell array slowly enough to time out on a busy CI runner.
	const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((c, i) => c === b[i]);

	it("makes the same island from the same seed, and another from another", () => {
		expect(same(generate(12345).volume.data, v.data)).toBe(true);
		expect(same(generate(54321).volume.data, v.data)).toBe(false);
	}, 20_000);

	it("has bedrock under everything and sea round the edge", () => {
		for (let x = 0; x < W; x += 7) expect(v.get(x, 0, 5)).toBe(B.bedrock);
		expect(v.get(1, SEA, 1)).toBe(B.water);
		expect(v.get(1, SEA + 1, 1)).toBe(B.air);
	});

	it("keeps the clearing flat and free of trees, with the fire on the ground", () => {
		const [fx, fy, fz] = island.fire;
		expect(v.get(fx, fy, fz)).toBe(B.air);
		expect(v.get(fx, fy - 1, fz)).toBe(B.grass);
		for (let dz = -CLEARING + 1; dz < CLEARING; dz++) {
			for (let dx = -CLEARING + 1; dx < CLEARING; dx++) {
				if (Math.hypot(dx, dz) >= CLEARING - 1) continue;
				expect(groundAt(v, CAMP.x + dx, CAMP.z + dz)).toBe(fy - 1);
			}
		}
	});

	it("grows a forest and hides ores, with gems only deep down", () => {
		const count = (b: number) => v.data.reduce((n, c) => n + (c === b ? 1 : 0), 0);
		expect(count(B.log)).toBeGreaterThan(200);
		expect(count(B.coal)).toBeGreaterThan(50);
		expect(count(B.gem)).toBeGreaterThan(3);
		for (let i = 0; i < CELLS; i++) if (v.data[i] === B.gem) expect(cellOf(i)[1]).toBeLessThanOrEqual(7);
	});

	it("puts kids down on open ground by the fire", () => {
		const [x, y, z] = spawnPoint(island);
		expect(v.get(Math.floor(x), Math.floor(y), Math.floor(z))).toBe(B.air);
		expect(v.get(Math.floor(x), Math.floor(y) - 1, Math.floor(z))).not.toBe(B.air);
	});
});

describe("woods islands made the newer way", () => {
	const fnv = (d: Uint8Array) => {
		let h = 2166136261;
		for (const b of d) {
			h ^= b;
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	};

	it("still makes an older island exactly as it was, so its edits still line up", () => {
		expect(fnv(generate(12345, 1).volume.data)).toBe(1767047353);
	});

	it("grows oaks, birches and pines, with grass, flowers and toadstools", () => {
		const { volume } = generate(4242);
		const count = (b: number) => volume.data.reduce((n, c) => n + (c === b ? 1 : 0), 0);
		for (const b of [B.leaves, B.birchLeaves, B.pineLeaves, B.birchLog, B.tallGrass, B.flowerRed, B.mushroom])
			expect(count(b)).toBeGreaterThan(20);
	});

	it("keeps plants off the spot by the fire", () => {
		const island = generate(4242);
		const [fx, fy, fz] = island.fire;
		for (let dz = -3; dz <= 3; dz++)
			for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dz) <= 3) expect(island.volume.get(fx + dx, fy, fz + dz)).toBe(B.air);
	});
});

describe("woods clock", () => {
	it("runs a day, then a night, then the next day", () => {
		expect(phaseAt(0)).toMatchObject({ phase: "day", night: 1, sun: 1 });
		expect(phaseAt(DAY_S + 1)).toMatchObject({ phase: "night", night: 1 });
		expect(phaseAt(DAY_S + NIGHT_S + 1)).toMatchObject({ phase: "day", night: 2 });
		expect(phaseAt(DAY_S + NIGHT_S / 2).sun).toBe(0);
		expect(phaseAt(DAY_S - 1).sun).toBeLessThan(1);
	});
	it("feeds the fire up to full, and lights wider the more it holds", () => {
		expect(feed(FUEL_MAX - 5, 45)).toBe(FUEL_MAX);
		expect(fireRadius(0)).toBe(0);
		expect(fireRadius(FUEL_MAX)).toBeGreaterThan(fireRadius(FUEL_MAX / 4));
	});
});

describe("woods nights", () => {
	for (const seed of [1, 99, 4242, 777777]) {
		it(`loses animals somewhere a kid can walk to (seed ${seed})`, () => {
			const island = generate(seed);
			const can = walkable(island.volume);
			for (let night = 1; night <= 5; night++) {
				const lost = lostAnimals(island.volume, seed, night);
				expect(lost).toHaveLength(LOST_PER_NIGHT);
				for (const a of lost) {
					const i = Math.floor(a.at[0]) + W * Math.floor(a.at[2]);
					expect(can[i]).toBe(1);
					expect(Math.hypot(a.at[0] - CAMP.x, a.at[2] - CAMP.z)).toBeGreaterThan(fireRadius(FUEL_MAX));
				}
			}
			expect(lostAnimals(island.volume, seed, 3)).toEqual(lostAnimals(island.volume, seed, 3));
		});
	}

	it("brings the deer closer when the fire is low", () => {
		const far = deerAt(1, 1, 30, 0);
		const near = deerAt(1, 1, 30, 1);
		const d = (p: { x: number; z: number }) => Math.hypot(p.x - CAMP.x, p.z - CAMP.z);
		expect(d(near)).toBeLessThan(d(far));
		expect(d(near)).toBeGreaterThan(fireRadius(FUEL_MAX / 4));
	});
});

describe("woods rain", () => {
	it("rains on some days, only by day, easing in and out", () => {
		let wet = 0;
		for (let day = 0; day < 40; day++) {
			let any = false;
			for (let t = 0; t < CYCLE_S; t += 2) {
				const r = rainAt(77, day * CYCLE_S + t);
				expect(r).toBeGreaterThanOrEqual(0);
				expect(r).toBeLessThanOrEqual(1);
				if (r > 0) {
					any = true;
					expect(t).toBeLessThan(DAY_S);
				}
			}
			if (any) wet++;
		}
		expect(wet).toBeGreaterThan(6);
		expect(wet).toBeLessThan(28);
		expect(rainAt(77, 1234)).toBe(rainAt(77, 1234));
	});
});

describe("woods crafting", () => {
	it("uses whichever kind of log the bag has, and nothing it can't afford", () => {
		const planks = RECIPE_BY_ID.planks!;
		expect(craftUses(planks, { [B.birchLog]: 2 })).toEqual([{ b: B.birchLog, n: 1 }]);
		expect(craftUses(planks, {})).toBeNull();
		expect(craftUses(RECIPE_BY_ID.torches!, { [B.coal]: 1 })).toBeNull();
		for (const r of RECIPES) expect(r.gives.n).toBeGreaterThan(0);
	});
});

describe("woods goals and messages", () => {
	it("meets a goal once, when its count passes the line", () => {
		expect(goalsMet(NO_STATS, { ...NO_STATS, logs: 1 }).map((g) => g.id)).toEqual(["first-log"]);
		expect(goalsMet({ ...NO_STATS, logs: 1 }, { ...NO_STATS, logs: 2 })).toEqual([]);
		for (const g of GOALS) expect(g.tickets).toBeLessThanOrEqual(30);
	});
	it("accepts what a screen sends and nothing else", () => {
		expect(clientMsg.safeParse({ t: "place", i: 10, b: B.planks }).success).toBe(true);
		expect(clientMsg.safeParse({ t: "place", i: CELLS, b: B.planks }).success).toBe(false);
		expect(clientMsg.safeParse({ t: "place", i: 10, b: 0 }).success).toBe(false);
		expect(clientMsg.safeParse({ t: "emote", e: "hello" }).success).toBe(false);
		expect(clientMsg.safeParse({ t: "chat", text: "hi" }).success).toBe(false);
	});
});
