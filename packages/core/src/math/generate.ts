import { wordProblem } from "./problems.ts";
import { gcd, int, pick, type Rng } from "./rng.ts";
import type { MathSkill, Problem, Token } from "./types.ts";

const num = (v: number | string): Token => ({ t: "num", v: String(v) });
const op = (v: "+" | "−" | "×" | "÷" | "=" | "of"): Token => ({ t: "op", v });
const frac = (n: number, d: number): Token => ({ t: "frac", n: String(n), d: String(d) });
const blank: Token = { t: "blank" };

const DENOM_WORD: Record<number, [string, string]> = {
	2: ["half", "halves"],
	3: ["third", "thirds"],
	4: ["quarter", "quarters"],
	5: ["fifth", "fifths"],
	6: ["sixth", "sixths"],
	8: ["eighth", "eighths"],
	10: ["tenth", "tenths"],
	12: ["twelfth", "twelfths"],
	100: ["hundredth", "hundredths"],
};
/** "three quarters", "one half" — how a teacher says it. */
export function sayFraction(n: number, d: number): string {
	const w = DENOM_WORD[d];
	if (!w) return `${n} over ${d}`;
	return `${n} ${n === 1 ? w[0] : w[1]}`;
}

export type GenOptions = { tables?: number[] };

/** A multiplication fact. Level sets the other factor's range: 1–5, 1–10, then 1–12. */
export function mulFact(a: number, b: number, level = 1): Problem {
	const [lo, hi] = a <= b ? [a, b] : [b, a];
	const p = a * b;
	const strategies: string[] = [];
	if (b === 9 || a === 9) strategies.push(`9 × ${a === 9 ? b : a} is 10 × ${a === 9 ? b : a} − ${a === 9 ? b : a} = ${p}`);
	else if (b === 5 || a === 5) strategies.push(`5 × ${a === 5 ? b : a} is half of 10 × ${a === 5 ? b : a}`);
	else if (lo > 2) strategies.push(`${a} × ${b} = ${a} × ${b - 1} + ${a} = ${a * (b - 1)} + ${a}`);
	return {
		key: `m:mul:${lo}x${hi}`,
		skill: "mul",
		level,
		prompt: [num(a), op("×"), num(b), op("="), blank],
		answer: { kind: "int", value: p },
		spoken: `${a} times ${b}`,
		explain: [`${a} × ${b} = ${p}`, ...strategies].join(". "),
		visual: a <= 10 && b <= 10 ? { kind: "array", rows: a, cols: b } : undefined,
	};
}

export function divFact(divisor: number, quotient: number, level = 1): Problem {
	const dividend = divisor * quotient;
	return {
		key: `m:div:${dividend}/${divisor}`,
		skill: "div",
		level,
		prompt: [num(dividend), op("÷"), num(divisor), op("="), blank],
		answer: { kind: "int", value: quotient },
		spoken: `${dividend} divided by ${divisor}`,
		explain: `${dividend} ÷ ${divisor} = ${quotient}, because ${divisor} × ${quotient} = ${dividend}`,
		visual: divisor <= 10 && quotient <= 10 ? { kind: "array", rows: divisor, cols: quotient } : undefined,
	};
}

/** Rebuild a tracked fact from its key (for Leitner review rounds). */
export function problemFromKey(key: string): Problem | null {
	let m = /^m:mul:(\d+)x(\d+)$/.exec(key);
	if (m) return mulFact(Number(m[1]), Number(m[2]), 1);
	m = /^m:div:(\d+)\/(\d+)$/.exec(key);
	if (m) return divFact(Number(m[2]), Number(m[1]) / Number(m[2]), 1);
	return null;
}

const factorRange = (level: number) => (level <= 1 ? 5 : level === 2 ? 10 : 12);

function genMul(level: number, rng: Rng, opts: GenOptions): Problem {
	const a = pick(rng, opts.tables?.length ? opts.tables : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	const b = int(rng, level >= 4 ? 3 : 1, factorRange(level));
	return rng() < 0.5 ? mulFact(a, b, level) : mulFact(b, a, level);
}

function genDiv(level: number, rng: Rng, opts: GenOptions): Problem {
	const divisor = pick(
		rng,
		(opts.tables?.length ? opts.tables : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).filter((t) => t >= 2),
	);
	return divFact(divisor, int(rng, level >= 4 ? 3 : 1, factorRange(level)), level);
}

function addExplain(a: number, b: number) {
	const tens = Math.floor(b / 10) * 10;
	const ones = b - tens;
	return tens && ones ? `Split it: ${a} + ${tens} = ${a + tens}, then + ${ones} = ${a + b}` : `${a} + ${b} = ${a + b}`;
}
function subExplain(a: number, b: number) {
	const up = Math.ceil(b / 10) * 10;
	return up > b && up < a
		? `Count up from ${b}: ${up - b} to reach ${up}, then ${a - up} more to ${a}. That's ${a - b}`
		: `${a} − ${b} = ${a - b}`;
}

function genAddSub(level: number, rng: Rng): Problem {
	let a: number;
	let b: number;
	const add = rng() < 0.5;
	if (level <= 1) {
		a = int(rng, 3, 12);
		b = int(rng, 2, 9);
	} else if (level === 2) {
		// Two-digit, no regrouping: ones digits don't carry/borrow.
		const at = int(rng, 2, 8);
		const bt = int(rng, 1, 9 - at);
		const ao = int(rng, 0, 9);
		const bo = add ? int(rng, 0, 9 - ao) : int(rng, 0, ao);
		a = at * 10 + ao;
		b = bt * 10 + bo;
		if (!add && b > a) [a, b] = [b, a];
	} else if (level === 3) {
		// Two-digit with regrouping: the ones digits are chosen so a carry (add) or borrow (subtract) is guaranteed.
		if (add) {
			const ao = int(rng, 2, 9);
			const bo = int(rng, 10 - ao, 9);
			const at = int(rng, 1, 7);
			a = at * 10 + ao;
			b = int(rng, 1, 8 - at) * 10 + bo;
		} else {
			const ao = int(rng, 0, 8);
			const bo = int(rng, ao + 1, 9);
			const at = int(rng, 3, 9);
			a = at * 10 + ao;
			b = int(rng, 1, at - 1) * 10 + bo;
		}
	} else {
		a = int(rng, 120, 899);
		b = int(rng, 35, level >= 5 ? 499 : 199);
	}
	if (add) {
		// Level 5: missing-number form, `? + b = sum`.
		if (level >= 5 && rng() < 0.5)
			return {
				key: `m:miss:?+${b}=${a + b}`,
				skill: "addsub",
				level,
				prompt: [blank, op("+"), num(b), op("="), num(a + b)],
				answer: { kind: "int", value: a },
				spoken: `what plus ${b} equals ${a + b}`,
				explain: `Work backwards: ${a + b} − ${b} = ${a}`,
			};
		return {
			key: `m:add:${a}+${b}`,
			skill: "addsub",
			level,
			prompt: [num(a), op("+"), num(b), op("="), blank],
			answer: { kind: "int", value: a + b },
			spoken: `${a} plus ${b}`,
			explain: addExplain(a, b),
		};
	}
	if (b > a) [a, b] = [b, a];
	return {
		key: `m:sub:${a}-${b}`,
		skill: "addsub",
		level,
		prompt: [num(a), op("−"), num(b), op("="), blank],
		answer: { kind: "int", value: a - b },
		spoken: `${a} minus ${b}`,
		explain: subExplain(a, b),
	};
}

function genMixed(level: number, rng: Rng): Problem {
	if (level <= 1) {
		// Warm-up facts. They keep their fact key (so they still feed Leitner review) but count toward "mixed".
		const fact = rng() < 0.5 ? mulFact(int(rng, 2, 9), int(rng, 2, 9), level) : divFact(int(rng, 2, 9), int(rng, 2, 9), level);
		return { ...fact, skill: "mixed" };
	}
	if (level === 2) {
		// Two-digit × one-digit, by partitioning.
		const a = int(rng, 12, 49);
		const b = int(rng, 2, 6);
		const t = Math.floor(a / 10) * 10;
		return {
			key: `m:mul2:${a}x${b}`,
			skill: "mixed",
			level,
			prompt: [num(a), op("×"), num(b), op("="), blank],
			answer: { kind: "int", value: a * b },
			spoken: `${a} times ${b}`,
			explain: `Split ${a} into ${t} and ${a - t}: ${t} × ${b} = ${t * b}, ${a - t} × ${b} = ${(a - t) * b}, together ${a * b}`,
		};
	}
	if (level === 3) {
		// Order of operations: multiply before adding.
		const a = int(rng, 2, 20);
		const b = int(rng, 2, 9);
		const c = int(rng, 2, 9);
		return {
			key: `m:ooo:${a}+${b}x${c}`,
			skill: "mixed",
			level,
			prompt: [num(a), op("+"), num(b), op("×"), num(c), op("="), blank],
			answer: { kind: "int", value: a + b * c },
			spoken: `${a} plus ${b} times ${c}`,
			explain: `Multiply first: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${a + b * c}`,
		};
	}
	if (level === 4) {
		// Three-digit ÷ one-digit, exact.
		const d = int(rng, 2, 9);
		const q = int(rng, 14, 99);
		return {
			key: `m:div3:${d * q}/${d}`,
			skill: "mixed",
			level,
			prompt: [num(d * q), op("÷"), num(d), op("="), blank],
			answer: { kind: "int", value: q },
			spoken: `${d * q} divided by ${d}`,
			explain: `${d * q} ÷ ${d} = ${q}, because ${d} × ${q} = ${d * q}`,
		};
	}
	// Two steps: (a × b) − c.
	const a = int(rng, 3, 12);
	const b = int(rng, 3, 12);
	const c = int(rng, 1, a * b - 1);
	return {
		key: `m:two:${a}x${b}-${c}`,
		skill: "mixed",
		level,
		prompt: [num(a), op("×"), num(b), op("−"), num(c), op("="), blank],
		answer: { kind: "int", value: a * b - c },
		spoken: `${a} times ${b}, minus ${c}`,
		explain: `${a} × ${b} = ${a * b}, then ${a * b} − ${c} = ${a * b - c}`,
	};
}

const DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];

function genFractions(level: number, rng: Rng): Problem {
	if (level <= 1) {
		const d = pick(rng, DENOMS);
		const a = int(rng, 1, d - 1);
		let b = int(rng, 1, d - 1);
		if (rng() < 0.2) b = a;
		const value = a < b ? "<" : a > b ? ">" : "=";
		return {
			key: `m:fr:cmp:${a}/${d}?${b}/${d}`,
			skill: "fractions",
			level,
			prompt: [frac(a, d), { t: "choice" }, frac(b, d)],
			answer: { kind: "choice", value },
			spoken: `Which is bigger: ${sayFraction(a, d)} or ${sayFraction(b, d)}?`,
			explain: `Same-size pieces, so compare the tops: ${a} ${value} ${b}`,
			visual: {
				kind: "bars",
				parts: [
					{ n: a, d },
					{ n: b, d },
				],
			},
		};
	}
	if (level === 2) {
		const d = pick(rng, [2, 3, 4, 5]);
		const n = int(rng, 1, d - 1);
		const k = int(rng, 2, 4);
		return {
			key: `m:fr:eq:${n}/${d}=?/${d * k}`,
			skill: "fractions",
			level,
			prompt: [frac(n, d), op("="), { t: "frac", n: "?", d: String(d * k) }],
			answer: { kind: "int", value: n * k },
			spoken: `${sayFraction(n, d)} equals how many ${DENOM_WORD[d * k]?.[1] ?? `over ${d * k}`}?`,
			explain: `The bottom was multiplied by ${k}, so multiply the top by ${k} too: ${n} × ${k} = ${n * k}`,
			visual: {
				kind: "bars",
				parts: [
					{ n, d },
					{ n: n * k, d: d * k },
				],
			},
		};
	}
	if (level === 3) {
		let d = pick(rng, [2, 3, 4, 5]);
		let n = int(rng, 1, d - 1);
		const g = gcd(n, d);
		n /= g;
		d /= g;
		const k = int(rng, 2, 4);
		return {
			key: `m:fr:simp:${n * k}/${d * k}`,
			skill: "fractions",
			level,
			prompt: [frac(n * k, d * k), op("="), blank],
			answer: { kind: "frac", n, d, simplest: true },
			spoken: `Simplify ${sayFraction(n * k, d * k)}`,
			explain: `Divide top and bottom by ${k}: ${n * k}/${d * k} = ${n}/${d}`,
			visual: {
				kind: "bars",
				parts: [
					{ n: n * k, d: d * k },
					{ n, d },
				],
			},
		};
	}
	if (level === 4) {
		const d = pick(rng, [4, 5, 6, 8, 10, 12]);
		const a = int(rng, 1, d - 2);
		const b = int(rng, 1, d - 1 - a);
		return {
			key: `m:fr:add:${a}/${d}+${b}/${d}`,
			skill: "fractions",
			level,
			prompt: [frac(a, d), op("+"), frac(b, d), op("="), blank],
			answer: { kind: "frac", n: a + b, d },
			spoken: `${sayFraction(a, d)} plus ${sayFraction(b, d)}`,
			explain: `Same bottom, so add the tops: ${a} + ${b} = ${a + b}, giving ${a + b}/${d}`,
			visual: { kind: "bar", n: a + b, d },
		};
	}
	// Fraction of an amount.
	const d = pick(rng, [2, 3, 4, 5, 10]);
	const n = int(rng, 1, d - 1);
	const whole = d * int(rng, 2, 12);
	return {
		key: `m:fr:of:${n}/${d}of${whole}`,
		skill: "fractions",
		level,
		prompt: [frac(n, d), op("of"), num(whole), op("="), blank],
		answer: { kind: "int", value: (whole / d) * n },
		spoken: `${sayFraction(n, d)} of ${whole}`,
		explain: `${whole} ÷ ${d} = ${whole / d} in each part, and ${n} parts make ${(whole / d) * n}`,
		visual: { kind: "bar", n, d },
	};
}

const fixed = (x: number, p: number) => Number(x.toFixed(p));

function genDecimals(level: number, rng: Rng): Problem {
	if (level <= 2) {
		const d = level <= 1 ? 10 : 100;
		const n = int(rng, 1, d - 1);
		const places = d === 10 ? 1 : 2;
		return {
			key: `m:dec:f2d:${n}/${d}`,
			skill: "decimals",
			level,
			prompt: [frac(n, d), op("="), blank],
			answer: { kind: "dec", value: n / d, places },
			spoken: `Write ${sayFraction(n, d)} as a decimal`,
			explain: `${n} ${d === 10 ? "tenths" : "hundredths"} is ${(n / d).toFixed(places)}`,
			visual: d === 10 ? { kind: "bar", n, d } : undefined,
		};
	}
	if (level === 3) {
		const a = fixed(int(rng, 1, 9) / 10, 1);
		let b = fixed(int(rng, 1, 99) / 100, 2);
		if (rng() < 0.15) b = a;
		const value = a < b ? "<" : a > b ? ">" : "=";
		return {
			key: `m:dec:cmp:${a}?${b}`,
			skill: "decimals",
			level,
			prompt: [num(a.toFixed(1)), { t: "choice" }, num(b.toFixed(2))],
			answer: { kind: "choice", value },
			spoken: `Compare ${a} and ${b}`,
			explain: `Line up the places: ${a.toFixed(2)} ${value} ${b.toFixed(2)}`,
		};
	}
	if (level === 4) {
		const a = fixed(int(rng, 11, 89) / 10, 1);
		const b = fixed(int(rng, 11, 89) / 10, 1);
		return {
			key: `m:dec:add:${a}+${b}`,
			skill: "decimals",
			level,
			prompt: [num(a.toFixed(1)), op("+"), num(b.toFixed(1)), op("="), blank],
			answer: { kind: "dec", value: fixed(a + b, 1), places: 1 },
			spoken: `${a} plus ${b}`,
			explain: `Add the tenths, then the ones: ${a.toFixed(1)} + ${b.toFixed(1)} = ${(a + b).toFixed(1)}`,
		};
	}
	// Round to the nearest whole number.
	const x = fixed(int(rng, 101, 999) / 100, 2);
	return {
		key: `m:dec:round:${x}`,
		skill: "decimals",
		level,
		prompt: [num(x.toFixed(2)), op("="), blank],
		answer: { kind: "int", value: Math.round(x) },
		spoken: `Round ${x} to the nearest whole number`,
		explain: `Look at the tenths digit: ${x.toFixed(2)} rounds ${x - Math.floor(x) >= 0.5 ? "up" : "down"} to ${Math.round(x)}`,
	};
}

/** Generate one problem for a skill at a level (1–5). */
export function generate(skill: MathSkill, level: number, rng: Rng, opts: GenOptions = {}): Problem {
	const l = Math.max(1, Math.min(5, Math.round(level)));
	switch (skill) {
		case "mul":
			return genMul(l, rng, opts);
		case "div":
			return genDiv(l, rng, opts);
		case "addsub":
			return genAddSub(l, rng);
		case "mixed":
			return genMixed(l, rng);
		case "fractions":
			return genFractions(l, rng);
		case "decimals":
			return genDecimals(l, rng);
		case "problems":
			return wordProblem(l, rng);
	}
}
