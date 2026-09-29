import { parseWordList } from "@jade/core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env.ts";
import { parseJsonObject } from "../lib/dictionary.ts";
import { rateLimit } from "../middleware.ts";

const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const PROMPT =
	"This is a photo of a child's school spelling list or worksheet. Extract ONLY the spelling words the child must learn, " +
	"in the order they appear. Ignore titles, instructions, dates, names, numbering and example sentences. " +
	'Reply with JSON only: {"title": string | null, "words": string[]}.';

/**
 * Photo → candidate words. The image is processed in memory and never stored. Nothing is saved to a list here;
 * the parent reviews and edits the candidates first, then saves through the normal list endpoints.
 */
export const importRoutes = new Hono<AppEnv>().post("/ocr", rateLimit("ocr"), async (c) => {
	const form = await c.req.formData();
	const file = form.get("image");
	if (!(file instanceof File)) throw new HTTPException(400, { message: "Attach a photo" });
	if (file.size > MAX_BYTES) throw new HTTPException(413, { message: "Photo is too large (max 4 MB)" });
	if (!TYPES.has(file.type)) throw new HTTPException(415, { message: "Use a JPEG, PNG or WebP photo" });

	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	const dataUrl = `data:${file.type};base64,${btoa(binary)}`;

	const out = (await c.env.AI.run(
		VISION_MODEL as keyof AiModels,
		{
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: PROMPT },
						{ type: "image_url", image_url: { url: dataUrl } },
					],
				},
			],
			max_tokens: 800,
		} as never,
	)) as { response?: string | Record<string, unknown> };

	const body = typeof out.response === "string" ? parseJsonObject(out.response) : (out.response ?? null);
	const rawWords = Array.isArray(body?.words) ? (body.words as unknown[]).filter((w): w is string => typeof w === "string") : [];
	// Fall back to scraping the raw text if the model ignored the JSON instruction.
	const words =
		rawWords.length > 0 ? parseWordList(rawWords.join("\n")) : typeof out.response === "string" ? parseWordList(out.response) : [];
	return c.json({ title: typeof body?.title === "string" ? body.title : null, words: words.slice(0, 100) });
});
