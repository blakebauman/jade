import type { ApiBindings } from "../src/env.ts";

declare global {
	namespace Cloudflare {
		interface Env extends Omit<ApiBindings, "AI"> {
			TEST_MIGRATIONS: D1Migration[];
		}
	}
}
