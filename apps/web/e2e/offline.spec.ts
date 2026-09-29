import { expect, test } from "@playwright/test";

test("cold start with no connection; offline sign-out is refused", async ({ page, context }) => {
	test.setTimeout(90_000);
	await page.goto("/");
	// Better Auth trusts the dev origin (5190); cookies on localhost aren't port-scoped, so the session carries over.
	const h = { Origin: "http://localhost:5190" };
	const signUp = await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `off-${Date.now()}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	expect(signUp.ok()).toBeTruthy();
	const child = await (await page.request.post("/api/children", { headers: h, data: { name: "Maya" } })).json();
	const list = await (
		await page.request.post("/api/lists", { headers: h, data: { name: "Week 6", words: [{ word: "cat" }, { word: "dog" }] } })
	).json();
	expect(list.id).toBeTruthy();

	// Online once: the service worker installs and the family's screens are visited.
	await page.goto("/profiles");
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload(); // now controlled by the service worker
	await expect(page.getByRole("heading", { name: "Who’s practicing?" })).toBeVisible();
	await page.goto(`/play/${child.id}`);
	await expect(page.getByRole("heading", { name: "What shall we practice?" })).toBeVisible();
	await page.goto(`/play/${child.id}/spelling`);
	await expect(page.getByRole("heading", { name: "Week 6" })).toBeVisible();
	await page.waitForTimeout(800); // list prefetch
	await page.goto(`/play/${child.id}/math`);
	await expect(page.getByRole("heading", { name: "Math: pick a topic" })).toBeVisible();

	// App closed; reopened later with no connection at all.
	const offlinePage = await context.newPage();
	await page.close();
	await context.setOffline(true);
	await offlinePage.goto("/");
	await expect(offlinePage.getByRole("heading", { name: "Who’s practicing?" })).toBeVisible({ timeout: 10_000 });
	await offlinePage.getByRole("link", { name: /Maya/ }).click();
	await expect(offlinePage.getByRole("heading", { name: "What shall we practice?" })).toBeVisible();
	await offlinePage.getByRole("link", { name: /Math/ }).last().click();
	await offlinePage.getByRole("link", { name: "Play" }).first().click();
	await offlinePage.getByRole("button", { name: "Start" }).click();
	await offlinePage.getByRole("button", { name: "1", exact: true }).click();
	await offlinePage.getByRole("button", { name: "Check" }).click();
	await expect(offlinePage.getByText(/Spot on!|Not quite|The answer is/).first()).toBeVisible();

	// A spelling list that was never played online still starts.
	await offlinePage.goto(`/play/${child.id}/round/${list.id}/bee`);
	await expect(offlinePage.getByRole("button", { name: "Start" })).toBeVisible({ timeout: 10_000 });

	// The math answer above is still queued, so signing out warns first. Even "Sign out anyway" needs the server:
	// offline it says it couldn't, and the practice and the remembered family both stay.
	await offlinePage.goto("/parent/settings");
	await offlinePage.getByRole("button", { name: "Sign out" }).click();
	await expect(offlinePage.getByRole("heading", { name: /hasn’t been saved yet/ })).toBeVisible();
	await offlinePage.getByRole("button", { name: "Sign out anyway" }).click();
	await expect(offlinePage.getByRole("alert").filter({ hasText: "Couldn’t sign out" })).toBeVisible();
	expect(await offlinePage.evaluate(() => localStorage.getItem("jade.user"))).not.toBeNull();
	const queued = await offlinePage.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const req = indexedDB.open("jade");
				req.onsuccess = () => {
					const c = req.result.transaction("ops").objectStore("ops").count();
					c.onsuccess = () => resolve(c.result);
				};
			}),
	);
	expect(queued).toBeGreaterThan(0);
});
