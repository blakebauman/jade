import { expect, test } from "@playwright/test";

test("signing out forgets the family on this device", async ({ page }) => {
	await page.goto("/");
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `so-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	await page.goto("/parent/settings");
	await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
	// What an installed app would have: the remembered user (set by the session check) and the data cache.
	await page.evaluate(async () => {
		const c = await caches.open("jade-data");
		await c.put("/api/children", new Response("[]"));
	});
	expect(await page.evaluate(() => localStorage.getItem("jade.user"))).not.toBeNull();
	await page.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("heading", { name: "Hear it. Spell it. Own it." })).toBeVisible();
	const left = await page.evaluate(async () => ({ user: localStorage.getItem("jade.user"), caches: await caches.keys() }));
	expect(left.user).toBeNull();
	expect(left.caches).not.toContain("jade-data");
});
