import { zValidator } from "@hono/zod-validator";
import { listInputSchema, listPatchSchema, normalizeWord, replaceWordsSchema } from "@jade/core";
import { PACKS } from "@jade/core/packs";
import { type Db, schema } from "@jade/db";
import { and, asc, count, countDistinct, eq, gt, gte, inArray, isNotNull, lt, max, sql } from "drizzle-orm";
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
	const [list, words, kids] = await Promise.all([
		db.query.wordLists.findFirst({ where: eq(schema.wordLists.id, listId) }),
		db.query.listWords.findMany({ where: eq(schema.listWords.listId, listId), orderBy: asc(schema.listWords.position) }),
		db.query.listChildren.findMany({ where: eq(schema.listChildren.listId, listId) }),
	]);
	const { archivedAt, ...rest } = list!;
	return {
		...rest,
		archived: archivedAt !== null,
		childIds: kids.map((k) => k.childId),
		words: words.map((w) => ({ word: w.word, sentence: w.customSentence, definition: w.customDefinition })),
	};
}

/** Statements that set which kids a list is for, keeping only this parent's own kids. */
async function listChildrenStatements(db: Db, ownerId: string, listId: string, childIds: string[]) {
	const owned = childIds.length
		? await db
				.select({ id: schema.children.id })
				.from(schema.children)
				.where(and(eq(schema.children.parentId, ownerId), inArray(schema.children.id, childIds)))
		: [];
	return [
		db.delete(schema.listChildren).where(eq(schema.listChildren.listId, listId)),
		...(owned.length ? [db.insert(schema.listChildren).values(owned.map((k) => ({ listId, childId: k.id })))] : []),
	] as const;
}

async function createList(db: Db, ownerId: string, input: z.infer<typeof listInputSchema>) {
	const id = newId();
	const rows = prepareWords(id, input.words);
	const [, ...assign] = await listChildrenStatements(db, ownerId, id, input.childIds ?? []);
	await db.batch([
		db.insert(schema.wordLists).values({ id, ownerId, name: input.name, grade: input.grade, source: input.source }),
		...insertWordsStatements(db, rows),
		...assign,
	]);
	return listWithWords(db, id);
}

const PREVIEW_WORDS = 4;

export const listRoutes = new Hono<AppEnv>()
	.get("/", async (c) => {
		const rows = await c.var.db
			.select({
				id: schema.wordLists.id,
				name: schema.wordLists.name,
				grade: schema.wordLists.grade,
				source: schema.wordLists.source,
				updatedAt: schema.wordLists.updatedAt,
				archivedAt: schema.wordLists.archivedAt,
				wordCount: count(schema.listWords.word),
			})
			.from(schema.wordLists)
			.leftJoin(schema.listWords, eq(schema.listWords.listId, schema.wordLists.id))
			.where(eq(schema.wordLists.ownerId, c.var.userId))
			.groupBy(schema.wordLists.id)
			// Timestamps are whole seconds; insertion order (rowid) settles lists made in the same second.
			.orderBy(asc(schema.wordLists.createdAt), asc(sql`${schema.wordLists}.rowid`));
		const family = eq(schema.children.parentId, c.var.userId);
		const [firsts, played, mastered, assigned] = await Promise.all([
			// The first few words of each list, so the parent recognises it by its words as well as its name.
			c.var.db
				.select({ listId: schema.listWords.listId, word: schema.listWords.word })
				.from(schema.listWords)
				.innerJoin(schema.wordLists, eq(schema.wordLists.id, schema.listWords.listId))
				.where(and(eq(schema.wordLists.ownerId, c.var.userId), lt(schema.listWords.position, PREVIEW_WORDS)))
				.orderBy(asc(schema.listWords.position)),
			// When each of the family's kids last played a round of each list.
			c.var.db
				.select({
					listId: schema.practiceSessions.listId,
					childId: schema.practiceSessions.childId,
					at: max(schema.practiceSessions.startedAt),
				})
				.from(schema.practiceSessions)
				.innerJoin(schema.children, eq(schema.children.id, schema.practiceSessions.childId))
				.where(and(family, isNotNull(schema.practiceSessions.listId), gt(schema.practiceSessions.total, 0)))
				.groupBy(schema.practiceSessions.listId, schema.practiceSessions.childId),
			// How many of each list's words each kid has mastered (4+ pips).
			c.var.db
				.select({ listId: schema.listWords.listId, childId: schema.wordProgress.childId, n: countDistinct(schema.listWords.word) })
				.from(schema.listWords)
				.innerJoin(schema.wordLists, eq(schema.wordLists.id, schema.listWords.listId))
				.innerJoin(schema.wordProgress, eq(schema.wordProgress.word, schema.listWords.word))
				.innerJoin(schema.children, eq(schema.children.id, schema.wordProgress.childId))
				.where(and(eq(schema.wordLists.ownerId, c.var.userId), family, gte(schema.wordProgress.box, 4)))
				.groupBy(schema.listWords.listId, schema.wordProgress.childId),
			// Which kids each list is for (none: everyone).
			c.var.db
				.select({ listId: schema.listChildren.listId, childId: schema.listChildren.childId })
				.from(schema.listChildren)
				.innerJoin(schema.children, eq(schema.children.id, schema.listChildren.childId))
				.where(family),
		]);
		return c.json(
			rows.map(({ archivedAt, ...r }) => {
				const kidIds = [...new Set([...played, ...mastered].filter((x) => x.listId === r.id).map((x) => x.childId))];
				return {
					...r,
					archived: archivedAt !== null,
					childIds: assigned.filter((a) => a.listId === r.id).map((a) => a.childId),
					preview: firsts.filter((w) => w.listId === r.id).map((w) => w.word),
					// Per kid, so "8 of 12 mastered" is one child's own progress, never a sibling's.
					perChild: kidIds.map((childId) => ({
						childId,
						lastPlayedAt: played.find((p) => p.listId === r.id && p.childId === childId)?.at ?? null,
						mastered: mastered.find((m) => m.listId === r.id && m.childId === childId)?.n ?? 0,
					})),
				};
			}),
		);
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
	.patch("/:id", zValidator("json", listPatchSchema), async (c) => {
		const list = await ownedList(c.var.db, c.var.userId, c.req.param("id"));
		const { archived, childIds, ...details } = c.req.valid("json");
		const assign = childIds ? await listChildrenStatements(c.var.db, c.var.userId, list.id, childIds) : [];
		await c.var.db.batch([
			c.var.db
				.update(schema.wordLists)
				.set({
					...details,
					...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
					// Archiving isn't an edit: past lists keep their place in "newest first".
					...(archived === undefined && { updatedAt: new Date() }),
				})
				.where(eq(schema.wordLists.id, list.id)),
			...assign,
		]);
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
