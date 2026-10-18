import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `jelly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	return (await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json()).id as string;
}

type Hooks = { setState: (name: string) => Promise<unknown> };
type Diagnostics = { renderer: { calls: number; triangles: number }; backend: string };

test("play Jelly Blocks: choose a speed, move, turn and drop, pause, and see the results", async ({ page }, info) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games/jelly`);
	await expect(page.getByRole("heading", { name: "Jelly Blocks" })).toBeVisible();
	await expect(page.getByText("Stack the jelly!")).toBeVisible();

	// The jar is drawn (WebGPU where the browser has it, else WebGL 2) before the game starts.
	await page.waitForFunction(() => {
		const d = (window as unknown as { __THREE_GAME_DIAGNOSTICS__?: Diagnostics }).__THREE_GAME_DIAGNOSTICS__;
		return !!d && d.renderer.calls > 0 && d.renderer.triangles > 0;
	});
	await expect(page.locator("[data-backend]")).toHaveAttribute("data-backend", /^(webgpu|webgl2)$/);

	await page.getByRole("button", { name: "Medium" }).click();
	await expect(page.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Start" }).click();
	const jar = page.getByRole("img", { name: /^Jelly Blocks\./ });
	await expect(jar).toHaveAccessibleName(/level 4/);

	// Move, turn and drop: keys on a laptop, the touch keys on a touch screen.
	if (info.project.name === "laptop") {
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.press("ArrowUp");
		for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
	} else {
		await page.getByRole("button", { name: "Move left" }).tap();
		await page.getByRole("button", { name: "Turn" }).tap();
		for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Drop" }).tap();
	}
	// Dropping scores 2 a row it falls.
	await expect(jar).toHaveAccessibleName(/Score [1-9]/);
	// Hold puts the piece aside, in the Hold tray.
	if (info.project.name === "laptop") await page.keyboard.press("KeyC");
	else await page.getByRole("button", { name: "Hold" }).tap();
	await expect(page.getByRole("region", { name: "Hold" }).getByRole("img")).toBeVisible();

	// Pause holds the game; Carry on goes back to it.
	await page.getByRole("button", { name: "Pause" }).click();
	await expect(page.getByText("Paused")).toBeVisible();
	await page.getByRole("button", { name: "Carry on" }).first().click();
	await expect(page.getByText("Paused")).toBeHidden();

	// Jump to a full jar (the dev build's test hook) for the results and Play again.
	await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setState("results"));
	await expect(page.getByText("The jar’s full!")).toBeVisible();
	await expect(page.getByText(/You popped \d+ rows? and scored/)).toBeVisible();
	await page.getByRole("button", { name: "Play again" }).click();
	await expect(page.getByText("The jar’s full!")).toBeHidden();
	await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("the Play home has a Jelly Blocks card", async ({ page }) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games`);
	await page.getByRole("link", { name: /Jelly Blocks/ }).click();
	await expect(page).toHaveURL(new RegExp(`/play/${id}/games/jelly$`));
});
