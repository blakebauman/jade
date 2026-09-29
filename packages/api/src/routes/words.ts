import { zValidator } from "@hono/zod-validator";
import { normalizeWord, wordSchema } from "@jade/core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { getWordInfo } from "../lib/dictionary.ts";

export const wordRoutes = new Hono<AppEnv>()
	.get("/:word", async (c) => {
		const word = normalizeWord(c.req.param("word"));
		if (!wordSchema.safeParse(word).success) throw new HTTPException(400, { message: "Not a word" });
		c.header("Cache-Control", "private, max-age=86400");
		return c.json(await getWordInfo(c.var.db, c.env, word));
	})
	/** Warm the cache for a whole list (called after saving a list) so the first round has definitions ready. */
	.post("/batch", zValidator("json", z.object({ words: z.array(wordSchema).max(100) })), async (c) => {
		const words = [...new Set(c.req.valid("json").words.map(normalizeWord))];
		const out = [];
		// Small concurrency: the dictionary API is a free community service.
		for (let i = 0; i < words.length; i += 4) {
			out.push(...(await Promise.all(words.slice(i, i + 4).map((w) => getWordInfo(c.var.db, c.env, w)))));
		}
		return c.json(out);
	});
