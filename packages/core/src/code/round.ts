import { int, pick, type Rng } from "../math/rng.ts";
import { cellsOf } from "./board.ts";
import { checkCode } from "./goals.ts";
import { run } from "./interp.ts";
import { type Made, TEMPLATES, type Template, templateById, templatesAt, toolboxFor } from "./puzzles.ts";
import { type Board, CODE_SKILLS, type CodeSkill, type Puzzle, type PuzzleKind, TURTLE } from "./types.ts";

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? `the ${one}` : n === 2 ? `both ${many}` : `all ${n} ${many}`);

/** The goal in one sentence, from what's in the garden. */
export function goalFor(made: Made): string {
	if (made.goal) return made.goal;
	const b = made.boards[0]!;
	const two = made.boards.length > 1;
	const parts: string[] = [];
	if (made.draw) return `Draw over the chalk line with ${TURTLE}’s pen.`;
	const seeds = cellsOf(b, "s").length;
	const lanterns = cellsOf(b, "L").length;
	const beds = cellsOf(b, "b").length;
	if (seeds && lanterns) parts.push("pick up the seeds and light the lanterns");
	else if (lanterns && beds) parts.push("light every lantern and plant every flower bed");
	else if (seeds) parts.push(two ? "pick up every seed" : `pick up ${plural(seeds, "seed")}`);
	else if (lanterns) parts.push(two ? "light every lantern" : `light ${plural(lanterns, "lantern")}`);
	const flag = cellsOf(b, "F").length > 0;
	let s = parts.length ? `${cap(parts.join(""))}${flag ? `, then get ${TURTLE} to the flag` : ""}.` : `Get ${TURTLE} to the flag.`;
	if (two) s += " Your code has to work in both gardens.";
	return s;
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const keyOf = (t: Template) => `c:${t.skill}:${t.id}.${t.level}`;

/** Lines of a program that a bug can go in: not blank, not a def or loop header. */
const codeLineIdx = (src: string) =>
	src
		.split("\n")
		.map((l, i) => [l, i] as const)
		.filter(([l]) => l.trim() !== "")
		.map(([, i]) => i);

/** One small bug, the kind kids make: the wrong turn, a number off by one, a line missing, a line not pushed in. */
export function mutate(src: string, rng: Rng): string | null {
	const lines = src.split("\n");
	const idx = codeLineIdx(src);
	const kinds = ["turn", "number", "drop", "outdent", "swap"];
	for (let tries = 0; tries < 30; tries++) {
		const kind = pick(rng, kinds);
		const i = pick(rng, idx);
		const l = lines[i]!;
		const out = [...lines];
		if (kind === "turn" && /\b(left|right)\(/.test(l))
			out[i] = l.replace(/\b(left|right)\(/, (_, d) => (d === "left" ? "right(" : "left("));
		else if (kind === "number" && /\d/.test(l) && !/^\s*def /.test(l)) {
			const m = [...l.matchAll(/\d+/g)];
			const hit = pick(rng, m);
			const n = Number(hit[0]);
			const to = n <= 1 ? n + 1 : rng() < 0.5 ? n - 1 : n + 1;
			out[i] = l.slice(0, hit.index) + String(to) + l.slice(hit.index! + hit[0].length);
		} else if (kind === "drop" && !/:\s*$/.test(l) && idx.length > 2) {
			// Never leave a block with nothing in it.
			const ind = l.length - l.trimStart().length;
			const prev = lines[i - 1] ?? "";
			const nextL = lines[i + 1] ?? "";
			const nextInd = nextL.length - nextL.trimStart().length;
			if (/:\s*$/.test(prev) && (nextL.trim() === "" || nextInd < ind)) continue;
			out.splice(i, 1);
		} else if (kind === "outdent" && /^ {4}/.test(l) && !/:\s*$/.test(l)) {
			const nextL = lines[i + 1] ?? "";
			const ind = l.length - l.trimStart().length;
			// Only the last line of a block can come out without breaking the block.
			if (nextL.trim() !== "" && nextL.length - nextL.trimStart().length >= ind) continue;
			const prev = lines[i - 1] ?? "";
			if (/:\s*$/.test(prev)) continue;
			out[i] = l.slice(4);
		} else if (kind === "swap" && i + 1 < lines.length) {
			const a = lines[i]!;
			const b = lines[i + 1]!;
			if (!b.trim() || /:\s*$/.test(a) || /:\s*$/.test(b) || a.trim() === b.trim()) continue;
			if (a.length - a.trimStart().length !== b.length - b.trimStart().length) continue;
			out[i] = b;
			out[i + 1] = a;
		} else continue;
		const next = out.join("\n");
		if (next !== src) return next;
	}
	return null;
}

/** Take the targets out of a garden, so "where will Tuck end up?" isn't given away by a flag. */
const bare = (b: Board): Board => ({ ...b, rows: b.rows.map((r) => r.replace(/[Fo]/g, ".")) });

/** A puzzle of one kind from a template; null when that kind doesn't fit (the caller tries another). */
export function makePuzzle(t: Template, kind: PuzzleKind, rng: Rng): Puzzle | null {
	const made = t.make(rng);
	const natural: PuzzleKind = made.draw ? "draw" : made.neat && !made.starter ? "neat" : "build";
	const base = {
		key: keyOf(t),
		skill: t.skill,
		level: t.level,
		boards: made.boards,
		solution: made.solution,
		toolbox: toolboxFor(made.solution, t.skill),
		say: made.say,
		hint: made.hint,
	};
	const goal = goalFor(made);
	if (kind === "predict") {
		if (made.noPredict || made.boards.length > 1) return null;
		const board = bare(made.boards[0]!);
		const r = run(made.solution, board);
		if (r.error) return null;
		const end = r.end.pos;
		if (end.x === board.start.x && end.y === board.start.y) return null;
		return {
			...base,
			kind,
			boards: [board],
			starter: made.solution,
			answer: end,
			goal: `Read the code. Where will ${TURTLE} end up? Tap the square.`,
			hint: "Point at Tuck and move your finger one line at a time.",
		};
	}
	if (kind === "fix") {
		for (let i = 0; i < 10; i++) {
			const bug = mutate(made.solution, rng);
			if (bug && !checkCode(made, bug).solved) {
				const lower = goal[0]!.toLowerCase() + goal.slice(1);
				return {
					...base,
					kind,
					starter: bug,
					goal: `There’s a bug in this code. Fix it so you ${lower.replace(/\.$/, "")}.`,
					neat: undefined,
				};
			}
		}
		return null;
	}
	const neat = made.neat;
	if (kind === "neat" && natural !== "neat") return null;
	return {
		...base,
		kind: natural,
		starter: made.starter ?? "",
		neat,
		goal: natural === "neat" && neat ? `${goal} Do it in ${neat} lines or fewer.` : goal,
	};
}

/** A puzzle from a key, a sibling of the one that was missed: same template and level, a new garden. */
export function puzzleFromKey(key: string, rng: Rng, kind: PuzzleKind = "build"): Puzzle | null {
	const m = /^c:(\w+):(\w+)\.(\d)$/.exec(key);
	if (!m || !(CODE_SKILLS as readonly string[]).includes(m[1]!)) return null;
	const t = templateById(m[1] as CodeSkill, m[2]!);
	if (!t) return null;
	return makePuzzle(t, kind, rng) ?? makePuzzle(t, "build", rng);
}

/** The level a unit opens at, and whether it's open: a unit opens once the one before it reaches level 2. */
export function unitOpen(skill: CodeSkill, levels: Partial<Record<string, number>>) {
	const i = CODE_SKILLS.indexOf(skill);
	if (i === 0 || levels[skill] !== undefined) return true;
	return (levels[CODE_SKILLS[i - 1]!] ?? 1) >= 2;
}

/** The order puzzles come in: build, fix, predict, build, a drawing or neat one, build. */
const PLAN: PuzzleKind[] = ["build", "fix", "predict", "build", "neat", "build"];

/**
 * A round of six puzzles in one unit: the first a level below (a warm-up, when there is one), one review puzzle due in
 * this unit, the rest at the kid's level. "review" is a round of due puzzles from any unit.
 */
export function buildCodeRound(
	skill: CodeSkill | "review",
	levels: Partial<Record<string, number>>,
	due: string[],
	rng: Rng,
	size = 6,
): Puzzle[] {
	const out: Puzzle[] = [];
	if (skill === "review") {
		for (const key of due.slice(0, size)) {
			const p = puzzleFromKey(key, rng, out.length % 2 ? "fix" : "build");
			if (p) out.push(p);
		}
		return out;
	}
	const level = levels[skill] ?? 1;
	const mine = due.filter((k) => k.startsWith(`c:${skill}:`));
	for (let i = 0; i < size; i++) {
		const kind = PLAN[i % PLAN.length]!;
		const atLevel = i === 0 && level > 1 ? level - 1 : level;
		if (i === 3 && mine.length > 0) {
			const p = puzzleFromKey(mine[0]!, rng, "build");
			if (p) {
				out.push(p);
				continue;
			}
		}
		const pool = templatesAt(skill, atLevel);
		const fallback = templatesAt(skill, level);
		let made: Puzzle | null = null;
		// The neat slot takes a drawing or neat template when the level has one.
		const special =
			kind === "neat"
				? pool.filter((t) => {
						const m = t.make(rng);
						return m.draw || m.neat;
					})
				: [];
		const candidates = special.length ? special : pool.length ? pool : fallback;
		for (let tries = 0; tries < 12 && !made; tries++) {
			const t = candidates[int(rng, 0, candidates.length - 1)]!;
			made = makePuzzle(t, kind === "neat" ? "build" : kind, rng) ?? (tries > 6 ? makePuzzle(t, "build", rng) : null);
		}
		if (made) out.push(made);
	}
	return out;
}

/** Every template, for tests. */
export const ALL_TEMPLATES = TEMPLATES;
