import { zValidator } from "@hono/zod-validator";
import { schema } from "@jade/db";
import { eq } from "drizzle-orm";
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
		return c.json({ hasPin: !!row?.pinHash, timeZone: row?.timeZone ?? null });
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
				timeZone: z.string().max(64).optional(),
			}),
		),
		async (c) => {
			const { pin, timeZone } = c.req.valid("json");
			const pinHash = pin === undefined ? undefined : pin === null ? null : await hashPassword(pin);
			await c.var.db
				.insert(schema.parentSettings)
				.values({ userId: c.var.userId, pinHash: pinHash ?? null, timeZone: timeZone ?? null })
				.onConflictDoUpdate({
					target: schema.parentSettings.userId,
					set: { ...(pinHash !== undefined && { pinHash }), ...(timeZone && { timeZone }) },
				});
			return c.json({ ok: true });
		},
	)
	.post("/verify-pin", rateLimit("pin"), zValidator("json", z.object({ pin: z.string().max(8) })), async (c) => {
		const row = await c.var.db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, c.var.userId) });
		if (!row?.pinHash) return c.json({ ok: true });
		return c.json({ ok: await verifyPassword({ hash: row.pinHash, password: c.req.valid("json").pin }) });
	});
