import { expect, type Page, test } from "@playwright/test";
import { stubVoice, stubWords } from "./helpers.ts";

async function setup(page: Page) {
	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Maya" } })).json();
	const list = await (
		await page.request.post("/api/lists", {
			headers: h,
			data: { name: "Three", words: [{ word: "necessary" }, { word: "rhythm" }, { word: "believe" }] },
		})
	).json();
	return { id: child.id as string, listId: list.id as string };
}

test("spelling results show the real first try of a word fixed on the second go", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const { id, listId } = await setup(page);
	await page.goto(`/play/${id}/round/${listId}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	const input = page.getByLabel("Type the spelling");
	// 1: right.
	await expect.poll(() => spoken.length).toBe(1);
	await input.fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await page.getByRole("button", { name: /Next/ }).click();
	// 2: wrong, then fixed.
	await expect.poll(() => spoken.length).toBe(2);
	const w2 = spoken.at(-1)!;
	await input.fill(`${w2.slice(0, -1)}x`);
	await page.getByRole("button", { name: "Check" }).click();
	await page.waitForTimeout(300);
	await input.fill(w2);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Fixed it!")).toBeVisible();
	await page.getByRole("button", { name: /Next/ }).click();
	// 3: missed twice.
	await expect.poll(() => spoken.length).toBe(3);
	for (let i = 0; i < 2; i++) {
		await input.fill("zzq");
		await page.getByRole("button", { name: "Check" }).click();
		await page.waitForTimeout(300);
	}
	await page.getByRole("button", { name: /Finish/ }).click();
	await expect(page.getByRole("heading", { name: "Words to practice" })).toBeVisible();
	// The fixed word shows its real first try, not the right answer.
	await expect(page.getByRole("img", { name: `You wrote ${w2.slice(0, -1)}x` })).toBeVisible();
});

test("math results show the wrong first answer of a problem fixed on the second go", async ({ page }) => {
	await stubVoice(page);
	const { id } = await setup(page);
	await page.goto(`/play/${id}/math/facts`);
	await page.getByRole("button", { name: "Start" }).click();
	const label = async () => (await page.locator("[role=img][aria-label*='blank']").first().getAttribute("aria-label"))!;
	const solve = (l: string) => {
		const m = /^(\d+) (times|divided by) (\d+) equals blank$/.exec(l)!;
		return String(m[2] === "times" ? Number(m[1]) * Number(m[3]) : Number(m[1]) / Number(m[3]));
	};
	const tap = async (s: string) => {
		for (const k of s) await page.getByRole("button", { name: k, exact: true }).click();
	};
	// 1: wrong then right.
	const a1 = solve(await label());
	const wrong1 = String(Number(a1) + 1);
	await tap(wrong1);
	await page.getByRole("button", { name: "Check" }).click();
	await tap(a1);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Fixed it!")).toBeVisible();
	await page.getByRole("button", { name: /Next/ }).click();
	// 2: wrong twice.
	const a2 = solve(await label());
	for (let i = 0; i < 2; i++) {
		await tap(String(Number(a2) + 1));
		await page.getByRole("button", { name: "Check" }).click();
	}
	await page.getByRole("link", { name: "Leave round" }).click();
	await page.getByRole("button", { name: "Stop", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Worth another look" })).toBeVisible();
	// The fix shows the wrong first answer, not the right one.
	await expect(page.getByRole("img", { name: wrong1, exact: true })).toBeVisible();
});

test("a perfect round lands the stars, then lights them marigold", async ({ page }) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Maya" } })).json();
	const list = await (await page.request.post("/api/lists", { headers: h, data: { name: "One", words: [{ word: "cat" }] } })).json();
	await page.goto(`/play/${child.id}/round/${list.id}/bee`);
	await page.getByRole("button", { name: "Start" }).click();
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	await page.getByLabel("Type the spelling").fill(spoken.at(-1)!);
	await page.getByRole("button", { name: "Check" }).click();
	await page.getByRole("button", { name: /Finish/ }).click();
	await page.getByRole("img", { name: "3 of 3 stars" }).waitFor();
	// The keyframes really exist (a missing @keyframes creates no animation at all).
	const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
	expect(names).toContain("tile-land");
	await expect(page.locator(".tile[data-law=right]")).toHaveCount(3);
});
