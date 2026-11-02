import { seeded } from "@jade/core/math";
import { describe, expect, it } from "vitest";
import {
	accuracy,
	advance,
	beatAt,
	COUNT_IN_BARS,
	CRATE_SIZE,
	chart,
	crate,
	dancers,
	flames,
	type Game,
	GOOD_S,
	HYPE_MAX,
	inRise,
	LANES,
	LEVELS,
	type Level,
	MOODS,
	newGame,
	PERFECT_S,
	pick,
	press,
	RISE_BARS,
	run,
	SONG_BARS,
	SONGS_PER_SET,
	songSeconds,
	spb,
	ticketsFor,
} from "./sim.ts";
import type { Track } from "./tracks.ts";

const T = (id: Track["id"], mood: Track["mood"], bpm: number, half = false): Track => ({
	id,
	name: id,
	mood,
	bpm,
	half,
	bars: 16,
	loopStart: 0.1,
	loopEnd: 0,
});
const TRACKS: Track[] = [
	T("sunset", "chill", 100),
	T("funk", "funky", 110),
	T("pop", "bouncy", 120),
	T("drop", "big", 126),
	T("amen", "jungle", 172, true),
	T("roller", "jungle", 172, true),
	T("rinse", "jungle", 172, true),
];

/** Plays a whole set: picks what's asked for when `listen`, else the first record, and plays every song at `skill`. */
function playSet(seed: number, level: Level, skill: number, listen = true) {
	const g = newGame(seed, level);
	const rng = seeded(seed + 1);
	while (g.phase !== "over") {
		pick(g, (listen && TRACKS.find((t) => t.mood === g.request)) || TRACKS[0]!);
		run(g, songSeconds(g.track!) + 1, skill, rng);
	}
	return g;
}

describe("the chart", () => {
	it("is the same for the same seed and different for another", () => {
		expect(chart(TRACKS[2]!, "party", 5)).toEqual(chart(TRACKS[2]!, "party", 5));
		expect(chart(TRACKS[2]!, "party", 5)).not.toEqual(chart(TRACKS[2]!, "party", 6));
	});

	it("puts every note on the eighth-note grid, in a lane, after the count-in and inside the song", () => {
		for (const level of LEVELS)
			for (const track of TRACKS) {
				const notes = chart(track, level, 11);
				for (const n of notes) {
					expect(n.beat * 2).toBe(Math.round(n.beat * 2));
					expect(n.t).toBeCloseTo(n.beat * spb(track), 9);
					expect(n.lane).toBeGreaterThanOrEqual(0);
					expect(n.lane).toBeLessThan(LANES);
					expect(n.beat).toBeGreaterThanOrEqual(COUNT_IN_BARS * 4);
					expect(n.beat).toBeLessThan(SONG_BARS * 4);
				}
				// Sorted, and never two notes in one lane at once.
				const keys = notes.map((n) => `${n.beat}:${n.lane}`);
				expect(new Set(keys).size).toBe(keys.length);
				expect([...notes].sort((a, b) => a.t - b.t)).toEqual(notes);
			}
	});

	it("gets busier from Chill to Wild, and through a song", () => {
		const count = (level: Level) => chart(TRACKS[1]!, level, 3).length;
		expect(count("chill")).toBeLessThan(count("party"));
		expect(count("party")).toBeLessThan(count("wild"));
		const notes = chart(TRACKS[1]!, "party", 3);
		const inBars = (from: number, to: number) => notes.filter((n) => n.beat >= from * 4 && n.beat < to * 4).length;
		expect(inBars(COUNT_IN_BARS, 8) / (8 - COUNT_IN_BARS)).toBeLessThan(inBars(16, 24) / 8);
	});

	it("never asks a hand to be in two places faster than an eighth note in one lane", () => {
		for (const level of LEVELS) {
			const notes = chart(TRACKS[3]!, level, 9);
			for (let lane = 0; lane < LANES; lane++) {
				const beats = notes.filter((n) => n.lane === lane).map((n) => n.beat);
				for (let i = 1; i < beats.length; i++) expect(beats[i]! - beats[i - 1]!).toBeGreaterThanOrEqual(0.5);
			}
		}
	});
});

describe("drum and bass", () => {
	it("is charted in half time: its notes come no faster than an 86 BPM record's", () => {
		const dnb = TRACKS[4]!;
		expect(spb(dnb)).toBeCloseTo(60 / 86, 9);
		expect(songSeconds(dnb)).toBeCloseTo(songSeconds(T("x" as Track["id"], "chill", 86)), 9);
		for (const level of LEVELS) {
			const notes = chart(dnb, level, 4);
			for (let lane = 0; lane < LANES; lane++) {
				const ts = notes.filter((n) => n.lane === lane).map((n) => n.t);
				for (let i = 1; i < ts.length; i++) expect(ts[i]! - ts[i - 1]!).toBeGreaterThanOrEqual((0.5 * 60) / 86 - 1e-9);
			}
		}
	});
});

describe("the crate", () => {
	it("deals four records, one answering the request and each of the others a different mood, the same every time", () => {
		for (let seed = 1; seed < 40; seed++) {
			const g = newGame(seed, "party");
			for (let song = 0; song < 3; song++) {
				g.song = song;
				g.request = MOODS[(seed + song) % MOODS.length]!;
				const dealt = crate(g, TRACKS);
				expect(dealt).toHaveLength(CRATE_SIZE);
				expect(dealt.filter((t) => t.mood === g.request)).toHaveLength(1);
				expect(new Set(dealt.map((t) => t.mood)).size).toBe(CRATE_SIZE);
				expect(crate(g, TRACKS)).toEqual(dealt);
			}
		}
	});

	it("brings every jungle record out over enough sets", () => {
		const seen = new Set<string>();
		for (let seed = 1; seed < 60; seed++) {
			const g = newGame(seed, "party");
			g.request = "jungle";
			for (const t of crate(g, TRACKS)) seen.add(t.id);
		}
		for (const id of ["amen", "roller", "rinse"]) expect(seen.has(id), id).toBe(true);
	});
});

describe("judging a press", () => {
	function songGame(level: Level = "party") {
		const g = newGame(1, level);
		pick(g, TRACKS[2]!);
		return g;
	}

	it("scores on the beat as Perfect, a little off as Good, and too far off as an extra tap", () => {
		const g = songGame();
		const [a, b, c] = g.notes;
		press(g, a!.lane, a!.t + PERFECT_S / 2);
		expect(a!.grade).toBe("perfect");
		press(g, b!.lane, b!.t - (PERFECT_S + GOOD_S) / 2);
		expect(b!.grade).toBe("good");
		const extras = g.counts.extra;
		press(g, (c!.lane + 1) % LANES, c!.t);
		expect(g.counts.extra).toBe(extras + 1);
		expect(c!.grade).toBeNull();
	});

	it("misses a note once it's gone past, breaking the streak and costing hype", () => {
		const g = songGame();
		const [a, b] = g.notes;
		press(g, a!.lane, a!.t);
		expect(g.combo).toBe(1);
		const hype = g.hype;
		advance(g, b!.t + GOOD_S + 0.01);
		expect(b!.grade).toBe("miss");
		expect(g.combo).toBe(0);
		expect(g.hype).toBeLessThan(hype);
		expect(g.events.some((e) => e.type === "miss")).toBe(true);
	});

	it("doesn't reward mashing every pad", () => {
		const g = newGame(2, "party");
		pick(g, TRACKS[1]!);
		for (let t = 0; t < songSeconds(g.track!); t += 0.05) for (let lane = 0; lane < LANES; lane++) press(g, lane, t);
		expect(g.hype).toBeLessThan(10);
		expect(g.rises).toBe(0);
	});

	it("climbs the multiplier with the streak", () => {
		const g = songGame();
		for (const n of g.notes.slice(0, 10)) press(g, n.lane, n.t);
		const before = g.score;
		const n = g.notes[10]!;
		press(g, n.lane, n.t);
		expect(g.score - before).toBe(200);
	});
});

describe("the Phoenix", () => {
	it("rises when hype is full, doubles points for its Fire Drop, then settles", () => {
		const g = newGame(4, "party");
		pick(g, TRACKS[2]!);
		const rng = seeded(4);
		while (!inRise(g) && g.phase === "song") run(g, 0.05, 1, rng);
		expect(g.rises).toBe(1);
		expect(g.hype).toBe(HYPE_MAX);
		const ends = g.riseUntil!;
		expect(ends - beatAt(g)).toBeLessThanOrEqual(RISE_BARS * 4 + 1);
		const n = g.notes[g.next]!;
		const mult = 1 + Math.min(3, Math.floor((g.combo + 1) / 10));
		const before = g.score;
		press(g, n.lane, n.t);
		expect(g.score - before).toBe(100 * mult * 2);
		while (inRise(g) && g.phase === "song") run(g, 0.05, 0, rng);
		expect(g.hype).toBeLessThan(HYPE_MAX);
	});

	it("rises at most once a song, so a set has three at most", () => {
		for (const level of LEVELS) expect(playSet(5, level, 1).rises).toBe(SONGS_PER_SET);
	});

	it("rises in a good player's set on every level, and never for a kid who hits nothing", () => {
		for (const level of LEVELS)
			for (const seed of [1, 2, 3]) {
				expect(playSet(seed, level, 0.95).rises, `${level} ${seed}`).toBeGreaterThanOrEqual(1);
				expect(playSet(seed, level, 0).rises).toBe(0);
			}
	});
});

describe("a set", () => {
	it("plays three songs and ends, rating a perfect set 5 flames and an empty one 1", () => {
		const best = playSet(7, "party", 1);
		expect(best.phase).toBe("over");
		expect(best.played).toHaveLength(SONGS_PER_SET);
		expect(best.counts.miss).toBe(0);
		expect(best.counts.perfect).toBe(best.totalNotes);
		expect(accuracy(best)).toBe(1);
		expect(flames(best)).toBe(5);
		expect(best.requestsMet).toBe(3);
		expect(ticketsFor(best, 30)).toBeLessThanOrEqual(30);
		const none = playSet(7, "party", 0);
		expect(none.phase).toBe("over");
		expect(flames(none)).toBe(1);
		expect(none.counts.miss).toBe(none.totalNotes);
	});

	it("rates a middling player in between", () => {
		const g = playSet(8, "party", 0.6);
		expect(flames(g)).toBeGreaterThanOrEqual(2);
		expect(flames(g)).toBeLessThanOrEqual(4);
	});

	it("never asks for the mood that just played", () => {
		for (let seed = 1; seed < 30; seed++) {
			const g = newGame(seed, "chill");
			while (g.phase !== "over") {
				pick(g, TRACKS[seed % 4]!);
				const mood = g.track!.mood;
				run(g, songSeconds(g.track!) + 1, 0.5);
				if (g.phase === "crate") expect(g.request).not.toBe(mood);
			}
		}
	});

	it("is pickier with no request met, and fills the floor with hype", () => {
		const ignored = playSet(9, "party", 1, false);
		expect(ignored.requestsMet).toBeLessThan(3);
		const g = newGame(9, "party") as Game;
		pick(g, TRACKS[0]!);
		g.hype = 0;
		const cold = dancers(g);
		g.hype = HYPE_MAX;
		expect(dancers(g)).toBeGreaterThan(cold);
	});
});
