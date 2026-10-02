import { createDb } from "@jade/db";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth.ts";
import type { AppEnv } from "./env.ts";

export const withDb = createMiddleware<AppEnv>(async (c, next) => {
	c.set("db", createDb(c.env.DB));
	await next();
});

export const requireParent = createMiddleware<AppEnv>(async (c, next) => {
	// Read the session from D1, not the 5-minute cookie cache, so a ban or a sign-out elsewhere holds on the next request.
	const session = await createAuth(c.env, c.var.db).api.getSession({ headers: c.req.raw.headers, query: { disableCookieCache: true } });
	if (!session) throw new HTTPException(401, { message: "Sign in required" });
	c.set("userId", session.user.id);
	await next();
});

/** Per-parent limiter for the endpoints that spend Workers AI. No binding (tests) means no limit. */
export async function enforceLimit(c: Context<AppEnv>, bucket: string) {
	if (!c.env.RATE_LIMIT) return;
	const { success } = await c.env.RATE_LIMIT.limit({ key: `${bucket}:${c.var.userId}` });
	if (!success) throw new HTTPException(429, { message: "Slow down a little" });
}

export const rateLimit = (bucket: string) =>
	createMiddleware<AppEnv>(async (c, next) => {
		await enforceLimit(c, bucket);
		await next();
	});
