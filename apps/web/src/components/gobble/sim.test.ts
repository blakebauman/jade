import { describe, expect, it } from "vitest";
import { KINDS } from "./kinds.ts";
import { autopilot, COUNTDOWN_S, fits, type Game, newGame, PLAYER, R0, ROUND_S, radiusFor, ranking, step } from "./sim.ts";
import { buildTown, PLAYER_START, SIZE } from "./town.ts";

const DT = 1 / 60;

/** Plays a whole round with `steer` choosing the player's direction each step. */
function play(g: Game, steer: (g: Game) => { x: number; z: number }, at?: { time: number; see: (g: Game) => void }) {
	const events = [];
	while (g.phase !== "over") {
		step(g, DT, steer(g));
		events.push(...g.events.splice(0));
		if (at && Math.abs(g.time - at.time) < DT / 2) at.see(g);
	}
	return events;
}

describe("the town", () => {
	it("is the same for the same seed and different for another", () => {
		expect(buildTown(4)).toEqual(buildTown(4));
		expect(buildTown(4)).not.toEqual(buildTown(5));
	});

	it("keeps everything inside the map without things standing in each other", () => {
		for (const seed of [1, 2, 3]) {
			const town = buildTown(seed);
			const outside = town.filter((p) => {
				const r = KINDS[p.kind].r - 0.01;
				return p.x < r || p.z < r || p.x > SIZE - r || p.z > SIZE - r;
			});
			expect(outside).toEqual([]);
			const overlaps: string[] = [];
			for (let i = 0; i < town.length; i++)
				for (let j = i + 1; j < town.length; j++) {
					const a = town[i]!;
					const b = town[j]!;
					if (Math.hypot(a.x - b.x, a.z - b.z) < KINDS[a.kind].r + KINDS[b.kind].r - 0.01) overlaps.push(`${a.kind}/${b.kind}`);
				}
			expect(overlaps).toEqual([]);
		}
	});

	it("has every kind in it, and small things right where the player starts", () => {
		const town = buildTown(7);
		for (const id of Object.keys(KINDS))
			expect(
				town.some((p) => p.kind === id),
				id,
			).toBe(true);
		const close = town.filter((p) => Math.hypot(p.x - PLAYER_START.x, p.z - PLAYER_START.z) < 3 && fits(R0, KINDS[p.kind].r));
		expect(close.length).toBeGreaterThanOrEqual(8);
	});
});

describe("holes", () => {
	it("wait for the countdown, then the round runs two minutes", () => {
		const g = newGame(1, "Jade");
		step(g, COUNTDOWN_S - 0.1, { x: 1, z: 0 });
		expect(g.phase).toBe("countdown");
		expect(g.holes[PLAYER]!.x).toBe(PLAYER_START.x);
		step(g, 0.2, { x: 1, z: 0 });
		expect(g.phase).toBe("play");
		expect(g.events).toContainEqual({ type: "start" });
		for (let t = 0; t < ROUND_S; t += 0.5) step(g, 0.5, { x: 0, z: 0 });
		expect(g.phase).toBe("over");
		expect(g.events.at(-1)).toEqual({ type: "end" });
	});

	it("swallow what fits and grow; something too big only leans", () => {
		const g = newGame(1, "Jade", 0);
		g.phase = "play";
		g.time = COUNTDOWN_S;
		// Put a cone right under the player and a car at its edge (cell 0 is the top-left corner).
		const p = g.holes[PLAYER]!;
		const cone = g.objs.findIndex((o) => o.kind === "cone");
		const car = g.objs.findIndex((o) => o.kind === "car");
		Object.assign(p, { x: 1, z: 1 });
		Object.assign(g.objs[cone]!, { x: 1, z: 1 });
		Object.assign(g.objs[car]!, { x: 2, z: 1 });
		g.cells[0]!.push(cone, car);
		for (let i = 0; i < 90; i++) step(g, DT, { x: 0, z: 0 });
		expect(g.objs[cone]!.state).toBe("gone");
		expect(p.score).toBeGreaterThanOrEqual(KINDS.cone.value);
		expect(g.objs[car]!.state).toBe("stand");
		expect(g.objs[car]!.tilt).toBeGreaterThan(0);
	});

	it("a much bigger hole gobbles a smaller one, which comes back small but keeps its score", () => {
		const g = newGame(2, "Jade", 1);
		g.phase = "play";
		g.time = 30;
		const [me, bot] = g.holes as [NonNullable<Game["holes"][0]>, NonNullable<Game["holes"][1]>];
		Object.assign(bot, { x: 30, z: 30, size: 400, score: 400, r: radiusFor(400), safeUntil: 0 });
		Object.assign(me, { x: 30.5, z: 30, size: 20, score: 20, r: radiusFor(20), safeUntil: 0 });
		step(g, DT, { x: 0, z: 0 });
		expect(g.events).toContainEqual(expect.objectContaining({ type: "gobbled", eater: 1, eaten: 0 }));
		expect(me.out).toBeGreaterThan(0);
		expect(me.score).toBe(20);
		for (let i = 0; i < 4 * 60; i++) step(g, DT, { x: 0, z: 0 });
		expect(me.out).toBe(0);
		expect(me.r).toBeLessThan(1);
		expect(me.score).toBeGreaterThanOrEqual(20);
	});
});

describe("a whole round", () => {
	it("is the same every time for the same seed and steering", () => {
		const a = newGame(9, "Jade");
		const b = newGame(9, "Jade");
		play(a, autopilot);
		play(b, autopilot);
		expect(a.holes.map((h) => h.score)).toEqual(b.holes.map((h) => h.score));
	});

	it("lets a good player grow big enough for houses and win, the bots grow too, and the town lasts", () => {
		const wins: boolean[] = [];
		for (const seed of [1, 2, 3, 4, 5]) {
			const g = newGame(seed, "Jade");
			let standing = 0;
			let peak = 0;
			const events = play(
				g,
				(g) => {
					peak = Math.max(peak, g.holes[PLAYER]!.size);
					return autopilot(g);
				},
				{ time: COUNTDOWN_S + 80, see: (g) => (standing = g.objs.filter((o) => o.state === "stand").length) },
			);
			const me = g.holes[PLAYER]!;
			wins.push(ranking(g)[0]!.i === PLAYER);
			// Gobbling starts at once (the start is full of small things) and a milestone comes within the first minute.
			const first = events.findIndex((e) => e.type === "gulp" && e.hole === PLAYER);
			expect(first).toBeGreaterThanOrEqual(0);
			expect(events.some((e) => e.type === "milestone")).toBe(true);
			expect(me.score, `seed ${seed}`).toBeGreaterThan(400);
			// At its biggest (being gobbled late sends it back to small).
			expect(fits(radiusFor(peak), KINDS.cottage.r), `seed ${seed}`).toBe(true);
			const bots = g.holes.slice(1);
			expect(
				bots.every((h) => h.score > 100),
				`seed ${seed}: ${bots.map((h) => h.score)}`,
			).toBe(true);
			// A good part of the town is still standing 80 s in, so the round never runs dry early.
			expect(standing, `seed ${seed}`).toBeGreaterThan(g.objs.length * 0.1);
			expect(ranking(g)[0]!.h.score).toBe(Math.max(...g.holes.map((h) => h.score)));
		}
		// Playing like a computer player wins most rounds; the bots aren't unbeatable.
		expect(wins.filter(Boolean).length).toBeGreaterThanOrEqual(3);
	});

	it("never lets a standing player sit still and win", () => {
		const g = newGame(3, "Jade");
		play(g, () => ({ x: 0, z: 0 }));
		const rank = ranking(g).findIndex((e) => e.i === PLAYER);
		expect(rank).toBeGreaterThan(2);
	});
});

describe("fairness", () => {
	it("never gives a computer player the child's own name", () => {
		const g = newGame(5, "maple", 10);
		expect(g.holes.filter((h) => h.name.toLowerCase() === "maple")).toHaveLength(1);
	});

	it("settles what was falling into a hole when it's gobbled: score yes, size no", () => {
		const g = newGame(2, "Jade", 1);
		g.phase = "play";
		g.time = 30;
		const [me, bot] = g.holes as [NonNullable<Game["holes"][0]>, NonNullable<Game["holes"][1]>];
		const cone = g.objs.findIndex((o) => o.kind === "cone");
		Object.assign(g.objs[cone]!, { state: "fall", hole: 0, t: 0 });
		g.moving.add(cone);
		Object.assign(bot, { x: 30, z: 30, size: 400, score: 400, r: radiusFor(400), safeUntil: 0 });
		Object.assign(me, { x: 30.5, z: 30, size: 20, score: 20, r: radiusFor(20), safeUntil: 0 });
		step(g, DT, { x: 0, z: 0 });
		expect(g.objs[cone]!.state).toBe("gone");
		expect(me.size).toBe(0);
		expect(me.score).toBe(20 + KINDS.cone.value);
		expect(g.moving.has(cone)).toBe(false);
	});
});
