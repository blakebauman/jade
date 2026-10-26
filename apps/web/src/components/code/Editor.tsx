import { backspace, type CodeError, type Doc, deleteForward, indent, insert, move, newline, outdent, setCaret } from "@jade/core/code";
import { Minus, Plus, X } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";

type Law = "right" | "wrong" | "missing" | "extra";

export type EditorMarks = {
	/** The problem to show, from a run or the parser. */
	error?: CodeError | null;
	/** Every line worked: marigold edges all down the program. */
	solved?: boolean;
	/** The line running now on the board. */
	now?: number | null;
};

const LAW_OF: Record<CodeError["kind"], Law> = { wrong: "wrong", missing: "missing", extra: "extra" };
const LAW_WORD: Record<Law, string> = {
	right: "worked",
	wrong: "something's wrong",
	missing: "something's missing",
	extra: "something extra",
};

/**
 * The kid's program: one maple strip a line, pushed in as far as it's indented. A finger taps a spot to put the caret
 * there and builds with the toolbox; a keyboard types straight in. It never opens the on-screen keyboard.
 */
export function Editor({
	doc,
	onChange,
	readOnly,
	marks,
	onRun,
	compact,
}: {
	doc: Doc;
	onChange: (d: Doc) => void;
	readOnly?: boolean;
	marks: EditorMarks;
	onRun?: () => void;
	compact?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const err = marks.error;

	function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		if (readOnly) return;
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			onRun?.();
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const keys: Record<string, (d: Doc) => Doc> = {
			Enter: newline,
			Backspace: (d) => backspace(d),
			Delete: deleteForward,
			ArrowLeft: (d) => move(d, "left"),
			ArrowRight: (d) => move(d, "right"),
			ArrowUp: (d) => move(d, "up"),
			ArrowDown: (d) => move(d, "down"),
			Home: (d) => move(d, "home"),
			End: (d) => move(d, "end"),
		};
		if (e.key === "Tab") {
			// Esc, then Tab, leaves the editor; Tab inside it indents, as in any code editor.
			if (ref.current?.dataset.leaving) return;
			e.preventDefault();
			onChange(e.shiftKey ? outdent(doc) : indent(doc));
			return;
		}
		if (e.key === "Escape") {
			if (ref.current) ref.current.dataset.leaving = "1";
			return;
		}
		const fn = keys[e.key];
		if (fn) {
			e.preventDefault();
			onChange(fn(doc));
		} else if (e.key.length === 1) {
			e.preventDefault();
			onChange(insert(doc, e.key, true));
		}
	}

	/** Put the caret at the character nearest a tap. */
	function tapLine(line: number, e: React.MouseEvent<HTMLElement>) {
		if (readOnly) return;
		const t = (e.target as HTMLElement).closest<HTMLElement>("[data-col]");
		let col = doc.lines[line]!.length;
		if (t) {
			const r = t.getBoundingClientRect();
			col = Number(t.dataset.col) + (e.clientX > r.left + r.width / 2 ? 1 : 0);
		}
		onChange(setCaret(doc, line, col));
		ref.current?.focus({ preventScroll: true });
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: a custom code editor: a textarea would open the iPad keyboard.
		<div
			ref={ref}
			role="textbox"
			aria-multiline="true"
			aria-readonly={readOnly || undefined}
			aria-label={readOnly ? "The code to read" : "Your code. Type, or use the toolbox. Tab pushes a line in; Escape then Tab leaves."}
			tabIndex={0}
			onKeyDown={onKeyDown}
			onBlur={() => {
				if (ref.current) delete ref.current.dataset.leaving;
			}}
			className="code-rack outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-page-ink)]"
		>
			<ol className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
				{doc.lines.map((text, i) => {
					const n = i + 1;
					const ind = text.length - text.trimStart().length;
					const law: Law | undefined = marks.solved ? "right" : err?.line === n ? LAW_OF[err.kind] : undefined;
					const blank = text.trim() === "";
					const caretHere = !readOnly && doc.line === i;
					return (
						<li key={i} className="flex items-stretch gap-2">
							<span className="code-gutter w-6 shrink-0 select-none pt-2 text-right font-mono text-sm tabular-nums" aria-hidden>
								{n}
							</span>
							{/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a tap places the caret; the editor itself takes the keys. */}
							<div
								className="code-line flex min-w-0 flex-1 cursor-text items-center py-1.5 pr-3 font-mono text-[1.05rem] leading-6 whitespace-pre md:text-lg"
								style={{ marginLeft: `${ind * 0.55}rem`, paddingLeft: "0.6rem", opacity: blank && !caretHere ? 0.6 : 1 }}
								data-law={law}
								data-now={marks.now === n ? "" : undefined}
								onClick={(e) => tapLine(i, e)}
							>
								<span className="sr-only">{`Line ${n}: ${text.trim() || "empty"}${law && law !== "right" ? `, ${LAW_WORD[law]}` : ""}`}</span>
								<span className="relative inline-flex min-w-0 flex-wrap" aria-hidden>
									{[...text.slice(ind)].map((ch, k) => {
										const col = ind + k;
										const flagged = err?.line === n && err.end !== undefined && col >= err.col && col < err.end;
										return (
											<span
												key={col}
												data-col={col}
												className={`relative ${flagged ? "underline decoration-[3px] underline-offset-4" : ""}`}
												style={
													flagged
														? {
																textDecorationColor:
																	err.kind === "extra"
																		? "var(--color-stone)"
																		: err.kind === "missing"
																			? "var(--color-sky)"
																			: "var(--color-coral)",
															}
														: undefined
												}
											>
												{caretHere && doc.col === col && <Caret />}
												{ch}
											</span>
										);
									})}
									{caretHere && doc.col >= text.length && (
										<span className="relative inline-block w-2" data-col={text.length}>
											<Caret />
										</span>
									)}
									{err?.line === n && err.kind === "missing" && err.end === undefined && (
										<span className="ml-1 inline-flex items-center text-[var(--color-sky-deep)]">
											<Plus className="size-4" strokeWidth={3} />
										</span>
									)}
								</span>
								{law && law !== "right" && <Corner law={law} />}
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

function Caret() {
	return <span className="caret-bar absolute top-0 bottom-0 left-0 w-[2px]" style={{ background: "var(--color-ink)" }} />;
}

/** The corner mark every non-right law carries, so colour is never the only sign. */
function Corner({ law }: { law: "wrong" | "missing" | "extra" }) {
	const Icon = law === "wrong" ? X : law === "missing" ? Plus : Minus;
	const bg = law === "wrong" ? "var(--color-coral)" : law === "missing" ? "var(--color-sky)" : "var(--color-stone)";
	return (
		<span
			className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full text-white shadow"
			style={{ background: bg }}
			aria-hidden
		>
			<Icon className="size-3.5" strokeWidth={3.5} />
		</span>
	);
}
