import { Tile } from "@jade/ui/components/tile";

/**
 * Spelling's and Math's art: a picture of a round, its maple tiles big on the subject's hue. No law colour: nothing has
 * been checked, so nothing is marked right or wrong outside a round.
 */
export function SubjectArt({ hue, tiles, answer }: { hue: "spell" | "math"; tiles: string[]; answer?: boolean }) {
	// Sized from the shelf's tile, so the art scales with it.
	const k = hue === "spell" ? 0.125 : 0.2;
	const box = { width: `calc(var(--tile) * ${k})`, height: `calc(var(--tile) * ${k})`, fontSize: `calc(var(--tile) * ${k * 0.56})` };
	return (
		<span aria-hidden className={`absolute inset-0 grid place-items-center ${hue === "spell" ? "bg-spell" : "bg-math"}`}>
			<span className="flex items-center justify-center" style={{ gap: `calc(var(--tile) * ${hue === "spell" ? 0.018 : 0.03})` }}>
				{tiles.map((c, i) =>
					c === "×" ? (
						<span key="times" className="font-display font-semibold text-sticker-ink" style={{ fontSize: `calc(var(--tile) * 0.13)` }}>
							×
						</span>
					) : (
						<Tile key={`${c}-${i}`} letter={c} grain={i % 4} style={box} />
					),
				)}
				{answer && <span className="rounded-[18%] bg-black/25 shadow-[inset_0_0.2em_0.4em_rgb(0_0_0/0.35)]" style={box} />}
			</span>
		</span>
	);
}
