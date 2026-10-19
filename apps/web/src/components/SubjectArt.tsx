import { Tile } from "@jade/ui/components/tile";

/**
 * Spelling's and Math's art: the round's own maple tiles, big, on the subject's hue. Spelling spells a word with one
 * tile checked right (marigold), Math sets a fact beside an empty answer square.
 */
export function SubjectArt({ hue, tiles, right, answer }: { hue: "spell" | "math"; tiles: string[]; right: number; answer?: boolean }) {
	// Sized from the shelf's tile, so the art scales with it.
	const k = hue === "spell" ? 0.125 : 0.2;
	const box = { width: `calc(var(--tile) * ${k})`, height: `calc(var(--tile) * ${k})`, fontSize: `calc(var(--tile) * ${k * 0.56})` };
	return (
		<span className={`absolute inset-0 grid place-items-center ${hue === "spell" ? "bg-spell" : "bg-math"}`}>
			<span className="flex items-center justify-center" style={{ gap: `calc(var(--tile) * ${hue === "spell" ? 0.018 : 0.03})` }}>
				{tiles.map((c, i) =>
					c === "×" ? (
						<span key="times" className="font-display font-semibold text-sticker-ink" style={{ fontSize: `calc(var(--tile) * 0.13)` }}>
							×
						</span>
					) : (
						<Tile key={`${c}-${i}`} letter={c} law={i === right ? "right" : undefined} grain={i % 4} style={box} />
					),
				)}
				{answer && <span className="rounded-[18%] bg-black/25 shadow-[inset_0_0.2em_0.4em_rgb(0_0_0/0.35)]" style={box} />}
			</span>
		</span>
	);
}
