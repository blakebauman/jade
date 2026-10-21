import { samples } from "#/lib/samples.ts";

/**
 * Gobble Town's recorded sounds (ElevenLabs, trimmed and levelled): gulps in four sizes, the milestone sparkle, a
 * gobble either way, the end jingles and a 24-second (12-bar, 120 BPM) music loop. Every `audio/*.mp3` is one (see
 * `lib/samples.ts`); prompts are in `audio/prompts.tsv`. About 750KB, loaded on Start.
 */

export const LOOPS = { music: { loopStart: 0.1, loopEnd: 24.1 } } as const;

export const SHOT_IDS = ["gulp-s", "gulp-m", "gulp-l", "gulp-xl", "milestone", "gobble-win", "gobble-lose", "win", "lose"] as const;

export type Shot = (typeof SHOT_IDS)[number];

const recorded = samples(import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" }), SHOT_IDS, LOOPS);

export const SHOT_URLS = recorded.shotUrls;
export const LOOP_URLS = recorded.loopUrls;
export const loadSamples = recorded.load;
export const shotBuffer = recorded.shot;
export const loopBuffer = recorded.loop;
