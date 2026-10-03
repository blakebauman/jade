import { type ReactNode, useEffect, useId, useRef } from "react";

/** Open Confirms, newest last: Escape backs out of the newest one only. */
const open: symbol[] = [];

/**
 * An in-place "are you sure?" on the board, replacing the browser's confirm() box. It isn't a modal: it appears where
 * the action was, takes focus on the safe choice, and Escape backs out.
 */
export function Confirm({
	message,
	note,
	confirmLabel,
	cancelLabel = "Cancel",
	onConfirm,
	choices,
	onCancel,
	busy,
	className = "",
}: {
	message: ReactNode;
	note?: ReactNode;
	cancelLabel?: string;
	onCancel: () => void;
	busy?: boolean;
	className?: string;
} & (
	| { confirmLabel: string; onConfirm: () => void; choices?: never }
	/** More than one way to say yes ("20 tickets", "20 stars"), each after the safe choice. */
	| { choices: { label: ReactNode; onChoose: () => void; key: string }[]; confirmLabel?: never; onConfirm?: never }
)) {
	const id = useId();
	const cancel = useRef<HTMLButtonElement>(null);
	// Latest callback without re-running the effect: callers pass a new function each render, and re-running would
	// pull focus back to Cancel on every unrelated re-render.
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;
	useEffect(() => {
		const me = Symbol();
		open.push(me);
		cancel.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && open.at(-1) === me) {
				e.preventDefault();
				onCancelRef.current();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			open.splice(open.indexOf(me), 1);
		};
	}, []);
	return (
		<div
			role="alertdialog"
			aria-labelledby={`${id}-msg`}
			aria-describedby={note ? `${id}-note` : undefined}
			className={`patch flex flex-wrap items-center justify-between gap-x-5 gap-y-3 p-4 ${className}`}
		>
			<div className="min-w-0 space-y-0.5">
				<p id={`${id}-msg`} className="font-display text-lg font-semibold">
					{message}
				</p>
				{note && (
					<p id={`${id}-note`} className="text-sm text-page-muted">
						{note}
					</p>
				)}
			</div>
			<div className="flex flex-wrap gap-2">
				<button ref={cancel} type="button" className="key" onClick={onCancel}>
					{cancelLabel}
				</button>
				{choices ? (
					choices.map((c) => (
						<button key={c.key} type="button" className="key" disabled={busy} onClick={c.onChoose}>
							{c.label}
						</button>
					))
				) : (
					<button type="button" className="key" disabled={busy} onClick={onConfirm}>
						{confirmLabel}
					</button>
				)}
			</div>
		</div>
	);
}
