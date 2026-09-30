import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export type Law = "right" | "wrong" | "missing" | "extra";

const LAW_LABEL: Record<Law, string> = { right: "right", wrong: "wrong letter", missing: "missing letter", extra: "extra letter" };

/**
 * A maple letter tile. `law` colours the lower edge and adds a small corner mark, so feedback never
 * depends on colour alone. `size` is the tile edge in px; the letter scales with it.
 */
export function Tile({
	letter,
	law,
	size = 72,
	className,
	style,
	points,
	grain,
	children,
	...rest
}: {
	letter?: string;
	/** Wood-grain variant 0–3; defaults to one derived from the letter so neighbours rarely match. */
	grain?: number;
	law?: Law;
	size?: number;
	points?: string | number;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children">) {
	return (
		<span
			className={cn("tile shrink-0", className)}
			data-law={law}
			data-grain={grain ?? (letter ? (letter.charCodeAt(0) * 7) % 4 : 0)}
			style={{ width: size, height: size, fontSize: size * 0.56, lineHeight: 1, ...style }}
			{...(letter ? { role: "img", "aria-label": law ? `${letter}, ${LAW_LABEL[law]}` : letter } : {})}
			{...rest}
		>
			<span aria-hidden={!!letter}>{children ?? letter}</span>
			{points !== undefined && (
				<span
					aria-hidden
					className="absolute right-[10%] bottom-[14%] font-body font-semibold text-ink-soft"
					style={{ fontSize: size * 0.18 }}
				>
					{points}
				</span>
			)}
			{law && law !== "right" && <LawMark law={law} size={size} />}
		</span>
	);
}

function LawMark({ law, size }: { law: Law; size: number }) {
	const s = Math.max(12, size * 0.24);
	const fill = { wrong: "var(--color-coral)", missing: "var(--color-sky)", extra: "var(--color-stone)", right: "var(--color-marigold)" }[
		law
	];
	return (
		<svg aria-hidden width={s} height={s} viewBox="0 0 16 16" className="absolute -top-[6%] -right-[6%] drop-shadow-sm">
			<circle cx="8" cy="8" r="7.5" fill={fill} stroke="white" strokeWidth="1" />
			{law === "wrong" && <path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />}
			{law === "missing" && <path d="M8 4.8v6.4M4.8 8h6.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />}
			{law === "extra" && <path d="M4.8 8h6.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />}
		</svg>
	);
}

/** An empty square on the board. */
export function Square({ size = 72, className, active }: { size?: number; className?: string; active?: boolean }) {
	return (
		<span
			aria-hidden
			className={cn("square inline-block shrink-0", active && "ring-2 ring-felt-ink/70 ring-offset-2 ring-offset-felt", className)}
			style={{ width: size, height: size }}
		/>
	);
}

/** Five mastery pips (Leitner box 1–5). Same ramp everywhere: play, results, parent view. */
export function Pips({ box, className, label }: { box: number; className?: string; label?: string }) {
	return (
		<span
			className={cn("inline-flex items-center gap-[3px]", className)}
			role="img"
			aria-label={label ?? (box === 0 ? "New word" : `Mastery ${box} of 5`)}
		>
			{[1, 2, 3, 4, 5].map((i) => (
				<span key={i} className={cn("size-[9px] rounded-full", i <= box ? "bg-felt-ink" : "ring-[1.5px] ring-felt-muted ring-inset")} />
			))}
		</span>
	);
}

/** Render a whole word as a small tile rack (lists, results). */
export function WordTiles({
	word,
	size = 30,
	laws,
	className,
	dropDelay,
}: {
	word: string;
	size?: number;
	laws?: (Law | undefined)[];
	className?: string;
	/** Drop the tiles onto the board one after another, starting after this many ms (collapsed under reduced motion). */
	dropDelay?: number;
}) {
	return (
		<span className={cn("inline-flex gap-[3px]", className)} role="img" aria-label={word}>
			{[...word].map((c, i) => (
				<Tile
					key={`${i}-${c}`}
					letter={c}
					size={size}
					law={laws?.[i]}
					grain={(i + c.charCodeAt(0)) % 4}
					aria-hidden
					{...(dropDelay !== undefined && { className: "animate-tile-drop", style: { animationDelay: `${dropDelay + i * 40}ms` } })}
				/>
			))}
		</span>
	);
}
