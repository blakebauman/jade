/**
 * A word on its own die-cut vinyl label, set in the display face. Lists show their words this way everywhere outside a
 * round: a parent or a kid reads them here, and only handles letters as tiles in the round itself. `max` is the size
 * it was given as a tile edge, so the label stays in step with the space it sits in; `min` is kept for callers.
 */
export function WordRack({ word, max, dropDelay }: { word: string; max: number; min?: number; dropDelay?: number }) {
	return (
		<span
			className={`word-sticker max-w-full ${dropDelay !== undefined ? "animate-sticker-place" : ""}`}
			style={{ fontSize: Math.round(max * 0.72), animationDelay: dropDelay !== undefined ? `${dropDelay}ms` : undefined }}
		>
			{word}
		</span>
	);
}
