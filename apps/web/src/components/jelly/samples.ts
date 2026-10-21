import { samples } from "#/lib/samples.ts";

/**
 * Jelly Blocks' recorded sounds (ElevenLabs, trimmed and levelled): a squishy tap to step and a squelch to turn (single
 * hits sliced from longer takes), plops in two sizes, a juicy pop per row, a sparkle for a big clear, the level-up
 * chime, the jar-full jingle and a 19.2-second (8-bar, 100 BPM) music loop. Every `audio/*.mp3` is one (see
 * `lib/samples.ts`); prompts are in `audio/prompts.tsv`. About 400KB, loaded on Start.
 */

export const LOOPS = { music: { loopStart: 0.1, loopEnd: 19.3 } } as const;

export const SHOT_IDS = ["move", "turn", "plop-s", "plop-l", "pop", "big-clear", "level", "full"] as const;

export type Shot = (typeof SHOT_IDS)[number];

const recorded = samples(import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" }), SHOT_IDS, LOOPS);

export const SHOT_URLS = recorded.shotUrls;
export const LOOP_URLS = recorded.loopUrls;
export const loadSamples = recorded.load;
export const shotBuffer = recorded.shot;
export const loopBuffer = recorded.loop;
