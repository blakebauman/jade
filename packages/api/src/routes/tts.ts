import { zValidator } from "@hono/zod-validator";
import { ttsQuerySchema } from "@jade/core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env.ts";
import { sha256Hex } from "../lib/ids.ts";
import { enforceLimit } from "../middleware.ts";

const TTS_MODEL = "@cf/deepgram/aura-2-en";
/** Bump to invalidate every cached clip (e.g. after changing model or encoding). */
const CACHE_VERSION = "v1";

const audioHeaders = (etag: string) => ({
	"Content-Type": "audio/mpeg",
	// Audio for a given text+voice never changes, so the browser and the service worker can keep it forever.
	"Cache-Control": "private, max-age=31536000, immutable",
	ETag: `"${etag}"`,
});

export const ttsRoutes = new Hono<AppEnv>().get("/", zValidator("query", ttsQuerySchema), async (c) => {
	const { text, kind, voice } = c.req.valid("query");
	const hash = await sha256Hex(`${CACHE_VERSION}|${voice}|${kind}|${text.toLowerCase()}`);
	if (c.req.header("If-None-Match") === `"${hash}"`) return c.body(null, 304);

	const key = `tts/${voice}/${kind}/${hash}.mp3`;
	const hit = await c.env.AUDIO.get(key);
	if (hit) return new Response(hit.body, { headers: { ...audioHeaders(hash), "X-Audio-Cache": "hit" } });

	// Only cache misses spend Workers AI, so only they count against the limit.
	await enforceLimit(c, "tts");
	let audio: ArrayBuffer;
	try {
		const stream = (await c.env.AI.run(
			TTS_MODEL as keyof AiModels,
			{ text, speaker: voice, encoding: "mp3" } as never,
		)) as unknown as ReadableStream;
		audio = await new Response(stream).arrayBuffer();
	} catch (err) {
		console.error("tts failed", err);
		// The client falls back to the browser's speechSynthesis on any non-2xx.
		throw new HTTPException(502, { message: "Voice unavailable" });
	}
	if (audio.byteLength === 0) throw new HTTPException(502, { message: "Voice unavailable" });
	c.executionCtx.waitUntil(c.env.AUDIO.put(key, audio, { httpMetadata: { contentType: "audio/mpeg" }, customMetadata: { kind, voice } }));
	return new Response(audio, { headers: { ...audioHeaders(hash), "X-Audio-Cache": "miss" } });
});
