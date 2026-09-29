import { zValidator } from "@hono/zod-validator";
import { listInputSchema, normalizeWord, replaceWordsSchema } from "@jade/core";
import { PACKS } from "@jade/core/packs";
import { type Db, schema } from "@jade/db";
import { asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { AppEnv } from "../env.ts";
import { newId } from "../lib/ids.ts";
import { ownedList } from "../lib/owned.ts";

type WordIn = z.infer<typeof replaceWordsSchema>["words"][number];

/** Normalize and de-duplicate, keeping the first occurrence's custom sentence/definition. */
function prepareWords(listId: string, words: WordIn[]) {
	const seen = new Set<string>();
	const rows: (typeof schema.listWords.$inferInsert)[] = [];
	for (const w of words) {
		const word = normalizeWord(w.word);
		if (!word || seen.has(word)) continue;
		seen.add(word);
		rows.push({ listId, position: rows.length, word, customSentence: w.sentence ?? null, customDefinition: w.definition ?? null });
	}
	return rows;
}

/** D1 caps bound parameters per statement (100); 5 columns × 15 rows stays under it. */
function insertWordsStatements(db: Db, rows: (typeof schema.listWords.$inferInsert)[]) {
	const out = [];
	for (let i = 0; i < rows.length; i += 15) out.push(db.insert(schema.listWords).values(rows.slice(i, i + 15)));
	return out;
}

async function listWithWords(db: Db, listId: string) {
	const [list, words] = await Promise.all([
		db.query.wordLists.findFirst({ where: eq(schema.wordLists.id, listId) }),
		db.query.listWords.findMany({ where: eq(schema.listWords.listId, listId), orderBy: asc(schema.listWords.position) }),
	]);
	return { ...list!, words: words.map((w) => ({ word: w.word, sentence: w.customSentence, definition: w.customDefinition })) };
}

async function createList(db: Db, ownerId: string, input: z.infer<typeof listInputSchema>) {
	const id = newId();
	const rows = prepareWords(id, input.words);
	await db.batch([
		db.insert(schema.wordLists).values({ id, ownerId, name: input.name, grade: input.grade, source: input.source }),
		...insertWordsStatements(db, rows),
	]);
	return listWithWords(db, id);
}

export const listRoutes = new Hono<AppEnv>()
	.get("/", async (c) => {
		const rows = await c.var.db
			.select({
				id: schema.wordLists.id,
				name: schema.wordLists.name,
				grade: schema.wordLists.grade,
				source: schema.wordLists.source,
				updatedAt: schema.wordLists.updatedAt,
				wordCount: count(schema.listWords.word),
			})
			.from(schema.wordLists)
			.leftJoin(schema.listWords, eq(schema.listWords.listId, schema.wordLists.id))
			.where(eq(schema.wordLists.ownerId, c.var.userId))
			.groupBy(schema.wordLists.id)
			.orderBy(asc(schema.wordLists.createdAt));
		return c.json(rows);
	})
	.get("/packs", (c) =>
		c.json(PACKS.map((p) => ({ id: p.id, name: p.name, grade: p.grade, wordCount: p.words.length, preview: p.words.slice(0, 8) }))),
	)
	.post("/packs/:packId", async (c) => {
		const pack = PACKS.find((p) => p.id === c.req.param("packId"));
		if (!pack) throw new HTTPException(404, { message: "Pack not found" });
		const list = await createList(c.var.db, c.var.userId, {
			name: pack.name,
			grade: pack.grade,
			source: "pack",
			words: pack.words.map((word) => ({ word })),
		});
		return c.json(list, 201);
	})
	.post("/", zValidator("json", listInputSchema), async (c) => c.json(await createList(c.var.db, c.var.userId, c.req.valid("json")), 201))
	.get("/:id", async (c) => {
		const list = await ownedList(c.var.db, c.var.userId, c.req.param("id"));
		return c.json(await listWithWords(c.var.db, list.id));
	})
	.patch("/:id", zValidator("json", listInputSchema.pick({ name: true, grade: true }).partial()), async (c) => {
		const list = await ownedList(c.var.db, c.var.userId, c.req.param("id"));
		await c.var.db
			.update(schema.wordLists)
			.set({ ...c.req.valid("json"), updatedAt: new Date() })
			.where(eq(schema.wordLists.id, list.id));
		return c.json(await listWithWords(c.var.db, list.id));
	})
	.put("/:id/words", zValidator("json", replaceWordsSchema), async (c) => {
		const list = await ownedList(c.var.db, c.var.userId, c.req.param("id"));
		const rows = prepareWords(list.id, c.req.valid("json").words);
		await c.var.db.batch([
			c.var.db.delete(schema.listWords).where(eq(schema.listWords.listId, list.id)),
			c.var.db.update(schema.wordLists).set({ updatedAt: new Date() }).where(eq(schema.wordLists.id, list.id)),
			...insertWordsStatements(c.var.db, rows),
		]);
		return c.json(await listWithWords(c.var.db, list.id));
	})
	.delete("/:id", async (c) => {
		const list = await ownedList(c.var.db, c.var.userId, c.req.param("id"));
		await c.var.db.delete(schema.wordLists).where(eq(schema.wordLists.id, list.id));
		return c.body(null, 204);
	});
