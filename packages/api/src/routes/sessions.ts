import { zValidator } from "@hono/zod-validator";
import {
	type AttemptInput,
	advanceStreak,
	applyAnswer,
	attemptsBatchSchema,
	BADGES,
	normalizeWord,
	sessionFinishSchema,
	sessionStartSchema,
	starsForRound,
	starsForWord,
} from "@jade/core";
import { type Db, schema } from "@jade/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env.ts";
import { ownedChild, ownedList } from "../lib/owned.ts";

type Session = typeof schema.practiceSessions.$inferSelect;
type BadgeOut = { id: string; label: string; icon: string };

async function ownedSession(c: { var: AppEnv["Variables"] }, id: string) {
	const s = await c.var.db.query.practiceSessions.findFirst({ where: eq(schema.practiceSessions.id, id) });
	if (!s) throw new HTTPException(404, { message: "Session not found" });
	await ownedChild(c.var.db, c.var.userId, s.childId);
	return s;
}

/** Award any badge the child now qualifies for; returns the new ones and the updated list to store. */
function checkBadges(stats: {
	badgesJson: string;
	currentStreak: number;
	totalStars: number;
	perfectRounds: number;
	wordsSpelled: number;
}) {
	const had = new Set<string>(JSON.parse(stats.badgesJson || "[]"));
	const fresh: BadgeOut[] = BADGES.filter(
		(b) =>
			!had.has(b.id) &&
			b.earned({
				streak: stats.currentStreak,
				totalStars: stats.totalStars,
				perfectRounds: stats.perfectRounds,
				words: stats.wordsSpelled,
			}),
	).map(({ id, label, icon }) => ({ id, label, icon }));
	return { fresh, badgesJson: JSON.stringify([...had, ...fresh.map((b) => b.id)]) };
}

/**
 * Save answers as they happen. Each attempt is keyed by its client id, so a replay (offline queue retrying,
 * or the same answers re-sent with the finish) is ignored: only newly inserted attempts move Leitner boxes,
 * add stars and count toward the streak. This is what makes leaving mid-round safe.
 */
async function recordAttempts(db: Db, s: Session, attempts: AttemptInput[], at: number, day: string) {
	const scored = attempts.map((a) => ({ ...a, word: normalizeWord(a.word), stars: starsForWord(a) }));
	const inserted = new Set<string>();
	// 10 columns per row; keep each insert under D1's 100-parameter limit.
	for (let i = 0; i < scored.length; i += 9) {
		const rows = await db
			.insert(schema.attempts)
			.values(
				scored.slice(i, i + 9).map((a) => ({
					clientId: a.clientId,
					sessionId: s.id,
					word: a.word,
					typed: a.typed,
					correct: a.correct,
					tries: a.tries,
					hintsUsed: a.hintsUsed,
					replays: a.replays,
					ms: a.ms,
					stars: a.stars,
				})),
			)
			.onConflictDoNothing()
			.returning({ clientId: schema.attempts.clientId });
		for (const r of rows) inserted.add(r.clientId);
	}
	const fresh = scored.filter((a) => inserted.has(a.clientId));
	const before = await db.query.childStats.findFirst({ where: eq(schema.childStats.childId, s.childId) });
	if (fresh.length === 0) return { recorded: 0, streak: before?.currentStreak ?? 0, newBadges: [] as BadgeOut[] };

	// Learn mode is study, not a test: it doesn't move words between Leitner boxes.
	const progressWrites = [];
	if (s.mode !== "learn") {
		const words = [...new Set(fresh.map((a) => a.word))];
		const existing = await db.query.wordProgress.findMany({
			where: and(eq(schema.wordProgress.childId, s.childId), inArray(schema.wordProgress.word, words)),
		});
		const byWord = new Map(existing.map((p) => [p.word, p]));
		for (const a of fresh) {
			const prev = byWord.get(a.word);
			// First-try correctness drives SRS; a word only right on the retry still needs practice.
			const firstTry = a.correct && a.tries === 1;
			byWord.set(a.word, {
				...applyAnswer(prev, a.word, firstTry, at),
				childId: s.childId,
				misses: (prev?.misses ?? 0) + (firstTry ? 0 : 1),
			});
		}
		for (const w of words) {
			const p = byWord.get(w)!;
			progressWrites.push(
				db
					.insert(schema.wordProgress)
					.values(p)
					.onConflictDoUpdate({
						target: [schema.wordProgress.childId, schema.wordProgress.word],
						set: { box: p.box, dueAt: p.dueAt, streak: p.streak, lastSeen: p.lastSeen, misses: p.misses },
					}),
			);
		}
	}

	// Practicing at all today keeps the streak alive; finishing the round isn't required.
	const streak = advanceStreak(
		{ current: before?.currentStreak ?? 0, best: before?.bestStreak ?? 0, lastDay: before?.lastDay ?? null },
		day,
	);
	const addStars = fresh.reduce((n, a) => n + a.stars, 0);
	const addWords = fresh.filter((a) => a.correct).length;
	const { fresh: newBadges, badgesJson } = checkBadges({
		badgesJson: before?.badgesJson ?? "[]",
		currentStreak: streak.current,
		totalStars: (before?.totalStars ?? 0) + addStars,
		perfectRounds: before?.perfectRounds ?? 0,
		wordsSpelled: (before?.wordsSpelled ?? 0) + addWords,
	});
	const streakCols = { currentStreak: streak.current, bestStreak: streak.best, lastDay: streak.lastDay, badgesJson };
	await db.batch([
		db
			.insert(schema.childStats)
			.values({ childId: s.childId, ...streakCols, totalStars: addStars, wordsSpelled: addWords })
			.onConflictDoUpdate({
				target: schema.childStats.childId,
				// Increments in SQL so two requests landing together can't overwrite each other's totals.
				set: {
					...streakCols,
					totalStars: sql`${schema.childStats.totalStars} + ${addStars}`,
					wordsSpelled: sql`${schema.childStats.wordsSpelled} + ${addWords}`,
				},
			}),
		...progressWrites,
	]);
	return { recorded: fresh.length, streak: streak.current, newBadges };
}

export const sessionRoutes = new Hono<AppEnv>()
	/** Idempotent on the client-generated id, so a round started offline can be replayed safely. */
	.post("/", zValidator("json", sessionStartSchema), async (c) => {
		const input = c.req.valid("json");
		await ownedChild(c.var.db, c.var.userId, input.childId);
		if (input.listId) await ownedList(c.var.db, c.var.userId, input.listId);
		await c.var.db
			.insert(schema.practiceSessions)
			.values({ id: input.id, childId: input.childId, listId: input.listId, mode: input.mode, startedAt: new Date(input.startedAt) })
			.onConflictDoNothing();
		return c.json({ id: input.id }, 201);
	})
	.get("/:id", async (c) => {
		const s = await ownedSession(c, c.req.param("id"));
		const attempts = await c.var.db.query.attempts.findMany({
			where: eq(schema.attempts.sessionId, s.id),
			orderBy: asc(schema.attempts.clientId),
		});
		return c.json({ ...s, attempts });
	})
	/** Save one or more answers mid-round. */
	.post("/:id/attempts", zValidator("json", attemptsBatchSchema), async (c) => {
		const s = await ownedSession(c, c.req.param("id"));
		const { attempts, at, day } = c.req.valid("json");
		return c.json(await recordAttempts(c.var.db, s, attempts, at, day));
	})
	/**
	 * Close a round (finished, or stopped early). Any answers not yet saved are recorded first; the round's score
	 * comes from everything stored for the session. Replays return the stored summary without double-counting.
	 */
	.post("/:id/finish", zValidator("json", sessionFinishSchema), async (c) => {
		const s = await ownedSession(c, c.req.param("id"));
		const { attempts, finishedAt, day } = c.req.valid("json");
		const db = c.var.db;

		if (s.finishedAt) {
			const stats = await db.query.childStats.findFirst({ where: eq(schema.childStats.childId, s.childId) });
			return c.json({ correct: s.correct, total: s.total, stars: s.stars, streak: stats?.currentStreak ?? 0, newBadges: [] });
		}

		const recorded = attempts.length > 0 ? await recordAttempts(db, s, attempts, finishedAt, day) : { newBadges: [] as BadgeOut[] };
		const all = await db.query.attempts.findMany({ where: eq(schema.attempts.sessionId, s.id) });
		const correct = all.filter((a) => a.correct).length;
		const stars = starsForRound(all.map((a) => a.stars));
		const perfect = all.length > 0 && all.every((a) => a.stars === 3);

		const stats = await db.query.childStats.findFirst({ where: eq(schema.childStats.childId, s.childId) });
		const perfectRounds = (stats?.perfectRounds ?? 0) + (perfect ? 1 : 0);
		const { fresh, badgesJson } = checkBadges({
			badgesJson: stats?.badgesJson ?? "[]",
			currentStreak: stats?.currentStreak ?? 0,
			totalStars: stats?.totalStars ?? 0,
			perfectRounds,
			wordsSpelled: stats?.wordsSpelled ?? 0,
		});
		await db.batch([
			db
				.update(schema.practiceSessions)
				.set({ finishedAt: new Date(finishedAt), correct, total: all.length, stars })
				.where(eq(schema.practiceSessions.id, s.id)),
			db
				.insert(schema.childStats)
				.values({ childId: s.childId, perfectRounds, badgesJson })
				.onConflictDoUpdate({ target: schema.childStats.childId, set: { perfectRounds, badgesJson } }),
		]);

		return c.json({ correct, total: all.length, stars, streak: stats?.currentStreak ?? 0, newBadges: [...recorded.newBadges, ...fresh] });
	});
