import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

async function parentWithList(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	await page.request.post("/api/children", { headers: h, data: { name: "Maya" } });
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Week 5", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	return list.id as string;
}

const addWord = async (page: Page, word: string) => {
	await page.getByPlaceholder("Add one word").fill(word);
	await page.getByRole("button", { name: "Add", exact: true }).click();
};

test("leaving a list with unsaved changes asks first, and the changes survive a reload", async ({ page }) => {
	const listId = await parentWithList(page);
	await page.goto(`/parent/lists/${listId}`);
	await expect(page.getByLabel("List name")).toHaveValue("Week 5");
	await addWord(page, "friend");
	await expect(page.getByText("Unsaved changes")).toBeVisible();

	await page.getByRole("link", { name: "Kids", exact: true }).click();
	const ask = page.getByRole("alertdialog", { name: "Leave without saving?" });
	await expect(ask).toBeVisible();
	await page.getByRole("button", { name: "Keep editing" }).click();
	await expect(ask).toHaveCount(0);

	await page.reload();
	await expect(page.getByText("Picked up your unsaved changes.")).toBeVisible();
	await expect(page.getByRole("button", { name: "Remove friend" })).toBeVisible();

	await page.getByRole("button", { name: "Save list" }).click();
	await expect(page.getByText("Maya can practice it now", { exact: false })).toBeVisible();
	await expect(page.getByRole("link", { name: /^Edit Week 5, 3 words/ })).toBeVisible();
});

test("a word can be fixed in place, and Clear all can be undone", async ({ page }) => {
	const listId = await parentWithList(page);
	await page.goto(`/parent/lists/${listId}`);
	await page.getByRole("button", { name: "Edit cat" }).click();
	await page.getByLabel("Spelling").fill("kat");
	await page.getByRole("button", { name: "Fix" }).click();
	await expect(page.getByRole("button", { name: "Remove kat" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Remove cat" })).toHaveCount(0);

	await page.getByRole("button", { name: "Clear all" }).click();
	await expect(page.getByText("Cleared 2 words.")).toBeVisible();
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(page.getByRole("button", { name: "Remove kat" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Remove dog" })).toBeVisible();
});

test("a long bee word fits a phone-width row", async ({ page }) => {
	const listId = await parentWithList(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/parent/lists/${listId}`);
	await addWord(page, "responsibility");
	await expect(page.getByRole("button", { name: "Remove responsibility" })).toBeInViewport();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});

test("words read from a photo are ringed, and the first one to check gets focus", async ({ page }) => {
	await parentWithList(page);
	await page.route("**/api/import/ocr", (r) => r.fulfill({ json: { title: "Week 6", words: ["recieve", "because"] } }));
	await page.goto("/parent/lists/new");
	await page.getByRole("button", { name: "Photo of the sheet" }).click();
	await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
		name: "sheet.png",
		mimeType: "image/png",
		buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
	});
	await expect(page.getByText("2 words from the photo to check.")).toBeVisible();
	await expect(page.getByRole("button", { name: "Edit recieve, read from the photo: check the spelling" })).toBeFocused();
	await expect(page.getByLabel("List name")).toHaveValue("Week 6");
	await page.getByRole("button", { name: "They all look right" }).click();
	await expect(page.getByRole("button", { name: "Edit recieve", exact: true })).toBeVisible();
});
