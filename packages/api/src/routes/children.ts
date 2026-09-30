import { zValidator } from "@hono/zod-validator";
import { BADGES, buildReviewRound, childInputSchema, childPatchSchema, childSettingsSchema, DEFAULT_SETTINGS } from "@jade/core";
import { MATH_SKILLS } from "@jade/core/math";
import { schema } from "@jade/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { newId } from "../lib/ids.ts";
import { getSkillLevels } from "../lib/math.ts";
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
	.patch("/:id", zValidator("json", childPatchSchema), async (c) => {
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
	/** Parent override for a math skill's adaptive level (e.g. start a confident speller at level 3). */
	.put(
		"/:id/math-level",
		zValidator("json", z.object({ skill: z.enum(MATH_SKILLS), level: z.number().int().min(1).max(5) })),
		async (c) => {
			const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id"));
			const { skill, level } = c.req.valid("json");
			await c.var.db
				.insert(schema.skillLevels)
				.values({ childId: child.id, skill, level })
				.onConflictDoUpdate({ target: [schema.skillLevels.childId, schema.skillLevels.skill], set: { level, updatedAt: new Date() } });
			return c.json(await getSkillLevels(c.var.db, child.id));
		},
	)
	.get("/:id/progress", async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id"));
		const now = Date.now();
		const [stats, allProgress, recent, levels] = await Promise.all([
			c.var.db.query.childStats.findFirst({ where: eq(schema.childStats.childId, child.id) }),
			c.var.db.query.wordProgress.findMany({ where: eq(schema.wordProgress.childId, child.id) }),
			c.var.db.query.practiceSessions.findMany({
				where: and(eq(schema.practiceSessions.childId, child.id), gt(schema.practiceSessions.total, 0)),
				orderBy: desc(schema.practiceSessions.startedAt),
				limit: 20,
			}),
			getSkillLevels(c.var.db, child.id),
		]);
		// Progress rows hold both spelling words and math facts (`m:` keys); keep the two subjects apart.
		const progress = allProgress.filter((p) => !p.word.startsWith("m:"));
		const facts = allProgress.filter((p) => p.word.startsWith("m:"));
		const troubleOf = (rows: typeof allProgress) =>
			rows
				.filter((p) => p.misses > 0)
				.sort((a, b) => b.misses - a.misses || a.box - b.box)
				.slice(0, 15)
				.map((p) => ({ word: p.word, misses: p.misses, box: p.box }));
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
			// Spelling (top-level for compatibility with the spelling screens).
			reviewDue: buildReviewRound(progress, now, 20),
			mastered: progress.filter((p) => p.box >= 4).length,
			/** Leitner box per practiced word, for the five-pip mastery ramp. */
			boxes: Object.fromEntries(progress.map((p) => [p.word, p.box])),
			trouble: troubleOf(progress),
			math: {
				/** Adaptive level (1–5) per skill; skills never practiced are absent (level 1). */
				levels,
				factsDue: buildReviewRound(facts, now, 20),
				factsMastered: facts.filter((p) => p.box >= 4).length,
				/** Leitner box per fact key (`m:mul:7x8`), for the times-table grid. */
				factBoxes: Object.fromEntries(facts.map((p) => [p.word, p.box])),
				trouble: troubleOf(facts),
			},
			recent,
		});
	});
