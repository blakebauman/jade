/** Units of the Code subject, in the order they open. Each has its own adaptive level (1–5). */
export const CODE_SKILLS = ["seq", "args", "loops", "vars", "ifs", "funcs"] as const;
export type CodeSkill = (typeof CODE_SKILLS)[number];

export const SKILL_LABEL: Record<CodeSkill, string> = {
	seq: "Steps",
	args: "Numbers",
	loops: "Loops",
	vars: "Names",
	ifs: "Choices",
	funcs: "Recipes",
};

export const SKILL_HINT: Record<CodeSkill, string> = {
	seq: "Code runs from top to bottom",
	args: "Tell a command how many",
	loops: "Repeat lines with for",
	vars: "Keep numbers in names, and print",
	ifs: "Look around, then choose with if and while",
	funcs: "Make your own commands with def",
};

/** The turtle's name. Tuck is the code's own character, never Roxy. */
export const TURTLE = "Tuck";

/** 0 = up (north), 1 = right (east), 2 = down (south), 3 = left (west). `right()` adds one. */
export type Dir = 0 | 1 | 2 | 3;
export type Cell = { x: number; y: number };

/**
 * A garden, one character per square, rows top to bottom:
 * `.` grass · `#` hedge · `~` pond · `s` seed · `L` lantern · `b` flower bed · `F` flag · `o` chalk to draw over.
 */
export type Board = { rows: string[]; start: Cell & { dir: Dir } };

export type PuzzleKind = "build" | "fix" | "predict" | "draw" | "neat";

export type Puzzle = {
	/** `c:<skill>:<template>.<level>`: the Leitner key. Review rebuilds a sibling from it, not this exact garden. */
	key: string;
	skill: CodeSkill;
	level: number;
	kind: PuzzleKind;
	/** One sentence, printed and read aloud. */
	goal: string;
	/** Every garden the code must solve. Two gardens make a kid look around (if, while) instead of counting. */
	boards: Board[];
	/** The editor starts with this (the buggy program for "fix", the code to read for "predict"). */
	starter: string;
	/** A program that solves it; shown by "Show me". */
	solution: string;
	/** What the toolbox offers, as snippets (`|` marks where the caret lands). */
	toolbox: string[];
	/** Make it neat: solved in this many lines or fewer earns a sparkle. */
	neat?: number;
	/** What the printed lines must be (Names puzzles). */
	say?: string[];
	/** Predict: where Tuck ends up. */
	answer?: Cell;
	hint: string;
};

/** How a problem in the code is marked, in the colour laws' terms. */
export type MarkKind = "wrong" | "missing" | "extra";

/** A kid-friendly problem: `line` is 1-based, `col` 0-based; `end` closes the marked span on that line. */
export type CodeError = { line: number; col: number; end?: number; kind: MarkKind; message: string };

export type CodeEvent =
	| { t: "line"; line: number }
	| { t: "move"; to: Cell }
	| { t: "turn"; dir: Dir }
	| { t: "bump"; at: Cell; what: "hedge" | "pond" | "edge" }
	| { t: "pick"; at: Cell }
	| { t: "light"; at: Cell }
	| { t: "plant"; at: Cell }
	| { t: "pen"; down: boolean }
	| { t: "paint"; at: Cell }
	| { t: "say"; text: string };

/** What a run left behind on the board. */
export type Garden = {
	pos: Cell;
	dir: Dir;
	pen: boolean;
	/** Keys `x,y`. */
	picked: string[];
	lit: string[];
	planted: string[];
	painted: string[];
	said: string[];
};

export type RunResult = {
	events: CodeEvent[];
	end: Garden;
	/** A syntax or runtime problem; the run stopped there. */
	error?: CodeError;
	/** How many lines ran (statements executed). */
	steps: number;
};
