import { int, pick, type Rng } from "../math/rng.ts";
import { STEP } from "./board.ts";
import type { Board, Cell, CodeSkill, Dir } from "./types.ts";

/**
 * A route Tuck walks: F forward, L left, R right, P pick (a seed), T light (a lantern), B plant (a flower bed),
 * D pen down, U pen up. Gardens are drawn round a route, so every puzzle is solvable by construction.
 */
export type Op = "F" | "L" | "R" | "P" | "T" | "B" | "D" | "U";

/** What a template makes: the gardens, a solution, and how to talk about it. */
export type Made = {
	boards: Board[];
	solution: string;
	hint: string;
	/** Overrides the generated goal sentence. */
	goal?: string;
	neat?: number;
	say?: string[];
	/** The editor starts with this in a build puzzle ("fill in" puzzles). */
	starter?: string;
	/** A drawing (chalk) puzzle. */
	draw?: boolean;
	/** No "where will Tuck end up?" version (the code senses the garden, or only talks). */
	noPredict?: boolean;
};
export type Template = { id: string; skill: CodeSkill; level: number; make(rng: Rng): Made };

const MAX_SIZE = 9;

type Walk = { cells: Map<string, string>; path: Cell[]; end: Cell; dir: Dir };
function walk(ops: Op[], dir: Dir): Walk {
	const cells = new Map<string, string>();
	let p = { x: 0, y: 0 };
	let d = dir;
	let pen = false;
	const path = [p];
	const mark = (ch: string) => cells.set(`${p.x},${p.y}`, ch);
	for (const op of ops) {
		if (op === "F") {
			p = { x: p.x + STEP[d].x, y: p.y + STEP[d].y };
			path.push(p);
			if (pen) mark("o");
		} else if (op === "L") d = ((d + 3) % 4) as Dir;
		else if (op === "R") d = ((d + 1) % 4) as Dir;
		else if (op === "P") mark("s");
		else if (op === "T") mark("L");
		else if (op === "B") mark("b");
		else if (op === "D") {
			pen = true;
			mark("o");
		} else if (op === "U") pen = false;
	}
	return { cells, path, end: p, dir: d };
}

type GardenOpts = {
	dir?: Dir;
	flag?: boolean;
	/** Chance a square off the route grows a hedge or pond. */
	decor?: number;
	/** Hedges straight ahead of every turn, so "path ahead?" is false exactly where the route turns. */
	walls?: boolean;
	/** Squares to set after the route is laid, relative to the start. */
	extra?: [Cell, string][];
	margin?: number;
};

/** A garden drawn round a route: the route stays clear, its marks are placed, decor goes round it. */
export function garden(ops: Op[], rng: Rng, o: GardenOpts = {}): Board {
	const dir = o.dir ?? 1;
	const w = walk(ops, dir);
	const marks = new Map(w.cells);
	if (o.flag !== false) marks.set(`${w.end.x},${w.end.y}`, "F");
	for (const [c, ch] of o.extra ?? []) marks.set(`${c.x},${c.y}`, ch);
	const onRoute = new Set(w.path.map((c) => `${c.x},${c.y}`));
	const all = [...w.path, ...[...marks.keys()].map((k) => ({ x: Number(k.split(",")[0]), y: Number(k.split(",")[1]) }))];
	const minX = Math.min(...all.map((c) => c.x));
	const maxX = Math.max(...all.map((c) => c.x));
	const minY = Math.min(...all.map((c) => c.y));
	const maxY = Math.max(...all.map((c) => c.y));
	const span = Math.max(maxX - minX, maxY - minY) + 1;
	const margin = o.margin ?? (span + 2 <= MAX_SIZE ? 1 : 0);
	const width = Math.max(maxX - minX + 1 + margin * 2, 4);
	const height = Math.max(maxY - minY + 1 + margin * 2, 3);
	const ox = margin - minX + Math.floor((width - (maxX - minX + 1 + margin * 2)) / 2);
	const oy = margin - minY + Math.floor((height - (maxY - minY + 1 + margin * 2)) / 2);
	const grid = Array.from({ length: height }, () => Array<string>(width).fill("."));

	// Walls: the square straight ahead of each turn.
	const blocks = new Set<string>();
	if (o.walls) {
		let p = { x: 0, y: 0 };
		let d = dir;
		const flat = ops.filter((op) => op === "F" || op === "L" || op === "R");
		flat.forEach((op, i) => {
			if (op === "F") p = { x: p.x + STEP[d].x, y: p.y + STEP[d].y };
			else {
				if (flat[i - 1] === "F" || i === 0) blocks.add(`${p.x + STEP[d].x},${p.y + STEP[d].y}`);
				d = ((d + (op === "R" ? 1 : 3)) % 4) as Dir;
			}
		});
		// And ahead of the end, so the walk stops there whatever it was told.
		blocks.add(`${w.end.x + STEP[w.dir].x},${w.end.y + STEP[w.dir].y}`);
	}
	const decor = o.decor ?? 0.12;
	const pond = rng() < 0.5;
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const k = `${x - ox},${y - oy}`;
			if (onRoute.has(k) || marks.has(k)) continue;
			if (blocks.has(k)) grid[y]![x] = "#";
			else if (rng() < decor) grid[y]![x] = pond && rng() < 0.4 ? "~" : "#";
		}
	for (const [k, ch] of marks) {
		const [x, y] = k.split(",").map(Number) as [number, number];
		grid[y + oy]![x + ox] = ch;
	}
	return { rows: grid.map((r) => r.join("")), start: { x: ox, y: oy, dir } };
}

const LINE: Record<Op, string> = {
	F: "forward()",
	L: "left()",
	R: "right()",
	P: "pick()",
	T: "light()",
	B: "plant()",
	D: "pen_down()",
	U: "pen_up()",
};
/** One command a line. */
export const stepsCode = (ops: Op[]) => ops.map((op) => LINE[op]).join("\n");
/** Runs of forward and of turns told how many: forward(3), right(2). */
export function countsCode(ops: Op[]) {
	const out: string[] = [];
	for (let i = 0; i < ops.length; ) {
		const op = ops[i]!;
		let n = 1;
		if (op === "F" || op === "R" || op === "L") while (ops[i + n] === op) n++;
		out.push(n > 1 ? `${LINE[op].slice(0, -1)}${n})` : LINE[op]);
		i += n;
	}
	return out.join("\n");
}
const F = (n: number): Op[] => Array<Op>(n).fill("F");
const turn = (rng: Rng): Op => (rng() < 0.5 ? "L" : "R");
const other = (t: Op): Op => (t === "L" ? "R" : "L");
/** A wandering route with no square visited twice: `turns` turns, `len` forwards, seeds dropped on the way. */
function trail(rng: Rng, len: number, turns: number, seeds: number, item: Op = "P"): Op[] {
	for (let tries = 0; tries < 200; tries++) {
		const segs: number[] = [];
		let left = len;
		for (let i = 0; i <= turns; i++) {
			const n = i === turns ? left : int(rng, 1, Math.max(1, Math.min(3, left - (turns - i))));
			segs.push(n);
			left -= n;
		}
		if (left !== 0 || segs.some((n) => n < 1)) continue;
		const ops: Op[] = [];
		segs.forEach((n, i) => {
			ops.push(...F(n));
			if (i < turns) ops.push(turn(rng));
		});
		const w = walk(ops, 1);
		const seen = new Set(w.path.map((c) => `${c.x},${c.y}`));
		if (seen.size !== w.path.length) continue;
		const xs = w.path.map((c) => c.x);
		const ys = w.path.map((c) => c.y);
		if (Math.max(...xs) - Math.min(...xs) >= MAX_SIZE || Math.max(...ys) - Math.min(...ys) >= MAX_SIZE) continue;
		// Seeds go on forward squares other than the last.
		const fIdx = ops.flatMap((op, i) => (op === "F" ? [i] : [])).slice(0, -1);
		const chosen = new Set<number>();
		while (chosen.size < Math.min(seeds, fIdx.length)) chosen.add(pick(rng, fIdx));
		return ops.flatMap((op, i) => (chosen.has(i) ? [op, item] : [op]));
	}
	return [...F(len)];
}

const both = (a: Board, b: Board) => [a, b];

export const TEMPLATES: Template[] = [
	// ── Steps: one command a line ──────────────────────────────────────────────────────────────────────────────
	{
		id: "line",
		skill: "seq",
		level: 1,
		make: (rng) => {
			const ops = F(int(rng, 2, 3));
			return { boards: [garden(ops, rng, { decor: 0.08 })], solution: stepsCode(ops), hint: "Each forward() moves Tuck one square." };
		},
	},
	{
		id: "corner",
		skill: "seq",
		level: 2,
		make: (rng) => {
			const t = turn(rng);
			const ops = [...F(int(rng, 1, 2)), t, ...F(int(rng, 1, 2))];
			return {
				boards: [garden(ops, rng)],
				solution: stepsCode(ops),
				hint: `Walk to the corner, then turn ${t === "L" ? "left" : "right"}: turning doesn’t move Tuck.`,
			};
		},
	},
	{
		id: "zigzag",
		skill: "seq",
		level: 3,
		make: (rng) => {
			const t = turn(rng);
			const ops = [...F(int(rng, 1, 2)), t, "F", "P", ...F(int(rng, 0, 1)), other(t), ...F(int(rng, 1, 2))] as Op[];
			return { boards: [garden(ops, rng)], solution: stepsCode(ops), hint: "Stand on the seed, then pick() it up." };
		},
	},
	{
		id: "detour",
		skill: "seq",
		level: 4,
		make: (rng) => {
			const t = turn(rng);
			const ops: Op[] = ["F", "P", t, "F", other(t), "F", "F", other(t), "F", "P", t, "F"];
			const w = walk(ops.slice(0, 1), 1);
			// A hedge straight ahead of the first seed, so the way round is the only way.
			const hedge = { x: w.end.x + 1, y: w.end.y };
			return {
				boards: [garden(ops, rng, { extra: [[hedge, "#"]] })],
				solution: stepsCode(ops),
				hint: "Go round the hedge one square at a time. Say each move out loud.",
			};
		},
	},
	{
		id: "trail",
		skill: "seq",
		level: 5,
		make: (rng) => {
			const ops = trail(rng, int(rng, 7, 9), int(rng, 3, 4), int(rng, 2, 3));
			return {
				boards: [garden(ops, rng)],
				solution: stepsCode(ops),
				hint: "Follow the path with your finger and write a line for each move.",
			};
		},
	},

	// ── Numbers: tell a command how many ───────────────────────────────────────────────────────────────────────
	{
		id: "long",
		skill: "args",
		level: 1,
		make: (rng) => {
			const ops = F(int(rng, 3, 6));
			return {
				boards: [garden(ops, rng, { decor: 0.08 })],
				solution: countsCode(ops),
				hint: "Put the number of squares inside forward()’s brackets.",
			};
		},
	},
	{
		id: "ell",
		skill: "args",
		level: 2,
		make: (rng) => {
			const ops = [...F(int(rng, 2, 4)), turn(rng), ...F(int(rng, 2, 4))];
			return { boards: [garden(ops, rng)], solution: countsCode(ops), hint: "Count the squares to the corner, turn, then count again." };
		},
	},
	{
		id: "chalkline",
		skill: "args",
		level: 3,
		make: (rng) => {
			const lead = int(rng, 0, 1);
			const ops: Op[] = [...F(lead), "D", ...F(int(rng, 2, 4))];
			const pre = lead ? `forward(${lead === 1 ? "" : lead})\n` : "";
			return {
				boards: [garden(ops, rng, { flag: false })],
				solution: `${pre}${countsCode(ops.slice(lead))}`,
				draw: true,
				hint: "pen_down() starts drawing on Tuck’s square. Then every square Tuck walks gets chalked.",
			};
		},
	},
	{
		id: "turnback",
		skill: "args",
		level: 3,
		make: (rng) => {
			const a = int(rng, 2, 3);
			const ops: Op[] = [...F(a), "P", "R", "R", ...F(a + 1)];
			return { boards: [garden(ops, rng, { dir: 1 })], solution: countsCode(ops), hint: "right(2) turns Tuck all the way round." };
		},
	},
	{
		id: "box",
		skill: "args",
		level: 4,
		make: (rng) => {
			const w = int(rng, 3, 4);
			const h = int(rng, 3, 4);
			const ops: Op[] = ["D", ...F(w - 1), "R", ...F(h - 1), "R", ...F(w - 1), "R", ...F(h - 2)];
			return {
				boards: [garden(ops, rng, { flag: false, dir: 1 })],
				solution: countsCode(ops),
				draw: true,
				hint: "Draw one side, turn, draw the next. The last side is one square shorter: the corner’s already drawn.",
			};
		},
	},
	{
		id: "lanterns",
		skill: "args",
		level: 5,
		make: (rng) => {
			const ops = trail(rng, int(rng, 7, 9), 3, 2, "T");
			return {
				boards: [garden(ops, rng)],
				solution: countsCode(ops),
				hint: "Stand on each lantern and light() it on the way to the flag.",
			};
		},
	},

	// ── Loops ─────────────────────────────────────────────────────────────────────────────────────────────────
	{
		id: "repeat",
		skill: "loops",
		level: 1,
		make: (rng) => {
			const n = int(rng, 5, 7);
			return {
				boards: [garden(F(n), rng, { decor: 0.08 })],
				solution: `for i in range(${n}):\n    forward()`,
				neat: 2,
				hint: "for i in range(5): runs the lines pushed in under it 5 times.",
			};
		},
	},
	{
		id: "seedrow",
		skill: "loops",
		level: 1,
		make: (rng) => {
			const n = int(rng, 4, 6);
			const ops = F(n).flatMap((op, i) => (i < n - 1 ? [op, "P"] : [op])) as Op[];
			return {
				boards: [garden(ops, rng, { decor: 0.08 })],
				solution: `for i in range(${n - 1}):\n    forward()\n    pick()\nforward()`,
				neat: 4,
				hint: "Walk one, pick one, again and again. Which lines repeat?",
			};
		},
	},
	{
		id: "stairs",
		skill: "loops",
		level: 2,
		make: (rng) => {
			const n = int(rng, 3, 4);
			const ops = Array.from({ length: n }, () => ["F", "L", "F", "R"] as Op[]).flat();
			return {
				boards: [garden(ops, rng, { dir: 1, walls: false, decor: 0.1 })],
				solution: `for i in range(${n}):\n    forward()\n    left()\n    forward()\n    right()`,
				neat: 5,
				hint: "Find one step of the stairs, write it once, and repeat it.",
			};
		},
	},
	{
		id: "square",
		skill: "loops",
		level: 3,
		make: (rng) => {
			const s = int(rng, 3, 5);
			const ops: Op[] = ["D", ...[0, 1, 2, 3].flatMap(() => [...F(s - 1), "R"] as Op[])];
			return {
				boards: [garden(ops, rng, { flag: false, dir: 0 })],
				solution: `pen_down()\nfor i in range(4):\n    forward(${s - 1})\n    right()`,
				draw: true,
				neat: 4,
				hint: "A square is four sides the same. Draw one side and turn, four times.",
			};
		},
	},
	{
		id: "everyother",
		skill: "loops",
		level: 4,
		make: (rng) => {
			const n = int(rng, 3, 4);
			const item: Op = rng() < 0.5 ? "P" : "T";
			const ops = Array.from({ length: n }, () => ["F", "F", item] as Op[]).flat();
			return {
				boards: [garden(ops, rng, { flag: false })],
				solution: `for i in range(${n}):\n    forward(2)\n    ${item === "P" ? "pick()" : "light()"}`,
				neat: 3,
				hint: item === "P" ? "The seeds are two squares apart." : "The lanterns are two squares apart.",
			};
		},
	},
	{
		id: "ring",
		skill: "loops",
		level: 5,
		make: (rng) => {
			const n = int(rng, 2, 3);
			const ops: Op[] = [0, 1, 2, 3].flatMap(() => [...F(n).flatMap(() => ["F", "P"] as Op[]), "R"] as Op[]);
			const inner: [Cell, string][] = [];
			for (let x = 1; x < n; x++) for (let y = 1; y < n; y++) inner.push([{ x, y: -y }, "#"]);
			return {
				boards: [garden(ops, rng, { flag: false, dir: 0, extra: inner })],
				solution: `for i in range(4):\n    for j in range(${n}):\n        forward()\n        pick()\n    right()`,
				neat: 5,
				hint: "A loop can go inside a loop: one side of seeds, then turn, four times.",
			};
		},
	},

	// ── Names: variables and print ─────────────────────────────────────────────────────────────────────────────
	{
		id: "hello",
		skill: "vars",
		level: 1,
		make: (rng) => {
			const word = pick(rng, ["hello", "hi there", "good morning", "I like seeds", "happy days"]);
			return {
				boards: [garden([], rng, { flag: false, decor: 0.15 })],
				solution: `print("${word}")`,
				say: [word],
				goal: `Make Tuck say “${word}”.`,
				noPredict: true,
				hint: `Words go inside quote marks: print("${word}")`,
			};
		},
	},
	{
		id: "sum",
		skill: "vars",
		level: 1,
		make: (rng) => {
			const a = int(rng, 2, 9);
			const b = int(rng, 2, 9);
			return {
				boards: [garden([], rng, { flag: false, decor: 0.15 })],
				solution: `print(${a} + ${b})`,
				say: [String(a + b)],
				goal: `Make Tuck work out ${a} + ${b} and say the answer. Let Python do the adding!`,
				noPredict: true,
				hint: `Numbers don’t need quote marks: print(${a} + ${b})`,
			};
		},
	},
	{
		id: "steps",
		skill: "vars",
		level: 2,
		make: (rng) => {
			const d = int(rng, 2, 4);
			const t = turn(rng);
			const ops = [...F(d), t, ...F(d)];
			const tc = t === "L" ? "left()" : "right()";
			return {
				boards: [garden(ops, rng)],
				solution: `steps = ${d}\nforward(steps)\n${tc}\nforward(steps)`,
				starter: `steps = 1\nforward(steps)\n${tc}\nforward(steps)`,
				goal: "Change one number so Tuck reaches the flag.",
				hint: "steps is a name for a number. Change it once and both forward(steps) lines change.",
			};
		},
	},
	{
		id: "count",
		skill: "vars",
		level: 3,
		make: (rng) => {
			const n = int(rng, 3, 5);
			const ops = F(n).flatMap((op) => [op, "P"]) as Op[];
			return {
				boards: [garden(ops, rng, { flag: false })],
				solution: `count = 0\nfor i in range(${n}):\n    forward()\n    pick()\n    count = count + 1\nprint(count)`,
				say: [String(n)],
				goal: "Pick up every seed, counting as you go, then make Tuck say how many.",
				noPredict: true,
				hint: "Start with count = 0, add 1 each time Tuck picks, and print(count) at the end, not pushed in.",
			};
		},
	},
	{
		id: "spiral",
		skill: "vars",
		level: 4,
		make: (rng) => {
			const n = int(rng, 4, 5);
			const ops: Op[] = ["D"];
			for (let i = 1; i < n; i++) ops.push(...F(i), "R");
			return {
				boards: [garden(ops, rng, { flag: false, dir: 0 })],
				solution: `pen_down()\nfor i in range(1, ${n}):\n    forward(i)\n    right()`,
				draw: true,
				neat: 4,
				hint: "range(1, 5) counts 1, 2, 3, 4. Use i as the number of squares.",
			};
		},
	},
	{
		id: "countby",
		skill: "vars",
		level: 5,
		make: (rng) => {
			const k = int(rng, 2, 5);
			const n = int(rng, 4, 5);
			const say = Array.from({ length: n }, (_, i) => String((i + 1) * k));
			return {
				boards: [garden([], rng, { flag: false, decor: 0.15 })],
				solution: `for i in range(1, ${n + 1}):\n    print(i * ${k})`,
				say,
				goal: `Make Tuck count by ${k}s: ${say.join(", ")}.`,
				noPredict: true,
				neat: 2,
				hint: `Loop i from 1 and print i * ${k}.`,
			};
		},
	},

	// ── Choices: if and while, in two gardens ──────────────────────────────────────────────────────────────────
	{
		id: "maybe",
		skill: "ifs",
		level: 1,
		make: (rng) => {
			const n = int(rng, 4, 5);
			const row = () => {
				const spots = new Set<number>();
				while (spots.size < 2) spots.add(int(rng, 0, n - 2));
				return F(n).flatMap((op, i) => (spots.has(i) ? [op, "P"] : [op])) as Op[];
			};
			const a = row();
			let b = row();
			while (stepsCode(a) === stepsCode(b)) b = row();
			return {
				boards: both(garden(a, rng), garden(b, rng)),
				solution: `for i in range(${n}):\n    forward()\n    if seed_here():\n        pick()`,
				hint: "The seeds are in different places in each garden. After each step, look: if seed_here(): pick()",
				noPredict: true,
			};
		},
	},
	{
		id: "choose",
		skill: "ifs",
		level: 2,
		make: (rng) => {
			const n = int(rng, 3, 4);
			const row = () => F(n).flatMap((op) => [op, rng() < 0.5 ? "T" : "B"]) as Op[];
			const a = row();
			let b = row();
			while (stepsCode(a) === stepsCode(b)) b = row();
			return {
				boards: both(garden(a, rng, { flag: false }), garden(b, rng, { flag: false })),
				solution: `for i in range(${n}):\n    forward()\n    if lantern_here():\n        light()\n    else:\n        plant()`,
				hint: "Every square has a lantern or a flower bed. if lantern_here(): light it, else: plant().",
				noPredict: true,
			};
		},
	},
	{
		id: "untilflag",
		skill: "ifs",
		level: 3,
		make: (rng) => {
			const a = int(rng, 3, 6);
			let b = int(rng, 3, 6);
			if (b === a) b = a === 6 ? 3 : a + 1;
			return {
				boards: both(garden(F(a), rng), garden(F(b), rng)),
				solution: "while not at_flag():\n    forward()",
				neat: 2,
				hint: "The flag is a different distance away each time. Keep going while Tuck is not at the flag.",
				noPredict: true,
			};
		},
	},
	{
		id: "winding",
		skill: "ifs",
		level: 4,
		make: (rng) => {
			const route = () => [...F(int(rng, 2, 4)), "R", ...F(int(rng, 2, 3)), "R", ...F(int(rng, 1, 3))] as Op[];
			const a = route();
			let b = route();
			while (stepsCode(a) === stepsCode(b)) b = route();
			return {
				boards: both(garden(a, rng, { dir: 0, walls: true, decor: 1 }), garden(b, rng, { dir: 0, walls: true, decor: 1 })),
				solution: "while not at_flag():\n    if path_ahead():\n        forward()\n    else:\n        right()",
				hint: "If the path ahead is clear, go forward. If it isn’t, turn right.",
				noPredict: true,
			};
		},
	},
	{
		id: "seedtrail",
		skill: "ifs",
		level: 5,
		make: (rng) => {
			const route = () => {
				const ops = [...F(int(rng, 3, 4)), "R", ...F(int(rng, 2, 3)), "R", ...F(int(rng, 2, 3))] as Op[];
				const fs = ops.flatMap((op, i) => (op === "F" && i < ops.length - 1 ? [i] : []));
				const spots = new Set([pick(rng, fs), pick(rng, fs)]);
				return ops.flatMap((op, i) => (spots.has(i) ? [op, "P"] : [op])) as Op[];
			};
			const a = route();
			let b = route();
			while (stepsCode(a) === stepsCode(b)) b = route();
			return {
				boards: both(garden(a, rng, { dir: 0, walls: true, decor: 1 }), garden(b, rng, { dir: 0, walls: true, decor: 1 })),
				solution:
					"while not at_flag():\n    if path_ahead():\n        forward()\n    else:\n        right()\n    if seed_here():\n        pick()",
				hint: "Walk the path as before, and after every move check for a seed.",
				noPredict: true,
			};
		},
	},

	// ── Recipes: def ───────────────────────────────────────────────────────────────────────────────────────────
	{
		id: "turnaround",
		skill: "funcs",
		level: 1,
		make: (rng) => {
			const a = int(rng, 2, 3);
			const ops: Op[] = [...F(a), "P", "R", "R", ...F(a + 1)];
			const use = `forward(${a})\npick()\nturn_around()\nforward(${a + 1})`;
			return {
				boards: [garden(ops, rng)],
				solution: `def turn_around():\n    right()\n    right()\n\n${use}`,
				starter: use,
				goal: "Teach Tuck to turn_around() with def, at the top.",
				hint: "def turn_around(): then, pushed in under it, the lines that turn Tuck all the way round.",
			};
		},
	},
	{
		id: "twosquares",
		skill: "funcs",
		level: 2,
		make: (rng) => {
			const one: Op[] = ["D", ...[0, 1, 2, 3].flatMap(() => ["F", "F", "R"] as Op[]), "U"];
			const ops: Op[] = [...one, "R", ...F(4), "L", ...one];
			return {
				boards: [garden(ops, rng, { flag: false, dir: 0 })],
				solution:
					"def square():\n    pen_down()\n    for i in range(4):\n        forward(2)\n        right()\n    pen_up()\n\nsquare()\nright()\nforward(4)\nleft()\nsquare()",
				draw: true,
				hint: "Make a square() recipe once, then use it twice. pen_up() before walking to the next one.",
			};
		},
	},
	{
		id: "sizes",
		skill: "funcs",
		level: 3,
		make: (rng) => {
			const a = int(rng, 2, 3);
			const b = a + 1;
			const sq = (s: number): Op[] => ["D", ...[0, 1, 2, 3].flatMap(() => [...F(s - 1), "R"] as Op[]), "U"];
			const ops: Op[] = [...sq(a), "R", ...F(a + 1), "L", ...sq(b)];
			return {
				boards: [garden(ops, rng, { flag: false, dir: 0 })],
				solution: `def square(size):\n    pen_down()\n    for i in range(4):\n        forward(size - 1)\n        right()\n    pen_up()\n\nsquare(${a})\nright()\nforward(${a + 1})\nleft()\nsquare(${b})`,
				draw: true,
				hint: "Give the recipe an input: def square(size): and draw each side size - 1 long.",
			};
		},
	},
	{
		id: "hop",
		skill: "funcs",
		level: 4,
		make: (rng) => {
			const n = 3;
			const ops = Array.from({ length: n }, () => ["F", "F", "P"] as Op[]).flat();
			return {
				boards: [garden([...ops, "F"], rng)],
				solution: `def hop():\n    forward(2)\n    pick()\n\nfor i in range(${n}):\n    hop()\nforward()`,
				hint: "Make hop() walk two squares and pick, then use it in a loop.",
			};
		},
	},
	{
		id: "bigstairs",
		skill: "funcs",
		level: 5,
		make: (rng) => {
			const n = int(rng, 3, 4);
			const ops: Op[] = [];
			for (let i = 1; i < n; i++) ops.push(...F(i), "R", ...F(i), "L");
			return {
				boards: [garden(ops, rng, { dir: 0 })],
				solution: `def step(size):\n    forward(size)\n    right()\n    forward(size)\n    left()\n\nfor i in range(1, ${n}):\n    step(i)`,
				hint: "Each step is bigger than the last. Make step(size), then loop i up from 1.",
			};
		},
	},
];

export const templatesAt = (skill: CodeSkill, level: number) => TEMPLATES.filter((t) => t.skill === skill && t.level === level);
export const templateById = (skill: CodeSkill, id: string) => TEMPLATES.find((t) => t.skill === skill && t.id === id);

/** What the toolbox offers for a solution: just the commands and shapes it needs, plus the turn it doesn't. */
export function toolboxFor(solution: string, skill: CodeSkill): string[] {
	const out: string[] = [];
	const has = (re: RegExp) => re.test(solution);
	const add = (s: string, when: boolean) => {
		if (when && !out.includes(s)) out.push(s);
	};
	const defs = [...solution.matchAll(/def (\w+)\((\w*)\)/g)];
	add(
		"def |():",
		defs.some((d) => !d[2]),
	);
	add(
		"def |(|):",
		defs.some((d) => !!d[2]),
	);
	add("while not |:", has(/while not/));
	add("for i in range(|):", has(/for i in range/));
	add("for j in range(|):", has(/for j in range/));
	add("if |:", has(/\bif /));
	add("else:", has(/else:/));
	const counted = skill !== "seq";
	add(counted ? "forward(|)" : "forward()", has(/forward\(/) || skill === "seq" || skill === "args");
	add("left()", has(/left\(|right\(/) || skill === "seq");
	add("right()", has(/left\(|right\(/) || skill === "seq");
	add("right(|)", has(/right\(\d/));
	for (const c of ["pick()", "light()", "plant()", "pen_down()", "pen_up()", "seed_here()", "lantern_here()", "at_flag()", "path_ahead()"])
		add(c, solution.includes(c));
	for (const d of defs) add(d[2] ? `${d[1]}(|)` : `${d[1]}()`, true);
	for (const d of defs) add(d[2]!, !!d[2]);
	add("print(|)", has(/print\(/));
	add('"|"', has(/"/));
	for (const m of solution.matchAll(/^\s*(\w+) = /gm)) add(m[1]!, m[1] !== "i");
	add("i", has(/\(i\)|i \*|forward\(i\)|step\(i\)/));
	add(" = ", has(/ = /));
	add(" + ", has(/ \+ /));
	add(" - ", has(/ - /));
	add(" * ", has(/ \* /));
	add(", ", has(/, /));
	add("0-9", has(/\d/) || counted);
	return out;
}

/** What each kind of puzzle asks, in a few words, for the parent's progress page. */
export const TEMPLATE_TITLE: Record<string, string> = {
	line: "Walk to the flag",
	corner: "Turn a corner",
	zigzag: "Zigzag and pick a seed",
	detour: "Go round a hedge",
	trail: "Follow a long trail",
	long: "Walk a number of squares",
	ell: "Two counted walks and a turn",
	chalkline: "Draw a chalk line",
	turnback: "Turn all the way round",
	box: "Draw a box",
	lanterns: "Light the lanterns on a trail",
	repeat: "Repeat a step with a loop",
	seedrow: "Pick a row of seeds with a loop",
	stairs: "Climb stairs with a loop",
	square: "Draw a square with a loop",
	everyother: "Every other square",
	ring: "A loop inside a loop",
	hello: "Say words with print",
	sum: "Print a sum",
	steps: "Change a variable",
	count: "Count with a variable",
	spiral: "Draw a spiral with the loop's number",
	countby: "Count by a number",
	maybe: "Pick a seed only if there is one",
	choose: "If and else",
	untilflag: "Walk while not at the flag",
	winding: "Follow a winding path",
	seedtrail: "Winding path with seeds",
	turnaround: "Teach a new command",
	twosquares: "Use a recipe twice",
	sizes: "A recipe with an input",
	hop: "A recipe in a loop",
	bigstairs: "Growing stairs",
};

/** A puzzle key (`c:loops:square.3`) in words: its unit's name and what it asks. */
export function puzzleTitle(key: string) {
	const m = /^c:\w+:(\w+)\.\d$/.exec(key);
	return (m && TEMPLATE_TITLE[m[1]!]) ?? key;
}
