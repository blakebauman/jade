import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { B, DAY_S, FUEL_MAX, generate, H, indexOf, NIGHT_S, type ServerMsg, spawnPoint, unpackEdit } from "@jade/core/woods";
import { describe, expect, it } from "vitest";
import type { WoodsWorld } from "../src/woods/WoodsWorld.ts";
import { call, signUp } from "./helpers.ts";

type Screen = { ws: WebSocket; msgs: ServerMsg[]; frames: Int32Array[]; send: (m: unknown) => void };

async function family() {
	const cookie = await signUp();
	const session = (await (await call("/api/auth/get-session", { cookie })).json()) as { user: { id: string } };
	const kid = async (name: string) =>
		((await (await call("/api/children", { method: "POST", cookie, json: { name } })).json()) as { id: string }).id;
	return { cookie, userId: session.user.id, kid, island: () => env.WOODS.getByName(session.user.id) };
}

async function connect(cookie: string, childId: string, island?: string): Promise<Screen> {
	const q = island ? `?island=${island}` : "";
	const res = await call(`/api/children/${childId}/woods/ws${q}`, { cookie, headers: { Upgrade: "websocket" } });
	expect(res.status).toBe(101);
	const ws = res.webSocket!;
	const screen: Screen = { ws, msgs: [], frames: [], send: (m) => ws.send(JSON.stringify(m)) };
	ws.addEventListener("message", (e) => {
		if (typeof e.data === "string") screen.msgs.push(JSON.parse(e.data));
		else if (e.data instanceof ArrayBuffer) screen.frames.push(new Int32Array(e.data));
		else void (e.data as Blob).arrayBuffer().then((b) => screen.frames.push(new Int32Array(b)));
	});
	ws.accept();
	await until(() => screen.msgs.some((m) => m.t === "welcome") && screen.frames.length > 0);
	return screen;
}

async function until(ok: () => boolean, ms = 3000) {
	const end = Date.now() + ms;
	while (!ok()) {
		if (Date.now() > end) throw new Error("timed out waiting");
		await new Promise((r) => setTimeout(r, 10));
	}
}

const find = <T extends ServerMsg["t"]>(s: Screen, t: T) => s.msgs.filter((m): m is Extract<ServerMsg, { t: T }> => m.t === t);
const welcome = (s: Screen) => find(s, "welcome")[0]!;

/** The grass a kid arrives standing on. */
function underFoot(seed: number) {
	const [x, y, z] = spawnPoint(generate(seed));
	return indexOf(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
}

describe("Campfire Woods islands", () => {
	it("welcomes a kid with the island's seed, nothing changed yet, and a supply of wool and torches", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const w = welcome(a);
		expect(w.seat).toBe(0);
		expect(w.seed).toBeGreaterThan(0);
		expect(w.island.mine).toBe(true);
		expect(w.inv[B.woolPink]).toBe(64);
		expect(w.inv[B.torch]).toBe(16);
		expect(a.frames[0]!.length).toBe(0);
	});

	it("lets a kid mine what they can reach, and tells everyone on the island", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const b = await connect(f.cookie, await f.kid("Sam"));
		expect(find(a, "join")[0]!.figure.label).toBe("Sam");
		const i = underFoot(welcome(a).seed);
		a.send({ t: "mine", i });
		await until(() => find(b, "edit").length > 0 && find(a, "inv").length > 0);
		expect(find(b, "edit")[0]).toMatchObject({ i, b: B.air, seat: 0 });
		expect(find(a, "inv")[0]!.inv[B.dirt]).toBe(1);

		// Whoever joins next gets the island as it is now.
		const c = await connect(f.cookie, await f.kid("Kai"));
		expect([...c.frames[0]!].map(unpackEdit)).toEqual([[i, B.air]]);
		expect(
			welcome(c)
				.figures.map((x) => x.label)
				.sort(),
		).toEqual(["Jade", "Kai", "Sam"]);
	});

	it("refuses what can't be done, so the screen can take it back", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const v = generate(welcome(a).seed).volume;
		const far = [48, H - 1, 80] as [number, number, number];
		while (v.get(...far) === B.air) far[1]--;
		a.send({ t: "mine", i: indexOf(...far) });
		a.send({ t: "place", i: indexOf(48, 40, 48), b: B.planks });
		a.send({ t: "mine", i: indexOf(10, 0, 10) });
		await until(() => find(a, "refused").length === 3);
		expect(find(a, "refused").map((r) => r.why)).toEqual(["reach", "reach", "fixed"]);

		// No planks to build with yet.
		const [x, y, z] = spawnPoint(generate(welcome(a).seed));
		a.send({ t: "place", i: indexOf(Math.floor(x) + 2, Math.floor(y), Math.floor(z)), b: B.planks });
		await until(() => find(a, "refused").length === 4);
		expect(find(a, "refused")[3]!.why).toBe("inventory");
	});

	it("builds with what's carried, and a parent can take a family's building back", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const [x, y, z] = spawnPoint(generate(welcome(a).seed));
		const i = indexOf(Math.floor(x) + 2, Math.floor(y), Math.floor(z));
		a.send({ t: "place", i, b: B.woolBlue });
		await until(() => find(a, "edit").length > 0 && find(a, "inv").length > 0);
		expect(find(a, "inv")[0]!.inv[B.woolBlue]).toBe(63);
		expect(find(a, "inv")[0]!.stats.placed).toBe(1);

		expect(await f.island().undoFamily(f.userId)).toBe(1);
		await until(() => a.frames.length > 1);
		expect([...a.frames[1]!].map(unpackEdit)).toEqual([[i, B.air]]);
	});

	it("only lets a kid onto their own family's island", async () => {
		const f = await family();
		const other = await family();
		const res = await call(`/api/children/${await f.kid("Jade")}/woods/ws?island=${other.userId}`, {
			cookie: f.cookie,
			headers: { Upgrade: "websocket" },
		});
		expect(res.status).toBe(403);
		const notMine = await call(`/api/children/${await other.kid("Sam")}/woods/ws`, { cookie: f.cookie, headers: { Upgrade: "websocket" } });
		expect(notMine.status).toBe(404);
	});

	it("moves a kid who opens it on a second screen off the first", async () => {
		const f = await family();
		const id = await f.kid("Jade");
		const a = await connect(f.cookie, id);
		await connect(f.cookie, id);
		await until(() => find(a, "kicked").length > 0);
		expect(find(a, "kicked")[0]!.why).toBe("elsewhere");
	});

	it("loses animals at nightfall, and counts a night only if the fire stayed lit", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const stub = f.island();
		await runInDurableObject(stub, (o: WoodsWorld) => {
			o.tick(DAY_S - 1);
			// Kept fed: full before night, and enough to last it.
			(o as unknown as { clock: { fuel: number } }).clock.fuel = FUEL_MAX;
			o.tick(2);
		});
		await until(() => find(a, "night").length > 0);
		expect(find(a, "night")[0]!.lost).toHaveLength(3);
		await runInDurableObject(stub, (o: WoodsWorld) => o.tick(NIGHT_S));
		await until(() => find(a, "dawn").length > 0 && find(a, "goal").length > 0);
		expect(find(a, "dawn")[0]).toMatchObject({ night: 1, kept: true });
		expect(find(a, "goal")[0]).toMatchObject({ key: "woods:night-1", tickets: 5 });

		// The next night the fire goes out (nobody fed it), so it doesn't count.
		await runInDurableObject(stub, (o: WoodsWorld) => {
			o.tick(DAY_S);
			o.tick(NIGHT_S);
		});
		await until(() => find(a, "dawn").length > 1);
		expect(find(a, "dawn")[1]).toMatchObject({ night: 2, kept: false });
	});

	it("keeps the clock still while nobody is on the island", async () => {
		const f = await family();
		const a = await connect(f.cookie, await f.kid("Jade"));
		const stub = f.island();
		expect(await runInDurableObject(stub, (_o, state) => state.storage.getAlarm())).not.toBeNull();
		a.ws.close();
		await until(() => false, 50).catch(() => {});
		await runDurableObjectAlarm(stub);
		expect(await runInDurableObject(stub, (_o, state) => state.storage.getAlarm())).toBeNull();
		expect(await stub.online()).toBe(0);
	});
});

describe("Campfire Woods friends", () => {
	async function link(a: Awaited<ReturnType<typeof family>>, b: Awaited<ReturnType<typeof family>>) {
		await call("/api/parent/friends", { method: "PUT", cookie: a.cookie, json: { label: "The Rivers" } });
		const { code } = (await (await call("/api/parent/friends/code", { method: "POST", cookie: a.cookie })).json()) as { code: string };
		const preview = await call(`/api/parent/friends/code/${code.toLowerCase()}`, { cookie: b.cookie });
		expect(await preview.json()).toEqual({ label: "The Rivers" });
		const res = await call("/api/parent/friends/accept", { method: "POST", cookie: b.cookie, json: { code } });
		expect(res.status).toBe(200);
		return code;
	}

	it("links two families with a code from one parent, entered by the other, once", async () => {
		const a = await family();
		const b = await family();
		const code = await link(a, b);
		// Used up, and never usable by the parent who made it.
		expect((await call("/api/parent/friends/accept", { method: "POST", cookie: b.cookie, json: { code } })).status).toBe(404);
		const { code: mine } = (await (await call("/api/parent/friends/code", { method: "POST", cookie: a.cookie })).json()) as {
			code: string;
		};
		expect((await call("/api/parent/friends/accept", { method: "POST", cookie: a.cookie, json: { code: mine } })).status).toBe(404);

		const listA = (await (await call("/api/parent/friends", { cookie: a.cookie })).json()) as { friends: { userId: string }[] };
		const listB = (await (await call("/api/parent/friends", { cookie: b.cookie })).json()) as {
			friends: { userId: string; label: string }[];
		};
		expect(listA.friends.map((f) => f.userId)).toEqual([b.userId]);
		expect(listB.friends).toMatchObject([{ userId: a.userId, label: "The Rivers" }]);
	});

	it("turns down a code that's run out", async () => {
		const a = await family();
		const b = await family();
		const { code } = (await (await call("/api/parent/friends/code", { method: "POST", cookie: a.cookie })).json()) as { code: string };
		await env.DB.prepare("update friend_codes set expires_at = ? where code = ?")
			.bind(Date.now() - 1000, code)
			.run();
		expect((await call("/api/parent/friends/accept", { method: "POST", cookie: b.cookie, json: { code } })).status).toBe(404);
	});

	it("lets a friend's kid visit, shown by initial, building only while the hosts allow it", async () => {
		const host = await family();
		const guest = await family();
		await link(host, guest);
		const jade = await connect(host.cookie, await host.kid("Jade"));
		const islands = (await (await call(`/api/children/${await guest.kid("Theo")}/woods/islands`, { cookie: guest.cookie })).json()) as {
			islands: { id: string; label: string; online: number }[];
		};
		expect(islands.islands).toMatchObject([{ label: "Our island" }, { id: host.userId, label: "The Rivers", online: 1 }]);

		const theo = await connect(guest.cookie, await guest.kid("Theo"), host.userId);
		expect(welcome(theo).island).toMatchObject({ label: "The Rivers", mine: false, build: true });
		await until(() => find(jade, "join").length > 0);
		expect(find(jade, "join")[0]!.figure).toMatchObject({ label: "T", guest: true });

		// Theo builds; the hosts switch to "just visit"; Theo's next block is refused; the hosts take his building back.
		const [x, y, z] = spawnPoint(generate(welcome(theo).seed));
		const i = indexOf(Math.floor(x) + 2, Math.floor(y), Math.floor(z));
		theo.send({ t: "place", i, b: B.woolGreen });
		await until(() => find(jade, "edit").length > 0);
		await call("/api/parent/friends", { method: "PUT", cookie: host.cookie, json: { guestsBuild: false } });
		theo.send({ t: "place", i: indexOf(Math.floor(x) - 2, Math.floor(y), Math.floor(z)), b: B.woolGreen });
		await until(() => find(theo, "refused").length > 0);
		expect(find(theo, "refused")[0]!.why).toBe("visit");
		const undo = await call("/api/parent/friends/undo", { method: "POST", cookie: host.cookie, json: { userId: guest.userId } });
		expect(await undo.json()).toEqual({ undone: 1 });

		// Unlinking sends Theo home, and he can't come back.
		expect((await call(`/api/parent/friends/${guest.userId}`, { method: "DELETE", cookie: host.cookie })).status).toBe(200);
		await until(() => find(theo, "kicked").length > 0);
		expect(find(theo, "kicked")[0]!.why).toBe("friends");
		const again = await call(`/api/children/${await guest.kid("Mia")}/woods/ws?island=${host.userId}`, {
			cookie: guest.cookie,
			headers: { Upgrade: "websocket" },
		});
		expect(again.status).toBe(403);
	});
});
