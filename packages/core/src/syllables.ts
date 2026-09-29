/**
 * Heuristic syllable split for display in Learn mode ("but·ter·fly"). Not linguistically perfect; parents can
 * override per word. Rules: split between vowel groups, VCCV → VC·CV (keeping common digraphs together),
 * VCV → V·CV, and a trailing consonant+"le" forms its own syllable.
 */
const VOWEL = /[aeiouy]/;
const DIGRAPHS = new Set(["ch", "sh", "th", "ph", "wh", "ck", "ng", "qu", "gh"]);

export function splitSyllables(word: string): string[] {
	const w = word.toLowerCase();
	if (w.length <= 3 || /[^a-z]/.test(w)) return [word];

	const isV = (i: number) => {
		const c = w[i]!;
		if (c === "y") return i > 0 && !VOWEL.test(w[i - 1]!);
		return VOWEL.test(c);
	};
	// Silent final "e" (not "-le") is not its own vowel group.
	const silentE = w.endsWith("e") && !w.endsWith("le") && w.length > 3;
	const end = silentE ? w.length - 1 : w.length;

	const groups: [number, number][] = [];
	for (let i = 0; i < end; ) {
		if (isV(i)) {
			let j = i;
			while (j + 1 < end && isV(j + 1)) j++;
			groups.push([i, j]);
			i = j + 1;
		} else i++;
	}
	if (groups.length <= 1) return [word];

	const cuts: number[] = [];
	for (let g = 0; g < groups.length - 1; g++) {
		const vEnd = groups[g]![1];
		const nextV = groups[g + 1]![0];
		const consonants = nextV - vEnd - 1;
		if (consonants === 0) cuts.push(vEnd + 1);
		else if (consonants === 1) cuts.push(vEnd + 1);
		else {
			const pair = w.slice(nextV - 2, nextV);
			// Consonant + "-le" ending forms its own syllable (lit·tle); a digraph stays with the next syllable (tea·cher).
			const isLe = w.slice(nextV - 1) === "le";
			cuts.push(isLe || DIGRAPHS.has(pair) ? nextV - 2 : vEnd + 2);
		}
	}

	const parts: string[] = [];
	let start = 0;
	for (const c of cuts) {
		if (c > start && c < w.length) {
			parts.push(word.slice(start, c));
			start = c;
		}
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
}
