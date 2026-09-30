/**
 * The gap (0…n) nearest a tap at `x`, given the typed tiles' boxes left to right: 0 is before the first tile,
 * n after the last. A tap past the last tile's middle (over the squares, say) lands at the end.
 */
export function gapFromX(x: number, tiles: { left: number; right: number }[]): number {
	for (let i = 0; i < tiles.length; i++) {
		const t = tiles[i]!;
		if (x < (t.left + t.right) / 2) return i;
	}
	return tiles.length;
}

/**
 * Keys for the typed tiles that follow the letters, not their positions: an edit mid-word keeps the tiles
 * before and after it, and only the new letters get new keys (so only they drop in).
 */
export function rekey(prev: string, prevKeys: string[], next: string, fresh: () => string): string[] {
	let head = 0;
	while (head < prev.length && head < next.length && prev[head] === next[head]) head++;
	let tail = 0;
	while (tail < prev.length - head && tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;
	const middle = Array.from({ length: next.length - head - tail }, fresh);
	return [...prevKeys.slice(0, head), ...middle, ...prevKeys.slice(prevKeys.length - tail)];
}
