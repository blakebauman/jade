import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env.ts";
import { ownedChild } from "../lib/owned.ts";
import { WOODS_HEADERS } from "../woods/WoodsWorld.ts";

/**
 * Campfire Woods for one kid. Mounted at /api/children/:id/woods. The island itself is a Durable Object; this checks
 * who's asking and which island they may join, then hands the WebSocket over.
 */
export const woodsRoutes = new Hono<AppEnv>().get("/ws", async (c) => {
	if (c.req.header("Upgrade") !== "websocket") throw new HTTPException(426, { message: "Expected a WebSocket" });
	const child = await ownedChild(c.var.db, c.var.userId, c.req.param("id")!);
	const island = c.req.query("island") || c.var.userId;
	if (island !== c.var.userId) throw new HTTPException(403, { message: "Not your island" });
	const headers = new Headers({ Upgrade: "websocket" });
	headers.set(WOODS_HEADERS.child, child.id);
	headers.set(WOODS_HEADERS.family, c.var.userId);
	headers.set(WOODS_HEADERS.label, child.name);
	headers.set(WOODS_HEADERS.guest, "0");
	return c.env.WOODS.getByName(island).fetch("https://woods/ws", { headers });
});
