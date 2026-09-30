import { describe, expect, it } from "vitest";
import { stretch } from "./stretch.ts";

const SR = 24000;
const tone = (hz: number, seconds: number) => Float32Array.from({ length: SR * seconds }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR));

/** Frequency from upward zero crossings over the middle of the clip, away from the edges. */
function pitch(x: Float32Array) {
	const a = Math.floor(x.length * 0.2);
	const b = Math.floor(x.length * 0.8);
	let crossings = 0;
	for (let i = a + 1; i < b; i++) if (x[i - 1]! < 0 && x[i]! >= 0) crossings++;
	return crossings / ((b - a) / SR);
}

const rms = (x: Float32Array, from: number, to: number) => {
	let s = 0;
	for (let i = from; i < to; i++) s += x[i]! ** 2;
	return Math.sqrt(s / (to - from));
};

describe("stretch", () => {
	it("returns the clip untouched at normal speed", () => {
		const x = tone(220, 0.5);
		expect(stretch(x, 1, SR)).toBe(x);
	});

	it.each([0.95, 0.684])("slows to rate %s without changing pitch or level", (rate) => {
		const y = stretch(tone(220, 1), rate, SR);
		expect(y.length).toBe(Math.round(SR / rate));
		expect(pitch(y)).toBeGreaterThan(215);
		expect(pitch(y)).toBeLessThan(225);
		// A steady tone stays steady: no dips where frames join, and the start isn't faded. The end may lose up to
		// the 10ms search window (speech clips end in silence anyway).
		const end = y.length - SR * 0.02;
		expect(rms(y, 0, SR * 0.05)).toBeGreaterThan(0.6);
		for (let i = 0; i + 480 <= end; i += 480) expect(rms(y, i, i + 480)).toBeGreaterThan(0.6);
	});
});
