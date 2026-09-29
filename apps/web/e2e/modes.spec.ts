import { expect, type Page, test } from "@playwright/test";
import { openLanding, stubVoice, stubWords } from "./helpers.ts";

/** Parent, speller and a one-word list created through the API (the browser context shares the cookie). */
async function setup(page: Page, word: string, name: string) {
	await openLanding(page);
	const origin = new URL(page.url()).origin;
	const h = { Origin: origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name } })).json();
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "One", words: [{ word, sentence: `I like the ${word}.` }] } })
	).json();
	return { childId: child.id as string, listId: list.id as string };
}

test("Tiles mode: tap tiles to build the word", async ({ page }) => {
	await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page, "cat", "Tia");
	await page.goto(`/play/${childId}/round/${listId}/tiles`);
	await page.getByRole("button", { name: "Start" }).click();
	for (const c of "cat")
		await page
			.getByRole("button", { name: `Place ${c}` })
			.first()
			.click();
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
	await page.getByRole("button", { name: /Finish/ }).click();
	await expect(page.getByText("1 of 1 spelled right")).toBeVisible();
});

test("Learn mode: study, cover, spell", async ({ page }) => {
	await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page, "friend", "Leo");
	await page.goto(`/play/${childId}/round/${listId}/learn`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByRole("img", { name: /^friend, split as/ })).toBeVisible();
	await expect(page.getByText("“I like the friend.”")).toBeVisible();
	await page.getByRole("button", { name: /Cover it/ }).click();
	await page.getByLabel("Type the spelling").fill("friend");
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
});
