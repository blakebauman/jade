import { api, type ListWord, type WordInfo } from "./api.ts";

type Item = { text: string; kind: "word" | "sentence" | "definition" };

/**
 * Get a saved list ready to play: fetch word info (definitions, sentences), then pre-generate the voice clips the
 * round will ask for. The text must match what the round screen sends to /api/tts exactly, or the cache misses:
 * the list's own sentence/definition wins over the dictionary's, same as in the round.
 *
 * Fire-and-forget. It keeps running after the editor navigates away, and failures only mean the first play is slower.
 */
export async function warmList(words: ListWord[]) {
	const slice = words.slice(0, 100);
	const infos = await api<WordInfo[]>("/api/words/batch", { method: "POST", json: { words: slice.map((w) => w.word) } }).catch(() => []);
	const byWord = new Map(infos.map((i) => [i.word, i]));

	const items: Item[] = [];
	for (const w of slice) {
		const info = byWord.get(w.word);
		items.push({ text: w.word, kind: "word" });
		const sentence = w.sentence ?? info?.sentence;
		const definition = w.definition ?? info?.definition;
		if (sentence) items.push({ text: sentence, kind: "sentence" });
		if (definition) items.push({ text: definition, kind: "definition" });
	}
	// Words first across the whole list, so the most-used clips are ready soonest.
	items.sort((a, b) => (a.kind === "word" ? 0 : 1) - (b.kind === "word" ? 0 : 1));

	for (let i = 0; i < items.length; i += 12) {
		try {
			await api("/api/tts/warm", { method: "POST", json: { items: items.slice(i, i + 12) } });
		} catch {
			return; // rate-limited or offline: the round still synthesizes on demand
		}
	}
}
