import { expect, type Page, test } from "@playwright/test";
import { openLanding, stubVoice } from "./helpers.ts";

async function setup(page: Page, name: string) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const child = await (await page.request.post("/api/children", { headers: h, data: { name } })).json();
	return { childId: child.id as string, headers: h };
}

/** The problem row's accessible label, e.g. "7 times 8 equals blank" or "6 over 8 equals blank". */
async function problemLabel(page: Page) {
	return (await page.locator("[role=img][aria-label*='blank']").first().getAttribute("aria-label"))!;
}

function solveFact(label: string): number {
	const m = /^(\d+) (times|divided by) (\d+) equals blank$/.exec(label);
	if (!m) throw new Error(`unexpected fact: ${label}`);
	return m[2] === "times" ? Number(m[1]) * Number(m[3]) : Number(m[1]) / Number(m[3]);
}

async function tapKeys(page: Page, answer: string) {
	for (const k of answer) await page.getByRole("button", { name: k === "/" ? "fraction bar" : k, exact: true }).click();
}

test("times-tables round on the keypad: right, missed twice, stop, results", async ({ page }, info) => {
	const shot = (name: string) => page.screenshot({ path: `test-results/${info.project.name}-math-${name}.png`, fullPage: true });
	await stubVoice(page);
	const { childId } = await setup(page, "Max");

	// Hub → Math → Times tables.
	await page.goto(`/play/${childId}`);
	await expect(page.getByRole("heading", { name: "What shall we practice?" })).toBeVisible();
	await shot("hub");
	await page.getByRole("link", { name: /Math/ }).click();
	await expect(page.getByRole("heading", { name: "Math: pick a topic" })).toBeVisible();
	await shot("topics");
	await page.getByRole("link", { name: "Play" }).first().click();
	await page.getByRole("button", { name: "Start" }).click();

	// No text inputs anywhere: the iPad system keyboard can never open during math.
	await expect(page.locator("input, textarea")).toHaveCount(0);

	// Problem 1: right.
	const first = solveFact(await problemLabel(page));
	await tapKeys(page, String(first).slice(0, 1));
	await shot("answering");
	await tapKeys(page, String(first).slice(1));
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
	await page.getByRole("button", { name: /Next/ }).click();

	// Problem 2: wrong twice → the answer and the "how" are shown.
	const second = solveFact(await problemLabel(page));
	const wrong = String(second + 1);
	await tapKeys(page, wrong);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Not quite. Have another go.")).toBeVisible();
	await tapKeys(page, wrong);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText(`The answer is ${second}`)).toBeVisible();
	await shot("reveal");

	// Stop early: answers are saved, results show the miss with its explanation.
	await page.getByRole("link", { name: "Leave round" }).click();
	await page.getByRole("button", { name: "Stop", exact: true }).click();
	await expect(page.getByText("1 of 2 right")).toBeVisible();
	await expect(page.getByText("Stopped after 2 of 10 problems")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Worth another look" })).toBeVisible();
	await shot("results");
	await page.goto(`/parent/progress/${childId}`);
	await expect(page.getByRole("heading", { name: "Times-table grid" })).toBeVisible();
	await shot("parent");

	const progress = await (await page.request.get(`/api/children/${childId}/progress`)).json();
	expect(progress.stats.totalStars).toBe(3);
	expect(Object.keys(progress.math.factBoxes)).toHaveLength(2);
	expect(progress.math.factsDue).toHaveLength(1);
	expect(progress.reviewDue).toEqual([]);
});

test("fractions: simplify with the fraction key", async ({ page }) => {
	await stubVoice(page);
	const { childId, headers } = await setup(page, "Fia");
	await page.request.put(`/api/children/${childId}/math-level`, { headers, data: { skill: "fractions", level: 3 } });

	await page.goto(`/play/${childId}/math/fractions`);
	await page.getByRole("button", { name: "Start" }).click();
	const m = /^(\d+) over (\d+) equals blank$/.exec(await problemLabel(page));
	expect(m, "a simplify problem").not.toBeNull();
	const [n, d] = [Number(m![1]), Number(m![2])];
	const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
	const k = g(n, d);

	// Equal but not simplest earns a nudge, not a miss.
	await tapKeys(page, `${n}/${d}`);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("That's equal, but it can be simpler.")).toBeVisible();
	for (let i = 0; i < `${n}/${d}`.length; i++) await page.getByRole("button", { name: "Delete" }).click();
	await tapKeys(page, `${n / k}/${d / k}`);
	await page.getByRole("button", { name: "Check" }).click();
	await expect(page.getByText("Spot on!")).toBeVisible();
});
