import { at, cellKey, cellsOf } from "./board.ts";
import { run } from "./interp.ts";
import { parse } from "./parser.ts";
import { type Board, type CodeError, type Puzzle, type RunResult, TURTLE } from "./types.ts";

export type BoardCheck = {
	run: RunResult;
	solved: boolean;
	/** Why it isn’t solved, when it ran to the end. */
	short?: string;
};
export type Verdict = {
	solved: boolean;
	/** One run per garden, in order; the screen replays them one after another. */
	boards: BoardCheck[];
	/** The first problem to show: a syntax or runtime error, or why the goal isn't met. */
	error?: CodeError;
	/** Lines of code, not counting blank lines and comments. */
	lines: number;
	/** Solved within the puzzle's neat line count. */
	neat: boolean;
};

export const codeLines = (src: string) => src.split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("#")).length;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Why a finished run leaves the garden unsolved, or null when it's solved. */
export function shortOf(board: Board, r: RunResult, say?: string[]): string | null {
	const g = r.end;
	const outline = cellsOf(board, "o").map(cellKey);
	if (outline.length > 0) {
		const extra = g.painted.filter((k) => !outline.includes(k)).length;
		const left = outline.filter((k) => !g.painted.includes(k)).length;
		if (extra > 0) return `${TURTLE} drew ${extra === 1 ? "a square" : `${extra} squares`} off the chalk line.`;
		if (left > 0) return `The chalk line isn’t finished yet: ${plural(left, "square")} still to draw.`;
	}
	const seeds = cellsOf(board, "s").length - g.picked.length;
	if (seeds > 0) return `${TURTLE} stopped, but ${seeds === 1 ? "a seed is" : `${seeds} seeds are`} still in the garden.`;
	const lanterns = cellsOf(board, "L").length - g.lit.length;
	if (lanterns > 0) return `${TURTLE} stopped, but ${lanterns === 1 ? "a lantern isn’t" : `${lanterns} lanterns aren’t`} lit yet.`;
	const beds = cellsOf(board, "b").length - g.planted.length;
	if (beds > 0) return `${TURTLE} stopped, but ${beds === 1 ? "a flower bed is" : `${beds} flower beds are`} still empty.`;
	if (cellsOf(board, "F").length > 0 && at(board, g.pos) !== "F") return `${TURTLE} stopped before reaching the flag.`;
	if (say) {
		if (g.said.length === 0) return `${TURTLE} didn’t say anything. Use print().`;
		if (g.said.join("\n") !== say.join("\n"))
			return `${TURTLE} said ${g.said.map((s) => `“${s}”`).join(", then ")}, but the goal is ${say.map((s) => `“${s}”`).join(", then ")}.`;
	}
	return null;
}

/** Run a kid's code in every garden of a puzzle and say whether it's solved, and if not, the first thing to fix. */
export function checkCode(puzzle: Pick<Puzzle, "boards" | "say" | "neat">, src: string): Verdict {
	const lines = codeLines(src);
	const boards: BoardCheck[] = [];
	let error: CodeError | undefined;
	const total = src.split("\n").length;
	for (const board of puzzle.boards) {
		const r = run(src, board);
		const short = r.error ? null : shortOf(board, r, puzzle.say);
		boards.push({ run: r, solved: !r.error && !short, short: short ?? undefined });
		if (!error && r.error) error = r.error;
		if (!error && short) {
			// Something's missing at the end of the program: a sky caret after the last line.
			const last = lastCodeLine(src) || total;
			error = { line: last, col: src.split("\n")[last - 1]?.length ?? 0, kind: "missing", message: short };
		}
		if (r.error) break;
	}
	const solved = boards.length === puzzle.boards.length && boards.every((b) => b.solved);
	return { solved, boards, error: solved ? undefined : error, lines, neat: solved && (!puzzle.neat || lines <= puzzle.neat) };
}

function lastCodeLine(src: string) {
	const ls = src.split("\n");
	for (let i = ls.length - 1; i >= 0; i--) if (ls[i]!.trim() !== "" && !ls[i]!.trim().startsWith("#")) return i + 1;
	return 0;
}

/** True when the code parses; for the editor's live "looks ready" state. */
export function parses(src: string) {
	try {
		parse(src);
		return true;
	} catch {
		return false;
	}
}
