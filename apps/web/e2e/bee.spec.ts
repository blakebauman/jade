import { expect, test } from "@playwright/test";
import { stubVoice, stubWords } from "./helpers.ts";

const WORDS = ["believe", "rhythm"];

test("parent sets up a list, speller plays a Bee round and sees missed words", async ({ page }, info) => {
	const spoken = await stubVoice(page);
	await stubWords(page);
	const email = `e2e-${info.project.name}-${Date.now()}@example.com`;

	// Parent signs up.
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Own it." })).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-landing.png` });
	await page.getByLabel("Your name").fill("Test Parent");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill("spelling-bee-1");
	await page.getByRole("button", { name: "Create family account" }).click();
	await expect(page.getByRole("heading", { name: "Word lists" })).toBeVisible();

	// Adds a speller.
	await page.getByRole("link", { name: "Spellers" }).click();
	await page.getByLabel("First name").fill("Jade");
	await page.getByRole("button", { name: "Add speller" }).click();
	await expect(page.getByRole("heading", { name: "Jade", level: 2 })).toBeVisible();

	// Pastes a list.
	await page.getByRole("link", { name: "Lists" }).click();
	await page.getByRole("link", { name: "New list" }).click();
	await page.getByLabel("List name").fill("Week 6");
	await page.getByPlaceholder("1. believe").fill(WORDS.map((w, i) => `${i + 1}. ${w}`).join("\n"));
	await page.getByRole("button", { name: "Add these words" }).click();
	await expect(page.getByText("Added 2 words.")).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-list-editor.png`, fullPage: true });
	await page.getByRole("button", { name: "Save list" }).click();
	await expect(page.getByRole("link", { name: /Week 6/ })).toBeVisible();

	// Speller picks their tile and starts a Bee round.
	await page.getByRole("link", { name: "Practice", exact: true }).click();
	await page.screenshot({ path: `test-results/${info.project.name}-profiles.png` });
	await page.getByRole("link", { name: "Jade" }).click();
	await page.getByRole("link", { name: "Bee" }).click();
	await page.getByRole("button", { name: "Start" }).click();

	const answer = page.getByLabel("Type the spelling");
	const check = page.getByRole("button", { name: "Check" });

	// Word 1: spelled right first time.
	await expect.poll(() => spoken.length).toBeGreaterThan(0);
	const first = spoken.at(-1)!;
	expect(WORDS).toContain(first);
	// Pre-check state: a bee question answered on the maple strip, partial spelling, mastery pips.
	await page.getByRole("button", { name: "Definition" }).click();
	await expect(page.getByText("Definition:")).toBeVisible();
	await answer.fill(first.slice(0, 3));
	await page.screenshot({ path: `test-results/${info.project.name}-precheck.png` });
	await answer.fill(first);
	await check.click();
	await expect(page.getByText("Spot on!")).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-correct.png` });
	await page.getByRole("button", { name: "Next word" }).click();

	// Word 2: missed twice; the right spelling is revealed.
	await expect.poll(() => spoken.filter((w) => w !== first).length).toBeGreaterThan(0);
	const second = WORDS.find((w) => w !== first)!;
	// First try drops a letter (sky square where it belongs).
	await answer.fill(second.slice(0, 2) + second.slice(3));
	await check.click();
	await expect(page.getByText(/Almost\./)).toBeVisible();
	await expect(page.getByRole("img", { name: "missing letter" })).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-retry.png` });
	// Second try swaps two letters (coral), then the right spelling is revealed.
	await answer.fill(second.slice(0, 1) + second.slice(2, 3) + second.slice(1, 2) + second.slice(3));
	await check.click();
	await expect(page.getByText("Here’s how it’s spelled:")).toBeVisible();
	await expect(page.getByRole("img", { name: `The spelling is ${[...second].join(" ")}` })).toBeVisible();
	const finish = page.getByRole("button", { name: /Finish/ });
	await expect(finish).toBeEnabled({ timeout: 15_000 });
	await page.screenshot({ path: `test-results/${info.project.name}-reveal.png` });
	await finish.click();

	// Results: score and the missed word.
	await expect(page.getByText("1 of 2 spelled right")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Words to practice" })).toBeVisible();
	await expect(page.getByRole("button", { name: `Hear ${second}` })).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-results.png`, fullPage: true });

	// Review now offers the missed word.
	await page.getByRole("link", { name: "Done" }).click();
	await expect(page.getByText(/1 word wants another go/)).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-home.png`, fullPage: true });

	// Parent progress view: trouble word with its pips.
	const childId = new URL(page.url()).pathname.split("/")[2];
	await page.goto(`/parent/progress/${childId}`);
	await expect(page.getByRole("heading", { name: "Trouble words" })).toBeVisible();
	await page.screenshot({ path: `test-results/${info.project.name}-progress.png`, fullPage: true });
});
