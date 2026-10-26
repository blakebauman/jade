/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_TEMPLATES, type Board, type CodeEvent, makePuzzle, run } from "../code/index.ts";
import { seeded } from "../math/rng.ts";

const open: Board = { rows: ["......", "......", "......"], start: { x: 0, y: 1, dir: 1 } };

/** Every program in the subset must be real Python: run the solutions and bugs through CPython and compare traces. */
describe("parity with real Python", () => {
	let python: string | null = null;
	for (const bin of ["python3", "python"]) {
		try {
			execFileSync(bin, ["--version"], { stdio: "ignore" });
			python = bin;
			break;
		} catch {}
	}
	const trace = (events: CodeEvent[]) =>
		events.flatMap((e): unknown[][] => {
			if (e.t === "move") return [["move", e.to.x, e.to.y]];
			if (e.t === "paint" || e.t === "pick" || e.t === "light" || e.t === "plant") return [[e.t, e.at.x, e.at.y]];
			if (e.t === "turn") return [["turn", e.dir]];
			if (e.t === "pen") return [["pen", e.down]];
			if (e.t === "say") return [["say", e.text]];
			return [];
		});

	it.skipIf(!python && !process.env.CI)("every solution and every bug runs the same in CPython", () => {
		if (!python) throw new Error("CI needs python3 for the parity test");
		const cases: { src: string; board: Board }[] = [];
		for (const t of ALL_TEMPLATES)
			for (const seed of [1, 2, 3, 4, 5]) {
				const made = t.make(seeded(seed));
				for (const board of made.boards) cases.push({ src: made.solution, board });
				const fix = makePuzzle(t, "fix", seeded(seed));
				if (fix) for (const board of fix.boards) cases.push({ src: fix.starter, board });
			}
		cases.push(
			{ src: "print(7 // 2, -7 // 2, 7 % 3, -7 % 3, 'ab' * 2, True + 1, 1 == True)", board: open },
			{ src: "x = 3\ndef f():\n    return x * 2\nprint(f(), str(5) + 'a', abs(-4))", board: open },
			{ src: "forward(3)\nforward(9)", board: open },
		);
		const script = fileURLToPath(new URL("../code/parity/garden.py", import.meta.url));
		const out = JSON.parse(execFileSync(python, [script], { input: JSON.stringify(cases), maxBuffer: 64 << 20 }).toString()) as {
			events: unknown[][];
			error: boolean;
		}[];
		cases.forEach((c, i) => {
			const ours = run(c.src, c.board);
			// Endless loops stop at different places in the two; both stopping is enough.
			if (ours.error?.message.includes("dizzy")) {
				expect(out[i]!.error).toBe(true);
				return;
			}
			expect(trace(ours.events), c.src).toEqual(out[i]!.events);
			expect(!!ours.error, c.src).toBe(out[i]!.error);
		});
	});
});
