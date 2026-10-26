import { CodeProblem, type Tok, tokenize } from "./lexer.ts";
import type { CodeError } from "./types.ts";

export type Expr =
	| { e: "num"; v: number }
	| { e: "str"; v: string }
	| { e: "bool"; v: boolean }
	| { e: "none" }
	| { e: "name"; v: string; col: number; end: number }
	| { e: "call"; fn: string; args: Expr[]; col: number; end: number }
	| { e: "bin"; op: string; a: Expr; b: Expr; col: number }
	| { e: "cmp"; op: string; a: Expr; b: Expr }
	| { e: "and" | "or"; a: Expr; b: Expr }
	| { e: "not"; a: Expr }
	| { e: "neg"; a: Expr };

export type Stmt = { line: number } & (
	| { s: "expr"; x: Expr }
	| { s: "assign"; name: string; op: string; x: Expr }
	| { s: "for"; v: string; args: Expr[]; body: Stmt[] }
	| { s: "while"; test: Expr; body: Stmt[] }
	| { s: "if"; test: Expr; body: Stmt[]; orelse: Stmt[] }
	| { s: "def"; name: string; params: string[]; body: Stmt[] }
	| { s: "return"; x: Expr | null }
	| { s: "pass" }
	| { s: "break" }
	| { s: "continue" }
);

const fail = (e: CodeError): never => {
	throw new CodeProblem(e);
};

/** Parse a program, or throw a CodeProblem saying, in kid words, what's missing, extra or wrong and where. */
export function parse(src: string): Stmt[] {
	const toks = tokenize(src);
	let i = 0;
	const peek = () => toks[i]!;
	const next = () => toks[i++]!;
	const is = (v: string, k?: Tok["k"]) => peek().v === v && (k ? peek().k === k : peek().k === "op" || peek().k === "kw");
	const lineEnd = (t: Tok) => {
		let j = i;
		while (toks[j] && toks[j]!.line === t.line && toks[j]!.k !== "newline") j++;
		return toks[j]?.col ?? t.end;
	};
	const expect = (v: string, what: string) => {
		const t = peek();
		if (t.v === v && (t.k === "op" || t.k === "kw")) return next();
		if (t.k === "newline" || t.k === "eof")
			return fail({ line: t.line, col: t.col, kind: "missing", message: `Line ${t.line} needs ${what} at the end.` });
		return fail({ line: t.line, col: t.col, end: t.end, kind: "missing", message: `Line ${t.line} needs ${what} before ${show(t)}.` });
	};
	const endLine = () => {
		const t = peek();
		if (t.k === "newline") return next();
		if (t.k === "eof") return t;
		return fail({
			line: t.line,
			col: t.col,
			end: lineEnd(t),
			kind: "extra",
			message: `Line ${t.line} has something extra at the end: ${show(t)}.`,
		});
	};

	function block(head: Tok): Stmt[] {
		expect(":", "a :");
		endLine();
		if (peek().k !== "indent") {
			const t = peek();
			return fail({
				line: t.k === "eof" ? head.line : t.line,
				col: 0,
				kind: "missing",
				message:
					t.k === "eof"
						? `Line ${head.line} ends with a colon, so the lines it runs go under it, pushed in.`
						: `Line ${t.line} needs to be pushed in, under line ${head.line}.`,
			});
		}
		next();
		const body: Stmt[] = [];
		while (peek().k !== "dedent" && peek().k !== "eof") body.push(...statement());
		if (peek().k === "dedent") next();
		return body;
	}

	function statement(): Stmt[] {
		const t = peek();
		const line = t.line;
		if (t.k === "kw") {
			switch (t.v) {
				case "for": {
					next();
					const v = next();
					if (v.k !== "name")
						return fail({
							line,
							col: v.col,
							end: v.end,
							kind: "missing",
							message: `Line ${line} needs a name after for, like for i in range(4):`,
						});
					expect("in", "in");
					const r = next();
					if (r.v !== "range")
						return fail({ line, col: r.col, end: r.end, kind: "wrong", message: `Tuck’s loops count with range, like for i in range(4):` });
					expect("(", "a (");
					const args = callArgs();
					if (args.length < 1 || args.length > 2)
						return fail({ line, col: r.col, end: r.end, kind: "wrong", message: `range on line ${line} takes one or two numbers.` });
					return [{ line, s: "for", v: v.v, args, body: block(t) }];
				}
				case "while": {
					next();
					const test = expr();
					return [{ line, s: "while", test, body: block(t) }];
				}
				case "if":
					return [ifChain()];
				case "elif":
				case "else":
					return fail({
						line,
						col: t.col,
						end: t.end,
						kind: "extra",
						message: `${t.v} on line ${line} needs an if just above it, lined up with it.`,
					});
				case "def": {
					next();
					const n = next();
					if (n.k !== "name")
						return fail({ line, col: n.col, end: n.end, kind: "missing", message: `Line ${line} needs a name for the recipe after def.` });
					expect("(", "a (");
					const params: string[] = [];
					while (!is(")")) {
						const p = next();
						if (p.k !== "name")
							return fail({ line, col: p.col, end: p.end, kind: "wrong", message: `The recipe’s inputs on line ${line} must be names.` });
						params.push(p.v);
						if (!is(")")) expect(",", "a ,");
					}
					next();
					return [{ line, s: "def", name: n.v, params, body: block(t) }];
				}
				case "return": {
					next();
					const x = peek().k === "newline" || peek().k === "eof" ? null : expr();
					endLine();
					return [{ line, s: "return", x }];
				}
				case "pass":
				case "break":
				case "continue":
					next();
					endLine();
					return [{ line, s: t.v } as Stmt];
			}
		}
		if (t.k === "indent")
			return fail({
				line,
				col: 0,
				end: t.end,
				kind: "extra",
				message: `Line ${line} is pushed in, but nothing above it ends with a colon.`,
			});
		if (t.k === "name" && toks[i + 1]?.k === "op" && ["=", "+=", "-=", "*="].includes(toks[i + 1]!.v)) {
			next();
			const op = next().v;
			const x = expr();
			endLine();
			return [{ line, s: "assign", name: t.v, op, x }];
		}
		const x = expr();
		if (is("=")) {
			const eq = peek();
			return fail({ line, col: eq.col, end: eq.end, kind: "wrong", message: `Only a name can go before = on line ${line}.` });
		}
		if (x.e === "name")
			return fail({
				line,
				col: x.col,
				end: x.end,
				kind: "missing",
				message: `${x.v} needs () after it to run, like ${x.v}().`,
			});
		endLine();
		return [{ line, s: "expr", x }];
	}

	function ifChain(): Stmt {
		const t = next();
		const test = expr();
		if (is("=")) {
			const eq = peek();
			fail({
				line: eq.line,
				col: eq.col,
				end: eq.end,
				kind: "wrong",
				message: `Use == to check if two things are the same, on line ${eq.line}.`,
			});
		}
		const body = block(t);
		let orelse: Stmt[] = [];
		if (is("elif", "kw")) orelse = [ifChain()];
		else if (is("else", "kw")) {
			const e = next();
			orelse = block(e);
		}
		return { line: t.line, s: "if", test, body, orelse };
	}

	function callArgs(): Expr[] {
		const args: Expr[] = [];
		while (!is(")")) {
			args.push(expr());
			if (!is(")")) expect(",", "a , between the inputs");
		}
		next();
		return args;
	}

	const CMP = ["==", "!=", "<", ">", "<=", ">="];
	function expr(): Expr {
		let a = andExpr();
		while (is("or", "kw")) {
			next();
			a = { e: "or", a, b: andExpr() };
		}
		return a;
	}
	function andExpr(): Expr {
		let a = notExpr();
		while (is("and", "kw")) {
			next();
			a = { e: "and", a, b: notExpr() };
		}
		return a;
	}
	function notExpr(): Expr {
		if (is("not", "kw")) {
			next();
			return { e: "not", a: notExpr() };
		}
		const a = sum();
		if (peek().k === "op" && CMP.includes(peek().v)) {
			const op = next().v;
			const b = sum();
			if (peek().k === "op" && CMP.includes(peek().v)) {
				const t = peek();
				fail({
					line: t.line,
					col: t.col,
					end: t.end,
					kind: "extra",
					message: `Tuck checks one thing at a time. Split up line ${t.line} with and.`,
				});
			}
			return { e: "cmp", op, a, b };
		}
		return a;
	}
	function sum(): Expr {
		let a = term();
		while (is("+") || is("-")) {
			const op = next();
			a = { e: "bin", op: op.v, a, b: term(), col: op.col };
		}
		return a;
	}
	function term(): Expr {
		let a = unary();
		while (is("*") || is("//") || is("%") || is("/")) {
			const op = next();
			if (op.v === "/")
				fail({
					line: op.line,
					col: op.col,
					end: op.end,
					kind: "wrong",
					message: `Tuck shares out whole numbers with //, not / (line ${op.line}).`,
				});
			a = { e: "bin", op: op.v, a, b: unary(), col: op.col };
		}
		return a;
	}
	function unary(): Expr {
		if (is("-")) {
			next();
			return { e: "neg", a: unary() };
		}
		return atom();
	}
	function atom(): Expr {
		const t = next();
		switch (t.k) {
			case "num":
				return { e: "num", v: Number(t.v) };
			case "str":
				return { e: "str", v: t.v };
			case "name":
				if (is("(")) {
					next();
					const args = callArgs();
					return { e: "call", fn: t.v, args, col: t.col, end: t.end };
				}
				return { e: "name", v: t.v, col: t.col, end: t.end };
			case "kw":
				if (t.v === "True" || t.v === "False") return { e: "bool", v: t.v === "True" };
				if (t.v === "None") return { e: "none" };
				break;
			case "op":
				if (t.v === "(") {
					const x = expr();
					expect(")", "a )");
					return x;
				}
				break;
			case "newline":
			case "eof":
				return fail({
					line: t.line,
					col: t.col,
					kind: "missing",
					message: `Line ${t.line} stops too soon. Something’s missing at the end.`,
				});
		}
		return fail({ line: t.line, col: t.col, end: t.end, kind: "extra", message: `${show(t)} can’t go there on line ${t.line}.` });
	}

	const body: Stmt[] = [];
	while (peek().k !== "eof") {
		if (peek().k === "newline") {
			next();
			continue;
		}
		body.push(...statement());
	}
	return body;
}

function show(t: Tok) {
	if (t.k === "str") return `"${t.v}"`;
	if (t.k === "newline" || t.k === "eof") return "the end of the line";
	return t.v;
}
