import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env.ts";
import { familyLabel, friendsOf, linked } from "../lib/friends.ts";
import { ownedChild } from "../lib/owned.ts";
import { WOODS_HEADERS } from "../woods/WoodsWorld.ts";

/**
 * Campfire Woods for one kid. Mounted at /api/children/:id/woods. Each family's island is a Durable Object named by
 * the parent's user id; a kid can join their own family's, or a linked friend family's. This checks which, then hands
 * the WebSocket over. Friends see a visiting kid's initial, never their name.
 */
export const woodsRoutes = new Hono<AppEnv>()
	/** The islands this kid can go to, with how many are playing on each now. */
	.get("/islands", async (c) => {
		const db = c.var.db;
		await ownedChild(db, c.var.userId, c.req.param("id")!);
		const friends = await friendsOf(db, c.var.userId);
		const online = (id: string) =>
			c.env.WOODS.getByName(id)
				.online()
				.catch(() => 0);
		const [ours, ...theirs] = await Promise.all([online(c.var.userId), ...friends.map((f) => online(f.userId))]);
		return c.json({
			islands: [
				{ id: c.var.userId, label: "Our island", mine: true, online: ours ?? 0 },
				...friends.map((f, k) => ({ id: f.userId, label: f.label, mine: false, online: theirs[k] ?? 0 })),
			],
		});
	})
	.get("/ws", async (c) => {
		if (c.req.header("Upgrade") !== "websocket") throw new HTTPException(426, { message: "Expected a WebSocket" });
		const db = c.var.db;
		const child = await ownedChild(db, c.var.userId, c.req.param("id")!);
		const island = c.req.query("island") || c.var.userId;
		const guest = island !== c.var.userId;
		if (guest && !(await linked(db, c.var.userId, island))) throw new HTTPException(403, { message: "Not a friend’s island" });
		const headers = new Headers({ Upgrade: "websocket" });
		headers.set(WOODS_HEADERS.child, child.id);
		headers.set(WOODS_HEADERS.family, c.var.userId);
		headers.set(WOODS_HEADERS.label, encodeURIComponent(guest ? (child.name.trim()[0] ?? "?").toUpperCase() : child.name));
		headers.set(WOODS_HEADERS.guest, guest ? "1" : "0");
		// The host family's own kids keep the island's name up to date (header values are ASCII-safe once encoded).
		if (!guest) headers.set(WOODS_HEADERS.island, encodeURIComponent(await familyLabel(db, c.var.userId)));
		return c.env.WOODS.getByName(island).fetch("https://woods/ws", { headers });
	});
