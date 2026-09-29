import { expect, test } from "@playwright/test";
import { stubVoice, stubWords } from "./helpers.ts";

/**
 * Playwright has no iOS on-screen keyboard, so this fakes what Safari does: the visual viewport shrinks to the
 * area above the keyboard (and `innerHeight` shrinks with it, which is what broke the first version).
 */
test("answer tiles and Check stay above the iPad keyboard", async ({ page }, info) => {
	test.skip(info.project.name !== "ipad", "iPad-only behaviour");
	await page.addInitScript(() => {
		const target = new EventTarget();
		const fake = Object.assign(target, {
			width: window.innerWidth,
			height: window.innerHeight,
			offsetTop: 0,
			offsetLeft: 0,
			pageTop: 0,
			pageLeft: 0,
			scale: 1,
		});
		Object.defineProperty(window, "visualViewport", { configurable: true, get: () => fake });
		(window as unknown as { __keyboard: (h: number) => void }).__keyboard = (h: number) => {
			fake.height = h;
			// Safari reports the shrunken height from innerHeight too.
			Object.defineProperty(window, "innerHeight", { configurable: true, get: () => h });
			target.dispatchEvent(new Event("resize"));
		};
	});
	await stubVoice(page);
	await stubWords(page);

	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `kb-${Date.now()}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Kay" } })).json();
	const list = await (await page.request.post("/api/lists", { headers: h, data: { name: "One", words: [{ word: "necessary" }] } })).json();

	await page.goto(`/play/${child.id}/round/${list.id}/bee`);
	await page.getByRole("button", { name: "Start" }).click();

	// iPad Pro 11 portrait keyboard leaves roughly 55% of the screen visible.
	const visible = Math.round((page.viewportSize()?.height ?? 1194) * 0.55);
	await page.evaluate((v) => (window as unknown as { __keyboard: (h: number) => void }).__keyboard(v), visible);
	await page.getByLabel("Type the spelling").fill("necesary");
	await expect(page.locator("main[data-keyboard]")).toBeVisible();

	for (const el of [page.getByRole("img", { name: "s" }).first(), page.getByRole("button", { name: "Check" })]) {
		const box = await el.boundingBox();
		expect(box, "element rendered").not.toBeNull();
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.y + box!.height).toBeLessThanOrEqual(visible);
	}
	await page.screenshot({
		path: "test-results/ipad-keyboard.png",
		clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: visible },
	});

	// Keyboard closes: the full layout comes back.
	await page.evaluate(() => (window as unknown as { __keyboard: (h: number) => void }).__keyboard(window.screen.height));
	await expect(page.locator("main[data-keyboard]")).toHaveCount(0);
});
