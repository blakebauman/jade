import { gradeAttempt } from "@jade/core";
import { describe, expect, it } from "vitest";
import { describeMiss } from "./feedback.ts";

describe("describeMiss", () => {
	it("names swapped vowels on reveal, only locates them on retry", () => {
		const g = gradeAttempt("believe", "beleive");
		expect(describeMiss(g, true)).toEqual(["“ie”, not “ei”"]);
		expect(describeMiss(g, false)).toEqual(["Two letters are swapped"]);
	});
	it("spots a missing double letter", () => {
		expect(describeMiss(gradeAttempt("necessary", "necesary"), true)).toEqual(["Double “ss”"]);
	});
	it("spots a wrong single letter", () => {
		expect(describeMiss(gradeAttempt("rhythm", "rhythn"), true)).toEqual(["“m”, not “n”"]);
	});
	it("never claims a doubled letter the word doesn't have", () => {
		expect(describeMiss(gradeAttempt("rhythm", "rhythmxx"), true)).toEqual(["No “x” there"]);
		expect(describeMiss(gradeAttempt("dinner", "dinnner"), true)).toEqual(["Only one “n”"]);
	});
	it("caps at two notes", () => {
		expect(describeMiss(gradeAttempt("february", "febuary"), true).length).toBeLessThanOrEqual(2);
	});
});
