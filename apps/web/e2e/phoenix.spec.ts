import { expect, type Page, test } from "@playwright/test";
import { openLanding, shelfTile } from "./helpers.ts";

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `phoenix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	return (await (await page.request.post("/api/children", { headers: h, data: { name: "Ava" } })).json()).id as string;
}

type Peek = {
	phase: string;
	score: number;
	combo: number;
	counts: { perfect: number; good: number; miss: number; extra: number };
	now: number;
	next: { lane: number; t: number } | null;
	music: "recorded" | "synth" | "none";
};
type Hooks = { setState: (name: string) => Promise<unknown>; peek: () => Peek; setSceneDrawing: (on: boolean) => unknown };
const peek = (page: Page) =>
	page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.peek());

/** Which record answers each request. */
const ANSWER: [RegExp, string][] = [
	[/chill/, "Sunset Glow"],
	[/funky/, "Feather Funk"],
	[/bouncy/, "Ember Pop"],
	[/big one/, "Firebird Drop"],
];
const KEYS = ["KeyD", "KeyF", "KeyJ", "KeyK"];
const PADS = ["Flame", "Star", "Heart", "Diamond"];

test("DJ a set: pick the record asked for, hit notes on the beat, pause, and see the results", async ({ page }, info) => {
	// Drawn in software on a runner without a graphics chip, so each step waits on a slow frame.
	test.slow();
	const id = await setup(page);
	await page.goto(`/play/${id}/games/phoenix`);
	await expect(page.getByRole("heading", { name: "Phoenix DJ Party" })).toBeVisible();
	await expect(page.getByText("You’re the DJ!")).toBeVisible();
	await page.getByRole("button", { name: "Party", exact: true }).click();
	await expect(page.getByRole("button", { name: "Party", exact: true })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Start the party" }).click();

	// The crate: a guest asks for a mood; put on the record that answers it.
	const ask = page.getByText(/asks: “/);
	await expect(ask).toBeVisible();
	const asked = (await ask.textContent())!;
	const record = ANSWER.find(([re]) => re.test(asked))![1];
	await page
		.getByRole("list", { name: "The record crate" })
		.getByRole("button", { name: new RegExp(record) })
		.click();
	await expect(page.getByRole("status")).toHaveText(/loves it!/);
	await expect(page.getByRole("meter", { name: "Party hype" })).toBeAttached();
	// The song is its recording, not the stand-in beat.
	expect((await peek(page)).music).toBe("recorded");

	// Hit the next few notes as they land: a key on a laptop, a tap on a pad on a touch screen. The 3D stops drawing
	// for this (the song and the highway carry on): drawn without a graphics chip, a frame can hold the page a second.
	await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setSceneDrawing(false));
	const touch = info.project.name !== "laptop";
	for (let k = 0; k < 4; k++) {
		const p = await peek(page);
		if (!p.next) break;
		// Timed off the song clock, not the page's frames (a runner without a graphics chip draws few of them).
		await page.waitForTimeout(Math.max(0, (p.next.t - p.now) * 1000 - 15));
		if (touch) await page.getByRole("button", { name: new RegExp(`^${PADS[p.next.lane]} pad`) }).tap();
		else await page.keyboard.press(KEYS[p.next.lane]!);
	}
	const played = await peek(page);
	expect(played.counts.perfect + played.counts.good).toBeGreaterThanOrEqual(1);
	expect(played.score).toBeGreaterThan(0);
	await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setSceneDrawing(true));

	// Pause holds the song and its clock; Carry on goes back to it.
	await page.getByRole("button", { name: "Pause" }).click();
	await expect(page.getByText("Paused")).toBeVisible();
	const held = (await peek(page)).now;
	await page.waitForTimeout(400);
	expect((await peek(page)).now).toBeCloseTo(held, 1);
	await page.getByRole("button", { name: "Carry on" }).first().click();
	await expect(page.getByText("Paused")).toBeHidden();

	// Jump to the end of a set (the dev build's test hook) for the results and Play again.
	await page.evaluate(() => (window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__.setState("results"));
	await expect(page.getByRole("img", { name: /of 5 flames/ })).toBeVisible();
	await expect(page.getByText(/hit \d+% of the beats/)).toBeVisible();
	await page.getByRole("button", { name: "Play again" }).click();
	await expect(page.getByText(/asks: “/)).toBeVisible();
});

test("the home shelf has a Phoenix DJ Party tile", async ({ page }) => {
	const id = await setup(page);
	await page.goto(`/play/${id}/games`);
	await shelfTile(page, "Phoenix DJ Party").click();
	await expect(page).toHaveURL(new RegExp(`/play/${id}/games/phoenix$`));
});

// Real fingers: touch events through Chromium's DevTools protocol, two thumbs at once, with negative identifiers as
// iOS can send. Each lands on its own pad.
test("two fingers press two pads at once", async ({ browser, browserName }, info) => {
	test.skip(browserName !== "chromium" || info.project.name !== "laptop", "touch events are sent through Chromium's protocol");
	test.slow();
	const context = await browser.newContext({ viewport: { width: 600, height: 860 }, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	const id = await setup(page);
	await page.goto(`/play/${id}/games/phoenix`);
	await page.getByRole("button", { name: "Start the party" }).tap();
	await page.getByRole("list", { name: "The record crate" }).getByRole("button").first().tap();
	const flame = (await page.getByRole("button", { name: /^Flame pad/ }).boundingBox())!;
	const heart = (await page.getByRole("button", { name: /^Heart pad/ }).boundingBox())!;
	const before = await peek(page);
	const judged = (p: Peek) => p.counts.perfect + p.counts.good + p.counts.extra;
	const cdp = await context.newCDPSession(page);
	const points = [
		{ x: flame.x + flame.width / 2, y: flame.y + flame.height / 2, id: -3 },
		{ x: heart.x + heart.width / 2, y: heart.y + heart.height / 2, id: -9 },
	];
	await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	await expect.poll(async () => judged(await peek(page)) - judged(before)).toBe(2);
	await context.close();
});
