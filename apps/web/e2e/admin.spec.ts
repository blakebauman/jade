import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

const PASSWORD = "spelling-bee-1";

async function signUp(page: Page, name: string) {
	const email = `admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", { headers: h, data: { email, password: PASSWORD, name } });
	return { email, h };
}

/**
 * There's no way to become an admin from the app; it's set in D1 by hand. Here that's done through the dev server's
 * own local explorer API, not `wrangler d1 execute`: a second process writing the same SQLite file locks it
 * (SQLITE_BUSY) and can fail the dev server's own queries mid-test.
 */
async function promote(page: Page, email: string) {
	const api = "/cdn-cgi/local/explorer/api/d1/database";
	const dbs = (await (await page.request.get(api)).json()) as { result: { name: string; uuid: string }[] };
	const db = dbs.result.find((d) => d.name === "DB");
	if (!db) throw new Error("No local D1 database named DB");
	const res = await page.request.post(`${api}/${db.uuid}/raw`, {
		data: { sql: "update user set role = 'admin' where email = ?", params: [email] },
	});
	const body = (await res.json()) as { success: boolean; result?: { meta: { changes: number } }[] };
	if (!body.success || body.result?.[0]?.meta.changes !== 1) throw new Error(`Couldn't promote ${email}: ${JSON.stringify(body)}`);
}

test.describe.configure({ mode: "serial" });

test("an admin finds a family, signs in as them past their PIN, and comes back", async ({ page }) => {
	await openLanding(page);
	const family = await signUp(page, "Family E2E");
	await page.request.put("/api/parent", { headers: family.h, data: { pin: "2468" } });
	await page.context().clearCookies();
	const admin = await signUp(page, "Admin E2E");
	// Not an admin yet: no Admin key, and the page sends them back.
	await page.goto("/parent");
	await expect(page.getByRole("link", { name: "Lists" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

	await promote(page, admin.email);
	// The session cookie still carries the old role; signing in again picks up the new one.
	await page.context().clearCookies();
	await page.request.post("/api/auth/sign-in/email", { headers: admin.h, data: { email: admin.email, password: PASSWORD } });
	await page.goto("/parent");
	await page.getByRole("link", { name: "Admin" }).click();
	await page.getByLabel("Find by name or email").fill(family.email);
	const row = page.getByRole("listitem").filter({ hasText: family.email });
	await expect(row).toBeVisible();

	await row.getByRole("button", { name: "Sign in as" }).click();
	await expect(page).toHaveURL(/\/profiles$/);
	await expect(page.getByText(`Signed in as ${family.email} from the admin area`)).toBeVisible();
	// The family's PIN doesn't stand in the admin's way.
	await page.goto("/parent/settings");
	await expect(page.getByText(`Signed in as ${family.email}`, { exact: false }).first()).toBeVisible();
	await expect(page.getByRole("heading", { name: "Parents only" })).toHaveCount(0);

	await page.getByRole("button", { name: "Back to my account" }).click();
	await expect(page).toHaveURL(/\/profiles$/);
	await expect(page.getByText("from the admin area")).toHaveCount(0);
	await page.goto("/parent/admin");
	await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
});

test("a banned family can't sign in until the ban is lifted", async ({ page }) => {
	await openLanding(page);
	const family = await signUp(page, "Family E2E 2");
	await page.context().clearCookies();
	const admin = await signUp(page, "Admin E2E 2");
	await promote(page, admin.email);
	await page.context().clearCookies();
	await page.request.post("/api/auth/sign-in/email", { headers: admin.h, data: { email: admin.email, password: PASSWORD } });

	await page.goto("/parent/admin");
	await page.getByLabel("Find by name or email").fill(family.email);
	const row = page.getByRole("listitem").filter({ hasText: family.email });
	await row.getByRole("button", { name: "Ban" }).click();
	await row.getByRole("alertdialog").getByRole("button", { name: "Ban" }).click();
	await expect(row.getByText("Banned", { exact: true })).toBeVisible();
	const signIn = () =>
		page.request.post("/api/auth/sign-in/email", { headers: family.h, data: { email: family.email, password: PASSWORD } });
	expect((await signIn()).status()).toBe(403);

	await row.getByRole("button", { name: "Lift ban" }).click();
	await expect(row.getByText("Banned", { exact: true })).toHaveCount(0);
	expect((await signIn()).status()).toBe(200);
});
