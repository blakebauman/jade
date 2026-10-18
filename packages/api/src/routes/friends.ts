import { zValidator } from "@hono/zod-validator";
import { schema } from "@jade/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { familyLabel, friendsOf, pair } from "../lib/friends.ts";
import { rateLimit } from "../middleware.ts";

/**
 * Friends, for parents: link with another family so their kids can visit each other's Campfire Woods islands. One
 * parent makes a code and gives it to the other, who enters it; either can unlink at any time, which sends any
 * visiting kids home at once. Mounted at /api/parent/friends.
 */

/** No 0/O or 1/I/L: codes are read aloud and typed by grown-ups. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_HOURS = 48;
const codeSchema = z
	.string()
	.trim()
	.transform((s) => s.toUpperCase().replace(/[\s-]/g, ""))
	.pipe(z.string().length(CODE_LENGTH));

function newCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const friendRoutes = new Hono<AppEnv>()
	.get("/", async (c) => {
		const db = c.var.db;
		const settings = await db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, c.var.userId) });
		return c.json({
			label: settings?.familyLabel ?? "",
			shownAs: await familyLabel(db, c.var.userId),
			guestsBuild: settings?.woodsGuestsBuild ?? true,
			friends: await friendsOf(db, c.var.userId),
		});
	})
	/** What this family is called to friends, and whether friends can build on its island. */
	.put(
		"/",
		zValidator("json", z.object({ label: z.string().trim().max(40).optional(), guestsBuild: z.boolean().optional() })),
		async (c) => {
			const { label, guestsBuild } = c.req.valid("json");
			const set = {
				...(label !== undefined && { familyLabel: label || null }),
				...(guestsBuild !== undefined && { woodsGuestsBuild: guestsBuild }),
			};
			if (Object.keys(set).length) {
				await c.var.db
					.insert(schema.parentSettings)
					.values({ userId: c.var.userId, ...set })
					.onConflictDoUpdate({ target: schema.parentSettings.userId, set });
			}
			if (guestsBuild !== undefined) await c.env.WOODS.getByName(c.var.userId).setGuestsBuild(guestsBuild);
			return c.json({ ok: true });
		},
	)
	.post("/code", rateLimit("friends"), async (c) => {
		const code = newCode();
		const expiresAt = new Date(Date.now() + CODE_HOURS * 3600_000);
		await c.var.db.insert(schema.friendCodes).values({ code, userId: c.var.userId, expiresAt });
		return c.json({ code, expiresAt: expiresAt.getTime() });
	})
	/** Who a code is from, before accepting it. */
	.get("/code/:code", rateLimit("friends"), async (c) => {
		const parsed = codeSchema.safeParse(c.req.param("code"));
		if (!parsed.success) throw new HTTPException(404, { message: "That code doesn’t work" });
		const row = await usable(c.var.db, parsed.data, c.var.userId);
		return c.json({ label: await familyLabel(c.var.db, row.userId) });
	})
	.post("/accept", rateLimit("friends"), zValidator("json", z.object({ code: codeSchema })), async (c) => {
		const db = c.var.db;
		const row = await usable(db, c.req.valid("json").code, c.var.userId);
		const [userA, userB] = pair(row.userId, c.var.userId);
		await db.batch([
			db.insert(schema.friendLinks).values({ userA, userB }).onConflictDoNothing(),
			db.update(schema.friendCodes).set({ usedAt: new Date() }).where(eq(schema.friendCodes.code, row.code)),
		]);
		return c.json({ userId: row.userId, label: await familyLabel(db, row.userId) });
	})
	/** Unlink, and send each family's kids home from the other's island now. */
	.delete("/:userId", async (c) => {
		const other = c.req.param("userId");
		const [userA, userB] = pair(other, c.var.userId);
		await c.var.db.delete(schema.friendLinks).where(and(eq(schema.friendLinks.userA, userA), eq(schema.friendLinks.userB, userB)));
		await Promise.all([c.env.WOODS.getByName(c.var.userId).kickFamily(other), c.env.WOODS.getByName(other).kickFamily(c.var.userId)]);
		return c.json({ ok: true });
	})
	/** Takes back what a family built or dug on this family's island (in the last day, or ever). */
	.post(
		"/undo",
		zValidator("json", z.object({ userId: z.string().max(64), since: z.number().int().nonnegative().optional() })),
		async (c) => {
			const { userId, since } = c.req.valid("json");
			if (userId === c.var.userId) throw new HTTPException(400, { message: "That’s your own family" });
			const undone = await c.env.WOODS.getByName(c.var.userId).undoFamily(userId, since ?? 0);
			return c.json({ undone });
		},
	);

/** A code that's someone else's, unused and in date; 404 otherwise, whatever the reason. */
async function usable(db: AppEnv["Variables"]["db"], code: string, me: string) {
	const row = await db.query.friendCodes.findFirst({ where: eq(schema.friendCodes.code, code) });
	if (!row || row.usedAt || row.expiresAt.getTime() < Date.now() || row.userId === me)
		throw new HTTPException(404, { message: "That code doesn’t work. Ask for a new one." });
	return row;
}
