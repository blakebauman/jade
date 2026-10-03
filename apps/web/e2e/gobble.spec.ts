import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `gobble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	return (await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json()).id as string;
}

type Hooks = { setState: (name: string) => Promise<unknown> };

test("play Gobble Town: start, steer, pause, and see the results", async ({ page }, info) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games/gobble`);
	await expect(page.getByRole("heading", { name: "Gobble Town" })).toBeVisible();
	await expect(page.getByText("You’re a hungry hole!")).toBeVisible();
	await page.getByRole("button", { name: "Start" }).click();

	// The countdown, then the clock and the leaderboard with the player in it.
	await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
	const board = page.getByRole("list", { name: "Leaderboard" });
	await expect(board.getByText("You")).toBeVisible();

	// Steer: keys on a laptop, a drag anywhere on a touch screen.
	if (info.project.name === "laptop") {
		await page.keyboard.down("KeyD");
		await page.waitForTimeout(800);
		await page.keyboard.up("KeyD");
	} else {
		const box = page.viewportSize()!;
		await page.mouse.move(box.width / 2, box.height * 0.7);
		await page.mouse.down();
		await page.mouse.move(box.width / 2 + 40, box.height * 0.7, { steps: 5 });
		await page.waitForTimeout(800);
		await page.mouse.up();
	}

	// Pause holds the round; Carry on goes back to it.
	await page.getByRole("button", { name: "Pause" }).click();
	await expect(page.getByText("Paused")).toBeVisible();
	await page.getByRole("button", { name: "Carry on" }).first().click();
	await expect(page.getByText("Paused")).toBeHidden();

	// Jump to the end of a round (the dev build's test hook) for the results and Play again.
	await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setState("results"));
	await expect(page.getByText(/You’re the biggest!|You came \d+(st|nd|rd|th)!/)).toBeVisible();
	await expect(page.getByText("(you)")).toBeVisible();
	await page.getByRole("button", { name: "Play again" }).click();
	await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
});
