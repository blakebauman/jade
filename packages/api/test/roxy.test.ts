import { env } from "cloudflare:test";
import { activeHolidays, type Home, type Look, starterHome, starterLook, wear } from "@jade/core/roxy";
import { describe, expect, it } from "vitest";
import { call, signUp } from "./helpers.ts";

type Studio = {
	current: Look;
	wornLookId: string | null;
	looks: { id: string; name: string; look: Look }[];
	unlocked: string[];
	wallet: { free: boolean; tickets: number; stars: number | null };
	holidays: { id: string; gift: string; claimed: boolean }[];
	holidaysOff: string[];
	home: Home;
	finds: string[];
};

async function family() {
	const cookie = await signUp();
	const res = await call("/api/children", { method: "POST", cookie, json: { name: "Roxy fan" } });
	const { id } = (await res.json()) as { id: string };
	const base = `/api/children/${id}/roxy`;
	const studio = async (day?: string) => (await (await call(`${base}${day ? `?day=${day}` : ""}`, { cookie })).json()) as Studio;
	const post = (path: string, json: unknown) => call(`${base}${path}`, { method: "POST", cookie, json });
	return { cookie, id, base, studio, post };
}

/** Stars come from spelling and math; here they're granted straight into the table. */
const giveStars = (childId: string, stars: number) =>
	env.DB.prepare(
		"insert into child_stats (child_id, total_stars) values (?, ?) on conflict(child_id) do update set total_stars = excluded.total_stars",
	)
		.bind(childId, stars)
		.run();

/** Tickets come from games (finds around town); here they're granted straight into the table. */
const giveTickets = (childId: string, tickets: number) =>
	env.DB.prepare(
		"insert into child_stats (child_id, tickets_earned) values (?, ?) on conflict(child_id) do update set tickets_earned = excluded.tickets_earned",
	)
		.bind(childId, tickets)
		.run();

const today = () => new Date().toISOString().slice(0, 10);

describe("roxy", () => {
	it("starts each child from their own look, and keeps other families out", async () => {
		const { id, studio, base } = await family();
		const first = await studio();
		expect(first.current).toEqual(starterLook(id));
		expect(first).toMatchObject({ looks: [], unlocked: [], wallet: { free: false, tickets: 0, stars: null }, wornLookId: null });
		expect((await call(base, { cookie: await signUp() })).status).toBe(404);
	});

	it("spends tickets once per item, and never more than the child has", async () => {
		const { id, studio, post } = await family();
		expect((await post("/unlock", { itemId: "hat-crown" })).status).toBe(409);
		await giveTickets(id, 45);
		const ok = await post("/unlock", { itemId: "hat-crown" });
		expect(await ok.json()).toEqual({ ok: true, wallet: { free: false, tickets: 15, stars: null } });
		// Again: already owned, no charge.
		expect(((await (await post("/unlock", { itemId: "hat-crown" })).json()) as Studio).wallet.tickets).toBe(15);
		const short = await post("/unlock", { itemId: "form-fox" });
		expect(short.status).toBe(409);
		expect(await short.json()).toMatchObject({ error: "tickets" });
		expect((await studio()).unlocked).toEqual(["hat-crown"]);
	});

	it("takes stars only while a parent lets them be spent in games, and never touches lifetime stars", async () => {
		const { id, post, cookie } = await family();
		await giveStars(id, 45);
		const off = await post("/unlock", { itemId: "hat-crown", pay: "stars" });
		expect(off.status).toBe(403);
		expect(await off.json()).toEqual({ error: "stars-off" });
		const link = { free: false, stars: true, practiceFirst: false, goal: "round", timeCosts: false };
		expect((await call(`/api/children/${id}/play`, { method: "PUT", cookie, json: link })).status).toBe(200);
		const ok = await post("/unlock", { itemId: "hat-crown", pay: "stars" });
		expect(await ok.json()).toEqual({ ok: true, wallet: { free: false, tickets: 0, stars: 15 } });
		const short = await post("/unlock", { itemId: "form-fox", pay: "stars" });
		expect(short.status).toBe(409);
		expect(await short.json()).toMatchObject({ error: "stars", wallet: { stars: 15 } });
		const progress = (await (await call(`/api/children/${id}/progress`, { cookie })).json()) as {
			stats: { totalStars: number; starsSpent: number };
		};
		expect(progress.stats).toMatchObject({ totalStars: 45, starsSpent: 30 });
	});

	it("autosaves only looks the child owns", async () => {
		const { id, studio, base, cookie } = await family();
		const put = (look: Look) => call(`${base}/current`, { method: "PUT", cookie, json: { look } });
		const crowned = wear(starterLook(id), "hat", { item: "hat-crown" });
		expect((await put(crowned)).status).toBe(403);
		const night = wear(starterLook(id), "background", { item: "stage-night" });
		expect((await put(night)).status).toBe(200);
		expect((await studio()).current.slots.background).toEqual({ item: "stage-night" });
		expect((await put({ ...night, slots: { ...night.slots, eyes: { item: "hair-bob" } } })).status).toBe(400);
	});

	it("saves one-of-a-kind looks to the gallery, across every family", async () => {
		const a = await family();
		const b = await family();
		const look = wear(starterLook(a.id), "background", { item: "stage-beach" });
		const saved = await a.post("/looks", { name: "Beach day", look });
		expect(saved.status).toBe(201);
		const { id: lookId } = (await saved.json()) as { id: string };
		expect(await a.studio()).toMatchObject({ wornLookId: lookId, looks: [{ id: lookId, name: "Beach day" }] });

		// The exact same look, from the same child and from someone else entirely.
		expect(await (await a.post("/looks", { name: "Again", look })).json()).toEqual({ error: "taken", mine: true });
		const twin = await b.post("/looks", { name: "Copy", look });
		expect(twin.status).toBe(409);
		expect(await twin.json()).toEqual({ error: "taken", mine: false });
		// One thing different makes it theirs.
		expect((await b.post("/looks", { name: "Mine", look: wear(look, "background", { item: "stage-meadow" }) })).status).toBe(201);
	});

	it("caps the gallery, renames, wears and deletes", async () => {
		const { id, base, cookie, post, studio } = await family();
		const stages = ["stage-felt", "stage-meadow", "stage-beach", "stage-night"];
		const noses = ["nose-button", "nose-dot", "nose-round"];
		const ids: string[] = [];
		for (const stage of stages)
			for (const nose of noses) {
				const look = wear(wear(starterLook(id), "background", { item: stage }), "nose", { item: nose });
				const res = await post("/looks", { name: `${stage} ${nose}`, look });
				expect(res.status).toBe(201);
				ids.push(((await res.json()) as { id: string }).id);
			}
		const full = await post("/looks", { name: "One more", look: wear(starterLook(id), "nose", { item: "nose-line" }) });
		expect(await full.json()).toEqual({ error: "full" });

		await call(`${base}/looks/${ids[0]}`, { method: "PATCH", cookie, json: { name: "First", wear: true } });
		const after = await studio();
		expect(after.wornLookId).toBe(ids[0]);
		expect(after.looks[0]?.name).toBe("First");
		await call(`${base}/looks/${ids[0]}`, { method: "DELETE", cookie });
		const gone = await studio();
		expect(gone.looks).toHaveLength(11);
		expect(gone.wornLookId).toBeNull();
	});

	it("gives a holiday's gift free while it's open, unless the family turned it off", async () => {
		const { studio, post, cookie } = await family();
		const day = today();
		const open = activeHolidays(day)[0];
		if (open) {
			expect((await studio(day)).holidays[0]).toMatchObject({ id: open.id, claimed: false });
			expect((await post("/claim", { holidayId: open.id, day })).status).toBe(200);
			expect((await studio(day)).holidays[0]).toMatchObject({ id: open.id, claimed: true });
		}
		// A holiday that isn't on today can't be claimed, and a far-off date isn't believed.
		const closed = (["halloween", "easter"] as const).find((h) => !activeHolidays(day).some((w) => w.id === h))!;
		expect((await post("/claim", { holidayId: closed, day })).status).toBe(403);
		expect((await post("/claim", { holidayId: "halloween", day: "2026-10-31" })).status).toBe(
			Math.abs(Date.parse(day) - Date.parse("2026-10-31")) > 86_400_000 ? 400 : 200,
		);

		await call("/api/parent", { method: "PUT", cookie, json: { roxyHolidaysOff: ["halloween"] } });
		expect((await studio("2026-10-31")).holidays.map((h) => h.id)).not.toContain("halloween");
		expect((await studio()).holidaysOff).toEqual(["halloween"]);
		expect((await post("/unlock", { itemId: "outer-bat" })).status).toBe(403);
	});

	it("never sells a holiday's gift: it's only claimed, free", async () => {
		const { id, studio, post } = await family();
		await giveTickets(id, 50);
		const res = await post("/unlock", { itemId: "hat-witch" });
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "gift" });
		expect(await studio()).toMatchObject({ unlocked: [], wallet: { tickets: 50 } });
	});

	it("takes off a holiday a parent turned off instead of refusing every save", async () => {
		const { id, studio, base, cookie, post } = await family();
		await giveTickets(id, 100);
		for (const itemId of ["outer-bat", "stage-halloween", "pumpkins"]) expect((await post("/unlock", { itemId })).status).toBe(200);
		const putLook = (look: Look) => call(`${base}/current`, { method: "PUT", cookie, json: { look } });
		const putHome = (home: Home) => call(`${base}/home`, { method: "PUT", cookie, json: { home } });
		const spooky = wear(wear(starterLook(id), "outer", { item: "outer-bat" }), "background", { item: "stage-halloween" });
		const room = { ...starterHome(), items: [...starterHome().items, { uid: "h", item: "pumpkins", x: 5, z: 7, rot: 0 }] };
		expect((await putLook(spooky)).status).toBe(200);
		expect((await putHome(room)).status).toBe(200);

		await call("/api/parent", { method: "PUT", cookie, json: { roxyHolidaysOff: ["halloween"] } });
		// What was saved comes back without it...
		const after = await studio();
		expect(after.current.slots.outer).toBeUndefined();
		expect(after.current.slots.background?.item).not.toBe("stage-halloween");
		expect(after.home.items).toEqual(starterHome().items);
		// ...and a device still holding the old look or room saves, getting back what was kept.
		const look = await putLook(spooky);
		expect(look.status).toBe(200);
		const saved = (await look.json()) as { look: Look };
		expect(saved.look.slots.outer).toBeUndefined();
		expect(saved.look).toEqual(after.current);
		const home = await putHome(room);
		expect(home.status).toBe(200);
		expect(((await home.json()) as Home).items).toEqual(starterHome().items);
		// Something never unlocked is still refused.
		expect((await putLook(wear(spooky, "hat", { item: "hat-crown" }))).status).toBe(403);
	});

	it("keeps each child's home, tidies what doesn't fit, and charges for locked furniture", async () => {
		const { id, studio, base, cookie, post } = await family();
		expect((await studio()).home).toEqual(starterHome());
		const put = (home: unknown) => call(`${base}/home`, { method: "PUT", cookie, json: { home } });
		const room = { ...starterHome(), items: [...starterHome().items, { uid: "x", item: "sofa", x: 0, z: 0, rot: 0 }] };
		// The sofa lands on the bed, so it's dropped.
		expect(((await (await put(room)).json()) as Home).items.map((p) => p.uid)).not.toContain("x");
		const piano = { ...starterHome(), items: [{ uid: "p", item: "piano", x: 4, z: 6, rot: 0 }] };
		expect((await put(piano)).status).toBe(403);
		await giveTickets(id, 30);
		expect((await post("/unlock", { itemId: "piano" })).status).toBe(200);
		expect((await put(piano)).status).toBe(200);
		expect((await studio()).home.items).toEqual([{ uid: "p", item: "piano", x: 4, z: 6, rot: 0 }]);
	});

	it("remembers what a child has found around town, once each, and pays tickets the first time", async () => {
		const { studio, post } = await family();
		expect((await studio()).finds).toEqual([]);
		expect(await (await post("/find", { findId: "park-acorn" })).json()).toEqual({ ok: true, tickets: 10 });
		expect(await (await post("/find", { findId: "park-acorn" })).json()).toEqual({ ok: true, tickets: 0 });
		expect((await studio()).wallet.tickets).toBe(10);
		expect((await post("/find", { findId: "moon-rock" })).status).toBe(404);
		expect((await studio()).finds).toEqual(["park-acorn"]);
	});
});
