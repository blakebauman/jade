import { samples } from "#/lib/samples.ts";

/**
 * Roxy's recorded sounds (ElevenLabs, trimmed and levelled): the studio's try-ons and twinkles, buying, a gentle "not
 * yet", a gift, a saved look; finds, hops and footsteps (grass, path, wood: single steps sliced from walking takes);
 * the home's furniture and decorating; travelling; four place backgrounds and two music loops (the town's, 12 bars at
 * 96 BPM, and the studio's, 8 bars at 102 BPM, each cut on the bar lines from a Music API track). Every `audio/*.mp3`
 * is one (see `lib/samples.ts`); prompts are in `audio/prompts.tsv`. About 1.7MB, loaded on the first tap.
 */

export const LOOPS = {
	"music-town": { loopStart: 0.1, loopEnd: 30.1 },
	"music-studio": { loopStart: 0.1, loopEnd: 18.9188 },
	"amb-park": { loopStart: 0.1, loopEnd: 20.04 },
	"amb-petshop": { loopStart: 0.1, loopEnd: 20.04 },
	"amb-school": { loopStart: 0.1, loopEnd: 20.04 },
	"amb-home": { loopStart: 0.1, loopEnd: 20.04 },
} as const;

export const SHOT_IDS = [
	"tryon",
	"twinkle",
	"unlock",
	"nope",
	"gift",
	"save",
	"ui",
	"find",
	"hop",
	"place",
	"turn",
	"away",
	"decor",
	"travel",
	"step-grass",
	"step-path",
	"step-wood",
] as const;

export type Shot = (typeof SHOT_IDS)[number];
export type Loop = keyof typeof LOOPS;

const recorded = samples(import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" }), SHOT_IDS, LOOPS);

export const SHOT_URLS = recorded.shotUrls;
export const LOOP_URLS = recorded.loopUrls;
export const loadSamples = recorded.load;
export const shotBuffer = recorded.shot;
export const loopBuffer = recorded.loop;
export const onLoop = recorded.onLoop;
