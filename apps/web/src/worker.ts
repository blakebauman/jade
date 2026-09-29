import { api } from "@jade/api";

// Assets are served before this runs (see wrangler.jsonc run_worker_first); the Worker only sees /api/* and /health.
export default {
	fetch: api.fetch,
} satisfies ExportedHandler<Env>;
