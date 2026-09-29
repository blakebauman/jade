import { Tile } from "@jade/ui/components/tile";
import { useElementWidth } from "#/lib/hooks.ts";
import { fitTile } from "./AnswerRow.tsx";

/** Tiles mode: the letters of the word plus a few decoys, scattered on the board below the answer row. */
export function TileBank({
	bank,
	used,
	onPick,
	disabled,
}: {
	bank: string[];
	used: number[];
	onPick: (i: number) => void;
	disabled?: boolean;
}) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const { size } = fitTile(width, Math.min(bank.length, 8), 72);
	const usedSet = new Set(used);
	return (
		<div ref={ref} className="w-full">
			<ul className="flex flex-wrap justify-center gap-2.5" aria-label="Letter tiles">
				{bank.map((c, i) => (
					<li key={`${c}-${i}`}>
						<button
							type="button"
							disabled={disabled || usedSet.has(i)}
							onClick={() => onPick(i)}
							aria-label={`Place ${c}`}
							className="rounded-[0.9rem] transition-opacity disabled:opacity-25"
							style={{ transform: `rotate(${((i * 37) % 9) - 4}deg)` }}
						>
							<Tile letter={c} size={size} grain={i % 4} aria-hidden />
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

const DECOYS: Record<string, string> = {
	a: "e",
	e: "i",
	i: "e",
	o: "u",
	u: "o",
	c: "k",
	k: "c",
	s: "c",
	m: "n",
	n: "m",
	b: "d",
	d: "b",
	f: "ph",
	y: "i",
};

/** Word letters + 2–3 plausible decoys (the letters kids actually confuse), shuffled. */
export function buildBank(word: string, seed: number): string[] {
	const letters = [...word];
	const decoys = new Set<string>();
	for (const c of letters) {
		const d = DECOYS[c];
		if (d && d.length === 1 && decoys.size < 3) decoys.add(d);
	}
	while (decoys.size < 2) decoys.add("aeioustrn"[(seed * 7 + decoys.size * 3) % 9]!);
	const all = [...letters, ...decoys];
	let r = Math.floor(seed * 233280);
	for (let i = all.length - 1; i > 0; i--) {
		r = (r * 9301 + 49297) % 233280;
		const j = Math.floor((r / 233280) * (i + 1));
		[all[i], all[j]] = [all[j]!, all[i]!];
	}
	return all;
}
