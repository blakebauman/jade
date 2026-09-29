import { Tile } from "@jade/ui/components/tile";

/** The wordmark: "jade" set as four tiles, the j a touch lifted like it was just placed. */
export function Brand({ size = 34 }: { size?: number }) {
	return (
		<span className="inline-flex items-end gap-1" role="img" aria-label="Jade Learning">
			{["j", "a", "d", "e"].map((c, i) => (
				<Tile key={c} letter={c} size={size} aria-hidden style={i === 0 ? { transform: "translateY(-4px) rotate(-6deg)" } : undefined} />
			))}
			<span aria-hidden className="ml-2 font-display font-medium text-felt-muted" style={{ fontSize: size * 0.55 }}>
				learning
			</span>
		</span>
	);
}
