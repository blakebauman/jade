import { normalizeWord, parseWordList } from "@jade/core";
import type { ListWord } from "./api.ts";

/** Minimal RFC-4180-ish CSV: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i]!;
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else field += c;
	}
	if (field || row.length) rows.push([...row, field]);
	return rows.filter((r) => r.some((f) => f.trim()));
}

/**
 * A CSV with a header naming a "word" column (and optionally "sentence" / "definition") keeps those columns.
 * Anything else is treated as a plain list of words.
 */
export function wordsFromFile(text: string): ListWord[] {
	const rows = parseCsv(text);
	const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
	const wi = header.findIndex((h) => h === "word" || h === "words" || h === "spelling");
	if (wi >= 0) {
		const si = header.findIndex((h) => h.startsWith("sentence") || h === "example");
		const di = header.findIndex((h) => h.startsWith("definition") || h === "meaning");
		const seen = new Set<string>();
		return rows.slice(1).flatMap((r) => {
			const word = normalizeWord(r[wi] ?? "");
			if (!word || seen.has(word)) return [];
			seen.add(word);
			return [{ word, sentence: si >= 0 ? r[si]?.trim() || null : null, definition: di >= 0 ? r[di]?.trim() || null : null }];
		});
	}
	return parseWordList(text).map((word) => ({ word, sentence: null, definition: null }));
}

/** Downscale a photo to ≤1600px JPEG. Keeps uploads small and converts iPad HEIC photos, which Safari can decode. */
export async function preparePhoto(file: File): Promise<File> {
	const bitmap = await createImageBitmap(file).catch(() => null);
	if (!bitmap) return file;
	const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
	return blob ? new File([blob], "list.jpg", { type: "image/jpeg" }) : file;
}
