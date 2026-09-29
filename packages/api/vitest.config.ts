import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations(path.join(import.meta.dirname, "../db/migrations"));

export default defineConfig({
	resolve: { tsconfig: "./tsconfig.json" },
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.test.jsonc" },
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: migrations,
					BETTER_AUTH_SECRET: "Qm9hcmQtdGlsZXMtYXJlLWZ1bi1zcGVsbGluZy1iZWU",
					BETTER_AUTH_URL: "http://localhost:5190",
				},
			},
		}),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
		include: ["test/**/*.test.ts"],
		// Sign-up hashes a password with PBKDF2 at 100k iterations; give it room.
		testTimeout: 20_000,
	},
});
