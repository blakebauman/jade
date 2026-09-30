import { expect, type Page, test } from "@playwright/test";
import { openLanding, stubVoice, stubWords } from "./helpers.ts";

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `home-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json();
	const two = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Two", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	await page.request.post("/api/lists", {
		headers: h,
		data: { name: "Three", words: [{ word: "sun" }, { word: "hat" }, { word: "pig" }] },
	});
	return { childId: child.id as string, twoId: two.id as string };
}

/** The chalk "go" keys on the page: there should only ever be one. */
const goKeys = (page: Page) => page.locator('main [data-variant="go"]');

test("one place to start: new words suggest Learn, and the newest list is up next", async ({ page }) => {
	const { childId } = await setup(page);
	await page.goto(`/play/${childId}/spelling`);
	await expect(page.getByRole("heading", { name: "Your lists" })).toBeVisible();
	await expect(goKeys(page)).toHaveCount(1);
	await expect(goKeys(page)).toHaveAccessibleName("Learn: Three");
	// Every way to practice is explained in words, not only on hover.
	await expect(page.getByText("hear the word and type it, like a real bee")).toBeVisible();
	await expect(page.getByRole("link", { name: "Bee: Two" })).toBeVisible();
	await page.getByRole("link", { name: "Subjects" }).click();
	await expect(page.getByRole("heading", { name: "What shall we practice?" })).toBeVisible();
});

test("an unfinished round carries on from its list, and starting another asks first", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { childId, twoId } = await setup(page);
	await page.goto(`/play/${childId}/round/${twoId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();

	await page.goto(`/play/${childId}/spelling`);
	await expect(goKeys(page)).toHaveCount(1);
	await expect(goKeys(page)).toHaveAccessibleName("Continue Two");
	await expect(page.getByRole("link", { name: "Continue Bee: Two, 1 of 2 done" })).toBeVisible();

	await page.getByRole("link", { name: "Tiles: Three" }).click();
	const ask = page.getByRole("alertdialog", { name: "Start something new?" });
	await expect(ask).toBeVisible();
	await page.getByRole("button", { name: "Back to Two" }).click();
	await expect(ask).toHaveCount(0);

	await page.getByRole("link", { name: "Continue Bee: Two, 1 of 2 done" }).click();
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByText("2/2")).toBeVisible();
});
