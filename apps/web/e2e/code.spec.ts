import { expect, type Page, test } from "@playwright/test";
import { openLanding, shelfTile, stubVoice } from "./helpers.ts";

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

type Stored = {
	state: { index: number; puzzles: { kind: string; solution: string; starter: string; answer?: { x: number; y: number } }[] };
};
const current = async (page: Page) => {
	const s = JSON.parse((await page.evaluate(() => localStorage.getItem("jade.coderound")))!) as Stored;
	return s.state.puzzles[s.state.index]!;
};

/** Type a program the way a kid at a keyboard would: Enter keeps the indent (and adds one after a colon), Tab and Shift+Tab fix it. */
async function typeCode(page: Page, src: string) {
	const editor = page.getByRole("textbox", { name: /Your code/ });
	await editor.click();
	// Clear what's there (a fix-it puzzle's starter): from the end of the last line, one Backspace a character.
	const there = JSON.parse((await page.evaluate(() => localStorage.getItem("jade.coderound")))!).state.code as string;
	for (let i = 0; i < there.split("\n").length; i++) await page.keyboard.press("ArrowDown");
	await page.keyboard.press("End");
	for (let i = 0; i < there.length; i++) await page.keyboard.press("Backspace");
	let indent = 0;
	const lines = src.split("\n").filter((l) => l.trim() !== "");
	for (const [i, line] of lines.entries()) {
		const want = (line.length - line.trimStart().length) / 4;
		if (i > 0) {
			await page.keyboard.press("Enter");
			indent = lines[i - 1]!.trimEnd().endsWith(":") ? indent + 1 : indent;
		}
		for (; indent > want; indent--) await page.keyboard.press("Shift+Tab");
		for (; indent < want; indent++) await page.keyboard.press("Tab");
		await page.keyboard.type(line.trim());
	}
}

/** Skip to the end of a run, unless a short one has finished first (Skip goes when it does). */
const skip = (page: Page) =>
	page
		.getByRole("button", { name: "Skip" })
		.click({ timeout: 2000 })
		.catch(() => {});

/** Solve whatever puzzle is showing, then wait for the run to finish. */
async function solve(page: Page) {
	const p = await current(page);
	if (p.kind === "predict") {
		await page.getByRole("button", { name: `Row ${p.answer!.y + 1}, square ${p.answer!.x + 1}` }).click();
		await page.getByRole("button", { name: "Check" }).click();
	} else {
		await typeCode(page, p.solution);
		await page.getByRole("button", { name: "Run" }).click();
		await skip(page);
	}
	await expect(page.getByRole("button", { name: /Next|Finish/ })).toBeVisible();
}

test("a Steps round: toolbox taps, a bug marked on its line, typing, predict, results", async ({ page }, info) => {
	const shot = (name: string) => page.screenshot({ path: `test-results/${info.project.name}-code-${name}.png`, fullPage: true });
	await stubVoice(page);
	const { childId } = await setup(page, "Max");

	// Home shelf → Code → Steps (the only open unit).
	await page.goto(`/play/${childId}`);
	await expect(shelfTile(page, "Code")).toBeVisible();
	await shelfTile(page, "Code").click();
	await expect(page.getByRole("heading", { name: "Code: pick a unit" })).toBeVisible();
	await expect(page.getByText("Opens when Steps reaches level 2")).toBeVisible();
	await shot("units");
	await page.getByRole("link", { name: "Play" }).click();
	await page.getByRole("button", { name: "Start" }).click();
	// Like math, nothing here can open the iPad keyboard.
	await expect(page.locator("input, textarea")).toHaveCount(0);

	// Puzzle 1 by toolbox taps alone: a wrong program first, so the run stops on its line, then the fix.
	const first = await current(page);
	expect(first.kind).toBe("build");
	const steps = first.solution.split("\n");
	await page.getByRole("button", { name: "Add forward()" }).click();
	await page.getByRole("button", { name: "Add left()" }).click();
	for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Add forward()" }).click();
	await shot("coding");
	await page.getByRole("button", { name: "Run" }).click();
	await skip(page);
	// The run's problem is marked on a line and said in words.
	await expect(page.locator(".code-line[data-law]")).toHaveCount(1);
	await shot("marked");
	// Clear it with the toolbox's delete (a whole command a tap), then tap the solution in.
	for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Delete" }).click();
	for (const line of steps) await page.getByRole("button", { name: `Add ${line.trim()}` }).click();
	await page.getByRole("button", { name: "Run" }).click();
	await expect(page.locator(".code-line[data-law=right]")).toHaveCount(steps.length, { timeout: 15_000 });
	await expect(page.getByText(/It works|Fixed it/)).toBeVisible();
	await shot("solved");
	await page.getByRole("button", { name: "Next" }).click();

	// The rest, by typing (or tapping the square, for "where will Tuck end up?").
	for (let i = 1; i < 6; i++) {
		const p = await current(page);
		if (p.kind === "predict") await shot("predict");
		if (p.kind === "fix") await shot("fix");
		await solve(page);
		await page.getByRole("button", { name: /Next|Finish/ }).click();
	}

	await expect(page.getByRole("heading", { name: /Perfect round|Great coding|Good work|Every miss/ })).toBeVisible();
	await expect(page.getByText(/of 6 solved/)).toBeVisible();
	await shot("results");

	// Every puzzle was saved: levels and review come back from the server.
	const progress = await (await page.request.get(`/api/children/${childId}/progress`)).json();
	expect(progress.code).toBeTruthy();
	expect(progress.recent[0].mode).toBe("seq");
	expect(progress.recent[0].total).toBe(6);
});

test("a round picks up where it was left", async ({ page }) => {
	await stubVoice(page);
	const { childId } = await setup(page, "Ana");
	await page.goto(`/play/${childId}/code/seq`);
	await page.getByRole("button", { name: "Start" }).click();
	await solve(page);
	await page.getByRole("button", { name: "Next" }).click();
	await page.reload();
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByRole("list", { name: "Puzzle 2 of 6" })).toBeVisible();
	await page.goto(`/play/${childId}`);
	await expect(shelfTile(page, "Code")).toBeVisible();
	await expect(page.getByText(/1 of 6 done/)).toBeVisible();
});

test.describe("real fingers", () => {
	// Chromium only (CDP): touch events with a negative id, as iOS sends, not mouse clicks dressed up as taps.
	test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
	test.skip(({ browserName }) => browserName !== "chromium", "CDP touch is Chromium only");

	test("the toolbox, the line keys and Run answer real touches", async ({ page }) => {
		await stubVoice(page);
		const { childId } = await setup(page, "Ivy");
		await page.goto(`/play/${childId}/code/seq`);
		await page.getByRole("button", { name: "Start" }).click();
		const cdp = await page.context().newCDPSession(page);
		const tap = async (name: string) => {
			const box = await page.getByRole("button", { name, exact: true }).boundingBox({ timeout: 5000 });
			// Only Skip may be gone: a short run can finish first.
			if (!box && name === "Skip") return;
			if (!box) throw new Error(`no ${name} button`);
			const p = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: -3 };
			await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		};
		const p = await current(page);
		for (const line of p.solution.split("\n")) await tap(`Add ${line.trim()}`);
		await expect(page.locator(".code-line")).toHaveCount(p.solution.split("\n").length);
		await tap("Delete");
		await expect(page.locator(".code-line")).toHaveCount(p.solution.split("\n").length);
		await tap(`Add ${p.solution.split("\n").at(-1)!.trim()}`);
		await tap("Run");
		await tap("Skip");
		await expect(page.getByText(/It works/)).toBeVisible();
		// The editor never became a text field, so no on-screen keyboard.
		await expect(page.locator("input, textarea")).toHaveCount(0);
	});
});
