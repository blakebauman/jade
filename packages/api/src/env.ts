import type { Db } from "@jade/db";

/** Bindings the API needs. apps/web/wrangler.jsonc declares them; this is the contract. */
export interface ApiBindings {
	DB: D1Database;
	/** Cached TTS audio: tts/{voice}/{kind}/{sha256(text)}.mp3 */
	AUDIO: R2Bucket;
	AI: Ai;
	RATE_LIMIT?: RateLimit;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	/** Optional Merriam-Webster Elementary Dictionary key (free for non-commercial use). */
	MW_KEY?: string;
}

export type AppEnv = {
	Bindings: ApiBindings;
	Variables: { db: Db; userId: string };
};
