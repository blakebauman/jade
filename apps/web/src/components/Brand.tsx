import { Tile } from "@jade/ui/components/tile";

/** The wordmark: "jade’s" set as tiles, the j a touch lifted like it was just placed, then "world". */
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
			<span aria-hidden className="ml-2 font-display font-medium text-page-muted" style={{ fontSize: size * 0.55 }}>
				world
			</span>
		</span>
	);
}
