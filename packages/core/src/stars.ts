/** Stars for one word. Correct first try with no help = 3, with a hint/replay-slow = 2, after a retry = 1, missed = 0. */
export function starsForWord(a: { correct: boolean; tries: number; hintsUsed: number }): 0 | 1 | 2 | 3 {
	if (!a.correct) return 0;
	if (a.tries > 1) return 1;
	if (a.hintsUsed > 0) return 2;
	return 3;
}

/**
 * Round stars (0–3) from the average per-word stars. Any finished round earns one star (effort counts);
 * two needs mostly-right spelling, three needs nearly all words right without help.
 */
export function starsForRound(perWord: number[]): 0 | 1 | 2 | 3 {
	if (perWord.length === 0) return 0;
	const avg = perWord.reduce((s, x) => s + x, 0) / perWord.length;
	return avg >= 2.5 ? 3 : avg >= 1.9 ? 2 : 1;
}
