/**
 * Campfire Woods' recorded sounds (ElevenLabs sound effects, trimmed and levelled; one-shots peak at -1dBFS, loops sit
 * at about -24dBFS). Every `audio/*.mp3` is one: `name.mp3` is a one-shot, and `name-1.mp3`, `name-2.mp3`… are takes of
 * the same one, played at random. The loops carry 0.1s of wrap-around either side, so the decoder's padding never lands
 * inside `loopStart`–`loopEnd` and the seam doesn't click. Prompts are in `audio/prompts.tsv`.
 *
 * They load after `unlock()`, about 1MB in all; until one has arrived (or if it never does) `sound.ts` makes that
 * sound itself, as it always has.
 */

const FILES = import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" });

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

/** Each file's URL by its name: one-shots by id (all their takes), loops by name. */
export const SHOT_URLS = new Map<string, string[]>();
export const LOOP_URLS = new Map<string, string>();
for (const [path, url] of Object.entries(FILES)) {
	const name = path.slice("./audio/".length, -".mp3".length);
	if (name in LOOPS) LOOP_URLS.set(name, url);
	else {
		const id = name.replace(/-\d+$/, "");
		SHOT_URLS.set(id, [...(SHOT_URLS.get(id) ?? []), url]);
	}
}

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

const warn = (e: unknown) => console.warn("[woods sound]", e);

/** Fetches and decodes everything, once. Failures are left out quietly: their sounds stay synthesised. */
export function loadSamples(c: BaseAudioContext) {
	if (started || typeof fetch !== "function") return;
	started = true;
	for (const id of SHOT_IDS) {
		for (const url of SHOT_URLS.get(id) ?? []) decode(c, url).then((b) => shots.set(id, [...(shots.get(id) ?? []), b]), warn);
	}
	for (const id of Object.keys(LOOPS) as Loop[]) {
		const url = LOOP_URLS.get(id);
		if (url) decode(c, url).then((b) => loops.set(id, b), warn);
	}
}

/** One of a one-shot's takes, or null while none has loaded. */
export function shotBuffer(id: Shot) {
	const all = shots.get(id);
	return all?.length ? all[Math.floor(Math.random() * all.length)]! : null;
}

export const loopBuffer = (id: Loop) => loops.get(id) ?? null;
