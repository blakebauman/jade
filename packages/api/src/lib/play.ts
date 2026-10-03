import { DEFAULT_PLAY, type PlaySettings } from "@jade/core";
import { FURNITURE, type Home, ITEMS, type Look, lockedFurnitureIn, lockedItemsIn } from "@jade/core/roxy";
import { type Db, schema } from "@jade/db";
import { and, eq, sql } from "drizzle-orm";

export type PlayRow = PlaySettings & { minutesBought: number; secondsUsed: number };

/** A kid's play settings, with the defaults when none are saved. */
export async function playRow(db: Db, childId: string): Promise<PlayRow> {
	const row = await db.query.childPlay.findFirst({ where: eq(schema.childPlay.childId, childId) });
	if (!row) return { ...DEFAULT_PLAY, minutesBought: 0, secondsUsed: 0 };
	const { free, stars, practiceFirst, goal, timeCosts, minutesBought, secondsUsed } = row;
	return { free, stars, practiceFirst, goal, timeCosts, minutesBought, secondsUsed };
}

/** What a kid can spend: tickets earned in games, and stars (lifetime stars less what games have taken). */
export async function wallets(db: Db, childId: string) {
	const s = await db.query.childStats.findFirst({ where: eq(schema.childStats.childId, childId) });
	return {
		stars: Math.max(0, (s?.totalStars ?? 0) - (s?.starsSpent ?? 0)),
		tickets: Math.max(0, (s?.ticketsEarned ?? 0) - (s?.ticketsSpent ?? 0)),
	};
}

/** Take `n` from a wallet only if it covers it, in one statement so two taps can't both spend the same stars. */
export async function charge(db: Db, childId: string, wallet: "stars" | "tickets", n: number): Promise<boolean> {
	const t = schema.childStats;
	const [spent, has] =
		wallet === "stars"
			? [t.starsSpent, sql`${t.totalStars} - ${t.starsSpent}`]
			: [t.ticketsSpent, sql`${t.ticketsEarned} - ${t.ticketsSpent}`];
	const paid = await db
		.update(t)
		.set(wallet === "stars" ? { starsSpent: sql`${spent} + ${n}` } : { ticketsSpent: sql`${spent} + ${n}` })
		.where(and(eq(t.childId, childId), sql`${has} >= ${n}`))
		.returning({ childId: t.childId });
	return paid.length > 0;
}

export function earnTickets(db: Db, childId: string, n: number) {
	return db
		.insert(schema.childStats)
		.values({ childId, ticketsEarned: n })
		.onConflictDoUpdate({ target: schema.childStats.childId, set: { ticketsEarned: sql`${schema.childStats.ticketsEarned} + ${n}` } });
}

/** Everything a game sells, for a kid whose games are free. Holiday gifts are never sold, so Free doesn't open them. */
export const SOLD = [
	...ITEMS.filter((i) => i.cost > 0 && !i.gift).map((i) => i.id),
	...FURNITURE.filter((f) => f.cost > 0).map((f) => f.id),
];

/**
 * Turning Free off: whatever the kid is wearing, has saved or has placed at home becomes theirs, so nothing is taken
 * off a look or out of the room. Everything else goes back to costing tickets.
 */
export async function keepWhatsUsed(db: Db, childId: string) {
	const [owned, current, looks, home] = await Promise.all([
		db.select({ itemId: schema.roxyUnlocks.itemId }).from(schema.roxyUnlocks).where(eq(schema.roxyUnlocks.childId, childId)),
		db.query.roxyCurrent.findFirst({ where: eq(schema.roxyCurrent.childId, childId) }),
		db.select({ lookJson: schema.roxyLooks.lookJson }).from(schema.roxyLooks).where(eq(schema.roxyLooks.childId, childId)),
		db.query.roxyHomes.findFirst({ where: eq(schema.roxyHomes.childId, childId) }),
	]);
	const unlocked = new Set(owned.map((r) => r.itemId));
	const used = new Set<string>();
	for (const json of [current?.lookJson, ...looks.map((l) => l.lookJson)]) {
		if (json) for (const item of lockedItemsIn(JSON.parse(json) as Look, unlocked)) if (!item.gift) used.add(item.id);
	}
	if (home) for (const f of lockedFurnitureIn(JSON.parse(home.homeJson) as Home, unlocked)) used.add(f.id);
	const rows = [...used].map((itemId) => ({ childId, itemId, cost: 0 }));
	// D1 takes at most 100 bound parameters a statement: 3 columns × 30 rows.
	for (let i = 0; i < rows.length; i += 30)
		await db
			.insert(schema.roxyUnlocks)
			.values(rows.slice(i, i + 30))
			.onConflictDoNothing();
	return used.size;
}
