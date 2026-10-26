import { CornerDownLeft, Delete, IndentDecrease, IndentIncrease } from "lucide-react";
import type { ReactNode } from "react";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** What a snippet's key says: the caret mark becomes a gap, so `forward(|)` reads "forward( )". */
export const snippetLabel = (s: string) => s.replace(/\|/g, " ").replace(/^ | $/g, (m) => (m === " " ? " " : m));

/**
 * The toolbox: this puzzle's commands and shapes as maple keys, the digits when numbers are needed, and the keys that
 * shape lines (new line, push in, pull out, delete). Everything a finger needs; nothing opens the iPad keyboard.
 * Buttons never take focus from the editor, so a laptop kid can mix typing and tapping.
 */
export function Toolbox({
	snippets,
	onSnippet,
	onNewline,
	onIndent,
	onOutdent,
	onDelete,
	disabled,
	compact,
	children,
}: {
	snippets: string[];
	onSnippet: (s: string) => void;
	onNewline: () => void;
	onIndent: () => void;
	onOutdent: () => void;
	onDelete: () => void;
	disabled?: boolean;
	compact?: boolean;
	/** The Run key and its friends, at the end of the shaping row. */
	children?: ReactNode;
}) {
	const words = snippets.filter((s) => s !== "0-9");
	const digits = snippets.includes("0-9");
	const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
	const size = compact ? "!min-h-10 !px-2.5 !text-base" : "!min-h-12 !px-3";
	return (
		<div className="flex flex-col gap-2" role="toolbar" aria-label="Toolbox">
			<div className="flex flex-wrap gap-2">
				{words.map((s) => (
					<button
						key={s}
						type="button"
						className={`key font-mono !font-semibold ${size}`}
						data-variant="tile"
						disabled={disabled}
						onPointerDown={keep}
						onMouseDown={keep}
						onClick={() => onSnippet(s)}
						aria-label={`Add ${s.replace(/\|/g, " ").trim()}`}
					>
						{snippetLabel(s)}
					</button>
				))}
			</div>
			{digits && (
				<div className="flex flex-wrap gap-1.5">
					{DIGITS.map((d) => (
						<button
							key={d}
							type="button"
							className={`key font-mono tabular-nums ${compact ? "!min-h-10 !min-w-10 !px-0" : "!min-h-11 !min-w-11 !px-0"}`}
							data-variant="tile"
							disabled={disabled}
							onPointerDown={keep}
							onMouseDown={keep}
							onClick={() => onSnippet(d)}
						>
							{d}
						</button>
					))}
				</div>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<Shape label="New line" onClick={onNewline} disabled={disabled} compact={compact}>
					<CornerDownLeft className="size-5" aria-hidden />
				</Shape>
				<Shape label="Push in" onClick={onIndent} disabled={disabled} compact={compact}>
					<IndentIncrease className="size-5" aria-hidden />
				</Shape>
				<Shape label="Pull out" onClick={onOutdent} disabled={disabled} compact={compact}>
					<IndentDecrease className="size-5" aria-hidden />
				</Shape>
				<Shape label="Delete" onClick={onDelete} disabled={disabled} compact={compact}>
					<Delete className="size-5" aria-hidden />
				</Shape>
				<span className="ml-auto flex flex-wrap items-center gap-2">{children}</span>
			</div>
		</div>
	);
}

function Shape({
	label,
	onClick,
	disabled,
	compact,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	compact?: boolean;
	children: ReactNode;
}) {
	const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
	return (
		<button
			type="button"
			className={`key ${compact ? "!min-h-10 !px-2.5" : "!min-h-12 !px-3"}`}
			disabled={disabled}
			onPointerDown={keep}
			onMouseDown={keep}
			onClick={onClick}
			aria-label={label}
			title={label}
		>
			{children}
			<span className="text-sm max-sm:sr-only">{label}</span>
		</button>
	);
}
