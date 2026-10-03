import { env } from "cloudflare:test";
import { DEFAULT_PLAY, type PlaySettings } from "@jade/core";
import { type Home, type Look, starterHome, starterLook, wear } from "@jade/core/roxy";
import { describe, expect, it } from "vitest";
import { call, signUp } from "./helpers.ts";

type Status = {
	settings: PlaySettings;
	wallet: { stars: number; tickets: number };
	today: { rounds: number; stars: number };
	time: { secondsLeft: number; secondsUsed: number };
	shut: boolean;
	outOfTime: boolean;
	open: boolean;
};

const DAY = "2026-10-02";

async function kid() {
	const cookie = await signUp();
	const { id } = (await (await call("/api/children", { method: "POST", cookie, json: { name: "Jade" } })).json()) as { id: string };
	const base = `/api/children/${id}/play`;
	const status = async () => (await (await call(`${base}?day=${DAY}`, { cookie })).json()) as Status;
	const set = async (s: Partial<PlaySettings>) => call(base, { method: "PUT", cookie, json: { ...DEFAULT_PLAY, ...s, day: DAY } });
	return { cookie, id, base, status, set };
}

const giveStars = (childId: string, stars: number) =>
	env.DB.prepare(
		"insert into child_stats (child_id, total_stars) values (?, ?) on conflict(child_id) do update set total_stars = excluded.total_stars",
	)
		.bind(childId, stars)
		.run();

/** Play a spelling round of `n` words, all right first time (3 stars each), finished on DAY. */
async function round(cookie: string, childId: string, n: number) {
	const words = Array.from({ length: n }, (_, i) => ({ word: `word${String.fromCharCode(97 + i)}` }));
	const list = (await (await call("/api/lists", { method: "POST", cookie, json: { name: "L", words } })).json()) as { id: string };
	const id = crypto.randomUUID();
	await call("/api/sessions", { method: "POST", cookie, json: { id, childId, listId: list.id, mode: "bee", startedAt: Date.now() } });
	const attempts = words.map(({ word }) => ({
		clientId: crypto.randomUUID(),
		word,
		typed: word,
		correct: true,
		tries: 1,
		hintsUsed: 0,
		replays: 0,
		ms: 2000,
	}));
	await call(`/api/sessions/${id}/finish`, { method: "POST", cookie, json: { finishedAt: Date.now(), day: DAY, attempts } });
}

describe("learn and play", () => {
	it("keeps a new kid's games apart from learning, and open", async () => {
		const { status, base } = await kid();
		expect(await status()).toMatchObject({ settings: DEFAULT_PLAY, wallet: { stars: 0, tickets: 0 }, open: true });
		expect((await call(base, { cookie: await signUp() })).status).toBe(404);
	});

	it("opens games after today's round, counting only rounds with enough answers", async () => {
		const { cookie, id, status, set } = await kid();
		await set({ practiceFirst: true, goal: "round" });
		expect(await status()).toMatchObject({ shut: true, open: false });
		await round(cookie, id, 3);
		// Three answers: their stars count, but it isn't a round yet.
		expect(await status()).toMatchObject({ today: { rounds: 0, stars: 9 }, shut: true });
		await round(cookie, id, 5);
		expect(await status()).toMatchObject({ today: { rounds: 1, stars: 24 }, shut: false, open: true });
		// A star goal reads the same day's stars.
		await set({ practiceFirst: true, goal: "stars20" });
		expect((await status()).open).toBe(true);
		// Another day starts again.
		const tomorrow = (await (await call(`/api/children/${id}/play?day=2026-10-03`, { cookie })).json()) as Status;
		expect(tomorrow).toMatchObject({ today: { rounds: 0, stars: 0 }, shut: true });
	});

	it("sells play time for stars, counts it down, and never gives it back", async () => {
		const { cookie, id, base, status, set } = await kid();
		const buy = () => call(`${base}/time`, { method: "POST", cookie, json: { day: DAY } });
		expect((await buy()).status).toBe(403);
		await set({ timeCosts: true });
		expect(await status()).toMatchObject({ outOfTime: true, open: false });
		expect((await buy()).status).toBe(409);
		await giveStars(id, 12);
		expect(await (await buy()).json()).toMatchObject({ time: { secondsLeft: 600 }, wallet: { stars: 7 }, open: true });
		const used = (s: number) => call(`${base}/time/used`, { method: "POST", cookie, json: { secondsUsed: s, day: DAY } });
		expect(await (await used(240)).json()).toMatchObject({ time: { secondsLeft: 360 } });
		// A late, smaller report from another device doesn't give time back...
		expect(await (await used(100)).json()).toMatchObject({ time: { secondsLeft: 360 } });
		// ...and nothing is used past what was bought.
		expect(await (await used(9999)).json()).toMatchObject({ time: { secondsLeft: 0, secondsUsed: 600 }, outOfTime: true });
		// Lifetime stars stay put.
		const progress = (await (await call(`/api/children/${id}/progress`, { cookie })).json()) as { stats: { totalStars: number } };
		expect(progress.stats.totalStars).toBe(12);
	});

	it("opens everything while games are free, then keeps what the kid used", async () => {
		const { cookie, id, set } = await kid();
		const roxy = `/api/children/${id}/roxy`;
		await set({ free: true });
		const studio = (await (await call(roxy, { cookie })).json()) as { unlocked: string[]; wallet: { free: boolean } };
		expect(studio.wallet.free).toBe(true);
		expect(studio.unlocked).toEqual(expect.arrayContaining(["hat-crown", "piano", "form-fox"]));
		// Holiday gifts are never sold, so Free doesn't open them.
		expect(studio.unlocked).not.toContain("hat-witch");
		// Wearing and placing paid things saves; unlocking charges nothing.
		const look: Look = wear(starterLook(id), "hat", { item: "hat-crown" });
		expect((await call(`${roxy}/current`, { method: "PUT", cookie, json: { look } })).status).toBe(200);
		const home: Home = { ...starterHome(), items: [{ uid: "p", item: "piano", x: 4, z: 6, rot: 0 }] };
		expect((await call(`${roxy}/home`, { method: "PUT", cookie, json: { home } })).status).toBe(200);
		expect((await call(`${roxy}/unlock`, { method: "POST", cookie, json: { itemId: "form-fox" } })).status).toBe(200);

		const off = (await (await set({ free: false })).json()) as { kept: number };
		expect(off.kept).toBe(2);
		const after = (await (await call(roxy, { cookie })).json()) as { unlocked: string[]; current: Look };
		expect(after.unlocked.sort()).toEqual(["hat-crown", "piano"]);
		expect(after.current.slots.hat?.item).toBe("hat-crown");
	});

	it("pays a game's tickets once per go, capped, and nothing while games are free", async () => {
		const { cookie, base, set } = await kid();
		const earn = async (key: string, tickets: number) =>
			(await (await call(`${base}/earn`, { method: "POST", cookie, json: { key, tickets, day: DAY } })).json()) as Status & {
				earned: number;
			};
		expect(await earn("gobble:r1", 12)).toMatchObject({ earned: 12, wallet: { tickets: 12 } });
		expect(await earn("gobble:r1", 12)).toMatchObject({ earned: 0, wallet: { tickets: 12 } });
		expect(await earn("gobble:r2", 500)).toMatchObject({ earned: 30, wallet: { tickets: 42 } });
		await set({ free: true });
		expect(await earn("gobble:r3", 10)).toMatchObject({ earned: 0, wallet: { tickets: 42 } });
	});
});
