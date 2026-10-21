import { describe, expect, it } from "vitest";
import { LOOP_URLS, LOOPS, SHOT_IDS, SHOT_URLS } from "./samples.ts";

describe("woods recordings", () => {
	it("has a file for every sound, and no file that isn't one", () => {
		expect([...SHOT_URLS.keys()].sort()).toEqual([...SHOT_IDS].sort());
		expect([...LOOP_URLS.keys()].sort()).toEqual(Object.keys(LOOPS).sort());
	});

	it("keeps several takes of the sounds heard over and over", () => {
		for (const id of SHOT_IDS.filter((s) => s.startsWith("step-"))) expect(SHOT_URLS.get(id)!.length).toBeGreaterThanOrEqual(4);
		for (const id of ["dig-stone", "dig-wood", "place"] as const) expect(SHOT_URLS.get(id)!.length).toBeGreaterThanOrEqual(2);
	});
});
