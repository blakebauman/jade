import { at, blocked, cellKey, inside, STEP, startGarden } from "./board.ts";
import { CodeProblem } from "./lexer.ts";
import { type Expr, parse, type Stmt } from "./parser.ts";
import { type Board, type CodeError, type CodeEvent, type Dir, type Garden, type RunResult, TURTLE } from "./types.ts";

/** Lines a run may take before Tuck gets dizzy (an endless loop). */
export const MAX_STEPS = 1000;
const MAX_DEPTH = 40;

/** Tuck's commands: they move and change the garden. */
export const COMMANDS = ["forward", "left", "right", "pick", "light", "plant", "pen_down", "pen_up"] as const;
/** Tuck's senses: they answer True or False. */
export const SENSORS = ["seed_here", "lantern_here", "bed_here", "at_flag", "path_ahead"] as const;
const BUILTINS = ["print", "range", "str", "abs"];
export const KNOWN_NAMES: string[] = [...COMMANDS, ...SENSORS, ...BUILTINS];

type Fn = { fn: true; name: string; params: string[]; body: Stmt[] };
type Value = number | string | boolean | null | Fn;

class Stop extends Error {
	constructor(readonly problem: CodeError) {
		super(problem.message);
	}
}
class Return {
	constructor(readonly value: Value) {}
}
class Break {}
class Continue {}

/** Python's own way of printing a value. */
export function pyStr(v: Value): string {
	if (v === null) return "None";
	if (v === true) return "True";
	if (v === false) return "False";
	if (typeof v === "object") return `<function ${v.name}>`;
	return String(v);
}
const typeName = (v: Value) =>
	typeof v === "string"
		? "words"
		: typeof v === "boolean"
			? "True or False"
			: v === null
				? "None"
				: typeof v === "object"
					? "a recipe"
					: "a number";
const truthy = (v: Value) => !(v === false || v === null || v === 0 || v === "");
const num = (v: Value) => (v === true ? 1 : v === false ? 0 : v);

function distance(a: string, b: string) {
	const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
	for (let j = 1; j <= b.length; j++) d[0]![j] = j;
	for (let i = 1; i <= a.length; i++)
		for (let j = 1; j <= b.length; j++)
			d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
	return d[a.length]![b.length]!;
}
/** The known name a typo was most likely meant to be. */
export function didYouMean(name: string, known: string[]): string | null {
	let best: string | null = null;
	let score = Math.max(2, Math.floor(name.length / 3)) + 1;
	for (const k of known) {
		const d = distance(name.toLowerCase(), k.toLowerCase());
		if (d < score) [best, score] = [k, d];
	}
	return best;
}

/**
 * Run a program in a garden. Every statement adds a `line` event, every action its own event, so the screen can
 * replay the run line by line. A problem stops the run where it happened, as Python would.
 */
export function run(src: string, board: Board): RunResult {
	const events: CodeEvent[] = [];
	const g: Garden = startGarden(board);
	let steps = 0;
	let line = 0;
	let depth = 0;
	const globals = new Map<string, Value>();
	const stop = (message: string, kind: CodeError["kind"] = "wrong", col = 0, end?: number): never => {
		throw new Stop({ line, col, end, kind, message });
	};

	let program: Stmt[];
	try {
		program = parse(src);
	} catch (e) {
		if (e instanceof CodeProblem) return { events, end: g, error: e.problem, steps };
		throw e;
	}

	const here = () => cellKey(g.pos);
	const paint = () => {
		if (!g.painted.includes(here())) g.painted.push(here());
		events.push({ t: "paint", at: { ...g.pos } });
	};
	const command = (name: string, args: Value[], col: number, end: number): Value => {
		const count = (max: number) => {
			if (args.length > 1) stop(`${name} takes one number at most.`, "extra", col, end);
			const n = args.length === 0 ? 1 : num(args[0]!);
			if (typeof n !== "number") stop(`${name} needs a number, not ${typeName(n)}.`, "wrong", col, end);
			if ((n as number) < 0 || (n as number) > max)
				stop(`${name}(${n}) is more than Tuck can do. Try a smaller number.`, "wrong", col, end);
			return n as number;
		};
		const none = () => {
			if (args.length > 0) stop(`${name}() doesn’t take anything inside its ().`, "extra", col, end);
		};
		switch (name) {
			case "forward": {
				const n = count(20);
				for (let k = 0; k < n; k++) {
					const to = { x: g.pos.x + STEP[g.dir].x, y: g.pos.y + STEP[g.dir].y };
					const ch = inside(board, to) ? at(board, to) : " ";
					if (blocked(ch)) {
						const what = ch === "#" ? "hedge" : ch === "~" ? "pond" : "edge";
						events.push({ t: "bump", at: to, what });
						stop(
							what === "hedge"
								? `Line ${line} walks ${TURTLE} into a hedge.`
								: what === "pond"
									? `Line ${line} walks ${TURTLE} into the pond.`
									: `Line ${line} walks ${TURTLE} off the edge of the garden.`,
						);
					}
					g.pos = to;
					events.push({ t: "move", to: { ...to } });
					if (g.pen) paint();
				}
				return null;
			}
			case "left":
			case "right": {
				const n = count(4);
				for (let k = 0; k < n; k++) {
					g.dir = ((g.dir + (name === "right" ? 1 : 3)) % 4) as Dir;
					events.push({ t: "turn", dir: g.dir });
				}
				return null;
			}
			case "pick": {
				none();
				if (at(board, g.pos) !== "s" || g.picked.includes(here())) stop(`There’s no seed here for line ${line} to pick.`);
				g.picked.push(here());
				events.push({ t: "pick", at: { ...g.pos } });
				return null;
			}
			case "light": {
				none();
				if (at(board, g.pos) !== "L" || g.lit.includes(here())) stop(`There’s no lantern here for line ${line} to light.`);
				g.lit.push(here());
				events.push({ t: "light", at: { ...g.pos } });
				return null;
			}
			case "plant": {
				none();
				if (at(board, g.pos) !== "b" || g.planted.includes(here())) stop(`There’s no empty flower bed here for line ${line} to plant.`);
				g.planted.push(here());
				events.push({ t: "plant", at: { ...g.pos } });
				return null;
			}
			case "pen_down":
				none();
				g.pen = true;
				events.push({ t: "pen", down: true });
				paint();
				return null;
			case "pen_up":
				none();
				g.pen = false;
				events.push({ t: "pen", down: false });
				return null;
			case "seed_here":
				none();
				return at(board, g.pos) === "s" && !g.picked.includes(here());
			case "lantern_here":
				none();
				return at(board, g.pos) === "L" && !g.lit.includes(here());
			case "bed_here":
				none();
				return at(board, g.pos) === "b" && !g.planted.includes(here());
			case "at_flag":
				none();
				return at(board, g.pos) === "F";
			case "path_ahead": {
				none();
				const to = { x: g.pos.x + STEP[g.dir].x, y: g.pos.y + STEP[g.dir].y };
				return inside(board, to) && !blocked(at(board, to));
			}
		}
		return null;
	};

	type Scope = { locals: Map<string, Value> | null; assigned: Set<string> };
	const lookup = (name: string, scope: Scope, col: number, end: number): Value => {
		if (scope.locals) {
			if (scope.locals.has(name)) return scope.locals.get(name)!;
			if (scope.assigned.has(name)) stop(`${name} doesn’t have a value yet on line ${line}.`, "wrong", col, end);
		}
		if (globals.has(name)) return globals.get(name)!;
		const known = [...KNOWN_NAMES, ...globals.keys(), ...(scope.locals?.keys() ?? [])];
		const guess = didYouMean(name, known);
		return stop(
			guess ? `${TURTLE} doesn’t know ${name}. Did you mean ${guess}?` : `${TURTLE} doesn’t know what ${name} is yet.`,
			"wrong",
			col,
			end,
		);
	};

	const evaluate = (x: Expr, scope: Scope): Value => {
		switch (x.e) {
			case "num":
			case "str":
			case "bool":
				return x.v;
			case "none":
				return null;
			case "name":
				return lookup(x.v, scope, x.col, x.end);
			case "neg": {
				const a = num(evaluate(x.a, scope));
				if (typeof a !== "number") return stop(`You can’t put a minus in front of ${typeName(a)}.`);
				return -a;
			}
			case "not":
				return !truthy(evaluate(x.a, scope));
			case "and": {
				const a = evaluate(x.a, scope);
				return truthy(a) ? evaluate(x.b, scope) : a;
			}
			case "or": {
				const a = evaluate(x.a, scope);
				return truthy(a) ? a : evaluate(x.b, scope);
			}
			case "cmp": {
				const a = evaluate(x.a, scope);
				const b = evaluate(x.b, scope);
				if (x.op === "==") return equal(a, b);
				if (x.op === "!=") return !equal(a, b);
				const na = typeof a === "string" ? a : num(a);
				const nb = typeof b === "string" ? b : num(b);
				if (typeof na !== typeof nb || (typeof na !== "number" && typeof na !== "string"))
					return stop(`You can’t compare ${typeName(a)} with ${typeName(b)} on line ${line}.`);
				const [p, q] = [na as number, nb as number];
				return x.op === "<" ? p < q : x.op === ">" ? p > q : x.op === "<=" ? p <= q : p >= q;
			}
			case "bin": {
				const a = evaluate(x.a, scope);
				const b = evaluate(x.b, scope);
				return arith(x.op, a, b, x.col);
			}
			case "call":
				return call(x, scope);
		}
	};

	const equal = (a: Value, b: Value) => {
		const na = typeof a === "boolean" ? num(a) : a;
		const nb = typeof b === "boolean" ? num(b) : b;
		return na === nb;
	};

	const arith = (op: string, a: Value, b: Value, col: number): Value => {
		if (op === "+" && typeof a === "string" && typeof b === "string") return a + b;
		if (op === "*" && typeof a === "string" && typeof num(b) === "number") return a.repeat(Math.max(0, num(b) as number));
		if (op === "*" && typeof b === "string" && typeof num(a) === "number") return b.repeat(Math.max(0, num(a) as number));
		const p = num(a);
		const q = num(b);
		if (typeof p !== "number" || typeof q !== "number") {
			if (typeof a === "string" || typeof b === "string")
				return stop(
					`You can’t ${op === "+" ? "add" : "mix"} words and numbers on line ${line}. Try str() round the number.`,
					"wrong",
					col,
					col + 1,
				);
			return stop(`You can’t do ${op} with ${typeName(a)} and ${typeName(b)}.`, "wrong", col, col + 1);
		}
		switch (op) {
			case "+":
				return p + q;
			case "-":
				return p - q;
			case "*":
				return p * q;
			case "//":
			case "%":
				if (q === 0) return stop(`Nothing can be shared into 0 groups (line ${line}).`, "wrong", col, col + op.length);
				return op === "//" ? Math.floor(p / q) : p - q * Math.floor(p / q);
		}
		return null;
	};

	const call = (x: Extract<Expr, { e: "call" }>, scope: Scope): Value => {
		const args = x.args.map((a) => evaluate(a, scope));
		const user = scope.locals?.get(x.fn) ?? globals.get(x.fn);
		if (user !== undefined) {
			if (typeof user !== "object" || user === null)
				return stop(`${x.fn} is ${typeName(user)}, not a command, so it can’t have ().`, "wrong", x.col, x.end);
			if (args.length !== user.params.length)
				return stop(
					`${x.fn} needs ${user.params.length === 0 ? "nothing" : user.params.length === 1 ? "one input" : `${user.params.length} inputs`} inside its (), but got ${args.length}.`,
					args.length > user.params.length ? "extra" : "missing",
					x.col,
					x.end,
				);
			if (++depth > MAX_DEPTH) return stop(`${x.fn} keeps calling itself and never stops.`, "wrong", x.col, x.end);
			const locals = new Map<string, Value>(user.params.map((p, i) => [p, args[i]!]));
			const at = line;
			try {
				exec(user.body, { locals, assigned: assignedIn(user.body, user.params) });
			} catch (r) {
				if (r instanceof Return) return r.value;
				throw r;
			} finally {
				depth--;
				line = at;
			}
			return null;
		}
		if ((COMMANDS as readonly string[]).includes(x.fn) || (SENSORS as readonly string[]).includes(x.fn))
			return command(x.fn, args, x.col, x.end);
		switch (x.fn) {
			case "print": {
				const text = args.map(pyStr).join(" ");
				g.said.push(text);
				events.push({ t: "say", text });
				return null;
			}
			case "str":
				if (args.length !== 1) return stop(`str takes one thing inside its ().`, "wrong", x.col, x.end);
				return pyStr(args[0]!);
			case "abs": {
				const n = num(args[0] ?? null);
				if (args.length !== 1 || typeof n !== "number") return stop(`abs takes one number.`, "wrong", x.col, x.end);
				return Math.abs(n);
			}
			case "range":
				return stop(`range goes in a for loop, like for i in range(4):`, "wrong", x.col, x.end);
		}
		return lookup(x.fn, scope, x.col, x.end);
	};

	const tick = (s: Stmt) => {
		line = s.line;
		if (++steps > MAX_STEPS) stop(`${TURTLE} got dizzy after ${MAX_STEPS} steps. Does your loop ever stop?`);
		events.push({ t: "line", line });
	};

	const set = (name: string, v: Value, scope: Scope) => (scope.locals ?? globals).set(name, v);

	const exec = (body: Stmt[], scope: Scope): void => {
		for (const s of body) {
			tick(s);
			switch (s.s) {
				case "expr":
					evaluate(s.x, scope);
					break;
				case "assign": {
					const v = evaluate(s.x, scope);
					if (s.op === "=") set(s.name, v, scope);
					else {
						const cur = scope.locals?.has(s.name) ? scope.locals.get(s.name)! : lookup(s.name, scope, 0, 0);
						set(s.name, arith(s.op[0]!, cur, v, 0), scope);
					}
					break;
				}
				case "for": {
					const nums = s.args.map((a) => num(evaluate(a, scope)));
					if (nums.some((n) => typeof n !== "number")) stop(`range needs whole numbers inside its ().`);
					const [from, to] = nums.length === 1 ? [0, nums[0] as number] : [nums[0] as number, nums[1] as number];
					for (let k = from; k < to; k++) {
						set(s.v, k, scope);
						try {
							exec(s.body, scope);
						} catch (c) {
							if (c instanceof Break) break;
							if (!(c instanceof Continue)) throw c;
						}
						line = s.line;
					}
					break;
				}
				case "while": {
					while (truthy(evaluate(s.test, scope))) {
						try {
							exec(s.body, scope);
						} catch (c) {
							if (c instanceof Break) break;
							if (!(c instanceof Continue)) throw c;
						}
						tick(s);
					}
					break;
				}
				case "if":
					if (truthy(evaluate(s.test, scope))) exec(s.body, scope);
					else exec(s.orelse, scope);
					break;
				case "def":
					set(s.name, { fn: true, name: s.name, params: s.params, body: s.body }, scope);
					break;
				case "return":
					if (!scope.locals) stop(`return only works inside a recipe made with def.`, "extra");
					throw new Return(s.x ? evaluate(s.x, scope) : null);
				case "break":
					throw new Break();
				case "continue":
					throw new Continue();
				case "pass":
					break;
			}
		}
	};

	try {
		exec(program, { locals: null, assigned: new Set() });
	} catch (e) {
		if (e instanceof Stop) return { events, end: g, error: e.problem, steps };
		if (e instanceof Break || e instanceof Continue)
			return { events, end: g, error: { line, col: 0, kind: "extra", message: `break and continue only work inside a loop.` }, steps };
		throw e;
	}
	return { events, end: g, steps };
}

/** Names a function body assigns to: they're its own, as in Python. */
function assignedIn(body: Stmt[], params: string[]): Set<string> {
	const out = new Set(params);
	const walk = (ss: Stmt[]) => {
		for (const s of ss) {
			if (s.s === "assign") out.add(s.name);
			if (s.s === "for") out.add(s.v);
			if (s.s === "def") out.add(s.name);
			if (s.s === "for" || s.s === "while" || s.s === "if") walk(s.body);
			if (s.s === "if") walk(s.orelse);
		}
	};
	walk(body);
	return out;
}
