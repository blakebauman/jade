/** The code editor's model: lines and a caret. Pure, so the toolbox, the keyboard and the tests share it. */
export type Doc = { lines: string[]; line: number; col: number };

export const INDENT = "    ";

export const docOf = (src: string): Doc => {
	const lines = src.split("\n");
	return { lines, line: lines.length - 1, col: lines[lines.length - 1]!.length };
};
export const textOf = (d: Doc) => d.lines.join("\n");

const lead = (s: string) => s.length - s.trimStart().length;
const clamp = (d: Doc): Doc => {
	const line = Math.max(0, Math.min(d.line, d.lines.length - 1));
	return { ...d, line, col: Math.max(0, Math.min(d.col, d.lines[line]!.length)) };
};

/** Put the caret somewhere; it's kept inside the text. */
export const setCaret = (d: Doc, line: number, col: number) => clamp({ ...d, line, col });

/** A new line at the caret, indented like this one, one step more after a colon. */
export function newline(d: Doc): Doc {
	const cur = d.lines[d.line]!;
	const before = cur.slice(0, d.col);
	const after = cur.slice(d.col);
	let ind = " ".repeat(Math.min(lead(cur), d.col));
	if (before.trimEnd().endsWith(":")) ind += INDENT;
	const lines = [...d.lines];
	lines.splice(d.line, 1, before.trimEnd() === "" ? "" : before, ind + after.trimStart());
	return { lines, line: d.line + 1, col: ind.length };
}

/** Snippets that start a line of their own: tapping one on a line that already has code starts a new line. */
export const startsStatement = (s: string) =>
	/^(forward|left|right|pick|light|plant|pen_down|pen_up|print|for |while |if |elif |else:|def |return)/.test(s) ||
	// A recipe the kid made, but not a sense: those go inside an if or a while.
	(/^\w+\(\|?\)$/.test(s) && !/^(seed_here|lantern_here|bed_here|at_flag|path_ahead|str|abs)\(/.test(s));

/**
 * Insert typed text or a toolbox snippet. A `|` in a snippet is where the caret lands (any others are dropped). A
 * statement snippet on a line that already has code goes on a new line under it, indented to fit.
 */
export function insert(d: Doc, snippet: string, typed = false): Doc {
	let doc = d;
	if (!typed && startsStatement(snippet) && doc.lines[doc.line]!.trim() !== "") {
		doc = newline({ ...doc, col: doc.lines[doc.line]!.length });
		// else: lines up with its if, one step out.
		if (snippet.startsWith("else:") || snippet.startsWith("elif ")) doc = outdent(doc);
	}
	const at = typed ? -1 : snippet.indexOf("|");
	const text = typed ? snippet : snippet.replaceAll("|", "");
	const cur = doc.lines[doc.line]!;
	const lines = [...doc.lines];
	lines[doc.line] = cur.slice(0, doc.col) + text + cur.slice(doc.col);
	return { lines, line: doc.line, col: doc.col + (at < 0 ? text.length : at) };
}

/** Tokens the toolbox's delete takes away whole, so a finger never has to pick a word apart letter by letter. */
const TOKEN =
	/(\w+\([^()]*\)|for \w+ in range\(|while not |while |if |elif |else:|def |return |not |and |or |print\(|\w+\(\)|\w+\(|\w+|\d+| = | \+ | - | \* | \/\/ | == | < | > |, |"[^"]*"|.)$/;

/** Delete before the caret. `word` takes a whole token (the toolbox); otherwise one character (a keyboard). */
export function backspace(d: Doc, word = false): Doc {
	const cur = d.lines[d.line]!;
	if (d.col === 0) {
		if (d.line === 0) return d;
		const prev = d.lines[d.line - 1]!;
		const lines = [...d.lines];
		lines.splice(d.line - 1, 2, prev + cur.trimStart());
		return { lines, line: d.line - 1, col: prev.length };
	}
	const before = cur.slice(0, d.col);
	let n = 1;
	if (before.trim() === "") n = ((d.col - 1) % 4) + 1;
	else if (word) n = TOKEN.exec(before)?.[0].length ?? 1;
	const lines = [...d.lines];
	lines[d.line] = before.slice(0, -n) + cur.slice(d.col);
	return { lines, line: d.line, col: d.col - n };
}

/** Delete after the caret (the keyboard's Delete). */
export function deleteForward(d: Doc): Doc {
	const cur = d.lines[d.line]!;
	if (d.col < cur.length) {
		const lines = [...d.lines];
		lines[d.line] = cur.slice(0, d.col) + cur.slice(d.col + 1);
		return { ...d, lines };
	}
	if (d.line === d.lines.length - 1) return d;
	const lines = [...d.lines];
	lines.splice(d.line, 2, cur + d.lines[d.line + 1]!.trimStart());
	return { ...d, lines };
}

export function indent(d: Doc): Doc {
	const lines = [...d.lines];
	lines[d.line] = INDENT + lines[d.line]!;
	return { lines, line: d.line, col: d.col + INDENT.length };
}

export function outdent(d: Doc): Doc {
	const cur = d.lines[d.line]!;
	const n = Math.min(lead(cur), INDENT.length);
	if (n === 0) return d;
	const lines = [...d.lines];
	lines[d.line] = cur.slice(n);
	return { lines, line: d.line, col: Math.max(0, d.col - n) };
}

/** Move the caret with the arrow keys, Home and End. */
export function move(d: Doc, key: "left" | "right" | "up" | "down" | "home" | "end"): Doc {
	const cur = d.lines[d.line]!;
	switch (key) {
		case "left":
			return d.col > 0 ? { ...d, col: d.col - 1 } : d.line > 0 ? { ...d, line: d.line - 1, col: d.lines[d.line - 1]!.length } : d;
		case "right":
			return d.col < cur.length ? { ...d, col: d.col + 1 } : d.line < d.lines.length - 1 ? { ...d, line: d.line + 1, col: 0 } : d;
		case "up":
			return clamp({ ...d, line: d.line - 1 });
		case "down":
			return clamp({ ...d, line: d.line + 1 });
		case "home": {
			// The first press goes to the code, past the indent; a second to the very start.
			const l = lead(cur);
			return { ...d, col: d.col === l ? 0 : l };
		}
		case "end":
			return { ...d, col: cur.length };
	}
}

/** Swap a line with the one above or below (dragging a line on touch screens moves it a line at a time). */
export function moveLine(d: Doc, by: -1 | 1): Doc {
	const to = d.line + by;
	if (to < 0 || to >= d.lines.length) return d;
	const lines = [...d.lines];
	[lines[d.line], lines[to]] = [lines[to]!, lines[d.line]!];
	return clamp({ lines, line: to, col: d.col });
}
