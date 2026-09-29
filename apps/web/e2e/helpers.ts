import type { Page } from "@playwright/test";

/** 0.2s of silent 8-bit WAV so <audio> plays and fires `ended` without calling Workers AI. */
export function silentWav() {
	const n = 1600;
	const b = Buffer.alloc(44 + n, 128);
	b.write("RIFF", 0);
	b.writeUInt32LE(36 + n, 4);
	b.write("WAVEfmt ", 8);
	b.writeUInt32LE(16, 16);
	b.writeUInt16LE(1, 20);
	b.writeUInt16LE(1, 22);
	b.writeUInt32LE(8000, 24);
	b.writeUInt32LE(8000, 28);
	b.writeUInt16LE(1, 32);
	b.writeUInt16LE(8, 34);
	b.write("data", 36);
	b.writeUInt32LE(n, 40);
	return b;
}

/** Records every word the app actually played (<audio> loads; prefetches of the next word are fetches. WebKit reports <audio> as "other", Chromium as "media"). */
export async function stubVoice(page: Page) {
	const spoken: string[] = [];
	await page.route("**/api/tts?**", (route) => {
		const u = new URL(route.request().url());
		if (u.searchParams.get("kind") === "word" && route.request().resourceType() !== "fetch") spoken.push(u.searchParams.get("text")!);
		return route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() });
	});
	return spoken;
}

/** Deterministic word info so e2e never depends on the dictionary API or Workers AI. */
export async function stubWords(page: Page) {
	await page.route("**/api/words/**", (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/words/batch") return route.fulfill({ json: [] });
		const word = decodeURIComponent(url.pathname.split("/").pop()!);
		return route.fulfill({
			json: {
				word,
				definition: "a word your speller is practicing",
				partOfSpeech: "noun",
				sentence: `Please spell the word ${word} for me.`,
				origin: null,
				phonetic: null,
				syllables: [word],
			},
		});
	});
}

/**
 * Open the sign-in page and wait until it has settled (its session check has run). Tests then sign up with
 * page.request; on a slow runner, a still-pending session check would otherwise see the new cookie and redirect
 * to /profiles in the middle of the test's next navigation.
 */
export async function openLanding(page: Page) {
	await page.goto("/");
	await page.getByRole("heading", { name: "Hear it. Spell it. Solve it." }).waitFor();
}
