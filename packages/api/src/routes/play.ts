import { zValidator } from "@hono/zod-validator";
import { MAX_TICKETS_PER_GO, playSettingsSchema, playState, TIME_BLOCK } from "@jade/core";
import { type Db, schema } from "@jade/db";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { ownedChild } from "../lib/owned.ts";
import { charge, earnTickets, keepWhatsUsed, playRow, wallets } from "../lib/play.ts";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);

/** Where play stands for a kid: their settings, wallets, today's practice, play time left, and whether games are open. */
async function status(db: Db, childId: string, day: string) {
	const [row, wallet, practice] = await Promise.all([
		playRow(db, childId),
		wallets(db, childId),
		db.query.dailyPractice.findFirst({ where: and(eq(schema.dailyPractice.childId, childId), eq(schema.dailyPractice.day, day)) }),
	]);
	const { minutesBought, secondsUsed, ...settings } = row;
	const todayPractice = { rounds: practice?.rounds ?? 0, stars: practice?.stars ?? 0 };
	const secondsLeft = Math.max(0, minutesBought * 60 - secondsUsed);
	return {
		settings,
		wallet,
		today: todayPractice,
		time: { secondsLeft, secondsUsed },
		...playState(settings, todayPractice, secondsLeft),
	};
}
export type PlayStatus = Awaited<ReturnType<typeof status>>;

/** Learn and Play for one kid. Mounted at /api/children/:id/play. */
export const playRoutes = new Hono<AppEnv>()
	.get("/", zValidator("query", z.object({ day: daySchema.optional() })), async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id")!);
		return c.json(await status(c.var.db, child.id, c.req.valid("query").day ?? today()));
	})
	/** The parent's switches. Turning Free off keeps whatever the kid is using. */
	.put("/", zValidator("json", playSettingsSchema.extend({ day: daySchema.optional() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const { day, ...settings } = c.req.valid("json");
		const before = await playRow(db, child.id);
		await db
			.insert(schema.childPlay)
			.values({ childId: child.id, ...settings })
			.onConflictDoUpdate({ target: schema.childPlay.childId, set: { ...settings, updatedAt: new Date() } });
		const kept = before.free && !settings.free ? await keepWhatsUsed(db, child.id) : 0;
		return c.json({ ...(await status(db, child.id, day ?? today())), kept });
	})
	/** Buy one block of play time with stars, while the parent has play time cost stars. */
	.post("/time", zValidator("json", z.object({ day: daySchema.optional() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const day = c.req.valid("json").day ?? today();
		if (!(await playRow(db, child.id)).timeCosts) throw new HTTPException(403, { message: "Play time is free" });
		if (!(await charge(db, child.id, "stars", TIME_BLOCK.stars)))
			return c.json({ error: "stars", ...(await status(db, child.id, day)) }, 409);
		await db
			.insert(schema.childPlay)
			.values({ childId: child.id, minutesBought: TIME_BLOCK.minutes })
			.onConflictDoUpdate({
				target: schema.childPlay.childId,
				set: { minutesBought: sql`${schema.childPlay.minutesBought} + ${TIME_BLOCK.minutes}` },
			});
		return c.json(await status(db, child.id, day));
	})
	/**
	 * Play time used, as a running total the device keeps. Only ever moves forward and never past what was bought, so a
	 * replay or a late report from another device can't give time back or take more than there was.
	 */
	.post("/time/used", zValidator("json", z.object({ secondsUsed: z.number().int().min(0), day: daySchema.optional() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const { secondsUsed, day } = c.req.valid("json");
		const p = schema.childPlay;
		await db
			.update(p)
			.set({ secondsUsed: sql`min(max(${p.secondsUsed}, ${secondsUsed}), ${p.minutesBought} * 60)` })
			.where(eq(p.childId, child.id));
		return c.json(await status(db, child.id, day ?? today()));
	})
	/**
	 * Tickets a game pays at the end of a go, once per key (`gobble:<round id>`), so the device can resend it from
	 * offline without it paying twice. One go pays at most MAX_TICKETS_PER_GO. While games are free nothing is paid.
	 */
	.post(
		"/earn",
		zValidator(
			"json",
			z.object({ key: z.string().regex(/^[a-z]+:[\w-]{1,64}$/), tickets: z.number().int().min(0), day: daySchema.optional() }),
		),
		async (c) => {
			const db = c.var.db;
			const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
			const { key, day } = c.req.valid("json");
			const tickets = Math.min(c.req.valid("json").tickets, MAX_TICKETS_PER_GO);
			const paid =
				tickets > 0 && !(await playRow(db, child.id)).free
					? await db
							.insert(schema.ticketEarnings)
							.values({ childId: child.id, key, tickets })
							.onConflictDoNothing()
							.returning({ key: schema.ticketEarnings.key })
					: [];
			if (paid.length > 0) await earnTickets(db, child.id, tickets);
			return c.json({ ...(await status(db, child.id, day ?? today())), earned: paid.length > 0 ? tickets : 0 });
		},
	);
