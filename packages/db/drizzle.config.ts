import { defineConfig } from "drizzle-kit";

// Generates SQL into ./migrations; wrangler applies them (`pnpm db:migrate:local` / `db:migrate:remote`).
// apps/web/wrangler.jsonc points `migrations_dir` here.
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/schema.ts",
	out: "./migrations",
});
