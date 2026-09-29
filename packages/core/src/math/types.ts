/** Skills the engine generates. Each has its own adaptive level (1–5). */
export const MATH_SKILLS = ["mul", "div", "addsub", "mixed", "fractions", "decimals", "problems"] as const;
export type MathSkill = (typeof MATH_SKILLS)[number];

/** Topics a parent turns on; each maps to one or more skills. */
export const MATH_TOPICS = ["facts", "mental", "fractions", "problems"] as const;
export type MathTopic = (typeof MATH_TOPICS)[number];

export const TOPIC_SKILLS: Record<MathTopic, MathSkill[]> = {
	facts: ["mul", "div"],
	mental: ["addsub", "mixed"],
	fractions: ["fractions", "decimals"],
	problems: ["problems"],
};

export const TOPIC_LABEL: Record<MathTopic, string> = {
	facts: "Times tables",
	mental: "Mental math",
	fractions: "Fractions & decimals",
	problems: "Word problems",
};

export type Op = "+" | "−" | "×" | "÷" | "=" | "<" | ">" | "of";

/** What the problem row shows, left to right. `blank` is where the answer goes. */
export type Token =
	| { t: "num"; v: string }
	| { t: "op"; v: Op }
	| { t: "frac"; n: string; d: string }
	| { t: "blank" }
	/** A choice between symbols (<, =, >) — the answer sits between the two sides. */
	| { t: "choice" };

export type Answer =
	| { kind: "int"; value: number }
	| { kind: "dec"; value: number; places: number }
	/** `simplest`: only the fully reduced form counts (the task is "simplify"). */
	| { kind: "frac"; n: number; d: number; simplest?: boolean }
	| { kind: "choice"; value: "<" | "=" | ">" };

export type Visual =
	| { kind: "array"; rows: number; cols: number }
	| { kind: "bar"; n: number; d: number }
	| { kind: "bars"; parts: { n: number; d: number }[] };

export type Problem = {
	/** Stable identity. Repeatable facts (`m:mul:`, `m:div:`) are tracked for Leitner review; one-offs aren't. */
	key: string;
	skill: MathSkill;
	level: number;
	prompt: Token[];
	answer: Answer;
	/** Read aloud by the voice. */
	spoken: string;
	/** Word problems: the story, shown on a plaque. */
	text?: string;
	/** The "how" shown after a miss. */
	explain: string;
	visual?: Visual;
};

/** Which keypad keys a problem needs beyond 0–9. */
export function keysFor(answer: Answer): ("/" | "." | "<" | "=" | ">")[] {
	if (answer.kind === "frac") return ["/"];
	if (answer.kind === "dec") return ["."];
	if (answer.kind === "choice") return ["<", "=", ">"];
	return [];
}

export const answerText = (a: Answer): string =>
	a.kind === "int"
		? String(a.value)
		: a.kind === "dec"
			? a.value.toFixed(a.places)
			: a.kind === "frac"
				? a.d === 1
					? String(a.n)
					: `${a.n}/${a.d}`
				: a.value;

/** Facts repeat and are worth spacing out; generated one-off problems aren't. */
export const isTrackedFact = (key: string) => key.startsWith("m:mul:") || key.startsWith("m:div:");
