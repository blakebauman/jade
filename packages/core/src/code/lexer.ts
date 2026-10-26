import type { CodeError } from "./types.ts";

export type TokKind = "name" | "num" | "str" | "op" | "kw" | "newline" | "indent" | "dedent" | "eof";
export type Tok = { k: TokKind; v: string; line: number; col: number; end: number };

export const KEYWORDS = new Set([
	"for",
	"in",
	"if",
	"elif",
	"else",
	"while",
	"def",
	"return",
	"not",
	"and",
	"or",
	"True",
	"False",
	"None",
	"pass",
	"break",
	"continue",
]);
const OPS = ["==", "!=", "<=", ">=", "//", "+=", "-=", "*=", "(", ")", ":", ",", "=", "<", ">", "+", "-", "*", "%", "/"];

export class CodeProblem extends Error {
	constructor(readonly problem: CodeError) {
		super(problem.message);
	}
}
const fail = (e: CodeError): never => {
	throw new CodeProblem(e);
};

/** The indent of a line in spaces; a tab counts as four. */
export const indentOf = (line: string) => {
	let n = 0;
	for (const ch of line) {
		if (ch === " ") n++;
		else if (ch === "\t") n += 4;
		else break;
	}
	return n;
};

/**
 * Python-style tokens with INDENT/DEDENT. Unlike Python, a line may not run on inside brackets: a bracket left open
 * is a missing `)` on that line, which is how a kid's code goes wrong.
 */
export function tokenize(src: string): Tok[] {
	const out: Tok[] = [];
	const stack = [0];
	const lines = src.replace(/\r\n?/g, "\n").split("\n");
	lines.forEach((text, i) => {
		const line = i + 1;
		const body = text.trimStart();
		if (body === "" || body.startsWith("#")) return;
		const ind = indentOf(text);
		const lead = text.length - body.length;
		const top = stack[stack.length - 1]!;
		if (ind > top) {
			const prev = out[out.length - 1];
			// An indent is only right after a line that ends in a colon.
			if (prev?.k !== "newline" || out[out.length - 2]?.v !== ":") {
				// A loop or if above it that forgot its colon is the likelier mistake.
				const head = prev ? lines[prev.line - 1]! : "";
				if (/^\s*(for|while|if|elif|else|def)\b/.test(head))
					fail({ line: prev!.line, col: head.trimEnd().length, kind: "missing", message: `Line ${prev!.line} needs a : at the end.` });
				fail({ line, col: 0, end: lead, kind: "extra", message: `Line ${line} is pushed in, but nothing above it ends with a colon.` });
			}
			stack.push(ind);
			out.push({ k: "indent", v: "", line, col: 0, end: lead });
		} else if (ind < top) {
			while (stack[stack.length - 1]! > ind) {
				stack.pop();
				out.push({ k: "dedent", v: "", line, col: 0, end: lead });
			}
			if (stack[stack.length - 1] !== ind)
				fail({ line, col: 0, end: lead, kind: "extra", message: `Line ${line} doesn’t line up with the lines above it.` });
		}
		let depth = 0;
		let col = lead;
		while (col < text.length) {
			const ch = text[col]!;
			if (ch === " " || ch === "\t") {
				col++;
				continue;
			}
			if (ch === "#") break;
			const start = col;
			if (/[A-Za-z_]/.test(ch)) {
				while (col < text.length && /[A-Za-z0-9_]/.test(text[col]!)) col++;
				const v = text.slice(start, col);
				out.push({ k: KEYWORDS.has(v) ? "kw" : "name", v, line, col: start, end: col });
				continue;
			}
			if (/[0-9]/.test(ch)) {
				while (col < text.length && /[0-9]/.test(text[col]!)) col++;
				if (text[col] === ".")
					fail({ line, col, end: col + 1, kind: "extra", message: `Tuck only counts in whole numbers. Take out the dot on line ${line}.` });
				out.push({ k: "num", v: text.slice(start, col), line, col: start, end: col });
				continue;
			}
			if (ch === '"' || ch === "'") {
				const close = text.indexOf(ch, col + 1);
				if (close < 0) fail({ line, col: text.trimEnd().length, kind: "missing", message: `Line ${line} needs a ${ch} to end the words.` });
				out.push({ k: "str", v: text.slice(col + 1, close), line, col: start, end: close + 1 });
				col = close + 1;
				continue;
			}
			const op = OPS.find((o) => text.startsWith(o, col));
			if (!op) fail({ line, col, end: col + 1, kind: "extra", message: `Tuck doesn’t know what ${ch} means on line ${line}.` });
			if (op === "(") depth++;
			if (op === ")") {
				if (depth === 0) fail({ line, col, end: col + 1, kind: "extra", message: `There’s an extra ) on line ${line}.` });
				depth--;
			}
			out.push({ k: "op", v: op!, line, col: start, end: col + op!.length });
			col += op!.length;
		}
		if (depth > 0) fail({ line, col: text.trimEnd().length, kind: "missing", message: `Line ${line} needs a ) to close the (.` });
		out.push({ k: "newline", v: "", line, col: text.trimEnd().length, end: text.trimEnd().length });
	});
	const last = out[out.length - 1];
	const line = last ? last.line : 1;
	while (stack.length > 1) {
		stack.pop();
		out.push({ k: "dedent", v: "", line: line + 1, col: 0, end: 0 });
	}
	out.push({ k: "eof", v: "", line: line + 1, col: 0, end: 0 });
	return out;
}
