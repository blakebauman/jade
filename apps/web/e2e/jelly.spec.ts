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

type Peek = { x: number | null; rot: number | null; type: number | null; pieces: number; score: number };
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
// iOS can send. Kept cheap for a runner without a graphics chip, where every event waits on a slow frame: few events, a
// small screen, each gesture timed by its own timestamps (as a real one is), and waits until the game has caught up.
test("a finger swipes, taps and flicks the jelly, and holds a touch key", async ({ browser, browserName }, info) => {
	test.skip(browserName !== "chromium" || info.project.name !== "laptop", "touch events are sent through Chromium's protocol");
	test.slow();
	const context = await browser.newContext({ viewport: { width: 600, height: 860 }, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	const id = await setup(page);
	await page.goto(`/play/${id}/games/jelly`);
	await page.getByRole("button", { name: "Start" }).tap();
	// Playing, and the jar listening for fingers (only during a game).
	await expect(page.locator("[data-swipes='on']")).toBeAttached({ timeout: 20_000 });
	const cdp = await context.newCDPSession(page);
	let clock = Date.now() / 1000;
	/** One touch event, `after` seconds after the last (the event's own time, whatever the page is doing). */
	const finger = (type: "touchStart" | "touchMove" | "touchEnd", after: number, x?: number, y?: number) => {
		clock += after;
		return cdp.send("Input.dispatchTouchEvent", { type, timestamp: clock, touchPoints: x === undefined ? [] : [{ x, y: y!, id: -7 }] });
	};
	const peek = () => page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.peek());
	const until = { timeout: 20_000 };
	await expect.poll(async () => (await peek()).x, until).not.toBeNull();
	const jar = { x: 300, y: 430 };

	// A swipe to the right steps the piece across.
	const x0 = (await peek()).x!;
	await finger("touchStart", 0.05, jar.x, jar.y);
	await finger("touchMove", 0.05, jar.x + 20, jar.y);
	await finger("touchMove", 0.1, jar.x + 110, jar.y + 2);
	await finger("touchEnd", 0.05);
	await expect.poll(async () => (await peek()).x!, until).toBeGreaterThanOrEqual(x0 + 2);

	// A tap turns it (the square never turns: drop squares until another piece is in play).
	for (let i = 0; i < 3 && (await peek()).type === 2; i++) {
		const n = (await peek()).pieces;
		await page.getByRole("button", { name: "Drop" }).tap();
		await expect.poll(async () => (await peek()).pieces, until).toBe(n + 1);
	}
	expect((await peek()).type).not.toBe(2);
	const rot = (await peek()).rot;
	await finger("touchStart", 0.3, jar.x, jar.y);
	await finger("touchEnd", 0.08);
	await expect.poll(async () => (await peek()).rot, until).not.toBe(rot);

	// A quick flick down drops it: only a drop scores here (2 a row it falls), however slowly the page is going.
	const score = (await peek()).score;
	await finger("touchStart", 0.3, jar.x, jar.y - 120);
	await finger("touchMove", 0.04, jar.x + 2, jar.y - 60);
	await finger("touchMove", 0.04, jar.x + 4, jar.y + 120);
	await finger("touchEnd", 0.04);
	await expect.poll(async () => (await peek()).score, until).toBeGreaterThan(score);

	// Holding Move left with a finger keeps stepping, to the wall.
	await expect.poll(async () => (await peek()).x, until).not.toBeNull();
	const key = await page.getByRole("button", { name: "Move left" }).boundingBox();
	await finger("touchStart", 0.3, key!.x + key!.width / 2, key!.y + key!.height / 2);
	await expect.poll(async () => (await peek()).x!, until).toBeLessThanOrEqual(0);
	await finger("touchEnd", 0.05);
	await context.close();
});
