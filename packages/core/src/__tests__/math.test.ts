import { describe, expect, it } from "vitest";
import {
	adaptLevel,
	answerText,
	buildMathRound,
	checkAnswer,
	divFact,
	generate,
	isTrackedFact,
	MATH_SKILLS,
	mulFact,
	problemFromKey,
	seeded,
} from "../math/index.ts";

describe("generators", () => {
	it("every skill and level produces problems that their own answer solves", () => {
		for (const skill of MATH_SKILLS) {
			for (let level = 1; level <= 5; level++) {
				const rng = seeded(level * 101 + skill.length);
				for (let i = 0; i < 200; i++) {
					const p = generate(skill, level, rng);
					expect(p.skill).toBe(skill);
					expect(p.key.startsWith("m:")).toBe(true);
					expect(p.prompt.some((t) => t.t === "blank" || t.t === "choice" || (t.t === "frac" && t.n === "?"))).toBe(true);
					expect(checkAnswer(p.answer, answerText(p.answer)), `${p.key} → ${answerText(p.answer)}`).toEqual({ correct: true });
					// Answers are whole, non-negative and kid-sized.
					if (p.answer.kind === "int") {
						expect(Number.isInteger(p.answer.value)).toBe(true);
						expect(p.answer.value).toBeGreaterThanOrEqual(0);
						expect(p.answer.value).toBeLessThan(2000);
					}
					expect(p.spoken.length).toBeGreaterThan(3);
					expect(p.explain.length).toBeGreaterThan(3);
				}
			}
		}
	});

	it("level 3 add/subtract always regroups", () => {
		const rng = seeded(7);
		for (let i = 0; i < 300; i++) {
			const p = generate("addsub", 3, rng);
			const [a, b] = p.key
				.replace(/^m:(add|sub):/, "")
				.split(/[+-]/)
				.map(Number) as [number, number];
			if (p.key.startsWith("m:add:")) expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
			else expect(b % 10).toBeGreaterThan(a % 10);
		}
	});

	it("facts use the chosen tables and round-trip through their key", () => {
		const rng = seeded(3);
		for (let i = 0; i < 100; i++) {
			const p = generate("mul", 3, rng, { tables: [7] });
			expect(p.key).toMatch(/^m:mul:\d+x\d+$/);
			expect(p.prompt.some((t) => t.t === "num" && t.v === "7")).toBe(true);
			expect(isTrackedFact(p.key)).toBe(true);
			expect(problemFromKey(p.key)?.answer).toEqual(p.answer);
		}
		expect(mulFact(8, 7).key).toBe(mulFact(7, 8).key);
		expect(problemFromKey(divFact(6, 9).key)?.answer).toEqual({ kind: "int", value: 9 });
		expect(isTrackedFact("m:add:47+38")).toBe(false);
	});
});

describe("checkAnswer", () => {
	it("integers", () => {
		expect(checkAnswer({ kind: "int", value: 56 }, " 56 ").correct).toBe(true);
		expect(checkAnswer({ kind: "int", value: 56 }, "65").correct).toBe(false);
		expect(checkAnswer({ kind: "int", value: 56 }, "").correct).toBe(false);
	});
	it("decimals accept equivalent forms", () => {
		const a = { kind: "dec", value: 0.5, places: 1 } as const;
		for (const s of ["0.5", ".5", "0.50", "1/2"]) expect(checkAnswer(a, s).correct).toBe(true);
		expect(checkAnswer(a, "0.05").correct).toBe(false);
	});
	it("fractions accept equivalents unless the task is to simplify", () => {
		expect(checkAnswer({ kind: "frac", n: 5, d: 8 }, "10/16").correct).toBe(true);
		expect(checkAnswer({ kind: "frac", n: 2, d: 4 }, "0.5").correct).toBe(true);
		expect(checkAnswer({ kind: "frac", n: 1, d: 2, simplest: true }, "1/2")).toEqual({ correct: true });
		expect(checkAnswer({ kind: "frac", n: 1, d: 2, simplest: true }, "2/4")).toEqual({
			correct: false,
			hint: "That's equal, but it can be simpler.",
		});
		expect(checkAnswer({ kind: "frac", n: 1, d: 2 }, "1/0").correct).toBe(false);
	});
	it("comparisons", () => {
		expect(checkAnswer({ kind: "choice", value: "<" }, "<").correct).toBe(true);
		expect(checkAnswer({ kind: "choice", value: "<" }, ">").correct).toBe(false);
	});
});

describe("adaptLevel", () => {
	const right = (ms = 2000, level = 2) => ({ correct: true, tries: 1, ms, level });
	const miss = (level = 2) => ({ correct: false, tries: 2, ms: 9000, level });
	it("moves up after 5 of 6 right first time and fluent", () => {
		expect(adaptLevel(2, [right(), right(), miss(), right(), right(), right()], "mul")).toBe(3);
	});
	it("stays when right but slow", () => {
		expect(
			adaptLevel(
				2,
				Array.from({ length: 6 }, () => right(20000)),
				"mul",
			),
		).toBe(2);
	});
	it("moves down after 2 misses in the last 4", () => {
		expect(adaptLevel(3, [right(2000, 3), miss(3), right(2000, 3), miss(3)], "mul")).toBe(2);
		expect(adaptLevel(1, [miss(1), miss(1)], "mul")).toBe(1);
	});
	it("only counts answers at the current level", () => {
		expect(adaptLevel(3, [miss(2), miss(2), right(2000, 3)], "mul")).toBe(3);
	});
});

describe("buildMathRound", () => {
	const settings = { topics: ["facts", "mental", "fractions", "problems"] as const, tables: [6, 7, 8] };
	it("puts due facts first and never repeats a problem", () => {
		const round = buildMathRound(
			"facts",
			{ ...settings, topics: [...settings.topics] },
			{ mul: 2, div: 2 },
			["m:mul:7x8", "m:div:42/6"],
			seeded(1),
		);
		expect(round).toHaveLength(10);
		expect(round.slice(0, 2).map((p) => p.key)).toEqual(["m:mul:7x8", "m:div:42/6"]);
		expect(new Set(round.map((p) => p.key)).size).toBe(10);
		expect(new Set(round.map((p) => p.skill))).toEqual(new Set(["mul", "div"]));
	});
	it("review rounds are only due facts", () => {
		const round = buildMathRound("review", { ...settings, topics: [...settings.topics] }, {}, ["m:mul:3x4", "m:mul:6x9"], seeded(2));
		expect(round.map((p) => p.key)).toEqual(["m:mul:3x4", "m:mul:6x9"]);
	});
	it("alternates skills within a topic", () => {
		const round = buildMathRound("fractions", { ...settings, topics: [...settings.topics] }, {}, [], seeded(5));
		expect(round.filter((p) => p.skill === "fractions").length).toBe(5);
		expect(round.filter((p) => p.skill === "decimals").length).toBe(5);
	});
});
