import { DurableObject } from "cloudflare:workers";
import {
	type Animal,
	B,
	blockInfo,
	burn,
	type ClientMsg,
	type Clock,
	canMine,
	canPlace,
	cellOf,
	clientMsg,
	EDITS_MAX,
	EDITS_PER_S,
	type Figure,
	FUEL_LOW,
	FUEL_MAX,
	FUEL_START,
	feed,
	fireRadius,
	generate,
	goalKey,
	goalsMet,
	type Inventory,
	ISLAND_MAX,
	indexOf,
	isLog,
	isPlant,
	type Lost,
	lostAnimals,
	NO_STATS,
	packEdit,
	phaseAt,
	REACH,
	REACH_ANIMAL,
	REACH_FIRE,
	REFILLS,
	type ServerMsg,
	SNUFF_EVERY_S,
	SNUFF_RANGE,
	STACK_MAX,
	spawnPoint,
	TERRAIN_LATEST,
	type Volume,
	type WoodsStats,
} from "@jade/core/woods";

/**
 * One Campfire Woods island: a family's world, which friends can visit. It keeps what kids have changed (the island
 * itself comes from the seed), each kid's inventory and counts, the fire, the clock and tonight's lost animals, and
 * tells everyone on the island what everyone else does. It's the only judge of what's allowed: a screen shows its own
 * edits straight away and takes them back if they're refused.
 *
 * The clock ticks once a second, and only while someone is connected, so nights pass only while kids play.
 */

/** Who a socket is, kept on the socket so it survives the object being evicted. */
type Who = {
	childId: string;
	familyId: string;
	/** A first name for family, just an initial for friends. */
	label: string;
	guest: boolean;
	seat: number;
	p: [number, number, number];
	yaw: number;
};

/** Each seat's figure colour. */
const COLOURS = ["#c2417a", "#3b8fd9", "#3f9b5a", "#7d58c4", "#e07a2f", "#1f9e9a", "#e0607e", "#b98a1d"];

/** Edits by the deer (snuffed torches) are nobody's to undo. */
const DEER = "deer";

type LostNow = Lost & { follows: number | null };

/** The headers the Worker forwards a checked connection with. */
export const WOODS_HEADERS = {
	child: "x-woods-child",
	family: "x-woods-family",
	label: "x-woods-label",
	guest: "x-woods-guest",
	island: "x-woods-island",
} as const;

export class WoodsWorld extends DurableObject<unknown> {
	private sql = this.ctx.storage.sql;
	private seed = 0;
	/** How this island was made from its seed; older islands keep the older way. */
	private gen = 1;
	private vol!: Volume;
	/** The island as made, before anyone changed it (to tell an undo back to it from one back to another edit). */
	private base!: Uint8Array;
	private fire: [number, number, number] = [0, 0, 0];
	private clock: Clock = { elapsed: 0, fuel: FUEL_START, nights: 0 };
	/** The fire hasn't gone out since tonight began. */
	private keptLit = true;
	private lost: LostNow[] = [];
	private home: Animal[] = [];
	private guestsBuild = true;
	private label = "";
	private lastTick = 0;
	private lastSnuff = 0;
	/** Recent edit times per socket, for the rate limit. */
	private recent = new Map<WebSocket, number[]>();

	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.sql.exec(`
				CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS edits (i INTEGER PRIMARY KEY, b INTEGER NOT NULL, prev INTEGER NOT NULL, by_family TEXT NOT NULL, at INTEGER NOT NULL);
				CREATE INDEX IF NOT EXISTS edits_by ON edits (by_family, at);
				CREATE TABLE IF NOT EXISTS inv (child_id TEXT NOT NULL, b INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (child_id, b));
				CREATE TABLE IF NOT EXISTS stats (child_id TEXT PRIMARY KEY, json TEXT NOT NULL);
			`);
			const meta = new Map(
				this.sql
					.exec<{ k: string; v: string }>("SELECT k, v FROM meta")
					.toArray()
					.map((r) => [r.k, r.v]),
			);
			this.seed = Number(meta.get("seed") ?? 0);
			// Islands from before there was more than one way have no `gen`: they're the first way.
			this.gen = Number(meta.get("gen") ?? 1);
			if (!this.seed) {
				this.seed = 1 + Math.floor(Math.random() * 2 ** 30);
				this.gen = TERRAIN_LATEST;
				this.setMeta("seed", this.seed);
				this.setMeta("gen", this.gen);
			}
			const island = generate(this.seed, this.gen);
			this.vol = island.volume;
			this.base = island.volume.data.slice();
			this.fire = island.fire;
			for (const r of this.sql.exec<{ i: number; b: number }>("SELECT i, b FROM edits")) this.vol.data[r.i] = r.b;
			if (meta.has("clock")) this.clock = JSON.parse(meta.get("clock")!);
			this.keptLit = meta.get("keptLit") !== "0";
			this.lost = JSON.parse(meta.get("lost") ?? "[]");
			this.home = JSON.parse(meta.get("home") ?? "[]");
			this.guestsBuild = meta.get("guestsBuild") !== "0";
			this.label = meta.get("label") ?? "";
		});
	}

	// ── Connecting ──

	override async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
		const h = (k: keyof typeof WOODS_HEADERS) => {
			const v = request.headers.get(WOODS_HEADERS[k]) ?? "";
			try {
				return decodeURIComponent(v);
			} catch {
				return v;
			}
		};
		const childId = h("child");
		const familyId = h("family");
		if (!childId || !familyId) return new Response("Missing who", { status: 400 });
		const guest = h("guest") === "1";
		if (!guest && h("island")) {
			this.label = h("island");
			this.setMeta("label", this.label);
		}

		const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
		this.ctx.acceptWebSocket(server);
		// The same kid on a second screen: the first one steps aside.
		for (const ws of this.sockets()) {
			if (this.who(ws)?.childId === childId) this.kick(ws, "elsewhere");
		}
		const taken = new Set(this.figures().map((f) => f.seat));
		const seat = [...Array(ISLAND_MAX).keys()].find((s) => !taken.has(s));
		if (seat === undefined) {
			server.send(json({ t: "kicked", why: "full" }));
			server.close(4000, "full");
			return new Response(null, { status: 101, webSocket: client });
		}
		const who: Who = { childId, familyId, label: h("label").slice(0, 24) || "?", guest, seat, p: spawnPoint(this.island()), yaw: 0 };
		server.serializeAttachment(who);

		this.refill(childId);
		const figure = this.figure(who);
		server.send(
			json({
				t: "welcome",
				seat,
				seed: this.seed,
				gen: this.gen,
				island: { label: this.label, mine: !guest, build: !guest || this.guestsBuild },
				figures: this.figures(),
				inv: this.inventory(childId),
				stats: this.stats(childId),
				clock: this.clock,
				lost: this.lost,
				home: this.home,
			}),
		);
		server.send(this.editsFrame());
		this.broadcast({ t: "join", figure }, server);
		await this.startClock();
		return new Response(null, { status: 101, webSocket: client });
	}

	override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const who = this.who(ws);
		if (!who || typeof raw !== "string" || raw.length > 512) return;
		let msg: ClientMsg;
		try {
			const parsed = clientMsg.safeParse(JSON.parse(raw));
			if (!parsed.success) return;
			msg = parsed.data;
		} catch {
			return;
		}
		switch (msg.t) {
			case "move":
				return this.move(ws, who, msg.p, msg.yaw);
			case "mine":
				return this.mine(ws, who, msg.i);
			case "place":
				return this.place(ws, who, msg.i, msg.b);
			case "feed":
				return this.feedFire(ws, who, msg.b);
			case "pickup":
				return this.pickup(who, msg.id);
			case "emote":
				if (this.tooFast(ws, 2)) return;
				return this.broadcast({ t: "emote", seat: who.seat, e: msg.e });
		}
	}

	override async webSocketClose(ws: WebSocket) {
		this.left(ws);
	}

	override async webSocketError(ws: WebSocket) {
		this.left(ws);
	}

	private left(ws: WebSocket) {
		const who = this.who(ws);
		this.recent.delete(ws);
		if (!who) return;
		// An animal following them waits where they were.
		for (const a of this.lost) {
			if (a.follows === who.seat) {
				a.follows = null;
				a.at = [...who.p];
				this.broadcast({ t: "lost", id: a.id, follows: null });
			}
		}
		this.saveLost();
		this.broadcast({ t: "leave", seat: who.seat }, ws);
	}

	// ── What kids do ──

	private move(ws: WebSocket, who: Who, p: [number, number, number], yaw: number) {
		who.p = p;
		who.yaw = yaw;
		ws.serializeAttachment(who);
		this.broadcast({ t: "move", seat: who.seat, p, yaw }, ws);
		// Bringing a lost animal into the firelight brings it home.
		const r = fireRadius(this.clock.fuel);
		if (r <= 0 || Math.hypot(p[0] - this.fire[0] - 0.5, p[2] - this.fire[2] - 0.5) > r) return;
		for (const a of this.lost.filter((l) => l.follows === who.seat)) {
			this.lost = this.lost.filter((l) => l.id !== a.id);
			this.home.push(a.animal);
			this.setMeta("home", JSON.stringify(this.home));
			this.saveLost();
			this.broadcast({ t: "home", id: a.id, animal: a.animal, seat: who.seat });
			this.count(ws, who.childId, (s) => ({ ...s, rescued: s.rescued + 1 }));
		}
	}

	private mine(ws: WebSocket, who: Who, i: number) {
		const b = this.vol.data[i]!;
		const refuse = (why: Extract<ServerMsg, { t: "refused" }>["why"]) => ws.send(json({ t: "refused", i, b, why }));
		if (this.tooFast(ws)) return refuse("fast");
		if (b === B.air || !canMine(b)) return refuse("fixed");
		if (!this.reaches(who, i)) return refuse("reach");
		if (who.guest && !this.guestsBuild) return refuse("visit");
		this.edit(i, B.air, who.familyId);
		this.broadcast({ t: "edit", i, b: B.air, seat: who.seat });
		const drop = blockInfo(b).drop;
		if (drop !== null) this.give(who.childId, drop, 1);
		this.count(ws, who.childId, (s) => ({ ...s, logs: s.logs + (isLog(b) ? 1 : 0), gems: s.gems + (b === B.gem ? 1 : 0) }));
	}

	private place(ws: WebSocket, who: Who, i: number, b: number) {
		const was = this.vol.data[i]!;
		const refuse = (why: Extract<ServerMsg, { t: "refused" }>["why"]) => ws.send(json({ t: "refused", i, b: was, why }));
		if (this.tooFast(ws)) return refuse("fast");
		if (!canPlace(b) || (was !== B.air && was !== B.water && !isPlant(was)) || this.atFire(i)) return refuse("fixed");
		if (!this.reaches(who, i)) return refuse("reach");
		if (who.guest && !this.guestsBuild) return refuse("visit");
		if ((this.inventory(who.childId)[b] ?? 0) < 1) return refuse("inventory");
		if (this.blocksSomeone(i)) return refuse("occupied");
		const isNew = this.sql.exec("SELECT 1 FROM edits WHERE i = ?", i).toArray().length === 0;
		if (isNew && this.editCount() >= EDITS_MAX) return refuse("full");
		this.edit(i, b, who.familyId);
		this.give(who.childId, b, -1);
		this.broadcast({ t: "edit", i, b, seat: who.seat });
		this.count(ws, who.childId, (s) => ({ ...s, placed: s.placed + 1 }));
	}

	private feedFire(ws: WebSocket, who: Who, b: number) {
		const fuel = blockInfo(b).fuel;
		if (fuel <= 0 || (this.inventory(who.childId)[b] ?? 0) < 1) return;
		if (Math.hypot(who.p[0] - this.fire[0] - 0.5, who.p[2] - this.fire[2] - 0.5) > REACH_FIRE + 1) return;
		this.give(who.childId, b, -1);
		this.clock.fuel = feed(this.clock.fuel, fuel);
		this.saveClock();
		this.sendInv(ws, who.childId);
		this.broadcast({ t: "tick", clock: this.clock });
	}

	private pickup(who: Who, id: string) {
		const a = this.lost.find((l) => l.id === id);
		if (!a || a.follows !== null) return;
		if (Math.hypot(who.p[0] - a.at[0], who.p[2] - a.at[2]) > REACH_ANIMAL + 1) return;
		a.follows = who.seat;
		this.saveLost();
		this.broadcast({ t: "lost", id, follows: who.seat });
	}

	// ── The clock ──

	private async startClock() {
		if ((await this.ctx.storage.getAlarm()) !== null) return;
		this.lastTick = Date.now();
		await this.ctx.storage.setAlarm(Date.now() + 1000);
	}

	override async alarm() {
		if (this.sockets().length === 0) {
			// Nobody here: the island waits, exactly as it is, until someone comes back.
			this.lastTick = 0;
			return;
		}
		const now = Date.now();
		const dt = this.lastTick ? Math.min(2, Math.max(0, (now - this.lastTick) / 1000)) : 1;
		this.lastTick = now;
		this.tick(dt, now);
		await this.ctx.storage.setAlarm(now + 1000);
	}

	/** Moves the island on by `dt` seconds. Public for tests, which can't wait for real nights. */
	tick(dt: number, now = Date.now()) {
		const before = phaseAt(this.clock.elapsed);
		this.clock.elapsed += dt;
		this.clock.fuel = burn(this.clock.fuel, dt);
		const after = phaseAt(this.clock.elapsed);

		if (before.phase === "day" && after.phase === "night") {
			this.keptLit = this.clock.fuel > 0;
			this.lost = lostAnimals(this.vol, this.seed, after.night).map((l) => ({ ...l, follows: null }));
			this.saveLost();
			this.broadcast({ t: "night", night: after.night, lost: this.lost });
		}
		if (after.phase === "night" && this.clock.fuel <= 0) this.keptLit = false;
		if (after.phase === "night" && this.clock.fuel < FUEL_MAX * FUEL_LOW && now - this.lastSnuff >= SNUFF_EVERY_S * 1000) {
			this.lastSnuff = now;
			this.snuff();
		}
		if (before.phase === "night" && after.phase === "day") this.dawn(before.night);

		this.saveClock();
		this.broadcast({ t: "tick", clock: this.clock });
	}

	private dawn(night: number) {
		const kept = this.keptLit;
		if (kept) this.clock.nights++;
		// Anyone still lost finds their own way home at sunrise; nobody stays lost.
		this.lost = [];
		this.saveLost();
		this.keptLit = true;
		this.setMeta("keptLit", "1");
		this.broadcast({ t: "dawn", night, kept });
		for (const ws of this.sockets()) {
			const who = this.who(ws);
			if (!who) continue;
			this.refill(who.childId);
			if (kept) this.count(ws, who.childId, (s) => ({ ...s, nights: s.nights + 1 }));
			else this.sendInv(ws, who.childId);
		}
	}

	/** The Night Deer puts out a torch near the camp: the one built nearest the fire. */
	private snuff() {
		const [fx, , fz] = this.fire;
		let best: { i: number; d: number } | null = null;
		for (const r of this.sql.exec<{ i: number }>("SELECT i FROM edits WHERE b = ?", B.torch)) {
			const [x, , z] = cellOf(r.i);
			const d = Math.hypot(x - fx, z - fz);
			if (d <= SNUFF_RANGE && (!best || d < best.d)) best = { i: r.i, d };
		}
		if (!best) return;
		this.edit(best.i, B.air, DEER);
		this.broadcast({ t: "edit", i: best.i, b: B.air, seat: -1 });
	}

	// ── Called by the Worker ──

	/** Who's on the island now. */
	online(): number {
		return this.sockets().length;
	}

	/** A friend link was removed: that family's kids leave this island now. */
	kickFamily(familyId: string): number {
		let n = 0;
		for (const ws of this.sockets()) {
			const who = this.who(ws);
			if (who?.guest && who.familyId === familyId) {
				this.kick(ws, "friends");
				n++;
			}
		}
		return n;
	}

	/** Takes back what one family built or dug here (since `since`, ms), cell by cell, to what was there before. */
	undoFamily(familyId: string, since = 0): number {
		const rows = this.sql
			.exec<{ i: number; prev: number }>("SELECT i, prev FROM edits WHERE by_family = ? AND at >= ?", familyId, since)
			.toArray();
		const packed = new Int32Array(rows.length);
		rows.forEach((r, k) => {
			this.vol.data[r.i] = r.prev;
			if (r.prev === this.base[r.i]) this.sql.exec("DELETE FROM edits WHERE i = ?", r.i);
			else this.sql.exec("UPDATE edits SET b = ?, by_family = '' WHERE i = ?", r.prev, r.i);
			packed[k] = packEdit(r.i, r.prev);
		});
		if (rows.length) for (const ws of this.sockets()) ws.send(packed.buffer);
		return rows.length;
	}

	setGuestsBuild(build: boolean) {
		this.guestsBuild = build;
		this.setMeta("guestsBuild", build ? "1" : "0");
	}

	// ── Helpers ──

	private island() {
		return { volume: this.vol, seed: this.seed, fire: this.fire };
	}

	private sockets() {
		return this.ctx.getWebSockets();
	}

	private who(ws: WebSocket): Who | null {
		return (ws.deserializeAttachment() as Who | null) ?? null;
	}

	private figure(w: Who): Figure {
		return { seat: w.seat, label: w.label, colour: COLOURS[w.seat % COLOURS.length]!, guest: w.guest, p: w.p, yaw: w.yaw };
	}

	private figures(): Figure[] {
		return this.sockets()
			.map((ws) => this.who(ws))
			.filter((w): w is Who => !!w)
			.map((w) => this.figure(w));
	}

	private broadcast(msg: ServerMsg, except?: WebSocket) {
		const text = json(msg);
		for (const ws of this.sockets()) {
			if (ws === except) continue;
			try {
				ws.send(text);
			} catch {}
		}
	}

	private kick(ws: WebSocket, why: Extract<ServerMsg, { t: "kicked" }>["why"]) {
		try {
			ws.send(json({ t: "kicked", why }));
			ws.close(4000, why);
		} catch {}
		this.left(ws);
		// The socket lingers in getWebSockets until the close completes; forget who it was now.
		ws.serializeAttachment(null);
	}

	/** At most `perSecond` actions a second from one screen. */
	private tooFast(ws: WebSocket, perSecond = EDITS_PER_S) {
		const now = Date.now();
		const times = (this.recent.get(ws) ?? []).filter((t) => now - t < 1000);
		times.push(now);
		this.recent.set(ws, times);
		return times.length > perSecond;
	}

	private reaches(who: Who, i: number) {
		const [x, y, z] = cellOf(i);
		return Math.hypot(x + 0.5 - who.p[0], y + 0.5 - (who.p[1] + 1.5), z + 0.5 - who.p[2]) <= REACH + 1.5;
	}

	/** The fire's cell and the one above it stay clear. */
	private atFire(i: number) {
		const [x, y, z] = this.fire;
		return i === indexOf(x, y, z) || i === indexOf(x, y + 1, z);
	}

	/** A block there would trap a figure (it overlaps someone's feet or head). */
	private blocksSomeone(i: number) {
		const [x, y, z] = cellOf(i);
		return this.figures().some(
			(f) => Math.abs(f.p[0] - (x + 0.5)) < 0.8 && Math.abs(f.p[2] - (z + 0.5)) < 0.8 && f.p[1] < y + 1 && f.p[1] + 1.7 > y,
		);
	}

	private edit(i: number, b: number, by: string) {
		const prev = this.vol.data[i]!;
		this.vol.data[i] = b;
		if (b === this.base[i]) this.sql.exec("DELETE FROM edits WHERE i = ?", i);
		else
			this.sql.exec(
				"INSERT INTO edits (i, b, prev, by_family, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (i) DO UPDATE SET b = excluded.b, prev = excluded.prev, by_family = excluded.by_family, at = excluded.at",
				i,
				b,
				prev,
				by,
				Date.now(),
			);
	}

	private editCount() {
		return this.sql.exec<{ n: number }>("SELECT count(*) AS n FROM edits").one().n;
	}

	/** Everything changed on the island, as one binary frame of packed edits. */
	private editsFrame(): ArrayBuffer {
		const rows = this.sql.exec<{ i: number; b: number }>("SELECT i, b FROM edits").toArray();
		const packed = new Int32Array(rows.length);
		rows.forEach((r, k) => {
			packed[k] = packEdit(r.i, r.b);
		});
		return packed.buffer;
	}

	private inventory(childId: string): Inventory {
		const inv: Inventory = {};
		for (const r of this.sql.exec<{ b: number; n: number }>("SELECT b, n FROM inv WHERE child_id = ? AND n > 0", childId)) inv[r.b] = r.n;
		return inv;
	}

	private give(childId: string, b: number, n: number) {
		this.sql.exec(
			"INSERT INTO inv (child_id, b, n) VALUES (?, ?, max(0, min(?, ?))) ON CONFLICT (child_id, b) DO UPDATE SET n = max(0, min(?, n + ?))",
			childId,
			b,
			STACK_MAX,
			n,
			STACK_MAX,
			n,
		);
	}

	/** Wool and torches top back up to their daily supply. */
	private refill(childId: string) {
		for (const [b, n] of Object.entries(REFILLS)) {
			this.sql.exec(
				"INSERT INTO inv (child_id, b, n) VALUES (?, ?, ?) ON CONFLICT (child_id, b) DO UPDATE SET n = max(n, excluded.n)",
				childId,
				Number(b),
				n,
			);
		}
	}

	private stats(childId: string): WoodsStats {
		const row = this.sql.exec<{ json: string }>("SELECT json FROM stats WHERE child_id = ?", childId).toArray()[0];
		return row ? { ...NO_STATS, ...JSON.parse(row.json) } : { ...NO_STATS };
	}

	/** Updates a kid's counts, sends them their inventory, and tells them about any goal they just met. */
	private count(ws: WebSocket, childId: string, change: (s: WoodsStats) => WoodsStats) {
		const before = this.stats(childId);
		const after = change(before);
		this.sql.exec(
			"INSERT INTO stats (child_id, json) VALUES (?, ?) ON CONFLICT (child_id) DO UPDATE SET json = excluded.json",
			childId,
			JSON.stringify(after),
		);
		this.sendInv(ws, childId, after);
		for (const g of goalsMet(before, after)) ws.send(json({ t: "goal", id: g.id, key: goalKey(g), tickets: g.tickets, label: g.label }));
	}

	private sendInv(ws: WebSocket, childId: string, stats = this.stats(childId)) {
		ws.send(json({ t: "inv", inv: this.inventory(childId), stats }));
	}

	private setMeta(k: string, v: string | number) {
		this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", k, String(v));
	}

	private saveClock() {
		this.setMeta("clock", JSON.stringify(this.clock));
		this.setMeta("keptLit", this.keptLit ? "1" : "0");
	}

	private saveLost() {
		this.setMeta("lost", JSON.stringify(this.lost));
	}
}

const json = (msg: ServerMsg) => JSON.stringify(msg);
