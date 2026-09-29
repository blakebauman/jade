import type { Problem, Token } from "@jade/core/math";
import { type Law, Square, Tile } from "@jade/ui/components/tile";
import { Fragment } from "react";
import { fitTile } from "#/components/round/AnswerRow.tsx";
import { useElementWidth } from "#/lib/hooks.ts";

const OP_LABEL: Record<string, string> = {
	"+": "plus",
	"−": "minus",
	"×": "times",
	"÷": "divided by",
	"=": "equals",
	"<": "is less than",
	">": "is greater than",
	of: "of",
};

/** Operators sit on the felt as chalk marks, not tiles: only numbers and the answer are things you handle. */
function OpMark({ v, size }: { v: string; size: number }) {
	return (
		<span
			className="grid shrink-0 place-items-center font-display font-semibold text-felt-ink"
			style={{ width: size * 0.62, height: size, fontSize: size * (v === "of" ? 0.38 : 0.6) }}
		>
			{v}
		</span>
	);
}

/**
 * Digits as tiles. `motion` matches the spelling row: typed tiles drop in, judged tiles flip in a left-to-right cascade
 * (the key includes the law so the flip replays on each check), and a revealed answer drops in one tile per beat.
 */
export function NumberTiles({ v, size, law, motion }: { v: string; size: number; law?: Law; motion?: "drop" | "flip" | "reveal" }) {
	return (
		<span className="flex shrink-0" style={{ gap: Math.max(2, size * 0.06) }}>
			{[...v].map((c, i) => (
				<Tile
					key={`${c}-${i}-${law ?? ""}`}
					letter={c}
					size={size}
					law={law}
					grain={(i + c.charCodeAt(0)) % 4}
					className={motion === "flip" ? "animate-tile-flip" : motion ? "animate-tile-drop" : undefined}
					style={
						motion === "flip" ? { animationDelay: `${i * 55}ms` } : motion === "reveal" ? { animationDelay: `${i * 140}ms` } : undefined
					}
					aria-hidden
				/>
			))}
		</span>
	);
}

/** Answer slot: typed characters as tiles plus a caret square while answering, so it's clear where the answer grows. */
function AnswerSlot({ typed, size, law }: { typed: string; size: number; law?: Law }) {
	if (!typed) return <Square size={size} active />;
	if (law) return <NumberTiles v={typed} size={size} law={law} motion="flip" />;
	return (
		<span className="flex shrink-0 items-center" style={{ gap: Math.max(2, size * 0.06) }}>
			<NumberTiles v={typed} size={size} motion="drop" />
			<Square size={size * 0.5} active />
		</span>
	);
}

/** A fraction: numerator tiles over a bar over denominator tiles. `?` numerator is the answer slot. */
function FracStack({ n, d, size, typed, law }: { n: string; d: string; size: number; typed: string; law?: Law }) {
	const s = size * 0.72;
	return (
		<span className="inline-flex shrink-0 flex-col items-center" style={{ gap: s * 0.12 }}>
			{n === "?" ? <AnswerSlot typed={typed} size={s} law={law} /> : <NumberTiles v={n} size={s} />}
			<span className="h-1 w-full min-w-8 rounded-full bg-felt-ink" />
			<NumberTiles v={d} size={s} />
		</span>
	);
}

export function tokensText(tokens: Token[], typed = "?"): string {
	return tokens
		.map((t) =>
			t.t === "num"
				? t.v
				: t.t === "op"
					? t.v
					: t.t === "frac"
						? `${t.n === "?" ? typed : t.n}/${t.d}`
						: t.t === "choice"
							? typed === "?"
								? "○"
								: typed
							: typed,
		)
		.join(" ");
}

/**
 * The problem laid out on the board. `law` colours the answer tiles after a check. Word problems have only a blank
 * (the story sits on a plaque above), so the answer slot stands alone.
 */
export function ProblemRow({ problem, typed, law }: { problem: Problem; typed: string; law?: Law }) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	// Size by total characters so long problems shrink rather than wrap.
	const chars = problem.prompt.reduce(
		(n, t) =>
			n +
			(t.t === "num"
				? t.v.length
				: t.t === "frac"
					? Math.max(t.n.length, t.d.length) * 0.75
					: t.t === "blank"
						? Math.max(2, typed.length)
						: 0.7),
		0,
	);
	const { size } = fitTile(width, Math.max(4, Math.ceil(chars + 1)), 84);
	return (
		<div ref={ref} className="w-full">
			<div
				className="flex items-center justify-center"
				style={{ gap: size * 0.12 }}
				role="img"
				aria-label={problem.prompt
					.map((t) =>
						t.t === "op" ? OP_LABEL[t.v] : t.t === "num" ? t.v : t.t === "frac" ? `${t.n === "?" ? "blank" : t.n} over ${t.d}` : "blank",
					)
					.join(" ")}
			>
				{problem.prompt.map((t, i) => (
					<Fragment key={`${t.t}-${i}`}>
						{t.t === "num" && <NumberTiles v={t.v} size={size} />}
						{t.t === "op" && <OpMark v={t.v} size={size} />}
						{t.t === "frac" && <FracStack n={t.n} d={t.d} size={size} typed={typed} law={t.n === "?" ? law : undefined} />}
						{t.t === "blank" && <AnswerSlot typed={typed} size={size} law={law} />}
						{t.t === "choice" &&
							(typed ? <NumberTiles v={typed} size={size} law={law} motion={law ? "flip" : "drop"} /> : <Square size={size} active />)}
					</Fragment>
				))}
			</div>
		</div>
	);
}
