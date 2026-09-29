/** Letters a spelling word may contain besides a–z: apostrophes (don't) and hyphens (well-known). */
const ALLOWED = /[^a-z'-]/g;

/** Canonical comparison form: trimmed, lowercased, curly apostrophes straightened, stray characters dropped. */
export function normalizeWord(raw: string): string {
	return raw.trim().toLowerCase().replace(/[‘’ʼ]/g, "'").replace(ALLOWED, "");
}

/**
 * Split free text (a pasted list, a CSV column, OCR output) into unique words, preserving first-seen order.
 * Separators are newlines, commas, semicolons, tabs and runs of spaces. Numbering like "1." or "2)" is dropped.
 */
export function parseWordList(text: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const token of text.split(/[\n\r,;\t]+|\s{2,}|\s+(?=\d+[.)])/)) {
		const cleaned = token.replace(/^\s*\d+[.)]\s*/, "").trim();
		// A token with internal single spaces is two words ("cat dog"); keep hyphen/apostrophe words whole.
		for (const part of cleaned.split(/\s+/)) {
			const word = normalizeWord(part);
			if (word.length === 0 || !/[a-z]/.test(word) || seen.has(word)) continue;
			seen.add(word);
			out.push(word);
		}
	}
	return out;
}
