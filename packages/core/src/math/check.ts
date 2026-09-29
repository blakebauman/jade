import { gcd } from "./rng.ts";
import type { Answer } from "./types.ts";

export type CheckResult = { correct: boolean /** A nudge shown instead of "wrong" when the answer is close. */; hint?: string };

const INT = /^-?\d+$/;
const DEC = /^-?(\d+\.?\d*|\.\d+)$/;
const FRAC = /^(\d+)\s*\/\s*(\d+)$/;

/** Clean keypad/keyboard input: trim, unify symbols, drop spaces. */
export const normalizeInput = (s: string) => s.trim().replace(/[÷⁄∕]/g, "/").replace(/,/g, ".").replace(/\s+/g, "");

/** Parse "3/4", "6", "0.75" into a fraction n/d (d > 0), or null. */
function parseRational(s: string): { n: number; d: number } | null {
	const f = FRAC.exec(s);
	if (f) {
		const d = Number(f[2]);
		return d === 0 ? null : { n: Number(f[1]), d };
	}
	if (INT.test(s)) return { n: Number(s), d: 1 };
	if (DEC.test(s)) {
		const places = s.includes(".") ? s.split(".")[1]!.length : 0;
		const d = 10 ** places;
		return { n: Math.round(Number(s) * d), d };
	}
	return null;
}

export function checkAnswer(answer: Answer, raw: string): CheckResult {
	const s = normalizeInput(raw);
	if (!s) return { correct: false };
	switch (answer.kind) {
		case "choice":
			return { correct: s === answer.value };
		case "int": {
			if (INT.test(s)) return { correct: Number(s) === answer.value };
			const r = parseRational(s);
			// "12/2" for 6 is right in value; accept it but it's unusual, so no hint needed.
			return { correct: !!r && r.n === answer.value * r.d };
		}
		case "dec": {
			const r = parseRational(s);
			if (!r) return { correct: false };
			const want = Math.round(answer.value * 10 ** answer.places);
			return { correct: r.n * 10 ** answer.places === want * r.d };
		}
		case "frac": {
			const r = parseRational(s);
			if (!r) return { correct: false };
			const equal = r.n * answer.d === answer.n * r.d;
			if (!equal) return { correct: false };
			if (answer.simplest && gcd(r.n, r.d) !== 1) return { correct: false, hint: "That's equal, but it can be simpler." };
			return { correct: true };
		}
	}
}
