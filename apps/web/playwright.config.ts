import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	// Needs the production service worker; run with `pnpm test:e2e:offline`.
	testIgnore: /offline\.spec\.ts$/,
	use: { baseURL: "http://localhost:5190", trace: "retain-on-failure" },
	webServer: { command: "pnpm dev", url: "http://localhost:5190/health", reuseExistingServer: true, timeout: 120_000 },
	projects: [
		{ name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } },
		{ name: "ipad", use: { ...devices["iPad Pro 11"] } },
		{ name: "phone", use: { ...devices["iPhone 15"] } },
	],
});
