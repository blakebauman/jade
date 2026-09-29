import { expect, type Page, test } from "@playwright/test";
import { stubVoice, stubWords } from "./helpers.ts";

async function setup(page: Page) {
	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json();
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Two", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	return { childId: child.id as string, listId: list.id as string };
}

/** Spell whatever word was just spoken, correctly. */
async function spellSpoken(page: Page, spoken: string[]) {
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
}

test("stopping mid-round keeps the answers and shows results", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page);
	await page.goto(`/play/${childId}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await spellSpoken(page, spoken);

	await page.getByRole("link", { name: "Leave round" }).click();
	await page.getByRole("button", { name: "Stop", exact: true }).click();
	await expect(page.getByText("1 of 1 spelled right")).toBeVisible();
	await expect(page.getByText("Stopped after 1 of 2 words")).toBeVisible();

	const progress = await (await page.request.get(`/api/children/${childId}/progress`)).json();
	expect(progress.stats).toMatchObject({ totalStars: 3, wordsSpelled: 1, currentStreak: 1 });
});

test("closing the app mid-round: progress is saved and the round can be continued", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page);
	await page.goto(`/play/${childId}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await spellSpoken(page, spoken);
	const first = spoken.at(-1)!;

	// Saved on the server before any "finish".
	await expect.poll(async () => (await (await page.request.get(`/api/children/${childId}/progress`)).json()).stats.wordsSpelled).toBe(1);

	// The app is closed and reopened later.
	await page.goto(`/play/${childId}`);
	await expect(page.getByText("Pick up where you left off")).toBeVisible();
	await expect(page.getByText("Two: 1 of 2 words done")).toBeVisible();
	await page.getByRole("link", { name: "Continue" }).click();
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByText("2/2")).toBeVisible();
	await expect.poll(() => spoken.at(-1)).not.toBe(first);
	await spellSpoken(page, spoken);
	await page.getByRole("button", { name: /Finish/ }).click();
	await expect(page.getByText("2 of 2 spelled right")).toBeVisible();

	const progress = await (await page.request.get(`/api/children/${childId}/progress`)).json();
	expect(progress.stats).toMatchObject({ totalStars: 6, wordsSpelled: 2 });
	expect(progress.recent[0]).toMatchObject({ correct: 2, total: 2 });
});

test("answers given offline sync when the connection returns", async ({ page, context }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page);
	await page.goto(`/play/${childId}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);

	await context.setOffline(true);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
	// Queued on the device, not yet on the server.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					new Promise<number>((r) => {
						const req = indexedDB.open("jade");
						req.onsuccess = () => {
							const tx = req.result.transaction("ops", "readonly").objectStore("ops").count();
							tx.onsuccess = () => r(tx.result);
						};
					}),
			),
		)
		.toBeGreaterThan(0);

	await context.setOffline(false);
	await expect
		.poll(async () => (await (await page.request.get(`/api/children/${childId}/progress`)).json()).stats.wordsSpelled, { timeout: 10_000 })
		.toBe(1);
});
