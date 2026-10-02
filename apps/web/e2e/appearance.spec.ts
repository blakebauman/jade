import { expect, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

const theme = (page: import("@playwright/test").Page) => page.locator("html");
const themeColor = (page: import("@playwright/test").Page) => page.locator('meta[name="theme-color"]');

test("Day and Night: Auto follows the device, a parent's choice holds on every visit", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "light" });
	await openLanding(page);
	await expect(theme(page)).toHaveAttribute("data-theme", "day");

	await page.request.post("/api/auth/sign-up/email", {
		headers: { Origin: new URL(page.url()).origin },
		data: { email: `theme-${Date.now()}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	await page.goto("/parent/settings");
	await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "true");

	// Auto: the device going dark takes the page with it.
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(theme(page)).toHaveAttribute("data-theme", "night");
	await page.emulateMedia({ colorScheme: "light" });
	await expect(theme(page)).toHaveAttribute("data-theme", "day");

	// Night, chosen: it holds against a light device, and across a reload (lit before React, from the device's copy).
	await page.getByRole("button", { name: "Night", exact: true }).click();
	await expect(theme(page)).toHaveAttribute("data-theme", "night");
	await expect(themeColor(page)).toHaveAttribute("content", "#0e4f43");
	await page.reload();
	await expect(theme(page)).toHaveAttribute("data-theme", "night");
	await expect(page.getByRole("button", { name: "Night", exact: true })).toHaveAttribute("aria-pressed", "true");

	// It lives on the account, so a fresh device (no local copy) gets it too.
	await page.evaluate(() => localStorage.removeItem("jade.appearance"));
	await page.reload();
	await expect(theme(page)).toHaveAttribute("data-theme", "night");

	await page.getByRole("button", { name: "Day", exact: true }).click();
	await expect(theme(page)).toHaveAttribute("data-theme", "day");
	await expect(themeColor(page)).toHaveAttribute("content", "#d4ebe1");
});
