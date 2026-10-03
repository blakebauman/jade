import { type Rng, seeded } from "@jade/core/math";

/**
 * Jelly Blocks' rules: falling pieces of four jelly cubes in a jar 10 wide and 20 tall. Move and turn the falling piece,
 * fill a whole row and it pops; the jar fills to the top and the game's over. It speeds up every 10 rows.
 *
 * The usual modern rules, so a kid who's played the classic finds it as they expect: a shuffled bag of all seven
 * pieces, turning with wall kicks, a ghost showing where the piece will land, Hold (once per piece), half a second to
 * slide a piece that's touched down. Pure and seeded: the scene steps it at 60Hz, tests play whole games.
 *
 * Rows count up from the bottom (y = 0); x from the left. Every cube has an id (so the scene can follow it as it falls
 * after a clear), kept in the grid as `id * 8 + type`.
 */

export const COLS = 10;
export const ROWS = 20;
/** Rows above the jar where pieces appear. */
export const HIDDEN = 2;
const H = ROWS + HIDDEN;

/** 1–7: I O T S Z J L. */
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const PIECE_NAMES = ["", "I", "O", "T", "S", "Z", "J", "L"] as const;

/** Each piece in its box (n × n), turned 0, right, 2, left; y up. */
const BOX: Record<PieceType, number> = { 1: 4, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 };
const SPAWN: Record<PieceType, [number, number][]> = {
	1: [
		[0, 2],
		[1, 2],
		[2, 2],
		[3, 2],
	],
	2: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	],
	3: [
		[1, 2],
		[0, 1],
		[1, 1],
		[2, 1],
	],
	4: [
		[1, 2],
		[2, 2],
		[0, 1],
		[1, 1],
	],
	5: [
		[0, 2],
		[1, 2],
		[1, 1],
		[2, 1],
	],
	6: [
		[0, 2],
		[0, 1],
		[1, 1],
		[2, 1],
	],
	7: [
		[2, 2],
		[0, 1],
		[1, 1],
		[2, 1],
	],
};

/** Cells of `type` turned `rot` times clockwise, in its box. A cube keeps its index as the piece turns. */
const SHAPES: Record<PieceType, [number, number][][]> = (() => {
	const out = {} as Record<PieceType, [number, number][][]>;
	for (let t = 1; t <= 7; t++) {
		const type = t as PieceType;
		const n = BOX[type];
		const rots = [SPAWN[type]];
		for (let r = 1; r < 4; r++) rots.push(rots[r - 1]!.map(([x, y]) => (type === 2 ? [x, y] : [y, n - 1 - x]) as [number, number]));
		out[type] = rots;
	}
	return out;
})();

export const shape = (type: PieceType, rot: number) => SHAPES[type][rot & 3]!;

/** Wall kicks (SRS), tried in order; y up. Keyed by `from * 4 + to`. */
const KICKS_JLSTZ: Record<number, [number, number][]> = {
	1: [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2],
	],
	4: [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2],
	],
	6: [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2],
	],
	9: [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2],
	],
	11: [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2],
	],
	14: [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2],
	],
	12: [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2],
	],
	3: [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2],
	],
};
const KICKS_I: Record<number, [number, number][]> = {
	1: [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, -1],
		[1, 2],
	],
	4: [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, 1],
		[-1, -2],
	],
	6: [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, 2],
		[2, -1],
	],
	9: [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, -2],
		[-2, 1],
	],
	11: [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, 1],
		[-1, -2],
	],
	14: [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, -1],
		[1, 2],
	],
	12: [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, -2],
		[-2, 1],
	],
	3: [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, 2],
		[2, -1],
	],
};

// ── Tuning ──

/** Seconds per row at a level: 0.9s at level 1, gentler than the arcade curve; level 10 is about 0.19s. */
export const gravity = (level: number) => Math.max(0.06, 0.9 * 0.84 ** (level - 1));
/** Soft drop: a row every 40ms (or gravity, if that's already faster). */
const SOFT_S = 0.04;
/** Holding left or right: one step, a pause, then a step every ARR. */
export const DAS_S = 0.17;
export const ARR_S = 0.05;
/** Time to slide a piece that's touched down, and how many moves may restart it. */
export const LOCK_S = 0.5;
const LOCK_RESETS = 15;
/** Full rows pop for this long before the rows above drop. */
export const CLEAR_S = 0.28;
export const ROWS_PER_LEVEL = 10;
const CLEAR_POINTS = [0, 100, 300, 500, 800];
/** Taps kept for the next piece. */
const MAX_PENDING = 4;
/** Start speeds a kid can choose. */
export const START_LEVELS = { slow: 1, medium: 4, fast: 7 } as const;
export type Speed = keyof typeof START_LEVELS;

// ── State ──

export type Active = { type: PieceType; rot: number; x: number; y: number; ids: number[] };

export type Action = "left" | "right" | "cw" | "ccw" | "drop" | "hold";
/** What the player is doing this step: keys (or buttons) held, and taps since the last step. */
export type Input = { left: boolean; right: boolean; down: boolean; actions: Action[] };
export const NO_INPUT: Input = { left: false, right: false, down: false, actions: [] };

export type GameEvent =
	| { type: "spawn" }
	| { type: "move" }
	| { type: "rotate"; dir: 1 | -1; kicked: boolean }
	| { type: "touch" }
	| { type: "lock"; ids: number[]; hard: boolean; fell: number }
	| { type: "clear"; rows: number[]; ids: number[]; count: number; combo: number; perfect: boolean; points: number }
	| { type: "collapse" }
	| { type: "level"; level: number }
	| { type: "hold" }
	/** The jar filled up, or play time ran out and the last piece is down. */
	| { type: "over"; why: "full" | "time" };

export type Game = {
	seed: number;
	rng: Rng;
	grid: Int32Array;
	active: Active | null;
	hold: PieceType | 0;
	holdUsed: boolean;
	queue: PieceType[];
	nextId: number;
	score: number;
	lines: number;
	startLevel: number;
	level: number;
	/** Pieces in a row that cleared something, minus one (−1: none). */
	combo: number;
	pieces: number;
	/** Gravity, lock delay and held-key timers. */
	fallT: number;
	lockT: number;
	lockResets: number;
	lowest: number;
	grounded: boolean;
	das: { dir: -1 | 0 | 1; t: number; next: number };
	/** Rows popping, and how long until they go. */
	clearing: { rows: number[]; t: number } | null;
	/** Taps waiting for the next piece (made during a pop, or after a drop in the same step). */
	pending: Action[];
	/** Play time's up: the game ends once the falling piece is down (and its rows popped). */
	lastPiece: boolean;
	phase: "play" | "over";
	time: number;
	events: GameEvent[];
};

/** Whether the game has ended (a function, so a check after a call that may end it isn't narrowed away). */
const isOver = (g: Game) => g.phase === "over";

export const cellType = (v: number) => (v & 7) as PieceType;
export const cellId = (v: number) => v >> 3;
const at = (g: Game, x: number, y: number) => g.grid[y * COLS + x]!;

export function newGame(seed: number, startLevel = 1): Game {
	const g: Game = {
		seed,
		rng: seeded(seed ^ 0x5bd1e995),
		grid: new Int32Array(COLS * H),
		active: null,
		hold: 0,
		holdUsed: false,
		queue: [],
		nextId: 1,
		score: 0,
		lines: 0,
		startLevel,
		level: startLevel,
		combo: -1,
		pieces: 0,
		fallT: 0,
		lockT: 0,
		lockResets: 0,
		lowest: H,
		grounded: false,
		das: { dir: 0, t: 0, next: 0 },
		clearing: null,
		pending: [],
		lastPiece: false,
		phase: "play",
		time: 0,
		events: [],
	};
	fillQueue(g);
	spawn(g);
	return g;
}

/** The next pieces, always at least `n` known (shuffled bags of all seven). */
export function upcoming(g: Game, n = 3): PieceType[] {
	return g.queue.slice(0, n);
}

function fillQueue(g: Game) {
	while (g.queue.length < 7) {
		const bag: PieceType[] = [1, 2, 3, 4, 5, 6, 7];
		for (let i = bag.length - 1; i > 0; i--) {
			const j = Math.floor(g.rng() * (i + 1));
			[bag[i], bag[j]] = [bag[j]!, bag[i]!];
		}
		g.queue.push(...bag);
	}
}

/** Whether `type` turned `rot` fits with its box at (x, y). */
export function fits(g: Game, type: PieceType, rot: number, x: number, y: number) {
	for (const [cx, cy] of shape(type, rot)) {
		const px = x + cx;
		const py = y + cy;
		if (px < 0 || px >= COLS || py < 0) return false;
		if (py < H && at(g, px, py) !== 0) return false;
	}
	return true;
}

/** The cells the falling piece covers now: [x, y, id]. */
export function activeCells(g: Game, a = g.active): [number, number, number][] {
	if (!a) return [];
	return shape(a.type, a.rot).map(([cx, cy], i) => [a.x + cx, a.y + cy, a.ids[i]!]);
}

/** Where the falling piece would land (its box's y). */
export function ghostY(g: Game) {
	const a = g.active;
	if (!a) return 0;
	let y = a.y;
	while (fits(g, a.type, a.rot, a.x, y - 1)) y--;
	return y;
}

function spawn(g: Game, type?: PieceType) {
	const t = type ?? g.queue.shift()!;
	fillQueue(g);
	const n = BOX[t];
	const lowestInBox = Math.min(...shape(t, 0).map(([, y]) => y));
	// The bottom of the piece starts just above the jar, then drops in at once if there's room.
	const a: Active = { type: t, rot: 0, x: n === 2 ? 4 : 3, y: ROWS - lowestInBox, ids: [] };
	for (let i = 0; i < 4; i++) a.ids.push(g.nextId++);
	g.fallT = 0;
	g.lockT = 0;
	g.lockResets = 0;
	g.grounded = false;
	if (!fits(g, a.type, a.rot, a.x, a.y)) {
		g.active = null;
		gameOver(g);
		return;
	}
	if (fits(g, a.type, a.rot, a.x, a.y - 1)) a.y--;
	g.lowest = a.y;
	g.active = a;
	g.events.push({ type: "spawn" });
}

function gameOver(g: Game, why: "full" | "time" = "full") {
	g.phase = "over";
	g.active = null;
	g.events.push({ type: "over", why });
}

/** The next piece, unless play time's up. */
function next(g: Game) {
	if (g.lastPiece) gameOver(g, "time");
	else spawn(g);
}

/** A move or turn while touching down restarts the lock delay (a few times), so a piece can be slid into place. */
function moved(g: Game) {
	const a = g.active!;
	// Lower than it's been: a fresh lock delay and a fresh set of resets.
	if (a.y < g.lowest) {
		g.lowest = a.y;
		g.lockResets = 0;
		g.lockT = 0;
	}
	if (g.grounded && g.lockResets < LOCK_RESETS) {
		g.lockT = 0;
		g.lockResets++;
	}
}

function shift(g: Game, dx: number) {
	const a = g.active;
	if (!a || !fits(g, a.type, a.rot, a.x + dx, a.y)) return false;
	a.x += dx;
	g.events.push({ type: "move" });
	moved(g);
	return true;
}

function rotate(g: Game, dir: 1 | -1) {
	const a = g.active;
	if (!a || a.type === 2) return false;
	const from = a.rot & 3;
	const to = (from + dir + 4) & 3;
	const kicks = (a.type === 1 ? KICKS_I : KICKS_JLSTZ)[from * 4 + to]!;
	for (let k = 0; k < kicks.length; k++) {
		const [dx, dy] = kicks[k]!;
		if (fits(g, a.type, to, a.x + dx, a.y + dy)) {
			a.x += dx;
			a.y += dy;
			a.rot = to;
			g.events.push({ type: "rotate", dir, kicked: k > 0 });
			moved(g);
			return true;
		}
	}
	return false;
}

function holdPiece(g: Game) {
	const a = g.active;
	if (!a || g.holdUsed) return;
	const back = g.hold;
	g.hold = a.type;
	g.holdUsed = true;
	g.events.push({ type: "hold" });
	spawn(g, back || undefined);
}

function lock(g: Game, hard: boolean, fell: number) {
	const a = g.active!;
	const cells = activeCells(g);
	for (const [x, y, id] of cells) if (y < H) g.grid[y * COLS + x] = id * 8 + a.type;
	g.active = null;
	g.holdUsed = false;
	g.pieces++;
	g.events.push({ type: "lock", ids: a.ids.slice(), hard, fell });
	// Wholly above the jar: it's full.
	if (cells.every(([, y]) => y >= ROWS)) return gameOver(g);
	const rows: number[] = [];
	for (let y = 0; y < H; y++) {
		let full = true;
		for (let x = 0; x < COLS && full; x++) if (at(g, x, y) === 0) full = false;
		if (full) rows.push(y);
	}
	if (rows.length === 0) {
		g.combo = -1;
		next(g);
		return;
	}
	const ids: number[] = [];
	for (const y of rows) for (let x = 0; x < COLS; x++) ids.push(cellId(at(g, x, y)));
	g.combo++;
	const n = rows.length;
	let points = CLEAR_POINTS[n]! * g.level + (g.combo > 0 ? 50 * g.combo * g.level : 0);
	// An empty jar afterwards: every cube left is in the popping rows.
	let left = 0;
	for (let i = 0; i < g.grid.length; i++) if (g.grid[i] !== 0) left++;
	const perfect = left === n * COLS;
	if (perfect) points += 1000 * g.level;
	g.score += points;
	const was = g.level;
	g.lines += n;
	g.level = g.startLevel + Math.floor(g.lines / ROWS_PER_LEVEL);
	g.events.push({ type: "clear", rows, ids, count: n, combo: g.combo, perfect, points });
	if (g.level > was) g.events.push({ type: "level", level: g.level });
	g.clearing = { rows, t: CLEAR_S };
}

/** The popped rows go; everything above drops down. */
function collapse(g: Game, rows: number[]) {
	const gone = new Set(rows);
	let to = 0;
	for (let y = 0; y < H; y++) {
		if (gone.has(y)) continue;
		if (to !== y) for (let x = 0; x < COLS; x++) g.grid[to * COLS + x] = at(g, x, y);
		to++;
	}
	for (let y = to; y < H; y++) for (let x = 0; x < COLS; x++) g.grid[y * COLS + x] = 0;
	g.clearing = null;
	g.events.push({ type: "collapse" });
	next(g);
}

/** One step of `dt` seconds. Taps in `input.actions` are used up. */
export function step(g: Game, dt: number, input: Input) {
	if (g.phase === "over") return;
	g.time += dt;
	const dir: -1 | 0 | 1 = input.left === input.right ? 0 : input.left ? -1 : 1;

	if (g.clearing) {
		// Taps during the pop wait for the next piece (a few at most).
		g.pending.push(...input.actions);
		g.pending.splice(0, g.pending.length - MAX_PENDING);
		input.actions.length = 0;
		g.clearing.t -= dt;
		if (g.clearing.t <= 0) collapse(g, g.clearing.rows);
		return;
	}
	if (!g.active) return;

	const acts = g.pending.length ? [...g.pending, ...input.actions] : input.actions.slice();
	g.pending.length = 0;
	input.actions.length = 0;
	for (let i = 0; i < acts.length; i++) {
		const act = acts[i]!;
		if (!g.active || isOver(g)) break;
		if (act === "left") shift(g, -1);
		else if (act === "right") shift(g, 1);
		else if (act === "cw") rotate(g, 1);
		else if (act === "ccw") rotate(g, -1);
		else if (act === "hold") holdPiece(g);
		else if (act === "drop") {
			const a = g.active;
			const to = ghostY(g);
			const fell = a.y - to;
			a.y = to;
			g.score += 2 * fell;
			lock(g, true, fell);
			// One drop a step: taps after it are for the next piece.
			g.pending.push(...acts.slice(i + 1, i + 1 + MAX_PENDING));
			break;
		}
	}
	if (!g.active || isOver(g)) return;

	// Held left or right: a step at once, then after a pause a step every ARR.
	if (dir !== g.das.dir) {
		g.das = { dir, t: 0, next: DAS_S };
		if (dir) shift(g, dir);
	} else if (dir) {
		g.das.t += dt;
		while (g.das.t >= g.das.next) {
			if (!shift(g, dir)) {
				g.das.next = g.das.t + ARR_S;
				break;
			}
			g.das.next += ARR_S;
		}
	}

	const a = g.active;
	const every = input.down ? Math.min(SOFT_S, gravity(g.level)) : gravity(g.level);
	g.fallT += dt;
	while (g.fallT >= every) {
		g.fallT -= every;
		if (!fits(g, a.type, a.rot, a.x, a.y - 1)) {
			g.fallT = 0;
			break;
		}
		a.y--;
		if (input.down) g.score += 1;
		moved(g);
	}

	const down = !fits(g, a.type, a.rot, a.x, a.y - 1);
	if (down && !g.grounded) g.events.push({ type: "touch" });
	g.grounded = down;
	// In the air the lock delay waits (it only starts again on reaching a new lowest row, or with a move's reset).
	if (!down) return;
	g.lockT += dt;
	if (g.lockT >= LOCK_S) lock(g, false, 0);
}

/** Every cube in the jar now (not the falling piece): [x, y, id, type]. */
export function settled(g: Game): [number, number, number, PieceType][] {
	const out: [number, number, number, PieceType][] = [];
	for (let y = 0; y < H; y++)
		for (let x = 0; x < COLS; x++) {
			const v = at(g, x, y);
			if (v) out.push([x, y, cellId(v), cellType(v)]);
		}
	return out;
}

/** How high the stack stands, in rows. */
export function stackHeight(g: Game) {
	for (let y = H - 1; y >= 0; y--) for (let x = 0; x < COLS; x++) if (at(g, x, y)) return y + 1;
	return 0;
}

// ── A computer player, for tests and the screenshot hooks ──

/** Scores the jar after a placement (the usual height, holes and bumpiness weights). */
function judge(grid: Int32Array, cleared: number) {
	let heights = 0;
	let holes = 0;
	let bumps = 0;
	let prev = -1;
	for (let x = 0; x < COLS; x++) {
		let h = 0;
		for (let y = H - 1; y >= 0; y--)
			if (grid[y * COLS + x]) {
				h = y + 1;
				break;
			}
		for (let y = 0; y < h; y++) if (!grid[y * COLS + x]) holes++;
		heights += h;
		if (prev >= 0) bumps += Math.abs(h - prev);
		prev = h;
	}
	return -0.51 * heights + 0.76 * cleared - 0.36 * holes - 0.18 * bumps;
}

/** The best turn and column for the falling piece, by dropping it straight down from where it is. */
export function bestPlacement(g: Game): { rot: number; x: number } | null {
	const a = g.active;
	if (!a) return null;
	let best: { rot: number; x: number; v: number } | null = null;
	for (let rot = 0; rot < (a.type === 2 ? 1 : 4); rot++)
		for (let x = -3; x < COLS; x++) {
			if (!fits(g, a.type, rot, x, a.y)) continue;
			let y = a.y;
			while (fits(g, a.type, rot, x, y - 1)) y--;
			const grid = g.grid.slice();
			for (const [cx, cy] of shape(a.type, rot)) if (y + cy < H) grid[(y + cy) * COLS + x + cx] = 1;
			let cleared = 0;
			for (let r = 0; r < H; r++) {
				let full = true;
				for (let c = 0; c < COLS && full; c++) if (!grid[r * COLS + c]) full = false;
				if (full) cleared++;
			}
			const v = judge(grid, cleared);
			if (!best || v > best.v) best = { rot, x, v };
		}
	return best && { rot: best.rot, x: best.x };
}

const targets = new WeakMap<Active, { rot: number; x: number } | null>();

/** One tap toward the best placement (chosen once per piece): turn, then step sideways, then drop. */
export function autopilot(g: Game): Input {
	const a = g.active;
	if (!a) return { ...NO_INPUT, actions: [] };
	if (!targets.has(a)) targets.set(a, bestPlacement(g));
	const target = targets.get(a);
	let act: Action = "drop";
	if (target && a.rot !== target.rot) act = "cw";
	else if (target && a.x !== target.x) {
		const dx = a.x < target.x ? 1 : -1;
		// Blocked on the way: drop where it is.
		if (fits(g, a.type, a.rot, a.x + dx, a.y)) act = dx > 0 ? "right" : "left";
	}
	return { left: false, right: false, down: false, actions: [act] };
}
