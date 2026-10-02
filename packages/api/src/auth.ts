import { type Db, schema } from "@jade/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { ApiBindings } from "./env.ts";
import { hashPassword, verifyPassword } from "./lib/password.ts";

/** Better Auth is built per request: Workers bindings only exist inside the handler. */
export function createAuth(env: ApiBindings, db: Db) {
	return betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		basePath: "/api/auth",
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			password: { hash: hashPassword, verify: verifyPassword },
		},
		session: {
			// Families leave the app open on a tablet; keep them signed in for 60 days, refreshed daily.
			expiresIn: 60 * 60 * 24 * 60,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: true, maxAge: 5 * 60 },
		},
		trustedOrigins: [env.BETTER_AUTH_URL],
		// Admin endpoints under /api/auth/admin/*. Promote a parent with `update user set role = 'admin'` in D1.
		plugins: [admin({ impersonationSessionDuration: 60 * 60 })],
	});
}
export type Auth = ReturnType<typeof createAuth>;
