import { seeded } from "@jade/core/math";
import type { Mood, Track, TrackId } from "./tracks.ts";

/**
 * Phoenix DJ Party's rules, pure and seeded. The kid DJs a set of three songs at a rooftop party. Before each song a
 * guest asks for a mood and the kid pulls a record from the crate. Through a song, notes fall in four lanes and are
 * hit on the beat: hits build a streak and the party's hype, misses drain it. When hype is full the Phoenix rises
 * (once a song at most: it's the song's peak): eight bars of Fire Drop, everything worth double. A set always plays to the end and is rated in flames.
 *
 * Time is the song's own clock in seconds (0 is the first downbeat), read by the screen from the audio; the chart is
 * written in beats, so a note's time is its beat times the track's seconds per beat.
 */

export type Level = "chill" | "party" | "wild";
export const LEVELS: readonly Level[] = ["chill", "party", "wild"];
export const LEVEL_LABEL: Record<Level, string> = { chill: "Chill", party: "Party", wild: "Wild" };

export const LANES = 4;
export const SONGS_PER_SET = 3;
/** Every song is this long, whatever its loop (the loop just goes round). */
export const SONG_BARS = 24;
/** Bars at the start of a song with no notes: the count-in. */
export const COUNT_IN_BARS = 2;
/** How far off the beat still counts, in seconds either way. */
export const PERFECT_S = 0.075;
export const GOOD_S = 0.16;
/** How long a Fire Drop lasts once the Phoenix rises. */
export const RISE_BARS = 8;
export const HYPE_MAX = 100;
const HYPE_START = 30;
const HYPE_AFTER_RISE = 60;
const HYPE_MATCH = 15;
const HYPE_MISS = 6;
const HYPE_EXTRA = 2;
/** Fewer notes on Chill, so each is worth more hype; more on Wild, so each is worth less. */
const HYPE_GAIN: Record<Level, { perfect: number; good: number }> = {
	chill: { perfect: 6, good: 3 },
	party: { perfect: 4, good: 2 },
	wild: { perfect: 3, good: 1.5 },
};
export const STREAKS = [10, 25, 50, 100] as const;
export const MOODS: readonly Mood[] = ["chill", "funky", "bouncy", "big"];

export type Grade = "perfect" | "good" | "miss";
export type Note = { beat: number; t: number; lane: number; grade: Grade | null };

export type GameEvent =
	| { type: "hit"; lane: number; grade: "perfect" | "good"; off: number }
	| { type: "miss"; lane: number }
	| { type: "extra"; lane: number }
	| { type: "streak"; n: number }
	| { type: "rise" }
	| { type: "rise-end" }
	| { type: "song-end"; song: number }
	| { type: "over" };

export type Counts = { perfect: number; good: number; miss: number; extra: number };

export type Game = {
	seed: number;
	level: Level;
	phase: "crate" | "song" | "over";
	/** Which song of the set (0-based): the one playing, or the one being picked. */
	song: number;
	track: Track | null;
	/** What the guest asked for, and which guest. */
	request: Mood;
	requestBy: number;
	/** Whether the record playing is the one asked for. */
	matched: boolean;
	notes: Note[];
	/** Notes before this index are all judged. */
	next: number;
	/** The song clock as last seen. */
	now: number;
	score: number;
	combo: number;
	bestCombo: number;
	hype: number;
	/** While the Phoenix is up: the beat its Fire Drop ends on. */
	riseUntil: number | null;
	rises: number;
	/** The Phoenix rises once a song at most: it's the song's peak. */
	risen: boolean;
	/** Songs the kid played that a guest asked for. */
	requestsMet: number;
	counts: Counts;
	totalNotes: number;
	played: TrackId[];
	events: GameEvent[];
};

export const GUESTS = 8;

export const spb = (track: Track) => 60 / track.bpm;
export const songSeconds = (track: Track) => SONG_BARS * 4 * spb(track);

export function newGame(seed: number, level: Level): Game {
	const rng = seeded(seed);
	return {
		seed,
		level,
		phase: "crate",
		song: 0,
		track: null,
		request: MOODS[Math.floor(rng() * MOODS.length)]!,
		requestBy: Math.floor(rng() * GUESTS),
		matched: false,
		notes: [],
		next: 0,
		now: 0,
		score: 0,
		combo: 0,
		bestCombo: 0,
		hype: HYPE_START,
		riseUntil: null,
		rises: 0,
		risen: false,
		requestsMet: 0,
		counts: { perfect: 0, good: 0, miss: 0, extra: 0 },
		totalNotes: 0,
		played: [],
		events: [],
	};
}

// ── The chart ──

/**
 * Patterns are one bar each: beats in the bar (0–3.5) and, for a two-lane chord, a 2. Pools run from sparse to busy;
 * a song takes them sparse in its first section of 8 bars, busier in the next, busiest in the last.
 */
type Hit = [beat: number, chord?: 2];
const POOLS: Record<Level, Hit[][][]> = {
	chill: [
		[
			[[0], [2]],
			[[0], [1], [2]],
			[[0], [2], [3]],
		],
		[
			[[0], [1], [2], [3]],
			[[0], [2], [3]],
			[[0], [1], [2]],
		],
		[
			[[0], [1], [2], [3]],
			[[0], [1], [2], [3]],
			[[0], [1.5], [2], [3]],
		],
	],
	party: [
		[
			[[0], [1], [2], [3]],
			[[0], [2], [3]],
			[[0], [1], [2], [2.5]],
		],
		[
			[[0], [1], [1.5], [2], [3]],
			[[0], [0.5], [1], [2], [3]],
			[[0], [1], [2], [2.5], [3]],
		],
		[
			[[0], [1], [1.5], [2], [3], [3.5]],
			[[0], [0.5], [1], [2], [2.5], [3]],
			[[0, 2], [1], [2], [3]],
		],
	],
	wild: [
		[
			[[0], [1], [1.5], [2], [3]],
			[[0], [0.5], [1], [2], [3]],
			[[0, 2], [1], [2], [3]],
		],
		[
			[[0], [0.5], [1], [1.5], [2], [3]],
			[[0, 2], [1], [1.5], [2, 2], [3]],
			[[0], [1], [1.5], [2], [2.5], [3], [3.5]],
		],
		[
			[[0, 2], [0.5], [1], [1.5], [2, 2], [2.5], [3], [3.5]],
			[[0], [0.5], [1], [1.5], [2], [2.5], [3], [3.5]],
			[[0, 2], [1], [1.5], [2, 2], [3], [3.5]],
		],
	],
};

/**
 * A song's notes: nothing in the count-in, a one-note breather at the end of every 8 bars, and the lanes walked
 * rather than jumped at random, so runs feel like a hand moving across the pads.
 */
export function chart(track: Track, level: Level, seed: number): Note[] {
	const rng = seeded(seed);
	const step = spb(track);
	const notes: Note[] = [];
	let lane = Math.floor(rng() * LANES);
	let dir = rng() < 0.5 ? 1 : -1;
	for (let bar = COUNT_IN_BARS; bar < SONG_BARS; bar++) {
		const at = bar * 4;
		if (bar % 8 === 7 || bar === SONG_BARS - 1) {
			// A breather: the downbeat alone.
			notes.push({ beat: at, t: at * step, lane, grade: null });
			continue;
		}
		const section = Math.min(2, Math.floor(bar / 8));
		const pool = POOLS[level][section]!;
		const pattern = pool[Math.floor(rng() * pool.length)]!;
		for (const [b, chord] of pattern) {
			// Walk: mostly a step along, sometimes a turn back, now and then a leap.
			const r = rng();
			if (r < 0.2) dir = -dir;
			const by = r > 0.88 ? 2 : 1;
			let next = lane + dir * by;
			if (next < 0 || next >= LANES) {
				dir = -dir;
				next = lane + dir * by;
			}
			lane = Math.max(0, Math.min(LANES - 1, next));
			const beat = at + b;
			notes.push({ beat, t: beat * step, lane, grade: null });
			if (chord) {
				const other = (lane + 2) % LANES;
				notes.push({ beat, t: beat * step, lane: other, grade: null });
			}
		}
	}
	return notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
}

// ── Playing ──

/** The crate: put a record on. Starts the song at its clock's 0. */
export function pick(g: Game, track: Track) {
	if (g.phase !== "crate") return;
	g.track = track;
	g.matched = track.mood === g.request;
	if (g.matched) {
		g.requestsMet++;
		g.hype = Math.min(HYPE_MAX, g.hype + HYPE_MATCH);
	}
	g.played.push(track.id);
	g.notes = chart(track, g.level, (g.seed ^ ((g.song + 1) * 0x9e3779b1)) >>> 0);
	g.totalNotes += g.notes.length;
	g.next = 0;
	g.now = 0;
	g.risen = false;
	g.phase = "song";
}

export const inRise = (g: Game) => g.riseUntil !== null;
export const multiplier = (g: Game) => 1 + Math.min(3, Math.floor(g.combo / 10));

function gainHype(g: Game, n: number) {
	if (inRise(g)) return;
	g.hype = Math.max(0, Math.min(HYPE_MAX, g.hype + n));
	if (g.hype >= HYPE_MAX && g.phase === "song" && !g.risen) {
		g.risen = true;
		g.riseUntil = Math.ceil(g.now / spb(g.track!) + 0.01) + RISE_BARS * 4;
		g.rises++;
		g.events.push({ type: "rise" });
	}
}

function judge(g: Game, n: Note, grade: Grade, off = 0) {
	n.grade = grade;
	g.counts[grade]++;
	if (grade === "miss") {
		g.combo = 0;
		g.events.push({ type: "miss", lane: n.lane });
		gainHype(g, -HYPE_MISS);
		return;
	}
	g.combo++;
	g.bestCombo = Math.max(g.bestCombo, g.combo);
	if ((STREAKS as readonly number[]).includes(g.combo)) g.events.push({ type: "streak", n: g.combo });
	g.score += (grade === "perfect" ? 100 : 50) * multiplier(g) * (inRise(g) ? 2 : 1);
	g.events.push({ type: "hit", lane: n.lane, grade, off });
	gainHype(g, HYPE_GAIN[g.level][grade]);
}

/** A pad pressed at song time `t`: the nearest waiting note in that lane, if one's close enough; else an extra tap. */
export function press(g: Game, lane: number, t: number) {
	if (g.phase !== "song") return;
	advance(g, t);
	let best: Note | null = null;
	for (let i = g.next; i < g.notes.length; i++) {
		const n = g.notes[i]!;
		if (n.t - t > GOOD_S) break;
		if (n.grade || n.lane !== lane) continue;
		if (Math.abs(n.t - t) <= GOOD_S && (!best || Math.abs(n.t - t) < Math.abs(best.t - t))) best = n;
	}
	if (best) judge(g, best, Math.abs(best.t - t) <= PERFECT_S ? "perfect" : "good", t - best.t);
	else {
		g.counts.extra++;
		g.events.push({ type: "extra", lane });
		gainHype(g, -HYPE_EXTRA);
	}
}

/** Moves the song clock on: notes left behind are missed, a Fire Drop runs out, and a song ends. */
export function advance(g: Game, t: number) {
	if (g.phase !== "song" || !g.track) return;
	g.now = Math.max(g.now, t);
	while (g.next < g.notes.length) {
		const n = g.notes[g.next]!;
		if (n.grade) {
			g.next++;
			continue;
		}
		if (g.now - n.t <= GOOD_S) break;
		judge(g, n, "miss");
		g.next++;
	}
	const beat = g.now / spb(g.track);
	if (g.riseUntil !== null && beat >= g.riseUntil) {
		g.riseUntil = null;
		g.hype = HYPE_AFTER_RISE;
		g.events.push({ type: "rise-end" });
	}
	if (g.now >= songSeconds(g.track)) endSong(g);
}

function endSong(g: Game) {
	g.events.push({ type: "song-end", song: g.song });
	if (g.riseUntil !== null) {
		// A Fire Drop doesn't carry over the gap between songs.
		g.riseUntil = null;
		g.hype = HYPE_AFTER_RISE;
		g.events.push({ type: "rise-end" });
	}
	g.song++;
	if (g.song >= SONGS_PER_SET) {
		g.phase = "over";
		g.events.push({ type: "over" });
		return;
	}
	g.phase = "crate";
	// The next guest asks for something different from what's just played.
	const rng = seeded((g.seed + g.song * 7919) >>> 0);
	const last = g.track!.mood;
	const others = MOODS.filter((m) => m !== last);
	g.request = others[Math.floor(rng() * others.length)]!;
	g.requestBy = (g.requestBy + 1 + Math.floor(rng() * (GUESTS - 1))) % GUESTS;
	g.track = null;
}

// ── Reading the game ──

/** How well the set went, 0–1: perfects count whole, goods most of one. */
export function accuracy(g: Game) {
	const judged = g.counts.perfect + g.counts.good + g.counts.miss;
	return judged ? (g.counts.perfect + 0.6 * g.counts.good) / judged : 0;
}

/** The set's rating, 1–5 flames. */
export function flames(g: Game) {
	const a = accuracy(g);
	return a >= 0.9 ? 5 : a >= 0.75 ? 4 : a >= 0.55 ? 3 : a >= 0.35 ? 2 : 1;
}

/** Tickets for a finished set: its flames, its rises and the requests met, at most `max`. */
export const ticketsFor = (g: Game, max: number) => Math.min(max, flames(g) * 3 + g.rises * 3 + g.requestsMet * 2);

/** How many of the guests are dancing: a hot floor fills, a cold one drifts off to the snacks. */
export const dancers = (g: Game) => (g.phase === "crate" ? 3 : Math.round(2 + (g.hype / HYPE_MAX) * (GUESTS - 2)));

/** Where the song is, in beats (fractional). */
export const beatAt = (g: Game, t = g.now) => (g.track ? t / spb(g.track) : 0);

/** Notes the autoplayer has already chosen to let go by. */
const skipped = new WeakSet<Note>();

/**
 * For tests and screenshots: plays each note as it comes, hitting a share `skill` of them (1 hits them all, 0 none)
 * within 20ms of the beat, and letting the rest go by.
 */
export function autoplay(g: Game, t: number, skill = 1, rng: () => number = Math.random) {
	if (g.phase !== "song") return;
	for (let i = g.next; i < g.notes.length && g.phase === "song"; i++) {
		const n = g.notes[i]!;
		if (n.t > t) break;
		if (n.grade || skipped.has(n)) continue;
		if (rng() < skill) press(g, n.lane, n.t + (rng() - 0.5) * 0.04);
		else skipped.add(n);
	}
	advance(g, t);
}

/** Plays `seconds` of the current song in steps, as the screen would. */
export function run(g: Game, seconds: number, skill = 1, rng: () => number = Math.random, dt = 1 / 60) {
	const until = g.now + seconds;
	for (let t = g.now; t < until && g.phase === "song"; t += dt) autoplay(g, t, skill, rng);
}
