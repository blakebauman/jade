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
	const list = await (await page.request.post("/api/lists", { headers: h, data: { name: "One", words: [{ word }] } })).json();
	return { childId: child.id as string, listId: list.id as string };
}

const tiles = (page: Page) => page.locator("[data-typed-index]");
const row = async (page: Page) => (await tiles(page).allTextContents()).join("");

/** Tap the answer row in the gap before typed tile `i`, the way a finger would. */
async function tapGap(page: Page, i: number) {
	const input = page.getByLabel("Type the spelling");
	const [box, a, b] = await Promise.all([
		input.boundingBox(),
		tiles(page)
			.nth(i - 1)
			.boundingBox(),
		tiles(page).nth(i).boundingBox(),
	]);
	if (!box || !a || !b) throw new Error("row not laid out");
	await input.click({ position: { x: (a.x + a.width + b.x) / 2 - box.x, y: box.height / 2 } });
}

async function startBee(page: Page, word: string) {
	await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page, word, "Cara");
	await page.goto(`/play/${childId}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
}

test("tap between two letters to put in the one that was missed", async ({ page }) => {
	await startBee(page, "necessary");
	await page.getByLabel("Type the spelling").fill("necesary");
	await expect(tiles(page)).toHaveCount(8);

	await tapGap(page, 5);
	await expect(page.locator("[data-caret]")).toHaveAttribute("data-caret", "5");
	await page.screenshot({ path: `test-results/${test.info().project.name}-caret.png` });
	await page.keyboard.type("s");
	expect(await row(page)).toBe("necessary");
	// The caret moved on past the new letter, not to the end.
	await expect(page.locator("[data-caret]")).toHaveAttribute("data-caret", "6");

	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
});

test("backspace mid-word takes out the letter before the caret", async ({ page }) => {
	await startBee(page, "rhythm");
	await page.getByLabel("Type the spelling").fill("rhyythm");
	await tapGap(page, 3);
	await page.keyboard.press("Backspace");
	expect(await row(page)).toBe("rhythm");
	await expect(page.locator("[data-caret]")).toHaveAttribute("data-caret", "2");
	// The arrow keys walk the caret back to the end, where the ringed square takes over again.
	for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
	await expect(page.locator("[data-caret]")).toHaveCount(0);
});
