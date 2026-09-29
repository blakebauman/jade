import type { Visual as V } from "@jade/core/math";

/** The picture that goes with the "how" after a miss: a dot array for facts, or fraction bars. */
export function Visual({ visual }: { visual: V }) {
	if (visual.kind === "array") {
		const cell = Math.max(8, Math.min(18, Math.floor(220 / Math.max(visual.rows, visual.cols))));
		return (
			<div
				className="inline-grid gap-1 rounded-xl bg-felt-deep/70 p-3"
				style={{ gridTemplateColumns: `repeat(${visual.cols}, ${cell}px)` }}
				role="img"
				aria-label={`${visual.rows} rows of ${visual.cols}`}
			>
				{Array.from({ length: visual.rows * visual.cols }, (_, i) => (
					<span key={i} className="maple rounded-full" style={{ width: cell, height: cell }} />
				))}
			</div>
		);
	}
	const bars = visual.kind === "bar" ? [{ n: visual.n, d: visual.d }] : visual.parts;
	return (
		<div className="flex w-full max-w-md flex-col gap-2">
			{bars.map((b, i) => (
				<div key={`${b.n}-${b.d}-${i}`} className="flex items-center gap-3">
					<div
						className="flex h-7 flex-1 overflow-hidden rounded-md ring-1 ring-felt-muted/60"
						role="img"
						aria-label={`${b.n} out of ${b.d} parts`}
					>
						{Array.from({ length: b.d }, (_, j) => (
							<span key={j} className={`flex-1 border-r border-felt-deep last:border-r-0 ${j < b.n ? "maple" : "bg-felt-deep/60"}`} />
						))}
					</div>
					<span className="w-14 text-right font-display text-lg tabular-nums">
						{b.n}/{b.d}
					</span>
				</div>
			))}
		</div>
	);
}
