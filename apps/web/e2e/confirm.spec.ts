import { expect, type Page, test } from "@playwright/test";
import { stubVoice, stubWords } from "./helpers.ts";

const shot = (page: Page, n: string) =>
	process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${test.info().project.name}-${n}.png` }) : Promise.resolve();

async function setup(page: Page) {
	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Maya" } })).json();
	await page.request.post("/api/children", { headers: h, data: { name: "Theo" } });
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Two", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	return { childId: child.id as string, listId: list.id as string };
}

test("stopping a round asks in place; Escape and Keep going back out", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { childId, listId } = await setup(page);
	await page.goto(`/play/${childId}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();

	const ask = page.getByRole("alertdialog", { name: "Stop here?" });
	await page.getByRole("link", { name: "Leave round" }).click();
	await expect(ask).toBeVisible();
	await expect(ask).toContainText("Your 1 answer is saved");
	await expect(page.getByRole("button", { name: "Keep going" })).toBeFocused();
	await shot(page, "stop");
	await page.keyboard.press("Escape");
	await expect(ask).toHaveCount(0);
	await expect(page.getByText("Spot on!")).toBeVisible();

	await page.getByRole("link", { name: "Leave round" }).click();
	await page.getByRole("button", { name: "Keep going" }).click();
	await expect(ask).toHaveCount(0);

	await page.getByRole("link", { name: "Leave round" }).click();
	await page.getByRole("button", { name: "Stop", exact: true }).click();
	await expect(page.getByText("1 of 1 spelled right")).toBeVisible();
});

test("removing a kid and deleting a list ask in place", async ({ page }) => {
	const { listId } = await setup(page);
	await page.goto("/parent/kids");
	await page.getByRole("button", { name: "Remove" }).last().click();
	const ask = page.getByRole("alertdialog", { name: "Remove Theo?" });
	await expect(ask).toBeVisible();
	await shot(page, "remove-kid");
	await page.getByRole("button", { name: "Cancel" }).click();
	await expect(ask).toHaveCount(0);
	await page.getByRole("button", { name: "Remove" }).last().click();
	await page.getByRole("button", { name: "Remove Theo" }).click();
	await expect(page.getByRole("heading", { name: "Theo" })).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Maya" })).toBeVisible();

	await page.goto(`/parent/lists/${listId}`);
	await expect(page.getByRole("textbox", { name: "List name" })).toHaveValue("Two");
	await page.getByRole("button", { name: "Delete" }).click();
	await expect(page.getByRole("alertdialog", { name: "Delete “Two”?" })).toBeVisible();
	await shot(page, "delete-list");
	await page.getByRole("button", { name: "Delete list" }).click();
	await expect(page.getByRole("heading", { name: "Word lists" })).toBeVisible();
	await expect(page.getByText("Two", { exact: true })).toHaveCount(0);
});
