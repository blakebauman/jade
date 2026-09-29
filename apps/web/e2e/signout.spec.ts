import { expect, type Page, test } from "@playwright/test";
import { openLanding, stubVoice, stubWords } from "./helpers.ts";

const PASSWORD = "spelling-bee-1";

async function signUp(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	const email = `so-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
	await page.request.post("/api/auth/sign-up/email", { headers: h, data: { email, password: PASSWORD, name: "P" } });
	return { h, email };
}

/** Plays one word while the server answers every round upload with 401 (the session lapsed): it stays queued. */
async function playOneUnsaved(page: Page) {
	const { h, email } = await signUp(page);
	const spoken = await stubVoice(page);
	await stubWords(page);
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json();
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Two", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	await page.route("**/api/sessions**", (r) => r.fulfill({ status: 401, json: { error: "unauthorized" } }));
	await page.goto(`/play/${child.id}/round/${list.id}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
	return { childId: child.id as string, email, h };
}

const queued = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const req = indexedDB.open("jade");
				req.onsuccess = () => {
					const c = req.result.transaction("ops").objectStore("ops").count();
					c.onsuccess = () => resolve(c.result);
				};
			}),
	);

test("signing out forgets the family on this device", async ({ page }) => {
	await signUp(page);
	await page.goto("/parent/settings");
	await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
	// What an installed app would have: the remembered user (set by the session check) and the data cache.
	await page.evaluate(async () => {
		const c = await caches.open("jade-data");
		await c.put("/api/children", new Response("[]"));
	});
	expect(await page.evaluate(() => localStorage.getItem("jade.user"))).not.toBeNull();
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Solve it." })).toBeVisible();
	const left = await page.evaluate(async () => ({ user: localStorage.getItem("jade.user"), caches: await caches.keys() }));
	expect(left.user).toBeNull();
	expect(left.caches).not.toContain("jade-data");
});

test("unsaved practice: a 401 keeps it queued, sign-out warns, and it uploads once the server takes it", async ({ page }) => {
	const { childId, email, h } = await playOneUnsaved(page);
	expect(await queued(page)).toBeGreaterThan(0);

	await page.goto("/parent/settings");
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Practice from 1 round hasn’t been saved yet" })).toBeVisible();
	await page.getByRole("button", { name: "Stay signed in" }).click();
	await expect(page.getByRole("heading", { name: /hasn’t been saved yet/ })).toHaveCount(0);

	// The server accepts writes again: signing out uploads the practice first, then signs out.
	await page.unroute("**/api/sessions**");
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Solve it." })).toBeVisible();
	expect(await queued(page)).toBe(0);

	// The word really reached the server.
	await page.request.post("/api/auth/sign-in/email", { headers: h, data: { email, password: PASSWORD } });
	const progress = await (await page.request.get(`/api/children/${childId}/progress`)).json();
	expect(progress.stats.wordsSpelled).toBe(1);
});

test("unsaved practice: 'Sign out anyway' discards it", async ({ page }) => {
	await playOneUnsaved(page);
	await page.goto("/parent/settings");
	await page.getByRole("button", { name: "Sign out" }).click();
	await page.getByRole("button", { name: "Sign out anyway" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Solve it." })).toBeVisible();
	expect(await queued(page)).toBe(0);
});
