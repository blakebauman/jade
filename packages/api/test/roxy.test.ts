import { env } from "cloudflare:test";
import { activeHolidays, type Home, type Look, starterHome, starterLook, wear } from "@jade/core/roxy";
import { describe, expect, it } from "vitest";
import { call, signUp } from "./helpers.ts";

type Studio = {
	current: Look;
	wornLookId: string | null;
	looks: { id: string; name: string; look: Look }[];
	unlocked: string[];
	balance: number;
	holidays: { id: string; gift: string; claimed: boolean }[];
	holidaysOff: string[];
	home: Home;
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

const today = () => new Date().toISOString().slice(0, 10);

describe("roxy", () => {
	it("starts each child from their own look, and keeps other families out", async () => {
		const { id, studio, base } = await family();
		const first = await studio();
		expect(first.current).toEqual(starterLook(id));
		expect(first).toMatchObject({ looks: [], unlocked: [], balance: 0, wornLookId: null });
		expect((await call(base, { cookie: await signUp() })).status).toBe(404);
	});

	it("spends stars once per item, and never more than the child has", async () => {
		const { id, studio, post, cookie } = await family();
		expect((await post("/unlock", { itemId: "hat-crown" })).status).toBe(409);
		await giveStars(id, 45);
		const ok = await post("/unlock", { itemId: "hat-crown" });
		expect(await ok.json()).toEqual({ ok: true, balance: 15 });
		// Again: already owned, no charge.
		expect(await (await post("/unlock", { itemId: "hat-crown" })).json()).toEqual({ ok: true, balance: 15 });
		const short = await post("/unlock", { itemId: "form-fox" });
		expect(short.status).toBe(409);
		expect(await short.json()).toEqual({ error: "stars", balance: 15 });
		expect((await studio()).unlocked).toEqual(["hat-crown"]);
		// Lifetime stars (and the star badges) are untouched.
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
		expect((await post("/unlock", { itemId: "hat-witch" })).status).toBe(403);
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
		await giveStars(id, 30);
		expect((await post("/unlock", { itemId: "piano" })).status).toBe(200);
		expect((await put(piano)).status).toBe(200);
		expect((await studio()).home.items).toEqual([{ uid: "p", item: "piano", x: 4, z: 6, rot: 0 }]);
	});
});
