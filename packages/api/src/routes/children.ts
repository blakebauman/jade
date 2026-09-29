import { zValidator } from "@hono/zod-validator";
import { BADGES, buildReviewRound, childInputSchema, childSettingsSchema, DEFAULT_SETTINGS } from "@jade/core";
import { schema } from "@jade/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { newId } from "../lib/ids.ts";
import { ownedChild } from "../lib/owned.ts";

function present(row: typeof schema.children.$inferSelect) {
	const parsed = childSettingsSchema.safeParse(JSON.parse(row.settingsJson || "{}"));
	return { id: row.id, name: row.name, avatar: row.avatar, grade: row.grade, settings: parsed.success ? parsed.data : DEFAULT_SETTINGS };
}

export const childrenRoutes = new Hono<AppEnv>()
	.get("/", async (c) => {
		const rows = await c.var.db.query.children.findMany({
			where: eq(schema.children.parentId, c.var.userId),
			orderBy: schema.children.createdAt,
		});
		return c.json(rows.map(present));
	})
	.post("/", zValidator("json", childInputSchema), async (c) => {
		const input = c.req.valid("json");
		const id = newId();
		const settings = childSettingsSchema.parse({ ...input.settings });
		await c.var.db.batch([
			c.var.db.insert(schema.children).values({
				id,
				parentId: c.var.userId,
				name: input.name,
				avatar: input.avatar,
				grade: input.grade,
				settingsJson: JSON.stringify(settings),
			}),
			c.var.db.insert(schema.childStats).values({ childId: id }),
		]);
		return c.json(present((await ownedChild(c.var.db, c.var.userId, id))!), 201);
	})
	.patch("/:id", zValidator("json", childInputSchema.partial()), async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id"));
		const input = c.req.valid("json");
		const settings = input.settings ? childSettingsSchema.parse({ ...present(child).settings, ...input.settings }) : undefined;
		await c.var.db
			.update(schema.children)
			.set({
				name: input.name,
				avatar: input.avatar,
				grade: input.grade,
				settingsJson: settings ? JSON.stringify(settings) : undefined,
			})
			.where(eq(schema.children.id, child.id));
		return c.json(present(await ownedChild(c.var.db, c.var.userId, child.id)));
	})
	.delete("/:id", async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id"));
		await c.var.db.delete(schema.children).where(eq(schema.children.id, child.id));
		return c.body(null, 204);
	})
	.get("/:id/progress", async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id"));
		const now = Date.now();
		const [stats, progress, recent] = await Promise.all([
			c.var.db.query.childStats.findFirst({ where: eq(schema.childStats.childId, child.id) }),
			c.var.db.query.wordProgress.findMany({ where: eq(schema.wordProgress.childId, child.id) }),
			c.var.db.query.practiceSessions.findMany({
				where: and(eq(schema.practiceSessions.childId, child.id), gt(schema.practiceSessions.total, 0)),
				orderBy: desc(schema.practiceSessions.startedAt),
				limit: 20,
			}),
		]);
		const earned = new Set<string>(JSON.parse(stats?.badgesJson ?? "[]"));
		return c.json({
			child: present(child),
			stats: {
				currentStreak: stats?.currentStreak ?? 0,
				bestStreak: stats?.bestStreak ?? 0,
				lastDay: stats?.lastDay ?? null,
				totalStars: stats?.totalStars ?? 0,
				wordsSpelled: stats?.wordsSpelled ?? 0,
			},
			badges: BADGES.map(({ id, label, icon }) => ({ id, label, icon, earned: earned.has(id) })),
			reviewDue: buildReviewRound(progress, now, 20),
			mastered: progress.filter((p) => p.box >= 4).length,
			/** Leitner box per practiced word, for the five-pip mastery ramp. */
			boxes: Object.fromEntries(progress.map((p) => [p.word, p.box])),
			trouble: progress
				.filter((p) => p.misses > 0)
				.sort((a, b) => b.misses - a.misses || a.box - b.box)
				.slice(0, 15)
				.map((p) => ({ word: p.word, misses: p.misses, box: p.box })),
			recent,
		});
	});
