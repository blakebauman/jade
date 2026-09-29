import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { call, fakeAi, mp3Stream, signUp } from "./helpers.ts";

afterEach(() => vi.restoreAllMocks());

describe("health", () => {
	it("GET /health returns ok", async () => {
		const res = await call("/health");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});
});

describe("auth guard", () => {
	it("rejects API calls without a session", async () => {
		expect((await call("/api/children")).status).toBe(401);
	});
});

describe("children + lists", () => {
	it("creates a child and keeps parents isolated", async () => {
		const a = await signUp();
		const b = await signUp();
		const created = await call("/api/children", { method: "POST", cookie: a, json: { name: "Jade", avatar: "7", grade: 4 } });
		expect(created.status).toBe(201);
		const child = (await created.json()) as { id: string; settings: { showLength: boolean; font: string } };
		expect(child.settings).toMatchObject({ showLength: false, font: "fredoka" });

		expect(((await (await call("/api/children", { cookie: a })).json()) as unknown[]).length).toBe(1);
		expect(((await (await call("/api/children", { cookie: b })).json()) as unknown[]).length).toBe(0);
		expect((await call(`/api/children/${child.id}/progress`, { cookie: b })).status).toBe(404);
	});

	it("normalizes and de-duplicates list words, and copies packs", async () => {
		const cookie = await signUp();
		const res = await call("/api/lists", {
			method: "POST",
			cookie,
			json: {
				name: "Week 3",
				words: [{ word: "Friend" }, { word: "friend" }, { word: "Don’t" }, { word: "because", sentence: "I smiled because it was sunny." }],
			},
		});
		expect(res.status).toBe(201);
		const list = (await res.json()) as { id: string; words: { word: string; sentence: string | null }[] };
		expect(list.words.map((w) => w.word)).toEqual(["friend", "don't", "because"]);
		expect(list.words[2]?.sentence).toBe("I smiled because it was sunny.");

		// More than one D1 insert chunk (15 rows) survives the batch.
		const many = Array.from({ length: 40 }, (_, i) => ({
			word: `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
		}));
		const replaced = await call(`/api/lists/${list.id}/words`, { method: "PUT", cookie, json: { words: many } });
		expect(((await replaced.json()) as { words: unknown[] }).words).toHaveLength(40);

		const pack = await call("/api/lists/packs/dolch-third", { method: "POST", cookie });
		expect(pack.status).toBe(201);
		const lists = (await (await call("/api/lists", { cookie })).json()) as { wordCount: number; source: string }[];
		expect(lists.find((l) => l.source === "pack")?.wordCount).toBe(41);
	});
});

describe("practice rounds", () => {
	it("records a round once, updates SRS, stars, streak and badges", async () => {
		const cookie = await signUp();
		const child = (await (await call("/api/children", { method: "POST", cookie, json: { name: "Sam" } })).json()) as { id: string };
		const list = (await (
			await call("/api/lists", { method: "POST", cookie, json: { name: "L", words: [{ word: "cat" }, { word: "friend" }] } })
		).json()) as {
			id: string;
		};
		const sessionId = crypto.randomUUID();
		const start = { id: sessionId, childId: child.id, listId: list.id, mode: "bee", startedAt: Date.now() };
		expect((await call("/api/sessions", { method: "POST", cookie, json: start })).status).toBe(201);
		// Replayed start from the offline queue is harmless.
		expect((await call("/api/sessions", { method: "POST", cookie, json: start })).status).toBe(201);

		const finish = {
			finishedAt: Date.now(),
			day: "2026-09-28",
			attempts: [
				{ clientId: crypto.randomUUID(), word: "cat", typed: "cat", correct: true, tries: 1, hintsUsed: 0, replays: 0, ms: 3000 },
				{ clientId: crypto.randomUUID(), word: "friend", typed: "freind", correct: false, tries: 2, hintsUsed: 0, replays: 1, ms: 9000 },
			],
		};
		const res = await call(`/api/sessions/${sessionId}/finish`, { method: "POST", cookie, json: finish });
		const summary = (await res.json()) as { correct: number; total: number; stars: number; streak: number; newBadges: { id: string }[] };
		expect(summary).toMatchObject({ correct: 1, total: 2, streak: 1 });
		expect(summary.newBadges.map((b) => b.id)).toContain("first-round");

		const again = (await (await call(`/api/sessions/${sessionId}/finish`, { method: "POST", cookie, json: finish })).json()) as {
			newBadges: unknown[];
		};
		expect(again.newBadges).toEqual([]);

		const progress = (await (await call(`/api/children/${child.id}/progress`, { cookie })).json()) as {
			stats: { totalStars: number; wordsSpelled: number; currentStreak: number };
			reviewDue: string[];
			trouble: { word: string; misses: number }[];
		};
		expect(progress.stats).toMatchObject({ totalStars: 3, wordsSpelled: 1, currentStreak: 1 });
		expect(progress.reviewDue).toEqual(["friend"]);
		expect(progress.trouble).toEqual([{ word: "friend", misses: 1, box: 1 }]);
	});

	it("saves answers mid-round, ignores replays, and finishing doesn't double-count", async () => {
		const cookie = await signUp();
		const child = (await (await call("/api/children", { method: "POST", cookie, json: { name: "Mia" } })).json()) as { id: string };
		const sessionId = crypto.randomUUID();
		await call("/api/sessions", {
			method: "POST",
			cookie,
			json: { id: sessionId, childId: child.id, listId: null, mode: "review", startedAt: Date.now() },
		});

		const a1 = {
			clientId: crypto.randomUUID(),
			word: "receive",
			typed: "receive",
			correct: true,
			tries: 1,
			hintsUsed: 0,
			replays: 0,
			ms: 2000,
		};
		const a2 = {
			clientId: crypto.randomUUID(),
			word: "weird",
			typed: "wierd",
			correct: false,
			tries: 2,
			hintsUsed: 0,
			replays: 0,
			ms: 5000,
		};
		const save = (attempts: unknown[]) =>
			call(`/api/sessions/${sessionId}/attempts`, { method: "POST", cookie, json: { attempts, at: Date.now(), day: "2026-09-28" } });

		expect(await (await save([a1])).json()).toMatchObject({ recorded: 1, streak: 1 });
		// The child leaves here without finishing: progress is already saved.
		const mid = (await (await call(`/api/children/${child.id}/progress`, { cookie })).json()) as {
			stats: { totalStars: number; wordsSpelled: number; currentStreak: number };
			boxes: Record<string, number>;
		};
		expect(mid.stats).toMatchObject({ totalStars: 3, wordsSpelled: 1, currentStreak: 1 });
		expect(mid.boxes).toEqual({ receive: 2 });

		// Offline queue replays the same answer: ignored.
		expect(await (await save([a1])).json()).toMatchObject({ recorded: 0 });

		await save([a2]);
		// Finish re-sends everything (belt and braces); nothing is counted twice.
		const done = (await (
			await call(`/api/sessions/${sessionId}/finish`, {
				method: "POST",
				cookie,
				json: { attempts: [a1, a2], finishedAt: Date.now(), day: "2026-09-28" },
			})
		).json()) as { correct: number; total: number };
		expect(done).toMatchObject({ correct: 1, total: 2 });
		const after = (await (await call(`/api/children/${child.id}/progress`, { cookie })).json()) as {
			stats: { totalStars: number; wordsSpelled: number };
			trouble: { word: string; misses: number }[];
		};
		expect(after.stats).toMatchObject({ totalStars: 3, wordsSpelled: 1 });
		expect(after.trouble).toEqual([{ word: "weird", misses: 1, box: 1 }]);
	});

	it("refuses sessions for another parent's child", async () => {
		const a = await signUp();
		const b = await signUp();
		const child = (await (await call("/api/children", { method: "POST", cookie: a, json: { name: "Kid" } })).json()) as { id: string };
		const res = await call("/api/sessions", {
			method: "POST",
			cookie: b,
			json: { id: crypto.randomUUID(), childId: child.id, listId: null, mode: "review", startedAt: Date.now() },
		});
		expect(res.status).toBe(404);
	});
});

describe("tts", () => {
	it("synthesizes once, then serves from R2", async () => {
		const cookie = await signUp();
		const { ai, calls } = fakeAi({ "@cf/deepgram/aura-2-en": () => mp3Stream() });
		const first = await call("/api/tts?text=necessary&kind=word&voice=luna", { cookie }, ai);
		expect(first.status).toBe(200);
		expect(first.headers.get("Content-Type")).toBe("audio/mpeg");
		expect(first.headers.get("X-Audio-Cache")).toBe("miss");
		expect(new Uint8Array(await first.arrayBuffer()).length).toBe(4);

		const second = await call("/api/tts?text=necessary&kind=word&voice=luna", { cookie }, ai);
		expect(second.headers.get("X-Audio-Cache")).toBe("hit");
		await second.arrayBuffer();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toMatchObject({ text: "necessary", speaker: "luna", encoding: "mp3" });

		const etag = second.headers.get("ETag")!;
		expect((await call("/api/tts?text=necessary&kind=word&voice=luna", { cookie, headers: { "If-None-Match": etag } }, ai)).status).toBe(
			304,
		);
	});

	it("returns 502 when the voice model fails so the client can fall back", async () => {
		const cookie = await signUp();
		const { ai } = fakeAi({
			"@cf/deepgram/aura-2-en": () => {
				throw new Error("boom");
			},
		});
		expect((await call("/api/tts?text=rhythm", { cookie }, ai)).status).toBe(502);
	});
});

describe("words", () => {
	it("uses the dictionary, masks the word in definitions, and caches", async () => {
		const cookie = await signUp();
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json([
				{
					phonetic: "/fɹɛnd/",
					meanings: [
						{
							partOfSpeech: "noun",
							definitions: [{ definition: "A person you like; a friendly companion.", example: "she is my best friend" }],
						},
					],
				},
			]),
		);
		const res = await call("/api/words/Friend", { cookie });
		const info = (await res.json()) as { definition: string; sentence: string; partOfSpeech: string; syllables: string[] };
		expect(info.definition).toBe("A person you like; a this word companion.");
		expect(info.sentence).toBe("She is my best friend.");
		expect(info.partOfSpeech).toBe("noun");

		await call("/api/words/friend", { cookie });
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const row = await env.DB.prepare("select source from word_info where word = 'friend'").first<{ source: string }>();
		expect(row?.source).toBe("dictionaryapi.dev");
	});

	it("falls back to Workers AI for a sentence when the dictionary has none", async () => {
		const cookie = await signUp();
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
		const { ai } = fakeAi({
			"@cf/meta/llama-3.1-8b-instruct-fast": () => ({
				response: '{"definition":"a pattern of beats in music","partOfSpeech":"noun","sentence":"We clapped to the rhythm of the drum."}',
			}),
		});
		const info = (await (await call("/api/words/rhythm", { cookie }, ai)).json()) as { sentence: string; definition: string };
		expect(info.sentence).toBe("We clapped to the rhythm of the drum.");
		expect(info.definition).toBe("a pattern of beats in music");
	});
});

describe("ocr import", () => {
	it("extracts candidate words from a photo without saving anything", async () => {
		const cookie = await signUp();
		const { ai } = fakeAi({
			"@cf/meta/llama-4-scout-17b-16e-instruct": () => ({
				response: 'Here you go: {"title":"Week 5","words":["1. Receive","believe","Believe"]}',
			}),
		});
		const form = new FormData();
		form.set("image", new File([new Uint8Array([0xff, 0xd8, 0xff])], "list.jpg", { type: "image/jpeg" }));
		const res = await call("/api/import/ocr", { method: "POST", cookie, body: form }, ai);
		expect(await res.json()).toEqual({ title: "Week 5", words: ["receive", "believe"] });
	});
});

describe("parent pin", () => {
	it("sets and verifies a 4-digit pin", async () => {
		const cookie = await signUp();
		await call("/api/parent", { method: "PUT", cookie, json: { pin: "2468" } });
		expect(await (await call("/api/parent", { cookie })).json()).toMatchObject({ hasPin: true });
		expect(await (await call("/api/parent/verify-pin", { method: "POST", cookie, json: { pin: "1111" } })).json()).toEqual({ ok: false });
		expect(await (await call("/api/parent/verify-pin", { method: "POST", cookie, json: { pin: "2468" } })).json()).toEqual({ ok: true });
	});
});
