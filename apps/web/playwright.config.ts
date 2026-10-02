import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	// Needs the production service worker; run with `pnpm test:e2e:offline`.
	testIgnore: /offline\.spec\.ts$/,
	// CI runners are several times slower than a laptop (cold Vite compiles, WebKit): more time, and one retry
	// that Playwright still reports as "flaky".
	timeout: process.env.CI ? 60_000 : 30_000,
	expect: { timeout: process.env.CI ? 10_000 : 5_000 },
	retries: process.env.CI ? 1 : 0,
	use: { baseURL: "http://localhost:5190", trace: "retain-on-failure" },
	webServer: { command: "pnpm dev", url: "http://localhost:5190/health", reuseExistingServer: true, timeout: 120_000 },
	projects: [
		{ name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } },
		{ name: "ipad", use: { ...devices["iPad Pro 11"] } },
		{ name: "phone", use: { ...devices["iPhone 15"] } },
		// On their sides, only the layout checks: every flow on every orientation would double the run for little.
		{ name: "ipad-landscape", use: { ...devices["iPad Pro 11 landscape"] }, testMatch: /(devices|keyboard)\.spec\.ts$/ },
		{ name: "phone-landscape", use: { ...devices["iPhone 15 landscape"] }, testMatch: /(devices|keyboard)\.spec\.ts$/ },
	],
});
