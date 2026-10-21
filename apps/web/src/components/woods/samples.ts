import { samples } from "#/lib/samples.ts";

/**
 * Campfire Woods' recorded sounds (ElevenLabs sound effects, trimmed and levelled; one-shots peak at -1dBFS, loops sit
 * at about -24dBFS). Every `audio/*.mp3` is one (see `lib/samples.ts`); prompts are in `audio/prompts.tsv`. About 1MB
 * in all, loaded after `unlock()`.
 */

export const LOOPS = {
	day: { loopStart: 0.1, loopEnd: 20.04 },
	night: { loopStart: 0.1, loopEnd: 20.04 },
	fire: { loopStart: 0.1, loopEnd: 12.04 },
	rain: { loopStart: 0.1, loopEnd: 15.04 },
} as const;

export const SHOT_IDS = [
	"dig-stone",
	"dig-wood",
	"dig-soil",
	"dig-leaves",
	"dig-sand",
	"dig-glass",
	"place",
	"feed",
	"chime",
	"home",
	"owl",
	"dawn",
	"snuff",
	"splash",
	"step-grass",
	"step-stone",
	"step-wood",
	"step-sand",
	"step-water",
	"call-bunny",
	"call-fox",
	"call-owl",
	"call-lamb",
	"call-hedgehog",
	"call-duckling",
] as const;

export type Shot = (typeof SHOT_IDS)[number];
export type Loop = keyof typeof LOOPS;

const recorded = samples(import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" }), SHOT_IDS, LOOPS);

export const SHOT_URLS = recorded.shotUrls;
export const LOOP_URLS = recorded.loopUrls;
export const loadSamples = recorded.load;
export const shotBuffer = recorded.shot;
export const loopBuffer = recorded.loop;
