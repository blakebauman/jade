import { zValidator } from "@hono/zod-validator";
import { APPEARANCES, DEFAULT_APPEARANCE, DEFAULT_PIN_RELOCK_MINUTES, pinRelockMinutesSchema } from "@jade/core";
import { HOLIDAYS } from "@jade/core/roxy";
import { schema } from "@jade/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { rateLimit } from "../middleware.ts";

/**
 * The parent PIN keeps small hands out of list editing on a shared device. It is a convenience gate,
 * not a security boundary — the parent's session is already on the device.
 */
export const parentRoutes = new Hono<AppEnv>()
	.get("/", async (c) => {
		const row = await c.var.db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, c.var.userId) });
		return c.json({
			hasPin: !!row?.pinHash,
			pinRelockMinutes: row?.pinRelockMinutes ?? DEFAULT_PIN_RELOCK_MINUTES,
			timeZone: row?.timeZone ?? null,
			roxyHolidaysOff: JSON.parse(row?.roxyHolidaysOff ?? "[]") as string[],
			appearance: row?.appearance ?? DEFAULT_APPEARANCE,
		});
	})
	.put(
		"/",
		zValidator(
			"json",
			z.object({
				pin: z
					.string()
					.regex(/^\d{4}$/)
					.nullable()
					.optional(),
				pinRelockMinutes: pinRelockMinutesSchema.optional(),
				timeZone: z.string().max(64).optional(),
				/** Holidays this family would rather Roxy didn’t celebrate. */
				roxyHolidaysOff: z.array(z.enum(HOLIDAYS)).max(HOLIDAYS.length).optional(),
				appearance: z.enum(APPEARANCES).optional(),
			}),
		),
		async (c) => {
			const { pin, pinRelockMinutes, timeZone, roxyHolidaysOff, appearance } = c.req.valid("json");
			const holidaysOff = roxyHolidaysOff && JSON.stringify([...new Set(roxyHolidaysOff)]);
			const pinHash = pin === undefined ? undefined : pin === null ? null : await hashPassword(pin);
			await c.var.db
				.insert(schema.parentSettings)
				.values({
					userId: c.var.userId,
					pinHash: pinHash ?? null,
					pinRelockMinutes: pinRelockMinutes ?? null,
					timeZone: timeZone ?? null,
					roxyHolidaysOff: holidaysOff ?? "[]",
					appearance: appearance ?? DEFAULT_APPEARANCE,
				})
				.onConflictDoUpdate({
					target: schema.parentSettings.userId,
					set: {
						...(pinHash !== undefined && { pinHash }),
						...(pinRelockMinutes && { pinRelockMinutes }),
						...(timeZone && { timeZone }),
						...(holidaysOff && { roxyHolidaysOff: holidaysOff }),
						...(appearance && { appearance }),
					},
				});
			return c.json({ ok: true });
		},
	)
	.post("/verify-pin", rateLimit("pin"), zValidator("json", z.object({ pin: z.string().max(8) })), async (c) => {
		const row = await c.var.db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, c.var.userId) });
		if (!row?.pinHash) return c.json({ ok: true });
		return c.json({ ok: await verifyPassword({ hash: row.pinHash, password: c.req.valid("json").pin }) });
	})
	/** The way back in when the PIN is forgotten: the account password opens the parent area, where a new PIN can be set. */
	.post("/verify-password", rateLimit("pin"), zValidator("json", z.object({ password: z.string().max(200) })), async (c) => {
		const account = await c.var.db.query.account.findFirst({
			where: and(eq(schema.account.userId, c.var.userId), eq(schema.account.providerId, "credential")),
		});
		if (!account?.password) return c.json({ ok: false });
		return c.json({ ok: await verifyPassword({ hash: account.password, password: c.req.valid("json").password }) });
	});
