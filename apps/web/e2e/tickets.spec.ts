import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

const today = () => new Date().toISOString().slice(0, 10);

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `tickets-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const id = (await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json()).id as string;
	return { id, h };
}

type Hooks = { setState: (name: string) => Promise<unknown> };
type Wallet = { wallet: { tickets: number } };

const GAMES = [
	{ game: "gobble", heading: "Gobble Town", over: /You’re the biggest!|You came \d+(st|nd|rd|th)!/ },
	{ game: "jelly", heading: "Jelly Blocks", over: /The jar’s full!/ },
];

// While a parent has a kid's games on Free, a go pays nothing, so the results never claim tickets that weren't paid.
for (const { game, heading, over } of GAMES) {
	test(`${heading} pays tickets, and shows none while games are Free`, async ({ page }) => {
		const { id, h } = await setup(page);
		const results = page.locator("div.glass", { hasText: over });
		const wallet = async () =>
			((await (await page.request.get(`/api/children/${id}/play?day=${today()}`)).json()) as Wallet).wallet.tickets;
		const play = async () => {
			await page.goto(`/play/${id}/games/${game}`);
			await expect(page.getByRole("heading", { name: heading })).toBeVisible();
			await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setState("results"));
			await expect(results).toBeVisible();
		};

		await play();
		await expect(results.locator(".ticket")).toBeVisible();
		await expect.poll(wallet).toBeGreaterThan(0);
		const paid = await wallet();

		const settings = { free: true, stars: false, practiceFirst: false, goal: "round", timeCosts: false, day: today() };
		expect((await page.request.put(`/api/children/${id}/play`, { headers: h, data: settings })).ok()).toBe(true);
		await play();
		await expect(results.locator(".ticket")).toHaveCount(0);
		expect(await wallet()).toBe(paid);
	});
}
