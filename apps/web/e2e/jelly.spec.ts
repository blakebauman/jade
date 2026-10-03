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

type Peek = { x: number | null; rot: number | null; pieces: number; score: number };
type Hooks = { setState: (name: string) => Promise<unknown>; peek: () => Peek };
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

// Real fingers, not a mouse: Playwright's mouse in the iPad project sends mouse pointer events, which once hid three
// bugs that only a real iPad showed. Touch events through Chromium's DevTools protocol, with a negative identifier as
// iOS can send.
test("a finger swipes, taps and flicks the jelly, and holds a touch key", async ({ browser, browserName }, info) => {
	test.skip(browserName !== "chromium" || info.project.name !== "laptop", "touch events are sent through Chromium's protocol");
	const context = await browser.newContext({ viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	const id = await setup(page);
	await page.goto(`/play/${id}/games/jelly`);
	await page.getByRole("button", { name: "Start" }).tap();
	const cdp = await context.newCDPSession(page);
	const finger = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number) =>
		cdp.send("Input.dispatchTouchEvent", { type, touchPoints: x === undefined ? [] : [{ x, y: y!, id: -7 }] });
	const peek = () => page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.peek());
	await expect.poll(async () => (await peek()).x).not.toBeNull();
	const jar = { x: 417, y: 560 };

	// A swipe to the right steps the piece across.
	const x0 = (await peek()).x!;
	await finger("touchStart", jar.x, jar.y);
	for (let i = 1; i <= 8; i++) {
		await finger("touchMove", jar.x + i * 18, jar.y + 2);
		await page.waitForTimeout(30);
	}
	await finger("touchEnd");
	await expect.poll(async () => (await peek()).x!).toBeGreaterThanOrEqual(x0 + 2);

	// A tap turns it.
	const rot = (await peek()).rot;
	await finger("touchStart", jar.x, jar.y);
	await finger("touchEnd");
	await expect.poll(async () => (await peek()).rot).not.toBe(rot);

	// A quick flick down drops it.
	const pieces = (await peek()).pieces;
	await finger("touchStart", jar.x, jar.y - 150);
	for (let i = 1; i <= 4; i++) await finger("touchMove", jar.x + 4, jar.y - 150 + i * 70);
	await finger("touchEnd");
	await expect.poll(async () => (await peek()).pieces).toBe(pieces + 1);

	// Holding Move left with a finger keeps stepping until the wall.
	const key = await page.getByRole("button", { name: "Move left" }).boundingBox();
	const kx = key!.x + key!.width / 2;
	const ky = key!.y + key!.height / 2;
	await finger("touchStart", kx, ky);
	await page.waitForTimeout(700);
	await finger("touchEnd");
	await expect.poll(async () => (await peek()).x!).toBeLessThanOrEqual(0);
	await context.close();
});
