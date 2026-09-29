import { describe, expect, it } from "vitest";
import {
	advanceStreak,
	applyAnswer,
	buildReviewRound,
	gradeAttempt,
	normalizeWord,
	parseWordList,
	splitSyllables,
	starsForRound,
	starsForWord,
} from "../index.ts";
import { PACKS } from "../packs.ts";

describe("normalizeWord", () => {
	it("lowercases, trims and straightens apostrophes", () => {
		expect(normalizeWord("  Don’t ")).toBe("don't");
		expect(normalizeWord("Well-Known!")).toBe("well-known");
	});
});

describe("parseWordList", () => {
	it("splits on newlines, commas and numbering, de-duplicating", () => {
		expect(parseWordList("1. cat\n2. Dog, bird;cat\n\nfish  frog")).toEqual(["cat", "dog", "bird", "fish", "frog"]);
	});
	it("drops pure numbers and blanks", () => {
		expect(parseWordList("12, , 3)\nsun")).toEqual(["sun"]);
	});
});

describe("gradeAttempt", () => {
	it("accepts exact matches regardless of case", () => {
		const r = gradeAttempt("Friend", "friend");
		expect(r.correct).toBe(true);
		expect(r.letters.every((l) => l.mark === "ok")).toBe(true);
	});
	it("marks a swapped vowel as wrong", () => {
		const r = gradeAttempt("friend", "freind");
		expect(r.correct).toBe(false);
		expect(r.distance).toBe(2);
		expect(r.letters.map((l) => l.expected).join("")).toBe("friend");
	});
	it("marks a missing letter", () => {
		const r = gradeAttempt("little", "litle");
		expect(r.letters.filter((l) => l.mark === "missing")).toHaveLength(1);
		expect(r.distance).toBe(1);
	});
	it("marks an extra letter", () => {
		const r = gradeAttempt("cat", "catt");
		expect(r.letters.filter((l) => l.mark === "extra")).toHaveLength(1);
		expect(r.letters.filter((l) => l.mark === "ok")).toHaveLength(3);
	});
	it("never counts an empty target as correct", () => {
		expect(gradeAttempt("", "").correct).toBe(false);
	});
});

describe("srs", () => {
	const now = Date.UTC(2026, 0, 1);
	it("promotes on correct and resets on miss", () => {
		const a = applyAnswer(undefined, "cat", true, now);
		expect(a).toMatchObject({ box: 2, dueAt: now + 86_400_000 });
		const b = applyAnswer(a, "cat", true, now);
		expect(b).toMatchObject({ box: 3, dueAt: now + 3 * 86_400_000 });
		expect(applyAnswer(b, "cat", false, now)).toMatchObject({ box: 1, streak: 0, dueAt: now });
	});
	it("builds review rounds from due words, weakest first", () => {
		const round = buildReviewRound(
			[
				{ word: "a1", box: 3, dueAt: now - 10, streak: 2, lastSeen: 0 },
				{ word: "b1", box: 1, dueAt: now, streak: 0, lastSeen: 0 },
				{ word: "later", box: 2, dueAt: now + 1, streak: 1, lastSeen: 0 },
				{ word: "mastered", box: 5, dueAt: now - 1, streak: 5, lastSeen: 0 },
			],
			now,
		);
		expect(round).toEqual(["b1", "a1"]);
	});
});

describe("stars", () => {
	it("scores words", () => {
		expect(starsForWord({ correct: true, tries: 1, hintsUsed: 0 })).toBe(3);
		expect(starsForWord({ correct: true, tries: 1, hintsUsed: 1 })).toBe(2);
		expect(starsForWord({ correct: true, tries: 2, hintsUsed: 0 })).toBe(1);
		expect(starsForWord({ correct: false, tries: 2, hintsUsed: 0 })).toBe(0);
	});
	it("uses clear thresholds and rewards finishing", () => {
		expect(starsForRound([3, 3, 2])).toBe(3);
		expect(starsForRound([3, 2, 1])).toBe(2);
		expect(starsForRound([3, 0])).toBe(1);
		expect(starsForRound([0, 0])).toBe(1);
		expect(starsForRound([])).toBe(0);
	});
});

describe("advanceStreak", () => {
	it("extends on consecutive days and resets after a gap", () => {
		let s = advanceStreak({ current: 0, best: 0, lastDay: null }, "2026-01-01");
		s = advanceStreak(s, "2026-01-02");
		expect(s).toEqual({ current: 2, best: 2, lastDay: "2026-01-02" });
		expect(advanceStreak(s, "2026-01-02")).toBe(s);
		expect(advanceStreak(s, "2026-01-05")).toEqual({ current: 1, best: 2, lastDay: "2026-01-05" });
	});
});

describe("splitSyllables", () => {
	it.each([
		["butterfly", "but·ter·fly"],
		["rabbit", "rab·bit"],
		["little", "lit·tle"],
		["make", "make"],
		["cat", "cat"],
		["teacher", "tea·cher"],
	])("%s → %s", (word, expected) => {
		expect(splitSyllables(word).join("·")).toBe(expected);
	});
});

describe("packs", () => {
	it("contain only normalized, unique words", () => {
		for (const p of PACKS) {
			expect(new Set(p.words).size).toBe(p.words.length);
			for (const word of p.words) expect(normalizeWord(word)).toBe(word);
		}
	});
});
