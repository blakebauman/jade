import { expect, type Page, test } from "@playwright/test";
import { openLanding, stubVoice } from "./helpers.ts";

/** An iPhone's notch and home bar, as the installed app sees them. Playwright can't emulate env(safe-area-inset-*). */
const TOP = 47;
const BOTTOM = 34;

async function fakeNotch(page: Page) {
	await page.addInitScript(
		([top, bottom]) => {
			// Inline on <html>: outranks the stylesheet's :root whenever Vite adds it. Init scripts run before the
			// parser has made <html>, so wait for it rather than writing to nothing.
			const apply = () => {
				document.documentElement.style.setProperty("--safe-top", `${top}px`);
				document.documentElement.style.setProperty("--safe-bottom", `${bottom}px`);
			};
			if (document.documentElement) apply();
			else
				new MutationObserver((_, watch) => {
					if (!document.documentElement) return;
					watch.disconnect();
					apply();
				}).observe(document, { childList: true });
		},
		[TOP, BOTTOM],
	);
}

async function setup(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	return (await (await page.request.post("/api/children", { headers: h, data: { name: "Ivy" } })).json()).id as string;
}

const top = async (el: ReturnType<Page["locator"]>) => {
	await expect(el).toBeVisible();
	return (await el.boundingBox())!.y;
};

test("nothing sits under the notch or the home bar", async ({ page }) => {
	await fakeNotch(page);
	await stubVoice(page);
	const childId = await setup(page);

	await page.goto(`/play/${childId}`);
	expect(await top(page.getByRole("heading", { name: "What shall we practice?" }))).toBeGreaterThanOrEqual(TOP);

	await page.goto(`/play/${childId}/math/facts`);
	await page.getByRole("button", { name: "Start" }).click();
	expect(await top(page.getByRole("link", { name: "Leave round" }))).toBeGreaterThanOrEqual(TOP);
	// The Keypad is the lowest thing on the screen: its last key clears the home bar.
	const check = page.getByRole("button", { name: "Check" });
	await check.scrollIntoViewIfNeeded();
	const main = (await page.locator("main").boundingBox())!;
	const box = (await check.boundingBox())!;
	expect(main.y + main.height - (box.y + box.height)).toBeGreaterThanOrEqual(BOTTOM);

	await page.goto("/parent");
	expect(await top(page.getByRole("link", { name: "Practice" }))).toBeGreaterThanOrEqual(TOP);
});

test("a phone on its side keeps the studio's panel beside the scene", async ({ page }, info) => {
	test.skip(info.project.name !== "phone-landscape", "phone-on-its-side layout");
	const childId = await setup(page);
	await page.goto(`/play/${childId}/games/roxy`);
	const panel = page.getByRole("region", { name: "Dress-up panel" });
	await expect(panel).toBeVisible();
	const box = (await panel.boundingBox())!;
	const { width, height } = page.viewportSize()!;
	expect(box.x).toBeGreaterThan(width / 2);
	// A floating column down the right, inset from the edges: not a bottom sheet.
	expect(box.height).toBeGreaterThan(height * 0.75);
	await page.screenshot({ path: "test-results/phone-landscape-studio.png" });
});
