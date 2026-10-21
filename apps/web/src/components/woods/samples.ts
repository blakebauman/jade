import chime from "./audio/chime.mp3";
import dawn from "./audio/dawn.mp3";
import day from "./audio/day.mp3";
import digGlass from "./audio/dig-glass.mp3";
import digLeaves1 from "./audio/dig-leaves-1.mp3";
import digLeaves2 from "./audio/dig-leaves-2.mp3";
import digSand from "./audio/dig-sand.mp3";
import digSoil1 from "./audio/dig-soil-1.mp3";
import digSoil2 from "./audio/dig-soil-2.mp3";
import digStone1 from "./audio/dig-stone-1.mp3";
import digStone2 from "./audio/dig-stone-2.mp3";
import digWood1 from "./audio/dig-wood-1.mp3";
import digWood2 from "./audio/dig-wood-2.mp3";
import feed from "./audio/feed.mp3";
import fire from "./audio/fire.mp3";
import home from "./audio/home.mp3";
import night from "./audio/night.mp3";
import owl from "./audio/owl.mp3";
import place1 from "./audio/place-1.mp3";
import place2 from "./audio/place-2.mp3";
import rain from "./audio/rain.mp3";
import snuff from "./audio/snuff.mp3";
import splash from "./audio/splash.mp3";

/**
 * Campfire Woods' recorded sounds (ElevenLabs sound effects, trimmed and levelled; one-shots peak at -1dBFS, loops sit
 * at about -24dBFS). Each one-shot lists its variants, played at random. The loops carry 0.1s of wrap-around either
 * side, so the decoder's padding never lands inside `loopStart`–`loopEnd` and the seam doesn't click.
 *
 * They load after `unlock()`, about 860KB in all; until one has arrived (or if it never does) `sound.ts` makes that
 * sound itself, as it always has.
 */
export const SHOTS = {
	"dig-stone": [digStone1, digStone2],
	"dig-wood": [digWood1, digWood2],
	"dig-soil": [digSoil1, digSoil2],
	"dig-leaves": [digLeaves1, digLeaves2],
	"dig-sand": [digSand],
	"dig-glass": [digGlass],
	place: [place1, place2],
	feed: [feed],
	chime: [chime],
	home: [home],
	owl: [owl],
	dawn: [dawn],
	snuff: [snuff],
	splash: [splash],
} as const;

export const LOOPS = {
	day: { url: day, loopStart: 0.1, loopEnd: 20.04 },
	night: { url: night, loopStart: 0.1, loopEnd: 20.04 },
	fire: { url: fire, loopStart: 0.1, loopEnd: 12.04 },
	rain: { url: rain, loopStart: 0.1, loopEnd: 15.04 },
} as const;

export type Shot = keyof typeof SHOTS;
export type Loop = keyof typeof LOOPS;

const shots = new Map<Shot, AudioBuffer[]>();
const loops = new Map<Loop, AudioBuffer>();
let started = false;

async function decode(c: BaseAudioContext, url: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const data = await res.arrayBuffer();
	// The callback form too: older Safari never resolves the promise one.
	return new Promise<AudioBuffer>((resolve, reject) => {
		const p = c.decodeAudioData(data, resolve, reject);
		if (p) p.then(resolve, reject);
	});
}

/** Fetches and decodes everything, once. Failures are left out quietly: their sounds stay synthesised. */
export function loadSamples(c: BaseAudioContext) {
	if (started || typeof fetch !== "function") return;
	started = true;
	for (const [id, urls] of Object.entries(SHOTS) as [Shot, readonly string[]][]) {
		for (const url of urls)
			decode(c, url).then(
				(b) => shots.set(id, [...(shots.get(id) ?? []), b]),
				(e) => console.warn("[woods sound]", e),
			);
	}
	for (const [id, l] of Object.entries(LOOPS) as [Loop, (typeof LOOPS)[Loop]][]) {
		decode(c, l.url).then(
			(b) => loops.set(id, b),
			(e) => console.warn("[woods sound]", e),
		);
	}
}

/** One of a one-shot's variants, or null while none has loaded. */
export function shotBuffer(id: Shot) {
	const all = shots.get(id);
	return all?.length ? all[Math.floor(Math.random() * all.length)]! : null;
}

export const loopBuffer = (id: Loop) => loops.get(id) ?? null;
