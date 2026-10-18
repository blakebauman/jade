import { QUESTS } from "@jade/core";
import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `quests-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	return (await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json()).id as string;
}

const today = (page: Page) =>
	page.evaluate(() => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));

test("today's quests show on the Play page, and a finished one pays its tickets once", async ({ page }) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games`);
	const board = page.getByRole("region", { name: "Today’s quests" });
	await expect(board).toBeVisible();
	await expect(board.getByRole("listitem")).toHaveCount(3);
	await expect(board.getByText("0 of 3 done")).toBeVisible();

	// Every quest finished on this device (whichever three today's are).
	const day = await today(page);
	const progress = Object.fromEntries(
		QUESTS.map((q) => [q.id, q.mode === "distinct" ? Array.from({ length: q.need }, (_, i) => `x${i}`) : q.need]),
	);
	await page.evaluate(
		([key, value]) => localStorage.setItem(key!, value!),
		[`jade.quests.${id}`, JSON.stringify({ day, progress, collected: [] })],
	);
	await page.reload();
	await expect(board.getByText("3 of 3 done")).toBeVisible();

	const collect = board.getByRole("button", { name: /^Collect/ }).first();
	const tickets = Number((await collect.textContent())!.replace(/\D/g, ""));
	await collect.click();
	await expect(board.getByText(`Done! ${tickets} tickets collected`)).toBeVisible();
	await expect(board.getByRole("button", { name: /^Collect/ })).toHaveCount(2);
	const wallet = async () => (await (await page.request.get(`/api/children/${id}/play?day=${day}`)).json()).wallet.tickets as number;
	expect(await wallet()).toBe(tickets);

	// A second collect of the same quest (another tab, a resend) pays nothing more.
	const key = `quest:${day}-${(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).collected[0], `jade.quests.${id}`)) as string}`;
	const again = await page.request.post(`/api/children/${id}/play/earn`, {
		headers: { Origin: new URL(page.url()).origin },
		data: { key, tickets, day },
	});
	expect((await again.json()).earned).toBe(0);
	expect(await wallet()).toBe(tickets);
});

test("visiting a place in town counts toward today's town quests", async ({ page }) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games/roxy/place/park`);
	await expect(page.getByRole("heading", { name: /park/i })).toBeVisible();
	const day = await today(page);
	const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), `jade.quests.${id}`);
	expect(stored.day).toBe(day);
	// Only today's quests keep progress; a town quest today has the park in it.
	for (const [qid, value] of Object.entries(stored.progress)) {
		expect(qid).toMatch(/^town-/);
		expect(value).toEqual(["park"]);
	}
});
