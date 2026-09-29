import { describe, expect, it } from "vitest";
import { parseCsv, wordsFromFile } from "./import.ts";

describe("parseCsv", () => {
	it("handles quotes, escaped quotes and CRLF", () => {
		expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\n')).toEqual([
			["a", "b, c", 'say "hi"'],
			["d", "e", "f"],
		]);
	});
});

describe("wordsFromFile", () => {
	it("reads word/sentence columns from a headed CSV", () => {
		const out = wordsFromFile('Word,Sentence\nFriend,"My friend, Sam, is here."\nfriend,dup\nrhythm,\n');
		expect(out).toEqual([
			{ word: "friend", sentence: "My friend, Sam, is here.", definition: null },
			{ word: "rhythm", sentence: null, definition: null },
		]);
	});
	it("falls back to a plain list", () => {
		expect(wordsFromFile("cat\ndog, bird").map((w) => w.word)).toEqual(["cat", "dog", "bird"]);
	});
});
