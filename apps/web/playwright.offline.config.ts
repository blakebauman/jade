import { defineConfig, devices } from "@playwright/test";

/**
 * Offline cold start needs the service worker, which only exists in a production build: this serves `vite preview`
 * on 4173 (dev keeps 5190) and runs e2e/offline.spec.ts on Chromium.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: /offline\.spec\.ts$/,
	use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
	webServer: {
		command: "pnpm preview --port 4173 --strictPort",
		url: "http://localhost:4173/health",
		reuseExistingServer: true,
		timeout: 180_000,
	},
	projects: [{ name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } }],
});
