// Separate from vite.config.ts: the Cloudflare plugin is incompatible with vitest's environment (same as memoturn).
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		passWithNoTests: true,
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
