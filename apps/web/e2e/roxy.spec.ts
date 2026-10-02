import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

const today = () => new Date().toISOString().slice(0, 10);

async function setup(page: Page, names = ["Ava"]) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `roxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const ids: string[] = [];
	for (const name of names) ids.push((await (await page.request.post("/api/children", { headers: h, data: { name } })).json()).id);
	return { h, ids };
}

/** Earn stars the real way: a few words spelled right first time (3 stars each). */
async function earnStars(page: Page, h: Record<string, string>, childId: string, words: string[]) {
	const id = `e2e-${crypto.randomUUID()}`;
	await page.request.post("/api/sessions", { headers: h, data: { id, childId, listId: null, mode: "bee", startedAt: Date.now() } });
	const attempts = words.map((word) => ({
		clientId: crypto.randomUUID(),
		word,
		typed: word,
		correct: true,
		tries: 1,
		hintsUsed: 0,
		replays: 0,
		ms: 2000,
	}));
	await page.request.post(`/api/sessions/${id}/attempts`, { headers: h, data: { attempts, at: Date.now(), day: today() } });
}

test("style a Roxy, add cat ears with a gem, and save it to the gallery", async ({ page }) => {
	const { ids } = await setup(page);
	await page.goto(`/play/${ids[0]}`);
	await page.getByRole("link", { name: /Games/ }).click();
	await page.getByRole("link", { name: /^Roxy Style your own character/ }).click();

	// One primary key in the studio.
	await expect(page.locator('main [data-variant="go"]')).toHaveCount(1);
	await page.getByRole("tab", { name: "Hair" }).click();
	// Each starter look is random, so start from a known style before checking Undo.
	await page.getByRole("button", { name: "Buzz", exact: true }).click();
	await page.getByRole("button", { name: "Coily", exact: true }).click();
	await expect(page.getByRole("button", { name: "Coily", exact: true })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Undo" }).click();
	await expect(page.getByRole("button", { name: "Coily", exact: true })).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("button", { name: "Coily", exact: true }).click();

	await page.getByRole("tab", { name: "Gems" }).click();
	await page.getByRole("button", { name: "Sapphire: cat", exact: true }).click();
	await expect(page.getByRole("button", { name: "Sapphire: cat", exact: true })).toHaveAttribute("aria-pressed", "true");

	// A pet of their own, with a name.
	await page.getByRole("tab", { name: "Pets" }).click();
	await page.getByRole("button", { name: "Dog", exact: true }).click();
	await page.getByRole("button", { name: "Mochi", exact: true }).click();
	await expect(page.getByText("and Mochi")).toBeVisible();

	await page.getByRole("button", { name: "Save look" }).click();
	await page.getByRole("button", { name: "Comet", exact: true }).click();
	await expect(page.locator('main [data-variant="go"]')).toHaveCount(1);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("Saved “Comet” to your looks.")).toBeVisible();

	await page.getByRole("link", { name: /My looks/ }).click();
	await expect(page.getByRole("heading", { name: "Comet and Mochi" })).toBeVisible();
	await expect(page.getByText("On stage")).toBeVisible();
});

test("locked items cost stars, and an exact copy of someone's look can't be saved", async ({ page }) => {
	const { h, ids } = await setup(page, ["Ava", "Theo"]);
	const [ava, theo] = ids as [string, string];
	await page.goto(`/play/${ava}/games/roxy`);
	await page.getByRole("tab", { name: "Face" }).click();
	await page.getByRole("button", { name: "Starry, 15 stars" }).click();
	await expect(page.getByText("Earn 15 more in Spelling or Math!")).toBeVisible();
	await page.getByRole("button", { name: "OK", exact: true }).click();

	await earnStars(page, h, ava, ["cat", "dog", "sun", "hat", "pig"]);
	await page.reload();
	await page.getByRole("tab", { name: "Face" }).click();
	await page.getByRole("button", { name: "Starry, 15 stars" }).click();
	await page.getByRole("button", { name: "Unlock" }).click();
	await expect(page.getByRole("button", { name: "Starry", exact: true })).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByTitle("Stars to spend")).toContainText("0");

	// Theo's look, saved by Theo, then Ava tries the very same one. Leave the studio first so no autosave of Ava's
	// own look lands after it.
	await page.goto(`/play/${ava}`);
	await page.evaluate((id) => localStorage.removeItem(`jade.roxy.${id}`), ava);
	const theoLook = (await (await page.request.get(`/api/children/${theo}/roxy`)).json()).current;
	await page.request.post(`/api/children/${theo}/roxy/looks`, { headers: h, data: { name: "Mine", look: theoLook } });
	await page.request.put(`/api/children/${ava}/roxy/current`, { headers: h, data: { look: theoLook } });
	await page.goto(`/play/${ava}/games/roxy`);
	await page.getByRole("button", { name: "Save look" }).click();
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("Someone already made this exact Roxy! Change one thing to make it yours.")).toBeVisible();
});

test("a holiday's collection shows in its week, and a parent can turn it off", async ({ page }) => {
	await page.clock.setFixedTime(new Date("2026-11-05T12:00:00"));
	const { h, ids } = await setup(page);
	await page.goto(`/play/${ids[0]}/games/roxy`);
	await expect(page.getByRole("tab", { name: "Diwali" })).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("heading", { name: "Diwali" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Bindi gem, free gift" })).toBeVisible();

	expect((await page.request.put("/api/parent", { headers: h, data: { roxyHolidaysOff: ["diwali"] } })).ok()).toBe(true);
	await page.reload();
	await page.getByRole("tab", { name: "Clothes" }).click();
	await expect(page.getByRole("tab", { name: "Diwali" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Lehenga/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Qipao, 25 stars, Lunar New Year/ })).toBeVisible();
});

test("decorate Roxy's home, and it's still there after a reload", async ({ page }) => {
	const { ids } = await setup(page);
	await page.goto(`/play/${ids[0]}/games/roxy`);
	await page.getByRole("link", { name: "Home" }).click();
	await expect(page.getByRole("heading", { name: "Roxy’s home" })).toBeVisible();
	await expect(page.getByText("Tap the floor and Roxy walks there.")).toBeVisible();

	await page.getByRole("button", { name: "Decorate" }).click();
	const inRoom = page.getByRole("region", { name: "In the room" });
	await page.getByRole("button", { name: "Add Sofa" }).click();
	await expect(page.getByRole("heading", { name: "Sofa", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Turn" }).click();
	await inRoom.getByRole("button", { name: "Bed", exact: true }).click();
	await page.getByRole("button", { name: "Put away" }).click();
	await page.getByRole("button", { name: "Dots", exact: true }).click();
	// Locked furniture asks for stars it doesn't have yet.
	await page.getByRole("button", { name: "Add Piano, 30 stars" }).click();
	await expect(page.getByText("Earn 30 more in Spelling or Math!")).toBeVisible();

	// Saved shortly after each change.
	await page.waitForResponse((r) => r.url().endsWith("/roxy/home") && r.request().method() === "PUT" && r.ok());
	await page.evaluate((id) => localStorage.removeItem(`jade.roxyhome.${id}`), ids[0]!);
	await page.reload();
	await page.getByRole("button", { name: "Decorate" }).click();
	await expect(inRoom.getByRole("button", { name: "Sofa", exact: true })).toBeVisible();
	await expect(inRoom.getByRole("button", { name: "Bed", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Dots", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("go to town, find something hidden in the park, and it's counted", async ({ page }) => {
	const { ids } = await setup(page);
	await page.goto(`/play/${ids[0]}/games`);
	await page.getByRole("link", { name: /^Town/ }).click();
	await expect(page.getByRole("heading", { name: "Town" })).toBeVisible();
	await page.getByRole("link", { name: /^The park/ }).click();
	await expect(page.getByRole("heading", { name: "The park" })).toBeVisible();
	await expect(page.getByText("0 of 5 found")).toBeVisible();

	// "Help me look" walks Roxy over to the next hidden thing and picks it up.
	await page.getByRole("button", { name: "Help me look" }).click();
	await expect(page.getByText(/You found the golden acorn!/)).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText("1 of 5 found")).toBeVisible();

	await page.getByRole("link", { name: "Town" }).click();
	await expect(page.getByRole("link", { name: /^The park.*1 of 5 found/ })).toBeVisible();

	// The pet shop's sign leads to choosing a pet.
	await page.getByRole("link", { name: /^Pet shop/ }).click();
	await page.getByRole("link", { name: "Choose a pet" }).click();
	await expect(page.getByRole("tab", { name: "Pets" })).toHaveAttribute("aria-selected", "true");
});
