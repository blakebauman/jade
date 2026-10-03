import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth.ts";
import type { AppEnv } from "./env.ts";
import { requireParent, withDb } from "./middleware.ts";
import { childrenRoutes } from "./routes/children.ts";
import { importRoutes } from "./routes/import.ts";
import { listRoutes } from "./routes/lists.ts";
import { parentRoutes } from "./routes/parent.ts";
import { playRoutes } from "./routes/play.ts";
import { roxyRoutes } from "./routes/roxy.ts";
import { sessionRoutes } from "./routes/sessions.ts";
import { ttsRoutes } from "./routes/tts.ts";
import { wordRoutes } from "./routes/words.ts";

export type { ApiBindings, AppEnv } from "./env.ts";

const authed = new Hono<AppEnv>()
	.use(requireParent)
	.route("/children/:id/roxy", roxyRoutes)
	.route("/children/:id/play", playRoutes)
	.route("/children", childrenRoutes)
	.route("/lists", listRoutes)
	.route("/words", wordRoutes)
	.route("/tts", ttsRoutes)
	.route("/import", importRoutes)
	.route("/sessions", sessionRoutes)
	.route("/parent", parentRoutes);

/** Mounted by apps/web's Worker at the root; it owns /health and /api/*. */
export const api = new Hono<AppEnv>()
	.get("/health", (c) => c.text("ok"))
	.use("/api/*", withDb)
	.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env, c.var.db).handler(c.req.raw))
	.route("/api", authed)
	.notFound((c) => c.json({ error: "Not found" }, 404))
	.onError((err, c) => {
		if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
		console.error(err);
		return c.json({ error: "Something went wrong" }, 500);
	});

export type Api = typeof api;
