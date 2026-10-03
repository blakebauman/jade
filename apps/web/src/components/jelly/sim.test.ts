import { describe, expect, it } from "vitest";
import {
	activeCells,
	autopilot,
	CLEAR_S,
	COLS,
	DAS_S,
	type Game,
	type GameEvent,
	ghostY,
	gravity,
	HIDDEN,
	type Input,
	LOCK_S,
	NO_INPUT,
	newGame,
	type PieceType,
	ROWS,
	settled,
	shape,
	stackHeight,
	step,
	upcoming,
} from "./sim.ts";

const DT = 1 / 60;
const idle = (): Input => ({ ...NO_INPUT, actions: [] });
const tap = (...actions: Input["actions"]): Input => ({ ...NO_INPUT, actions });

/** Runs `seconds` with the same input held, collecting events. */
function run(g: Game, seconds: number, input: () => Input = idle) {
	const events: GameEvent[] = [];
	for (let t = 0; t < seconds - 1e-9 && g.phase !== "over"; t += DT) {
		step(g, DT, input());
		events.push(...g.events.splice(0));
	}
	return events;
}

/** A game whose falling piece is `type`, the jar empty. */
function withPiece(type: PieceType, seed = 1) {
	for (let s = seed; s < seed + 200; s++) {
		const g = newGame(s);
		if (g.active?.type === type) return g;
	}
	throw new Error("no seed");
}

/** Fills row `y` except the columns listed. */
function fillRow(g: Game, y: number, except: number[] = []) {
	for (let x = 0; x < COLS; x++) if (!except.includes(x)) g.grid[y * COLS + x] = (g.nextId++ << 3) | 2;
}

describe("pieces", () => {
	it("each has four cubes, and turning four times comes back where it started", () => {
		for (let t = 1; t <= 7; t++) {
			const type = t as PieceType;
			expect(shape(type, 0)).toHaveLength(4);
			expect(shape(type, 4)).toEqual(shape(type, 0));
			expect(new Set(shape(type, 1).map(String)).size).toBe(4);
		}
	});

	it("come from shuffled bags of all seven", () => {
		const g = newGame(42);
		const seen: number[] = [g.active!.type, ...upcoming(g, 6)];
		expect(new Set(seen).size).toBe(7);
	});

	it("are the same for the same seed and differ for another", () => {
		expect(upcoming(newGame(7), 7)).toEqual(upcoming(newGame(7), 7));
		const a = Array.from({ length: 5 }, (_, i) => upcoming(newGame(i), 7).join(""));
		expect(new Set(a).size).toBeGreaterThan(1);
	});

	it("appear in the top rows of the jar, centred", () => {
		const g = newGame(3);
		const cells = activeCells(g);
		const ys = cells.map(([, y]) => y);
		expect(Math.min(...ys)).toBe(ROWS - 1);
		const xs = cells.map(([x]) => x);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(3);
		expect(Math.max(...xs)).toBeLessThanOrEqual(6);
	});
});

describe("moving and turning", () => {
	it("moves a step per tap and stops at the walls", () => {
		const g = withPiece(3);
		const x0 = g.active!.x;
		step(g, DT, tap("left"));
		expect(g.active!.x).toBe(x0 - 1);
		for (let i = 0; i < 10; i++) step(g, DT, tap("left"));
		expect(Math.min(...activeCells(g).map(([x]) => x))).toBe(0);
	});

	it("held: one step at once, then repeats after a pause", () => {
		const g = withPiece(3);
		const x0 = g.active!.x;
		const held = (): Input => ({ ...NO_INPUT, right: true, actions: [] });
		step(g, DT, held());
		expect(g.active!.x).toBe(x0 + 1);
		run(g, DAS_S - 2 * DT, held);
		expect(g.active!.x).toBe(x0 + 1);
		run(g, 0.2, held);
		expect(Math.max(...activeCells(g).map(([x]) => x))).toBe(COLS - 1);
	});

	it("kicks off a wall when turning against it", () => {
		const g = withPiece(1);
		step(g, DT, tap("cw"));
		for (let i = 0; i < 6; i++) step(g, DT, tap("left"));
		expect(Math.min(...activeCells(g).map(([x]) => x))).toBe(0);
		// The upright long piece against the left wall turns flat and is pushed back in.
		step(g, DT, tap("ccw"));
		const cells = activeCells(g);
		expect(new Set(cells.map(([, y]) => y)).size).toBe(1);
		expect(Math.min(...cells.map(([x]) => x))).toBe(0);
	});

	it("doesn't turn the square", () => {
		const g = withPiece(2);
		const before = activeCells(g);
		step(g, DT, tap("cw"));
		expect(activeCells(g)).toEqual(before);
	});
});

describe("falling and landing", () => {
	it("falls a row per gravity interval, faster at higher levels", () => {
		const g = withPiece(3);
		const y0 = g.active!.y;
		run(g, gravity(1) * 3 + DT);
		expect(g.active!.y).toBe(y0 - 3);
		expect(gravity(10)).toBeLessThan(gravity(1) / 3);
	});

	it("lands on the ghost, then locks after the lock delay", () => {
		const g = withPiece(3);
		const lowest = Math.min(...shape(3, 0).map(([, y]) => y));
		expect(ghostY(g) + lowest).toBe(0);
		const events = run(g, gravity(1) * 25 + LOCK_S + 0.1);
		expect(events.some((e) => e.type === "touch")).toBe(true);
		expect(events.some((e) => e.type === "lock")).toBe(true);
		expect(settled(g)).toHaveLength(4);
	});

	it("hard drop locks at once and scores 2 per row", () => {
		const g = withPiece(3);
		const fell = g.active!.y - ghostY(g);
		step(g, DT, tap("drop"));
		const lock = g.events.find((e) => e.type === "lock");
		expect(lock).toMatchObject({ hard: true, fell });
		expect(g.score).toBe(2 * fell);
		expect(g.pieces).toBe(1);
		expect(g.active).not.toBeNull();
	});

	it("sliding a landed piece restarts the lock delay, but not forever", () => {
		const g = withPiece(3);
		g.active!.y = ghostY(g);
		step(g, DT, idle());
		let alive = 0;
		for (let i = 0; i < 40 && g.pieces === 0; i++) {
			run(g, LOCK_S * 0.8);
			step(g, DT, tap(i % 2 ? "left" : "right"));
			alive++;
		}
		expect(g.pieces).toBe(1);
		expect(alive).toBeGreaterThan(5);
		expect(alive).toBeLessThan(20);
	});
});

describe("lock delay", () => {
	it("can't be dodged by turning a piece up into the air and back", () => {
		const g = withPiece(3);
		g.active!.y = ghostY(g);
		step(g, DT, idle());
		// Turning back and forth: the kick lifts it, the turn back leaves it floating, over and over.
		for (let i = 0; i < 400 && g.pieces === 0; i++) step(g, DT, tap(i % 2 ? "ccw" : "cw"));
		expect(g.pieces).toBe(1);
	});
});

describe("taps that can't be used at once", () => {
	it("taps during a pop wait for the next piece", () => {
		const play = (during: Input) => {
			const g = withPiece(1);
			fillRow(g, 0, [3, 4, 5, 6]);
			step(g, DT, tap("drop"));
			expect(g.clearing).not.toBeNull();
			step(g, DT, during);
			run(g, CLEAR_S + DT);
			return g.active!.x;
		};
		// The same game with and without a tap mid-pop: the new piece has taken the step.
		expect(play(tap("left"))).toBe(play(idle()) - 1);
	});

	it("two drops in one step drop one piece, then the next", () => {
		const g = newGame(4);
		step(g, DT, tap("drop", "drop"));
		expect(g.pieces).toBe(1);
		step(g, DT, idle());
		expect(g.pieces).toBe(2);
	});
});

describe("clearing rows", () => {
	it("a full row pops, then the rows above drop", () => {
		const g = withPiece(1);
		fillRow(g, 0, [3, 4, 5, 6]);
		g.grid[1 * COLS] = (g.nextId++ << 3) | 2;
		const above = settled(g).find(([, y]) => y === 1)!;
		step(g, DT, tap("drop"));
		const clear = g.events.find((e) => e.type === "clear");
		expect(clear).toMatchObject({ count: 1, rows: [0] });
		expect(g.lines).toBe(1);
		expect(g.score).toBe(100 + 2 * (ROWS - 1));
		// The pop lasts a moment; then the row above has dropped into its place and the next piece is out.
		expect(g.active).toBeNull();
		run(g, CLEAR_S + DT);
		const moved = settled(g).find(([, , id]) => id === above[2])!;
		expect(moved[1]).toBe(0);
		expect(g.active).not.toBeNull();
	});

	it("four rows at once is worth the most, and an empty jar after is a bonus", () => {
		const g = withPiece(1);
		step(g, DT, tap("cw"));
		for (let y = 0; y < 4; y++) fillRow(g, y, [g.active!.x + 2]);
		step(g, DT, tap("drop"));
		const clear = g.events.find((e) => e.type === "clear") as Extract<GameEvent, { type: "clear" }>;
		expect(clear.count).toBe(4);
		expect(clear.perfect).toBe(true);
		expect(clear.points).toBe(800 + 1000);
	});

	it("levels up every 10 rows and counts from the chosen start", () => {
		const g = newGame(5, 4);
		expect(g.level).toBe(4);
		const events = run(g, 600, () => autopilot(g));
		expect(g.lines).toBeGreaterThan(10);
		expect(g.level).toBe(4 + Math.floor(g.lines / 10));
		expect(events.some((e) => e.type === "level")).toBe(true);
	});
});

describe("hold", () => {
	it("keeps the piece for later, once per piece", () => {
		const g = newGame(9);
		const first = g.active!.type;
		const next = upcoming(g, 1)[0];
		step(g, DT, tap("hold"));
		expect(g.hold).toBe(first);
		expect(g.active!.type).toBe(next);
		// Not twice in a row.
		step(g, DT, tap("hold"));
		expect(g.active!.type).toBe(next);
		step(g, DT, tap("drop"));
		step(g, DT, tap("hold"));
		expect(g.active!.type).toBe(first);
	});
});

describe("the end", () => {
	it("ends when the jar is full", () => {
		const g = newGame(11);
		// Nobody steering: pieces pile up in the middle.
		const events = run(g, 400, () => tap("drop"));
		expect(g.phase).toBe("over");
		expect(events.at(-1)).toMatchObject({ type: "over", why: "full" });
		expect(stackHeight(g)).toBeGreaterThanOrEqual(ROWS - 2);
		expect(stackHeight(g)).toBeLessThanOrEqual(ROWS + HIDDEN);
	});

	it("when play time's up, the falling piece is the last: no new piece, its rows still pop", () => {
		const g = withPiece(1);
		fillRow(g, 0, [3, 4, 5, 6]);
		g.lastPiece = true;
		const events = run(g, DT * 2, () => tap("drop"));
		expect(events.some((e) => e.type === "clear")).toBe(true);
		expect(g.phase).toBe("play");
		const more = run(g, CLEAR_S + DT);
		expect(more.map((e) => e.type)).toEqual(["collapse", "over"]);
		expect(more.at(-1)).toMatchObject({ why: "time" });
		expect(g.active).toBeNull();
		expect(settled(g)).toHaveLength(0);
	});

	it("a careful player keeps going and clears plenty of rows", () => {
		for (const seed of [1, 2, 3]) {
			const g = newGame(seed);
			run(g, 300, () => autopilot(g));
			expect(g.lines, `seed ${seed}`).toBeGreaterThanOrEqual(40);
		}
	});
});
