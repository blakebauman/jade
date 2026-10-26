import { describe, expect, it } from "vitest";
import {
	ALL_TEMPLATES,
	applyEvent,
	type Board,
	backspace,
	buildCodeRound,
	CODE_SKILLS,
	type CodeEvent,
	checkCode,
	codeLines,
	type Doc,
	deleteForward,
	docOf,
	indent,
	insert,
	makePuzzle,
	move,
	moveLine,
	mutate,
	newline,
	outdent,
	parse,
	puzzleFromKey,
	run,
	setCaret,
	startGarden,
	TEMPLATE_TITLE,
	textOf,
	unitOpen,
} from "../code/index.ts";
import { seeded } from "../math/rng.ts";

const open: Board = { rows: ["......", "......", "......"], start: { x: 0, y: 1, dir: 1 } };
const errOf = (src: string, board = open) => run(src, board).error;

describe("the interpreter", () => {
	it("walks, turns and picks", () => {
		const b: Board = { rows: [".s.F"], start: { x: 0, y: 0, dir: 1 } };
		const r = run("forward()\npick()\nforward(2)", b);
		expect(r.error).toBeUndefined();
		expect(r.end.pos).toEqual({ x: 3, y: 0 });
		expect(r.end.picked).toEqual(["1,0"]);
		expect(checkCode({ boards: [b] }, "forward()\npick()\nforward(2)").solved).toBe(true);
	});

	it("stops at a hedge and says which line did it", () => {
		const b: Board = { rows: ["..#."], start: { x: 0, y: 0, dir: 1 } };
		const e = run("forward()\nforward()", b).error!;
		expect(e.line).toBe(2);
		expect(e.kind).toBe("wrong");
		expect(e.message).toMatch(/hedge/);
	});

	it("runs loops, ifs, while and recipes like Python", () => {
		const r = run(
			"def hop(n):\n    total = 0\n    for i in range(n):\n        forward()\n        total += 1\n    return total\n\nk = hop(2)\nwhile k < 4:\n    k = k + 1\nif k == 4 and not False:\n    print('k is', k)\nelse:\n    print('no')\nprint(7 // 2, 7 % 3, -7 // 2, 'ab' * 2, True + 1)",
			open,
		);
		expect(r.error).toBeUndefined();
		expect(r.end.said).toEqual(["k is 4", "3 1 -4 abab 2"]);
		expect(r.end.pos).toEqual({ x: 2, y: 1 });
	});

	it("emits a line event for every statement run", () => {
		const r = run("for i in range(3):\n    forward()", open);
		expect(r.events.filter((e) => e.t === "line").map((e) => (e as { line: number }).line)).toEqual([1, 2, 2, 2]);
	});

	it("gets dizzy instead of looping forever", () => {
		const e = errOf("while True:\n    left()")!;
		expect(e.message).toMatch(/dizzy/);
	});

	it("explains syntax problems in kid words, as missing, extra or wrong", () => {
		expect(errOf("for i in range(4)\n    forward()")).toMatchObject({ line: 1, kind: "missing", message: expect.stringMatching(/:/) });
		expect(errOf("forward(")).toMatchObject({ line: 1, kind: "missing", message: expect.stringMatching(/\)/) });
		expect(errOf("forward())")).toMatchObject({ line: 1, kind: "extra" });
		expect(errOf("forward()\n    left()")).toMatchObject({ line: 2, kind: "extra" });
		expect(errOf("for i in range(2):\nforward()")).toMatchObject({ line: 2, kind: "missing" });
		expect(errOf("foward()")).toMatchObject({ line: 1, kind: "wrong", message: expect.stringMatching(/Did you mean forward/) });
		expect(errOf("x = 1\nif x = 1:\n    left()")).toMatchObject({ line: 2, kind: "wrong", message: expect.stringMatching(/==/) });
		expect(errOf("forward")).toMatchObject({ kind: "missing", message: expect.stringMatching(/\(\)/) });
		expect(errOf("print('hi)")).toMatchObject({ kind: "missing" });
		expect(errOf("print('n' + 1)")).toMatchObject({ kind: "wrong", message: expect.stringMatching(/words and numbers/) });
		expect(errOf("def f(a):\n    left()\nf()")).toMatchObject({ line: 3, kind: "missing" });
	});

	it("names a run that finished short of the goal", () => {
		const b: Board = { rows: ["..s.F"], start: { x: 0, y: 0, dir: 1 } };
		const v = checkCode({ boards: [b] }, "forward(4)");
		expect(v.solved).toBe(false);
		expect(v.error).toMatchObject({ kind: "missing", line: 1, message: expect.stringMatching(/seed/) });
	});

	it("replays a run to the same garden it ended in", () => {
		const b: Board = { rows: ["s..", "...", "..L"], start: { x: 0, y: 0, dir: 1 } };
		const r = run("pick()\npen_down()\nforward(2)\nright()\nforward(2)\nlight()", b);
		const replayed = r.events.reduce(applyEvent, startGarden(b));
		expect(replayed).toEqual(r.end);
	});
});

describe("puzzles", () => {
	const seeds = Array.from({ length: 25 }, (_, i) => i + 1);

	it("covers every unit at every level", () => {
		for (const skill of CODE_SKILLS)
			for (let level = 1; level <= 5; level++)
				expect(
					ALL_TEMPLATES.some((t) => t.skill === skill && t.level === level),
					`${skill} ${level}`,
				).toBe(true);
	});

	it("every template's solution solves every garden it makes, and fits the screen", () => {
		for (const t of ALL_TEMPLATES)
			for (const seed of seeds) {
				const made = t.make(seeded(seed));
				const v = checkCode(made, made.solution);
				expect(v.error, `${t.id} seed ${seed}: ${v.error?.message}\n${made.boards[0]!.rows.join("\n")}`).toBeUndefined();
				expect(v.solved, `${t.id} seed ${seed}`).toBe(true);
				if (made.neat) expect(codeLines(made.solution), t.id).toBeLessThanOrEqual(made.neat);
				for (const b of made.boards) {
					expect(b.rows.length, t.id).toBeLessThanOrEqual(9);
					expect(Math.max(...b.rows.map((r) => r.length)), t.id).toBeLessThanOrEqual(9);
				}
				// A starter is never already solved.
				if (made.starter) expect(checkCode(made, made.starter).solved, `${t.id} starter`).toBe(false);
			}
	});

	it("an empty program never solves a puzzle", () => {
		for (const t of ALL_TEMPLATES) expect(checkCode(t.make(seeded(3)), "").solved, t.id).toBe(false);
	});

	it("two-garden puzzles can't be solved by counting squares in one of them", () => {
		for (const t of ALL_TEMPLATES.filter((t) => t.make(seeded(1)).boards.length > 1))
			for (const seed of seeds) {
				const made = t.make(seeded(seed));
				// Solving the first garden step by step must fail the second.
				const r = run(made.solution, made.boards[0]!);
				const moves = r.events
					.filter((e): e is Extract<CodeEvent, { t: "move" | "turn" | "pick" | "light" | "plant" }> =>
						["move", "turn", "pick", "light", "plant"].includes(e.t),
					)
					.map((e) => (e.t === "move" ? "forward()" : e.t === "turn" ? "?" : `${e.t}()`));
				const dirs = r.events.flatMap((e) => (e.t === "turn" ? [e.dir] : []));
				let d = made.boards[0]!.start.dir;
				let k = 0;
				const steps = moves.map((m) => {
					if (m !== "?") return m;
					const to = dirs[k++]!;
					const out = (to - d + 4) % 4 === 1 ? "right()" : "left()";
					d = to;
					return out;
				});
				expect(checkCode({ boards: [made.boards[1]!] }, steps.join("\n")).solved, `${t.id} seed ${seed}`).toBe(false);
			}
	});

	it("fix puzzles start broken, predict puzzles have an answer", () => {
		for (const t of ALL_TEMPLATES)
			for (const seed of seeds.slice(0, 8)) {
				const fix = makePuzzle(t, "fix", seeded(seed));
				if (fix) {
					expect(checkCode(fix, fix.starter).solved, `${t.id} fix`).toBe(false);
					expect(checkCode(fix, fix.solution).solved, `${t.id} fix solution`).toBe(true);
				}
				const p = makePuzzle(t, "predict", seeded(seed));
				if (p) expect(run(p.starter, p.boards[0]!).end.pos, t.id).toEqual(p.answer);
			}
	});

	it("mutate makes one small change", () => {
		const src = "for i in range(4):\n    forward(2)\n    right()";
		for (const seed of seeds) {
			const m = mutate(src, seeded(seed));
			expect(m).not.toBeNull();
			expect(m).not.toBe(src);
			expect(() => parse(m!)).not.toThrow();
		}
	});

	it("the toolbox offers what the solution needs", () => {
		const t = ALL_TEMPLATES.find((t) => t.id === "square")!;
		const p = makePuzzle(t, "build", seeded(1))!;
		expect(p.toolbox).toEqual(expect.arrayContaining(["for i in range(|):", "forward(|)", "right()", "pen_down()", "0-9"]));
		expect(p.toolbox).not.toContain("pick()");
	});
});

describe("rounds", () => {
	it("builds six puzzles in a unit with a warm-up a level below", () => {
		for (const skill of CODE_SKILLS)
			for (const seed of [1, 2, 3]) {
				const r = buildCodeRound(skill, { [skill]: 3 }, [], seeded(seed));
				expect(r.length, skill).toBe(6);
				expect(r[0]!.level).toBe(2);
				expect(r.slice(1).every((p) => p.level === 3)).toBe(true);
				expect(r.every((p) => p.skill === skill)).toBe(true);
			}
	});

	it("serves a sibling of a due puzzle, in its unit or in review", () => {
		const due = ["c:loops:square.3", "c:seq:corner.2"];
		const r = buildCodeRound("loops", { loops: 3 }, due, seeded(4));
		expect(r[3]!.key).toBe("c:loops:square.3");
		const review = buildCodeRound("review", {}, due, seeded(4));
		expect(review.map((p) => p.key)).toEqual(due);
		expect(puzzleFromKey("c:nope:x.1", seeded(1))).toBeNull();
	});

	it("opens units in order", () => {
		expect(unitOpen("seq", {})).toBe(true);
		expect(unitOpen("args", {})).toBe(false);
		expect(unitOpen("args", { seq: 2 })).toBe(true);
		expect(unitOpen("ifs", { ifs: 1 })).toBe(true);
	});
});

describe("the editor", () => {
	const type = (d: Doc, ...snips: string[]) => snips.reduce((doc, s) => (s === "\n" ? newline(doc) : insert(doc, s)), d);

	it("builds a loop from toolbox taps alone", () => {
		let d = docOf("");
		d = type(d, "for i in range(|):", "4");
		expect(textOf(d)).toBe("for i in range(4):");
		// A command on a line that has code goes under it, pushed in after the colon.
		d = type(d, "forward(|)", "2", "right()");
		expect(textOf(d)).toBe("for i in range(4):\n    forward(2)\n    right()");
		d = outdent(type(d, "\n"));
		d = insert(d, "pick()");
		expect(textOf(d)).toBe("for i in range(4):\n    forward(2)\n    right()\npick()");
	});

	it("lines else up with its if", () => {
		const d = type(docOf(""), "if |:", "seed_here()", "pick()", "else:");
		expect(textOf(d)).toBe("if seed_here():\n    pick()\nelse:");
	});

	it("deletes whole tokens from the toolbox and single characters from a keyboard", () => {
		const d = docOf("for i in range(4):\n    forward(2)");
		expect(textOf(backspace(d))).toBe("for i in range(4):\n    forward(2");
		// A whole command goes in one tap.
		expect(textOf(backspace(d, true))).toBe("for i in range(4):\n    ");
		const e = docOf("    pick()");
		expect(textOf(backspace(e, true))).toBe("    ");
		// In the indent, a delete takes one step of it.
		expect(textOf(backspace(docOf("        ")))).toBe("    ");
		// At a line's start it joins the line above.
		expect(textOf(backspace(setCaret(docOf("left()\nright()"), 1, 0)))).toBe("left()right()");
	});

	it("moves the caret and lines", () => {
		const d = setCaret(docOf("a()\n    b()"), 1, 7);
		expect(move(d, "home").col).toBe(4);
		expect(move(move(d, "home"), "home").col).toBe(0);
		expect(textOf(moveLine(d, -1))).toBe("    b()\na()");
		expect(textOf(indent(setCaret(docOf("x()"), 0, 0)))).toBe("    x()");
		expect(textOf(deleteForward(setCaret(docOf("ab"), 0, 0)))).toBe("b");
	});
});

it("every puzzle kind has a title for parents", () => {
	for (const t of ALL_TEMPLATES) expect(TEMPLATE_TITLE[t.id], t.id).toBeTruthy();
});
