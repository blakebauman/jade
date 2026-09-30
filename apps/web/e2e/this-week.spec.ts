import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

async function family(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const maya = (await (await page.request.post("/api/children", { headers: h, data: { name: "Maya", grade: 4 } })).json()).id as string;
	const theo = (await (await page.request.post("/api/children", { headers: h, data: { name: "Theo", grade: 2 } })).json()).id as string;
	return { h, maya, theo };
}

const spellingLists = (page: Page) => page.getByRole("heading", { name: "Spelling: pick a list" });

test("a list can be for one kid, and moving it to past lists takes it off their Spelling screen", async ({ page }) => {
	const { maya, theo } = await family(page);
	await page.goto("/parent/lists/new");
	await page.getByLabel("List name").fill("Maya week 6");
	await page.getByRole("button", { name: "Paste" }).click();
	await page.getByPlaceholder("1. believe", { exact: false }).fill("believe\nreceive");
	await page.getByRole("button", { name: "Add these words" }).click();
	await page.getByRole("button", { name: "Theo" }).click();
	await expect(page.getByRole("button", { name: "Everyone" })).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("button", { name: "Save list" }).click();
	await expect(page.getByText("Maya week 6 is saved. Maya can practice it now")).toBeVisible();

	await page.goto(`/play/${theo}/spelling`);
	await expect(spellingLists(page)).toBeVisible();
	await expect(page.getByRole("heading", { name: "Maya week 6" })).toHaveCount(0);
	await page.goto(`/play/${maya}/spelling`);
	await expect(page.getByRole("heading", { name: "Maya week 6" })).toBeVisible();

	await page.goto("/parent");
	await page.getByRole("button", { name: "Move Maya week 6 to past lists" }).click();
	await expect(page.getByText("moved to past lists", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: /Past lists \(1\)/ }).click();
	await expect(page.getByRole("button", { name: "Bring Maya week 6 back to This week" })).toBeVisible();

	await page.goto(`/play/${maya}/spelling`);
	await expect(spellingLists(page)).toBeVisible();
	await expect(page.getByRole("heading", { name: "Maya week 6" })).toHaveCount(0);
});

test("math levels are nudged from the kid's editor, with an example of each level", async ({ page }) => {
	const { maya } = await family(page);
	await page.goto(`/parent/kids?edit=${maya}`);
	const harder = page.getByRole("button", { name: "Make Times tables harder" });
	await expect(page.getByText("Times tables · level 1 of 5")).toBeVisible();
	await harder.click();
	await expect(page.getByText("Times tables · level 2 of 5")).toBeVisible();
	await page.goto(`/parent/progress/${maya}`);
	await expect(page.getByText("level 2 of 5").first()).toBeVisible();
	await page.getByRole("link", { name: "Change in Kids" }).click();
	await expect(page.getByRole("button", { name: "Make Times tables easier" })).toBeEnabled();
});
