import { describe, expect, it } from "vitest";
import { DEFAULT_PLAY, goalLeft, goalMet, goalProgress, minutesLeft, playState } from "../play.ts";

describe("play", () => {
	it("is open for a kid with nothing set", () => {
		expect(playState(DEFAULT_PLAY, { rounds: 0, stars: 0 }, 0)).toEqual({ shut: false, outOfTime: false, open: true });
	});

	it("opens after today's round, or today's stars", () => {
		expect(goalMet("round", { rounds: 0, stars: 40 })).toBe(false);
		expect(goalMet("round", { rounds: 1, stars: 0 })).toBe(true);
		expect(goalMet("stars10", { rounds: 3, stars: 9 })).toBe(false);
		expect(goalMet("stars10", { rounds: 0, stars: 10 })).toBe(true);
		expect(goalProgress("stars20", { rounds: 0, stars: 26 })).toEqual({ have: 20, need: 20, unit: "star" });
		expect(goalLeft("stars10", { rounds: 0, stars: 9 })).toBe("Earn 1 more star today");
		expect(goalLeft("round", { rounds: 0, stars: 0 })).toBe("Finish 1 round today");
	});

	it("shuts for practice first, then runs out of time, independently", () => {
		const both = { ...DEFAULT_PLAY, practiceFirst: true, timeCosts: true };
		expect(playState(both, { rounds: 0, stars: 0 }, 600)).toMatchObject({ shut: true, outOfTime: false, open: false });
		expect(playState(both, { rounds: 1, stars: 0 }, 0)).toMatchObject({ shut: false, outOfTime: true, open: false });
		expect(playState(both, { rounds: 1, stars: 0 }, 1)).toMatchObject({ open: true });
		// Without the time switch, no minutes is no limit.
		expect(playState({ ...both, timeCosts: false }, { rounds: 1, stars: 0 }, 0).open).toBe(true);
	});

	it("rounds minutes up so the last minute still shows", () => {
		expect(minutesLeft(0)).toBe(0);
		expect(minutesLeft(1)).toBe(1);
		expect(minutesLeft(60)).toBe(1);
		expect(minutesLeft(61)).toBe(2);
	});
});
