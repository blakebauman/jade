import { Tile } from "@jade/ui/components/tile";

/**
 * The wordmark: "jade’s" set as tiles, the j a touch lifted like it was just placed, then "world" on a die-cut sticker
 * pressed onto the page beside them: the album's two materials, the tiles you handle and the stickers you collect.
 */
export function Brand({ size = 34 }: { size?: number }) {
	return (
		<span className="inline-flex items-end gap-1" role="img" aria-label="Jade's World">
			{["j", "a", "d", "e", "’s"].map((c, i) => (
				<Tile
					key={c}
					letter={c}
					size={size}
					aria-hidden
					style={i === 0 ? { transform: "translateY(-4px) rotate(-6deg)" } : c.length > 1 ? { fontSize: size * 0.46 } : undefined}
				/>
			))}
			<span
				aria-hidden
				className="sticker ml-2 font-display leading-none font-semibold text-page-ink"
				style={
					{
						"--tilt": "3deg",
						fontSize: size * 0.5,
						padding: `${size * 0.16}px ${size * 0.3}px ${size * 0.2}px`,
						borderWidth: Math.max(2, size * 0.09),
						borderRadius: size * 0.3,
						marginBottom: size * 0.08,
					} as React.CSSProperties
				}
			>
				world
			</span>
		</span>
	);
}
