import { zValidator } from "@hono/zod-validator";
import { childSettingsSchema, TTS_KINDS, ttsQuerySchema, type VOICES } from "@jade/core";
import { schema } from "@jade/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { ApiBindings, AppEnv } from "../env.ts";
import { sha256Hex } from "../lib/ids.ts";
import { enforceLimit } from "../middleware.ts";

const TTS_MODEL = "@cf/deepgram/aura-2-en";
/** Bump to invalidate every cached clip (e.g. after changing model or encoding). */
const CACHE_VERSION = "v1";

type Kind = (typeof TTS_KINDS)[number];
type Voice = (typeof VOICES)[number];

const audioHeaders = (etag: string) => ({
	"Content-Type": "audio/mpeg",
	// Audio for a given text+voice never changes, so the browser and the service worker can keep it forever.
	"Cache-Control": "private, max-age=31536000, immutable",
	ETag: `"${etag}"`,
});

/** Cache identity for a clip. The client's `/api/tts?text&kind&voice` must hash to the same key the warmer fills. */
async function clipKey(text: string, kind: Kind, voice: Voice) {
	const hash = await sha256Hex(`${CACHE_VERSION}|${voice}|${kind}|${text.toLowerCase()}`);
	return { hash, key: `tts/${voice}/${kind}/${hash}.mp3` };
}

async function synthesize(env: ApiBindings, text: string, voice: Voice): Promise<ArrayBuffer> {
	const stream = (await env.AI.run(
		TTS_MODEL as keyof AiModels,
		{ text, speaker: voice, encoding: "mp3" } as never,
	)) as unknown as ReadableStream;
	const audio = await new Response(stream).arrayBuffer();
	if (audio.byteLength === 0) throw new Error("empty audio");
	return audio;
}

const storeClip = (env: ApiBindings, key: string, audio: ArrayBuffer, kind: Kind, voice: Voice) =>
	env.AUDIO.put(key, audio, { httpMetadata: { contentType: "audio/mpeg" }, customMetadata: { kind, voice } });

/** Pre-generate at most this many clips per warm request, keeping each request well inside Worker time limits. */
const WARM_BATCH = 12;
const WARM_CONCURRENCY = 4;

const warmSchema = z.object({
	items: z
		.array(z.object({ text: z.string().trim().min(1).max(300), kind: z.enum(TTS_KINDS) }))
		.min(1)
		.max(WARM_BATCH),
});

export const ttsRoutes = new Hono<AppEnv>()
	.get("/", zValidator("query", ttsQuerySchema), async (c) => {
		const { text, kind, voice } = c.req.valid("query");
		const { hash, key } = await clipKey(text, kind, voice);
		if (c.req.header("If-None-Match") === `"${hash}"`) return c.body(null, 304);

		const hit = await c.env.AUDIO.get(key);
		if (hit) return new Response(hit.body, { headers: { ...audioHeaders(hash), "X-Audio-Cache": "hit" } });

		// Only cache misses spend Workers AI, so only they count against the limit.
		await enforceLimit(c, "tts");
		let audio: ArrayBuffer;
		try {
			audio = await synthesize(c.env, text, voice);
		} catch (err) {
			console.error("tts failed", err);
			// The client falls back to the browser's speechSynthesis on any non-2xx.
			throw new HTTPException(502, { message: "Voice unavailable" });
		}
		c.executionCtx.waitUntil(storeClip(c.env, key, audio, kind, voice));
		return new Response(audio, { headers: { ...audioHeaders(hash), "X-Audio-Cache": "miss" } });
	})
	/**
	 * Pre-generate clips right after a list is saved, so a speller's first round plays each word instantly instead of
	 * waiting on the model. Generates for every voice this family's spellers use; skips clips already in R2.
	 * The client sends a list in small batches (see apps/web/src/lib/warm.ts).
	 */
	.post("/warm", zValidator("json", warmSchema), async (c) => {
		await enforceLimit(c, "tts-warm");
		const kids = await c.var.db.query.children.findMany({
			where: eq(schema.children.parentId, c.var.userId),
			columns: { settingsJson: true },
		});
		const voices = [...new Set(kids.map((k) => childSettingsSchema.parse(JSON.parse(k.settingsJson || "{}")).voice))];
		if (voices.length === 0) voices.push("luna");

		const jobs = c.req.valid("json").items.flatMap((it) => voices.map((voice) => ({ ...it, voice })));
		let generated = 0;
		let cached = 0;
		let failed = 0;
		const queue = [...jobs];
		await Promise.all(
			Array.from({ length: WARM_CONCURRENCY }, async () => {
				for (let job = queue.shift(); job; job = queue.shift()) {
					const { key } = await clipKey(job.text, job.kind, job.voice);
					if (await c.env.AUDIO.head(key)) {
						cached++;
						continue;
					}
					try {
						await storeClip(c.env, key, await synthesize(c.env, job.text, job.voice), job.kind, job.voice);
						generated++;
					} catch (err) {
						console.warn("tts warm failed", { text: job.text, err: String(err) });
						failed++;
					}
				}
			}),
		);
		return c.json({ generated, cached, failed, voices });
	});
