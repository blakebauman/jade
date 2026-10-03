import { type Rng, seeded } from "@jade/core/math";
import { KINDS, type KindId } from "./kinds.ts";
import { BLOCKS, buildTown, PLAYER_START, SIZE } from "./town.ts";

/**
 * Gobble Town's rules, with nothing drawn: holes slide round the town, anything that fits and is mostly over a hole
 * falls in and makes it bigger, and a hole much bigger than another can gobble it (the gobbled one comes back small
 * a few seconds later, keeping its score). The computer players steer themselves here too. Pure and seeded: the
 * scene steps it at a fixed rate and draws what it says, and tests can play whole rounds in a few milliseconds.
 */

export const ROUND_S = 120;
export const COUNTDOWN_S = 3;
/** A hole's radius from its size (what it has eaten since it last started small). */
export const R0 = 0.7;
const GROW = 0.095;
export const radiusFor = (size: number) => R0 + GROW * Math.sqrt(size);
/** A thing fits once it's a bit narrower than the hole. */
const FIT = 0.92;
export const fits = (holeR: number, kindR: number) => kindR < holeR * FIT;
/** How much bigger a hole must be to gobble another. */
export const EATS = 1.2;
const RESPAWN_S = 3;
/** After coming back, how long a hole can't be gobbled. */
const SAFE_S = 3;
const CELL = 4;
const CELLS = SIZE / CELL;
/** The widest thing in town, so a search round a hole reaches anything that could overlap it. */
const MAX_R = Math.max(...Object.values(KINDS).map((k) => k.r));

export type Obj = {
	kind: KindId;
	/** Where it stands (or where it is while it falls). */
	x: number;
	z: number;
	rot: number;
	tint: number;
	state: "stand" | "fall" | "gone";
	/** Falling: seconds since it tipped in, how far down it is, and which hole has it. */
	t: number;
	y: number;
	hole: number;
	/** Leaning toward a hole it's too big for (radians), and which way (a unit direction on the ground). */
	tilt: number;
	tx: number;
	tz: number;
};

export type Bot = {
	next: number;
	/** Where it's heading. */
	gx: number;
	gz: number;
	/** 0.72–0.88: how fast it moves and how often it notices danger. */
	skill: number;
	/** How keen it is to chase smaller holes. */
	nerve: number;
	/** A hole it's chasing, and until when it keeps trying. */
	prey: number;
	chaseUntil: number;
};

export type Hole = {
	name: string;
	colour: string;
	player: boolean;
	x: number;
	z: number;
	vx: number;
	vz: number;
	/** What it has eaten since it last started small; sets its radius. */
	size: number;
	/** Everything it has eaten this round: the leaderboard. */
	score: number;
	/** Its radius now (it grows smoothly toward `radiusFor(size)`). */
	r: number;
	/** Gobbled: the time it comes back, else 0. */
	out: number;
	safeUntil: number;
	gobbles: number;
	bot?: Bot;
};

export type GameEvent =
	| { type: "start" }
	| { type: "end" }
	| { type: "gulp"; hole: number; kind: KindId; value: number; x: number; z: number }
	| { type: "gobbled"; eater: number; eaten: number; x: number; z: number }
	| { type: "back"; hole: number }
	| { type: "milestone"; kind: KindId };

export type Game = {
	rng: Rng;
	/** Seconds since the countdown began. */
	time: number;
	phase: "countdown" | "play" | "over";
	objs: Obj[];
	holes: Hole[];
	/** Objects by grid cell, for finding what's near a hole. */
	cells: number[][];
	/** What happened since the scene last looked (it empties this). */
	events: GameEvent[];
	/** Objects not standing still: falling, or leaning toward a hole. The scene redraws only these. */
	moving: Set<number>;
	/** Milestones already announced to the player. */
	told: Set<KindId>;
};

/** The player is always hole 0. */
export const PLAYER = 0;

const BOTS: readonly [string, string][] = [
	["Pip", "#3d74c9"],
	["Mochi", "#7dbf52"],
	["Clover", "#f2b33d"],
	["Biscuit", "#f08a3c"],
	["Juniper", "#8a5bd1"],
	["Pebble", "#4cc3c7"],
	["Waffles", "#c98a4b"],
	["Sunny", "#e8c93a"],
	["Maple", "#d0574b"],
	["Noodle", "#5a8f6e"],
];
export const PLAYER_COLOUR = "#e0457b";

/** A new round. `bots` computer players join the player, each starting in a different part of town. */
export function newGame(seed: number, playerName: string, bots = 6): Game {
	const rng = seeded(seed ^ 0x9e3779b9);
	const objs: Obj[] = buildTown(seed).map((p) => ({ ...p, state: "stand", t: 0, y: 0, hole: -1, tilt: 0, tx: 0, tz: 0 }));
	const cells: number[][] = Array.from({ length: CELLS * CELLS }, () => []);
	objs.forEach((o, i) => {
		cells[cellOf(o.x, o.z)]!.push(i);
	});
	// Never a computer player with the child's own name.
	const names = BOTS.filter(([n]) => n.toLowerCase() !== playerName.trim().toLowerCase())
		.sort(() => rng() - 0.5)
		.slice(0, bots);
	const blocks = BLOCKS.slice(1).sort(() => rng() - 0.5);
	const hole = (name: string, colour: string, x: number, z: number, bot?: Bot): Hole => ({
		name,
		colour,
		player: !bot,
		x,
		z,
		vx: 0,
		vz: 0,
		size: 0,
		score: 0,
		r: R0,
		out: 0,
		safeUntil: COUNTDOWN_S + SAFE_S,
		gobbles: 0,
		...(bot && { bot }),
	});
	const holes = [
		hole(playerName, PLAYER_COLOUR, PLAYER_START.x, PLAYER_START.z),
		...names.map(([name, colour], i) => {
			const b = blocks[i % blocks.length]!;
			const x = b.x0 + 2 + rng() * 12;
			const z = b.z0 + 2 + rng() * 12;
			return hole(name, colour, x, z, {
				next: 0,
				gx: x,
				gz: z,
				skill: 0.72 + rng() * 0.16,
				nerve: 0.3 + rng() * 0.5,
				prey: -1,
				chaseUntil: 0,
			});
		}),
	];
	return { rng, time: 0, phase: "countdown", objs, holes, cells, events: [], moving: new Set(), told: new Set() };
}

const cellOf = (x: number, z: number) => {
	const cx = Math.min(CELLS - 1, Math.max(0, Math.floor(x / CELL)));
	const cz = Math.min(CELLS - 1, Math.max(0, Math.floor(z / CELL)));
	return cz * CELLS + cx;
};

/** Every object whose cell is within `reach` of (x, z) (callers check the real distance). */
function near(g: Game, x: number, z: number, reach: number, visit: (i: number, o: Obj) => void) {
	const x0 = Math.max(0, Math.floor((x - reach) / CELL));
	const x1 = Math.min(CELLS - 1, Math.floor((x + reach) / CELL));
	const z0 = Math.max(0, Math.floor((z - reach) / CELL));
	const z1 = Math.min(CELLS - 1, Math.floor((z + reach) / CELL));
	for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) for (const i of g.cells[cz * CELLS + cx]!) visit(i, g.objs[i]!);
}

export const timeLeft = (g: Game) => Math.max(0, COUNTDOWN_S + ROUND_S - g.time);
export const isIn = (h: Hole) => h.out === 0;
/** How long a thing takes to fall all the way in (s): bigger things take a little longer. */
const fallTime = (kind: KindId) => 0.45 + 0.22 * KINDS[kind].r;
const depth = (kind: KindId) => KINDS[kind].h + 1.2;

/** The holes in leaderboard order: highest score first (the player first on a tie). */
export const ranking = (g: Game) =>
	g.holes.map((h, i) => ({ h, i })).sort((a, b) => b.h.score - a.h.score || Number(b.h.player) - Number(a.h.player));

/**
 * Moves the round on by `dt` seconds. `steer` is the direction the player wants to go on the ground (x east, z south),
 * no longer than 1; zero stops them.
 */
export function step(g: Game, dt: number, steer: { x: number; z: number }) {
	if (g.phase === "over") return;
	g.time += dt;
	if (g.phase === "countdown") {
		if (g.time < COUNTDOWN_S) return;
		g.phase = "play";
		g.events.push({ type: "start" });
	}
	if (g.time >= COUNTDOWN_S + ROUND_S) {
		g.phase = "over";
		g.events.push({ type: "end" });
		return;
	}
	g.holes.forEach((h, i) => {
		if (!isIn(h)) {
			if (g.time >= h.out) comeBack(g, i);
			return;
		}
		const want = h.bot ? think(g, i, h.bot) : steer;
		const speed = (3.1 + 0.4 * h.r) * (h.bot?.skill ?? 1);
		const ease = Math.min(1, dt * 8);
		h.vx += (want.x * speed - h.vx) * ease;
		h.vz += (want.z * speed - h.vz) * ease;
		// Kept on the board: a big hole can't hang off the edge.
		const edge = Math.max(0.6, h.r * 0.85);
		h.x = Math.min(SIZE - edge, Math.max(edge, h.x + h.vx * dt));
		h.z = Math.min(SIZE - edge, Math.max(edge, h.z + h.vz * dt));
		h.r += (radiusFor(h.size) - h.r) * Math.min(1, dt * 4);
	});
	swallow(g, dt);
	gobbleHoles(g);
	milestones(g);
}

/** Things tip into holes they fit, lean toward holes they don't, and fall. */
function swallow(g: Game, dt: number) {
	const leaning = new Set<number>();
	g.holes.forEach((h, hi) => {
		if (!isIn(h)) return;
		near(g, h.x, h.z, h.r + MAX_R, (i, o) => {
			if (o.state !== "stand") return;
			const k = KINDS[o.kind];
			const dx = h.x - o.x;
			const dz = h.z - o.z;
			const d = Math.hypot(dx, dz);
			if (d > h.r + k.r) return;
			if (fits(h.r, k.r)) {
				// Mostly over the hole: in it goes.
				if (d < h.r - k.r * 0.4) {
					o.state = "fall";
					o.hole = hi;
					o.t = 0;
					o.tilt = 0;
					o.tx = d > 1e-3 ? dx / d : 1;
					o.tz = d > 1e-3 ? dz / d : 0;
					g.moving.add(i);
				}
				return;
			}
			// Too big: it leans toward the hole, more the further the hole reaches under it.
			const lean = Math.min(1, (h.r + k.r - d) / (2 * k.r)) * 0.14 * Math.min(1, h.r / k.r + 0.3);
			if (!leaning.has(i) || lean > o.tilt) {
				o.tilt = lean;
				o.tx = d > 1e-3 ? dx / d : 1;
				o.tz = d > 1e-3 ? dz / d : 0;
			}
			leaning.add(i);
			g.moving.add(i);
		});
	});
	for (const i of g.moving) {
		const o = g.objs[i]!;
		if (o.state === "fall") {
			const h = g.holes[o.hole]!;
			o.t += dt;
			// Slides toward the middle of its hole as it drops, tipping over the edge.
			const pull = Math.min(1, dt * 5);
			o.x += (h.x - o.x) * pull;
			o.z += (h.z - o.z) * pull;
			const p = Math.min(1, o.t / fallTime(o.kind));
			o.y = -p * p * depth(o.kind);
			o.tilt = p * 0.9;
			if (p >= 1) {
				o.state = "gone";
				g.moving.delete(i);
				const value = KINDS[o.kind].value;
				h.size += value;
				h.score += value;
				g.events.push({ type: "gulp", hole: o.hole, kind: o.kind, value, x: o.x, z: o.z });
			}
		} else if (o.state === "stand" && !leaning.has(i)) {
			// Nothing under it any more: it rocks back upright.
			o.tilt *= 1 - Math.min(1, dt * 10);
			if (o.tilt < 0.002) {
				o.tilt = 0;
				g.moving.delete(i);
			}
		}
	}
}

function gobbleHoles(g: Game) {
	const { holes } = g;
	for (let a = 0; a < holes.length; a++) {
		const A = holes[a]!;
		if (!isIn(A)) continue;
		for (let b = 0; b < holes.length; b++) {
			const B = holes[b]!;
			if (a === b || !isIn(B) || g.time < B.safeUntil || A.r < B.r * EATS) continue;
			if (Math.hypot(A.x - B.x, A.z - B.z) > A.r - B.r * 0.3) continue;
			const gain = 6 + Math.round(B.size * 0.5);
			A.size += gain;
			A.score += gain;
			A.gobbles++;
			g.events.push({ type: "gobbled", eater: a, eaten: b, x: B.x, z: B.z });
			// What was still falling into it lands now: it counts to the score, but the hole comes back small.
			for (const i of g.moving) {
				const o = g.objs[i]!;
				if (o.state !== "fall" || o.hole !== b) continue;
				o.state = "gone";
				B.score += KINDS[o.kind].value;
				g.moving.delete(i);
			}
			B.size = 0;
			B.r = R0;
			B.vx = 0;
			B.vz = 0;
			B.out = g.time + RESPAWN_S;
			if (B.bot) B.bot.prey = -1;
		}
	}
}

/** Back in town after being gobbled: small again, somewhere away from the big holes, safe for a moment. */
function comeBack(g: Game, i: number) {
	const h = g.holes[i]!;
	let best = { x: h.x, z: h.z, score: -Infinity };
	for (let k = 0; k < 16; k++) {
		const x = 3 + g.rng() * (SIZE - 6);
		const z = 3 + g.rng() * (SIZE - 6);
		let score = Infinity;
		g.holes.forEach((o, j) => {
			if (j === i || !isIn(o)) return;
			score = Math.min(score, Math.hypot(o.x - x, o.z - z) / o.r);
		});
		if (score > best.score) best = { x, z, score };
	}
	h.x = best.x;
	h.z = best.z;
	h.out = 0;
	h.safeUntil = g.time + SAFE_S;
	g.events.push({ type: "back", hole: i });
}

/** Tells the player when they've grown big enough for something new, one thing at a time. */
function milestones(g: Game) {
	const p = g.holes[PLAYER]!;
	let newest: KindId | null = null;
	for (const k of Object.values(KINDS)) {
		if (!k.milestone || g.told.has(k.id) || !fits(p.r, k.r)) continue;
		g.told.add(k.id);
		newest = k.id;
	}
	if (newest) g.events.push({ type: "milestone", kind: newest });
}

const STILL = { x: 0, z: 0 };

/**
 * A computer player's steering. A few times a second it looks round: it runs from holes that could gobble it, may
 * chase a smaller hole (less keenly when that's the player), and otherwise heads for the best thing it fits nearby.
 */
function think(g: Game, i: number, bot: Bot): { x: number; z: number } {
	const me = g.holes[i]!;
	if (g.time >= bot.next) {
		bot.next = g.time + 0.25 + g.rng() * 0.15;
		decide(g, i, me, bot);
	}
	// Chasing: keep following where the prey actually is.
	if (bot.prey >= 0) {
		const p = g.holes[bot.prey]!;
		if (isIn(p) && g.time < bot.chaseUntil) {
			bot.gx = p.x;
			bot.gz = p.z;
		} else bot.prey = -1;
	}
	const dx = bot.gx - me.x;
	const dz = bot.gz - me.z;
	const d = Math.hypot(dx, dz);
	if (d < 0.2) return STILL;
	// Ease off as it arrives, so it settles over its target rather than overshooting.
	const k = Math.min(1, d / 1.5) / d;
	return { x: dx * k, z: dz * k };
}

function decide(g: Game, i: number, me: Hole, bot: Bot) {
	// Danger first.
	let fx = 0;
	let fz = 0;
	if (g.time >= me.safeUntil - 0.5) {
		g.holes.forEach((o, j) => {
			if (j === i || !isIn(o) || o.r < me.r * EATS) return;
			const dx = me.x - o.x;
			const dz = me.z - o.z;
			const d = Math.hypot(dx, dz) || 0.01;
			if (d > o.r + me.r + 4 || g.rng() > bot.skill) return;
			fx += dx / (d * d);
			fz += dz / (d * d);
		});
	}
	if (fx || fz) {
		// Away from danger, and away from the edge so it isn't cornered.
		const cx = SIZE / 2 - me.x;
		const cz = SIZE / 2 - me.z;
		const len = Math.hypot(fx, fz);
		const clen = Math.hypot(cx, cz) || 1;
		const wx = fx / len + (cx / clen) * 0.35;
		const wz = fz / len + (cz / clen) * 0.35;
		bot.gx = me.x + wx * 6;
		bot.gz = me.z + wz * 6;
		bot.prey = -1;
		return;
	}
	if (bot.prey >= 0) return;
	// A smaller hole close by, sometimes (rarely the player, and never for long).
	let prey = -1;
	let preyD = 6 + me.r;
	g.holes.forEach((o, j) => {
		if (j === i || !isIn(o) || g.time < o.safeUntil || me.r < o.r * EATS * 1.05) return;
		const d = Math.hypot(o.x - me.x, o.z - me.z);
		if (d < preyD) {
			prey = j;
			preyD = d;
		}
	});
	if (prey >= 0) {
		const keen = g.holes[prey]!.player ? bot.nerve * 0.4 : bot.nerve;
		if (g.rng() < keen * 0.35) {
			bot.prey = prey;
			bot.chaseUntil = g.time + (g.holes[prey]!.player ? 2.5 : 4);
			return;
		}
	}
	// The best thing it fits nearby: worth more, and closer.
	let best = -1;
	let bestScore = 0;
	const reach = 7 + me.r * 2;
	near(g, me.x, me.z, reach, (j, o) => {
		if (o.state !== "stand" || !fits(me.r, KINDS[o.kind].r)) return;
		const d = Math.hypot(o.x - me.x, o.z - me.z);
		if (d > reach) return;
		const s = (KINDS[o.kind].value / (d + 2)) * (0.75 + g.rng() * 0.5);
		if (s > bestScore) {
			bestScore = s;
			best = j;
		}
	});
	if (best >= 0) {
		bot.gx = g.objs[best]!.x;
		bot.gz = g.objs[best]!.z;
		return;
	}
	// Nothing in reach: off to another block.
	if (Math.hypot(bot.gx - me.x, bot.gz - me.z) < 1) {
		const b = BLOCKS[Math.floor(g.rng() * BLOCKS.length)]!;
		bot.gx = b.x0 + 2 + g.rng() * 12;
		bot.gz = b.z0 + 2 + g.rng() * 12;
	}
}

const pilots = new WeakMap<Game, Bot>();
/** A computer player's brain steering the player instead (for tests): pass what it returns to `step`. */
export function autopilot(g: Game): { x: number; z: number } {
	const me = g.holes[PLAYER]!;
	let bot = pilots.get(g);
	if (!bot) {
		bot = { next: 0, gx: me.x, gz: me.z, skill: 1, nerve: 0.6, prey: -1, chaseUntil: 0 };
		pilots.set(g, bot);
	}
	return think(g, PLAYER, bot);
}
