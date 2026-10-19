import { defineConfig, devices } from "@playwright/test";

/**
 * The 3D games' specs. Drawn without a GPU on CI they're heavy, so CI runs them in their own job, one at a time
 * (`E2E_GROUP=games`), and everything else beside them in another (`E2E_GROUP=other`). Unset, everything runs.
 */
const GAMES = /(gobble|jelly|woods|roxy|tickets)\.spec\.ts$/;
const group = process.env.E2E_GROUP;

export default defineConfig({
	testDir: "./e2e",
	// Needs the production service worker; run with `pnpm test:e2e:offline`.
	testIgnore: /offline\.spec\.ts$/,
	// CI runners are several times slower than a laptop (cold Vite compiles, WebKit): more time, and one retry
	// that Playwright still reports as "flaky".
	timeout: process.env.CI ? 60_000 : 30_000,
	expect: { timeout: process.env.CI ? 10_000 : 5_000 },
	retries: process.env.CI ? 1 : 0,
	// Stop early on CI once it's clearly failing, rather than grinding through every timeout and retry.
	maxFailures: process.env.CI ? 3 : 0,
	...(group === "games" && { workers: 1 }),
	use: { baseURL: "http://localhost:5190", trace: "retain-on-failure" },
	webServer: { command: "pnpm dev", url: "http://localhost:5190/health", reuseExistingServer: true, timeout: 120_000 },
	projects: [
		{
			name: "laptop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } },
			...(group === "games" && { testMatch: GAMES }),
			...(group === "other" && { testIgnore: [/offline\.spec\.ts$/, GAMES] }),
		},
		{ name: "ipad", use: { ...devices["iPad Pro 11"] } },
		{ name: "phone", use: { ...devices["iPhone 15"] } },
		// On their sides, only the layout checks: every flow on every orientation would double the run for little.
		{ name: "ipad-landscape", use: { ...devices["iPad Pro 11 landscape"] }, testMatch: /(devices|keyboard)\.spec\.ts$/ },
		{ name: "phone-landscape", use: { ...devices["iPhone 15 landscape"] }, testMatch: /(devices|keyboard)\.spec\.ts$/ },
	],
});
