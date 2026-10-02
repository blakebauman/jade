import { expect, test } from "@playwright/test";
import { openLanding, stubVoice, stubWords } from "./helpers.ts";

/**
 * Playwright has no iOS on-screen keyboard, so this fakes what Safari does: the visual viewport shrinks to the
 * area above the keyboard (and `innerHeight` shrinks with it, which is what broke the first version).
 */
test("answer tiles and Check stay above the on-screen keyboard", async ({ page }, info) => {
	test.skip(info.project.name !== "ipad" && info.project.name !== "phone", "upright iPad and iPhone");
	await page.addInitScript(() => {
		// The real layout viewport, read live: at init time a phone hasn't applied its viewport meta yet, so a
		// snapshot here would be a desktop-sized page and the app would never see the keyboard close.
		const real = () => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });
		let up: number | null = null;
		const target = new EventTarget();
		const fake = Object.assign(target, { offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
		Object.defineProperties(fake, {
			width: { get: () => real().width },
			height: { get: () => up ?? real().height },
		});
		Object.defineProperty(window, "visualViewport", { configurable: true, get: () => fake });
		// Safari reports the shrunken height from innerHeight too.
		Object.defineProperty(window, "innerHeight", { configurable: true, get: () => up ?? real().height });
		/** Opens the keyboard leaving `h` px visible, or closes it with null. */
		(window as unknown as { __keyboard: (h: number | null) => void }).__keyboard = (h) => {
			up = h;
			target.dispatchEvent(new Event("resize"));
		};
	});
	await stubVoice(page);
	await stubWords(page);

	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `kb-${Date.now()}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Kay" } })).json();
	const list = await (await page.request.post("/api/lists", { headers: h, data: { name: "One", words: [{ word: "necessary" }] } })).json();

	await page.goto(`/play/${child.id}/round/${list.id}/bee`);
	await page.getByRole("button", { name: "Start" }).click();

	// An upright iPad Pro 11's keyboard leaves roughly 55% of the screen; an iPhone's, with Safari's bars, about half.
	const visible = Math.round(page.viewportSize()!.height * (info.project.name === "phone" ? 0.5 : 0.55));
	await page.evaluate((v) => (window as unknown as { __keyboard: (h: number | null) => void }).__keyboard(v), visible);
	await page.getByLabel("Type the spelling").fill("necesary");
	await expect(page.locator("main[data-keyboard]")).toBeVisible();

	for (const el of [page.getByRole("img", { name: "s" }).first(), page.getByRole("button", { name: "Check" })]) {
		const box = await el.boundingBox();
		expect(box, "element rendered").not.toBeNull();
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.y + box!.height).toBeLessThanOrEqual(visible);
	}
	await page.screenshot({
		path: `test-results/${info.project.name}-keyboard.png`,
		clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: visible },
	});

	// Keyboard closes: the full layout comes back.
	await page.evaluate(() => (window as unknown as { __keyboard: (h: number | null) => void }).__keyboard(null));
	await expect(page.locator("main[data-keyboard]")).toHaveCount(0);
});
