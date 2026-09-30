import type { GradeResult } from "@jade/core";
import { type Law, Square, Tile } from "@jade/ui/components/tile";
import { type ReactNode, useRef } from "react";
import { useElementWidth } from "#/lib/hooks.ts";
import type { Phase } from "#/lib/round.ts";
import { rekey } from "./caret.ts";

/**
 * Tile edge and gap that fit `count` tiles on one line in `width` (gap = 10% of the tile). A word never wraps:
 * long words just get smaller tiles.
 */
export function fitTile(width: number, count: number, max = 88) {
	const n = Math.max(count, 1);
	const gapFor = (size: number) => Math.max(3, Math.round(size * 0.1));
	if (!width) return { size: Math.min(max, 64), gap: gapFor(Math.min(max, 64)) };
	let size = Math.min(max, Math.floor(width / (n + 0.1 * (n - 1))));
	// The gap is rounded (and has a 3px floor), so step down until the whole row really fits.
	while (size > 1 && n * size + (n - 1) * gapFor(size) > width) size--;
	return { size, gap: gapFor(size) };
}

type Cell = { key: string; letter?: string; law?: Law; empty?: boolean; active?: boolean };

function isJudged(phase: Phase, grade: GradeResult | null, typed: string) {
	// On retry the marks stay until the speller edits the row; then it goes back to plain tiles.
	return !!grade && (phase === "correct" || phase === "reveal" || (phase === "retry" && typed === grade.typed));
}

/** The visible row: typed tiles, then squares (all remaining when the length hint is on, else one caret square). */
function cellsFor(typed: string, keys: string[], target: string, phase: Phase, grade: GradeResult | null, showLength: boolean): Cell[] {
	if (grade && isJudged(phase, grade, typed)) {
		// After a check, render the alignment: a missing letter is an empty sky-edged square where it belongs.
		return grade.letters.map((m, i) => {
			if (m.mark === "missing") return { key: `m${i}`, empty: true, law: "missing" };
			const law: Law = m.mark === "ok" ? "right" : m.mark === "wrong" ? "wrong" : "extra";
			// On retry, right letters stay unmarked so marigold only ever confirms a finished word.
			return { key: `t${i}`, letter: m.typed, law: phase === "retry" && law === "right" ? undefined : law };
		});
	}
	const cells: Cell[] = [...typed].map((c, i) => ({ key: keys[i] ?? `t${i}`, letter: c }));
	const slots = showLength ? Math.max(target.length - typed.length, 0) : 1;
	for (let i = 0; i < slots; i++) cells.push({ key: `s${typed.length + i}`, empty: true, active: i === 0 });
	return cells;
}

export function AnswerRow({
	typed,
	target,
	phase,
	grade,
	showLength,
	checkNonce,
	onTileClick,
	caret,
	overlay,
	trailing,
	note,
}: {
	typed: string;
	target: string;
	phase: Phase;
	grade: GradeResult | null;
	showLength: boolean;
	/** Changes on every Check so the flip cascade replays. */
	checkNonce: number;
	onTileClick?: (index: number) => void;
	/** Where the next letter goes. Before the end, a chalk bar sits in that gap instead of the ringed square. */
	caret?: number;
	overlay?: ReactNode;
	/** The Check / Next key, at the right end of the row. */
	trailing?: ReactNode;
	/** A feedback note and the cell it points at. */
	note?: { index: number; text: string } | null;
}) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	// Keys follow the letters, so a letter put in mid-word drops in where it goes and the rest stay still.
	const keyed = useRef({ text: "", keys: [] as string[], n: 0 });
	if (keyed.current.text !== typed) {
		const k = keyed.current;
		let n = k.n;
		const keys = rekey(k.text, k.keys, typed, () => `t${++n}`);
		keyed.current = { text: typed, keys, n };
	}
	const cells = cellsFor(typed, keyed.current.keys, target, phase, grade, showLength);
	const judged = isJudged(phase, grade, typed);
	const editing = !judged && (phase === "spelling" || phase === "retry");
	const midCaret = editing && caret !== undefined && caret < typed.length ? caret : null;
	// Size for the longer of the word and what's on the row, so tiles don't jump size while typing.
	const { size, gap } = fitTile(width, Math.max(cells.length, showLength ? target.length : Math.max(target.length, 5)));
	const rowWidth = cells.length * size + (cells.length - 1) * gap;
	const rowLeft = width ? (width - rowWidth) / 2 : 0;
	const noteLeft = note && width ? (width - rowWidth) / 2 + note.index * (size + gap) + size / 2 : 0;

	return (
		<div className="flex w-full items-center gap-3 sm:gap-5">
			<div ref={ref} className="relative min-w-0 flex-1">
				<div
					className={`flex justify-center ${phase === "retry" && judged ? "animate-tile-nudge" : ""}`}
					style={{ gap, minHeight: size }}
					key={phase === "retry" ? `nudge-${checkNonce}` : "row"}
				>
					{cells.map((c, i) =>
						c.empty ? (
							c.law === "missing" ? (
								<span
									key={`${c.key}-${checkNonce}`}
									className="square grid shrink-0 place-items-center"
									style={{
										width: size,
										height: size,
										boxShadow: "inset 0 -0.3em 0 var(--color-sky), inset 0 0.2em 0.5em rgb(0 0 0 / 0.45)",
									}}
									role="img"
									aria-label="missing letter"
								/>
							) : (
								<Square key={c.key} size={size} active={c.active && editing && midCaret === null} />
							)
						) : (
							<Tile
								key={judged ? `${c.key}-${checkNonce}` : c.key}
								letter={c.letter}
								law={c.law}
								size={size}
								grain={i % 4}
								className={judged ? "animate-tile-flip" : "animate-tile-drop"}
								style={judged ? { animationDelay: `${i * 55}ms` } : undefined}
								data-typed-index={judged ? undefined : i}
								onClick={onTileClick ? () => onTileClick(i) : undefined}
							/>
						),
					)}
				</div>
				{midCaret !== null && (
					<span
						aria-hidden
						data-caret={midCaret}
						className="caret-bar pointer-events-none absolute"
						style={{
							left: rowLeft + midCaret * (size + gap) - gap / 2,
							top: size * 0.1,
							height: size * 0.8,
							width: Math.max(3, Math.round(size * 0.06)),
						}}
					/>
				)}
				{note && (
					<p
						className="pointer-events-none absolute top-full mt-3 -translate-x-1/2 rounded-lg bg-felt-deep px-3 py-1.5 text-center text-sm whitespace-nowrap shadow-md md:text-base"
						style={{ left: Math.max(80, Math.min(noteLeft, width - 80)) }}
						aria-live="polite"
					>
						<span aria-hidden className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-felt-deep" />
						<span className="relative">{note.text}</span>
					</p>
				)}
				{overlay}
			</div>
			{trailing}
		</div>
	);
}

/** The right spelling, dropping in tile by tile as the voice spells it. */
export function RevealRow({ word, shown }: { word: string; shown: number }) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const { size, gap } = fitTile(width, word.length, 80);
	return (
		<div ref={ref} className="w-full">
			<div className="flex justify-center" style={{ gap }} role="img" aria-label={`The spelling is ${[...word].join(" ")}`}>
				{[...word].map((c, i) =>
					i < shown ? (
						<Tile key={`r${i}`} letter={c} law="right" size={size} grain={i % 4} className="animate-tile-drop" aria-hidden />
					) : (
						<Square key={`r${i}`} size={size} />
					),
				)}
			</div>
		</div>
	);
}
