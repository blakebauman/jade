import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

const PASSWORD = "spelling-bee-1";
const PIN = "2468";

/** A parent with a PIN, signed in, who has never unlocked the parent area on this tab. */
async function parentWithPin(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	const email = `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
	await page.request.post("/api/auth/sign-up/email", { headers: h, data: { email, password: PASSWORD, name: "P" } });
	await page.request.put("/api/parent", { headers: h, data: { pin: PIN } });
	return { h, email };
}

const gate = (page: Page) => page.getByRole("heading", { name: "Parents only" });
const settings = (page: Page) => page.getByRole("heading", { name: "Settings" });

async function enterPin(page: Page, pin = PIN) {
	await page.getByLabel("Enter the 4-digit PIN").fill(pin);
	await page.getByRole("button", { name: "Unlock" }).click();
}

test("the parent area asks for the PIN, rejects a wrong one, and stays open across a reload", async ({ page }) => {
	await parentWithPin(page);
	await page.goto("/parent/settings");
	await expect(gate(page)).toBeVisible();
	await enterPin(page, "1111");
	await expect(page.getByRole("alert")).toHaveText("That PIN didn’t match. Try again, or use your account password below.");
	await expect(settings(page)).toHaveCount(0);
	await enterPin(page);
	await expect(settings(page)).toBeVisible();
	await page.reload();
	await expect(settings(page)).toBeVisible();
});

test("going back to Practice locks the parent area again", async ({ page }) => {
	await parentWithPin(page);
	await page.goto("/parent/settings");
	await enterPin(page);
	await expect(settings(page)).toBeVisible();
	await page.getByRole("link", { name: "Practice", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Who’s practicing?" })).toBeVisible();
	await page.getByRole("link", { name: "Parents" }).click();
	await expect(gate(page)).toBeVisible();
});

test("signing out and back in on the same tab asks for the PIN again", async ({ page }) => {
	const { h, email } = await parentWithPin(page);
	await page.goto("/parent/settings");
	await enterPin(page);
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Solve it." })).toBeVisible();
	await page.request.post("/api/auth/sign-in/email", { headers: h, data: { email, password: PASSWORD } });
	await page.goto("/parent/settings");
	await expect(gate(page)).toBeVisible();
});

test("an idle parent area locks itself; activity keeps it open", async ({ page }) => {
	await page.clock.install();
	await parentWithPin(page);
	await page.goto("/parent/settings");
	await enterPin(page);
	await expect(settings(page)).toBeVisible();

	await page.clock.fastForward("04:00");
	await page.keyboard.press("Shift");
	await page.clock.fastForward("04:00");
	await expect(settings(page)).toBeVisible();

	await page.clock.fastForward("05:30");
	await expect(gate(page)).toBeVisible();
});

test("the idle time is the parent's choice in Settings", async ({ page }) => {
	await page.clock.install();
	await parentWithPin(page);
	await page.goto("/parent/settings");
	await enterPin(page);
	const choice = page.getByLabel("Ask again after");
	await expect(choice).toHaveValue("5");
	await choice.selectOption("1");
	await expect(choice).toHaveValue("1");
	await expect(page.getByText("Saved. The PIN is asked for again after 1 minute without a tap.")).toBeVisible();
	await expect(choice).toBeEnabled();

	await page.clock.fastForward("01:10");
	await expect(gate(page)).toBeVisible();
});

test("a longer idle time holds across a reload", async ({ page }) => {
	await page.clock.install();
	const { h } = await parentWithPin(page);
	await page.request.put("/api/parent", { headers: h, data: { pinRelockMinutes: 30 } });
	await page.goto("/parent/settings");
	await enterPin(page);
	await expect(settings(page)).toBeVisible();
	await page.clock.fastForward("10:00");
	await page.reload();
	await expect(settings(page)).toBeVisible();
	await expect(page.getByLabel("Ask again after")).toHaveValue("30");
});

test("a forgotten PIN gives way to the account password, then a new PIN", async ({ page }) => {
	await parentWithPin(page);
	await page.goto("/parent");
	await page.getByRole("button", { name: "Forgot the PIN?" }).click();
	const password = page.getByLabel("Your account password");
	await password.fill("not-it");
	await page.getByRole("button", { name: "Unlock" }).click();
	await expect(page.getByRole("alert")).toHaveText("That password didn’t match.");
	await password.fill(PASSWORD);
	await page.getByRole("button", { name: "Unlock" }).click();
	await expect(settings(page)).toBeVisible();
	await expect(page.getByText("You’re in. Choose a new PIN below, or remove it.")).toBeVisible();
	await expect(page.getByLabel("New PIN")).toBeFocused();
});

test("the gate can sign out, so a family is never stuck on it", async ({ page }) => {
	await parentWithPin(page);
	await page.goto("/parent");
	await expect(gate(page)).toBeVisible();
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Solve it." })).toBeVisible();
});

test("a new PIN has to be typed twice", async ({ page }) => {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	const email = `pin2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
	await page.request.post("/api/auth/sign-up/email", { headers: h, data: { email, password: PASSWORD, name: "P" } });
	await page.goto("/parent/settings");
	await page.getByLabel("Choose a PIN").fill("1357");
	await page.getByLabel("Type it again").fill("1358");
	await expect(page.getByRole("alert")).toHaveText("Those two don’t match. Type the same 4 digits in both.");
	await expect(page.getByRole("button", { name: "Save PIN" })).toBeDisabled();
	await page.getByLabel("Type it again").fill("1357");
	await page.getByRole("button", { name: "Save PIN" }).click();
	await expect(page.getByText("PIN saved.", { exact: false })).toBeVisible();
});
