import { zValidator } from "@hono/zod-validator";
import {
	activeHolidays,
	daysBetween,
	FIND_BY_ID,
	FURNITURE_BY_ID,
	fingerprint,
	HOLIDAY_LABEL,
	HOLIDAY_NOTE,
	HOLIDAYS,
	type HolidayId,
	type Home,
	ITEM,
	ITEMS,
	LOOK_NAME_MAX,
	type Look,
	lockedFurnitureIn,
	lockedItemsIn,
	MAX_SAVED_LOOKS,
	normalizeHome,
	normalizeLook,
	starterHome,
	starterLook,
} from "@jade/core/roxy";
import { type Db, schema } from "@jade/db";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { newId } from "../lib/ids.ts";
import { ownedChild } from "../lib/owned.ts";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);

async function holidaysOff(db: Db, parentId: string): Promise<Set<HolidayId>> {
	const row = await db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, parentId) });
	return new Set(JSON.parse(row?.roxyHolidaysOff ?? "[]"));
}

async function unlockedItems(db: Db, childId: string): Promise<Set<string>> {
	const rows = await db
		.select({ itemId: schema.roxyUnlocks.itemId })
		.from(schema.roxyUnlocks)
		.where(eq(schema.roxyUnlocks.childId, childId));
	return new Set(rows.map((r) => r.itemId));
}

async function balance(db: Db, childId: string): Promise<number> {
	const stats = await db.query.childStats.findFirst({ where: eq(schema.childStats.childId, childId) });
	return Math.max(0, (stats?.totalStars ?? 0) - (stats?.starsSpent ?? 0));
}

/** A look the child may wear: valid, and nothing in it still locked or from a holiday the family turned off. */
function wearable(input: unknown, unlocked: Set<string>, off: Set<HolidayId>): Look {
	const look = normalizeLook(input);
	if (!look) throw new HTTPException(400, { message: "That look doesn’t fit together" });
	const hidden = Object.values(look.slots).some((w) => {
		const h = ITEM.get(w.item)?.holiday;
		return h && off.has(h);
	});
	if (hidden || lockedItemsIn(look, unlocked).length > 0) throw new HTTPException(403, { message: "Some of those are still locked" });
	return look;
}

/** Everything the studio needs. `day` is the family's local day, for which holiday collections are open. */
async function studio(db: Db, parentId: string, childId: string, day: string) {
	const [current, looks, unlocked, stars, off, home, finds] = await Promise.all([
		db.query.roxyCurrent.findFirst({ where: eq(schema.roxyCurrent.childId, childId) }),
		db.select().from(schema.roxyLooks).where(eq(schema.roxyLooks.childId, childId)).orderBy(asc(schema.roxyLooks.createdAt)),
		unlockedItems(db, childId),
		balance(db, childId),
		holidaysOff(db, parentId),
		db.query.roxyHomes.findFirst({ where: eq(schema.roxyHomes.childId, childId) }),
		db.select({ findId: schema.roxyFinds.findId }).from(schema.roxyFinds).where(eq(schema.roxyFinds.childId, childId)),
	]);
	return {
		home: home ? (JSON.parse(home.homeJson) as Home) : starterHome(),
		finds: finds.map((f) => f.findId),
		current: current ? (JSON.parse(current.lookJson) as Look) : starterLook(childId),
		wornLookId: current?.wornLookId ?? null,
		looks: looks.map((l) => ({ id: l.id, name: l.name, look: JSON.parse(l.lookJson) as Look, createdAt: l.createdAt.getTime() })),
		unlocked: [...unlocked],
		balance: stars,
		holidaysOff: [...off],
		holidays: activeHolidays(day)
			.filter((w) => !off.has(w.id))
			.map((w) => {
				const gift = ITEMS.find((i) => i.holiday === w.id && i.gift)!;
				return { ...w, label: HOLIDAY_LABEL[w.id], note: HOLIDAY_NOTE[w.id], gift: gift.id, claimed: unlocked.has(gift.id) };
			}),
	};
}

/** Roxy, the dress-up game. Mounted at /api/children/:id/roxy. */
export const roxyRoutes = new Hono<AppEnv>()
	.get("/", zValidator("query", z.object({ day: daySchema.optional() })), async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id")!);
		return c.json(await studio(c.var.db, c.var.userId, child.id, c.req.valid("query").day ?? today()));
	})
	/** Autosave of what's on the stage. */
	.put("/current", zValidator("json", z.object({ look: z.unknown(), wornLookId: z.string().nullable().optional() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const { look: input, wornLookId } = c.req.valid("json");
		const look = wearable(input, await unlockedItems(db, child.id), await holidaysOff(db, c.var.userId));
		const worn = wornLookId
			? ((await db.query.roxyLooks.findFirst({ where: and(eq(schema.roxyLooks.id, wornLookId), eq(schema.roxyLooks.childId, child.id)) }))
					?.id ?? null)
			: null;
		const lookJson = JSON.stringify(look);
		await db
			.insert(schema.roxyCurrent)
			.values({ childId: child.id, lookJson, wornLookId: worn })
			.onConflictDoUpdate({ target: schema.roxyCurrent.childId, set: { lookJson, wornLookId: worn, updatedAt: new Date() } });
		return c.json({ ok: true });
	})
	/**
	 * Spend stars on an item. Idempotent: an item already owned costs nothing again. The unlock row goes in first,
	 * then the stars come out only if the balance covers it; if it doesn't, the row comes back out.
	 */
	.post("/unlock", zValidator("json", z.object({ itemId: z.string().max(40) })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const itemId = c.req.valid("json").itemId;
		// Clothes and furniture share one set of unlocks; their ids never overlap (a core test checks).
		const item = ITEM.get(itemId) ?? FURNITURE_BY_ID.get(itemId);
		if (!item) throw new HTTPException(404, { message: "No such item" });
		if (item.holiday && (await holidaysOff(db, c.var.userId)).has(item.holiday)) throw new HTTPException(403, { message: "Not available" });
		if (item.cost > 0) {
			const inserted = await db
				.insert(schema.roxyUnlocks)
				.values({ childId: child.id, itemId: item.id, cost: item.cost })
				.onConflictDoNothing()
				.returning({ itemId: schema.roxyUnlocks.itemId });
			if (inserted.length > 0) {
				const paid = await db
					.update(schema.childStats)
					.set({ starsSpent: sql`${schema.childStats.starsSpent} + ${item.cost}` })
					.where(
						and(
							eq(schema.childStats.childId, child.id),
							sql`${schema.childStats.totalStars} - ${schema.childStats.starsSpent} >= ${item.cost}`,
						),
					)
					.returning({ childId: schema.childStats.childId });
				if (paid.length === 0) {
					await db.delete(schema.roxyUnlocks).where(and(eq(schema.roxyUnlocks.childId, child.id), eq(schema.roxyUnlocks.itemId, item.id)));
					return c.json({ error: "stars", balance: await balance(db, child.id) }, 409);
				}
			}
		}
		return c.json({ ok: true, balance: await balance(db, child.id) });
	})
	/** A holiday's free gift, while its window is open on the family's day (which must be close to the real one). */
	.post("/claim", zValidator("json", z.object({ holidayId: z.enum(HOLIDAYS), day: daySchema })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const { holidayId, day } = c.req.valid("json");
		if (Math.abs(daysBetween(today(), day)) > 1) throw new HTTPException(400, { message: "Check the date on this device" });
		if ((await holidaysOff(db, c.var.userId)).has(holidayId)) throw new HTTPException(403, { message: "Not available" });
		if (!activeHolidays(day).some((w) => w.id === holidayId)) throw new HTTPException(403, { message: "That gift isn’t open today" });
		const gift = ITEMS.find((i) => i.holiday === holidayId && i.gift)!;
		await db.insert(schema.roxyUnlocks).values({ childId: child.id, itemId: gift.id, cost: 0 }).onConflictDoNothing();
		return c.json({ ok: true, itemId: gift.id });
	})
	/** Something found around town. Finding it again changes nothing. */
	.post("/find", zValidator("json", z.object({ findId: z.string().max(40) })), async (c) => {
		const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id")!);
		const find = FIND_BY_ID.get(c.req.valid("json").findId);
		if (!find) throw new HTTPException(404, { message: "Nothing like that here" });
		await c.var.db.insert(schema.roxyFinds).values({ childId: child.id, findId: find.id }).onConflictDoNothing();
		return c.json({ ok: true });
	})
	/** Save the home. Furniture that doesn't fit is dropped; furniture not yet unlocked is refused. */
	.put("/home", zValidator("json", z.object({ home: z.unknown() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const home = normalizeHome(c.req.valid("json").home);
		if (!home) throw new HTTPException(400, { message: "That room doesn’t fit together" });
		const off = await holidaysOff(db, c.var.userId);
		const hidden = home.items.some((p) => {
			const h = FURNITURE_BY_ID.get(p.item)?.holiday;
			return h && off.has(h);
		});
		if (hidden || lockedFurnitureIn(home, await unlockedItems(db, child.id)).length > 0)
			throw new HTTPException(403, { message: "Some of those are still locked" });
		const homeJson = JSON.stringify(home);
		await db
			.insert(schema.roxyHomes)
			.values({ childId: child.id, homeJson })
			.onConflictDoUpdate({ target: schema.roxyHomes.childId, set: { homeJson, updatedAt: new Date() } });
		return c.json(home);
	})
	/** Save the look to the gallery. Every saved look in Jade is one of a kind. */
	.post("/looks", zValidator("json", z.object({ name: z.string().trim().min(1).max(LOOK_NAME_MAX), look: z.unknown() })), async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const { name, look: input } = c.req.valid("json");
		const look = wearable(input, await unlockedItems(db, child.id), await holidaysOff(db, c.var.userId));
		const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(schema.roxyLooks).where(eq(schema.roxyLooks.childId, child.id));
		if (n >= MAX_SAVED_LOOKS) return c.json({ error: "full" }, 409);
		const print = await fingerprint(look);
		const id = newId();
		const lookJson = JSON.stringify(look);
		const inserted = await db
			.insert(schema.roxyLooks)
			.values({ id, childId: child.id, name, lookJson, fingerprint: print })
			.onConflictDoNothing()
			.returning({ id: schema.roxyLooks.id });
		if (inserted.length === 0) {
			const twin = await db.query.roxyLooks.findFirst({ where: eq(schema.roxyLooks.fingerprint, print) });
			return c.json({ error: "taken", mine: twin?.childId === child.id }, 409);
		}
		await db
			.insert(schema.roxyCurrent)
			.values({ childId: child.id, lookJson, wornLookId: id })
			.onConflictDoUpdate({ target: schema.roxyCurrent.childId, set: { lookJson, wornLookId: id, updatedAt: new Date() } });
		return c.json({ id, name, look }, 201);
	})
	/** Rename a saved look, or put it back on the stage. */
	.patch(
		"/looks/:lookId",
		zValidator("json", z.object({ name: z.string().trim().min(1).max(LOOK_NAME_MAX).optional(), wear: z.boolean().optional() })),
		async (c) => {
			const db = c.var.db;
			const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
			const where = and(eq(schema.roxyLooks.id, c.req.param("lookId")), eq(schema.roxyLooks.childId, child.id));
			const row = await db.query.roxyLooks.findFirst({ where });
			if (!row) throw new HTTPException(404, { message: "Look not found" });
			const { name, wear } = c.req.valid("json");
			if (name) await db.update(schema.roxyLooks).set({ name }).where(where);
			if (wear) {
				await db
					.insert(schema.roxyCurrent)
					.values({ childId: child.id, lookJson: row.lookJson, wornLookId: row.id })
					.onConflictDoUpdate({
						target: schema.roxyCurrent.childId,
						set: { lookJson: row.lookJson, wornLookId: row.id, updatedAt: new Date() },
					});
			}
			return c.json({ ok: true });
		},
	)
	.delete("/looks/:lookId", async (c) => {
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		await db.delete(schema.roxyLooks).where(and(eq(schema.roxyLooks.id, c.req.param("lookId")), eq(schema.roxyLooks.childId, child.id)));
		return c.json({ ok: true });
	});
