import { musicLoop } from "#/lib/music.ts";
import { LOOPS, type Loop, loadSamples, loopBuffer, onLoop, type Shot, shotBuffer } from "./samples.ts";

/**
 * Roxy's sounds, for the studio, home, the town and its places (all recordings, `samples.ts`; nothing is synthesised,
 * so until they've loaded Roxy is quiet, as she always was). Each screen says which it is with `scene()` on mount and
 * `leave()` on unmount (`SoundOrb` does both): that picks the music (the studio's in the studio, the town's at home
 * and in the places) and the place's background. The town map and the gallery are quiet pages. Moving between Roxy's screens keeps the music going; leaving them all stops it.
 * Sound starts on the first tap or key press anywhere (browsers only allow it from one). Muting is remembered on the
 * device.
 */

const MUTE_KEY = "jade.roxy.muted";
const LEVEL = 0.5;
const MUSIC_LEVEL = 0.2;
const AMBIENCE_LEVEL = 0.35;

export type Scene = "studio" | "home" | "park" | "petshop" | "school";
export type Surface = "grass" | "path" | "wood" | "tile" | "carpet";

const SCENES: Record<Scene, Loop[]> = {
	studio: ["music-studio"],
	home: ["music-town", "amb-home"],
	park: ["music-town", "amb-park"],
	petshop: ["music-town", "amb-petshop"],
	school: ["music-town", "amb-school"],
};

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
const loops = Object.fromEntries(
	(Object.keys(LOOPS) as Loop[]).map((id) => [
		id,
		musicLoop(id.startsWith("music") ? MUSIC_LEVEL : AMBIENCE_LEVEL, () => loopBuffer(id), LOOPS[id]),
	]),
) as Record<Loop, ReturnType<typeof musicLoop>>;
/** The loops the screen on show wants. */
let want = new Set<Loop>();
let leaving: ReturnType<typeof setTimeout> | undefined;
let armed = false;
let lastStep = 0;

function readMuted() {
	try {
		return localStorage.getItem(MUTE_KEY) === "1";
	} catch {
		return false;
	}
}

export const isMuted = () => muted;

export function setMuted(m: boolean) {
	muted = m;
	try {
		localStorage.setItem(MUTE_KEY, m ? "1" : "0");
	} catch {}
	if (ctx && out) out.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.05);
}

/** Call from a tap or key press: browsers only let sound begin from one. */
export function unlock() {
	try {
		if (!ctx) {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AC) return;
			ctx = new AC();
			out = ctx.createGain();
			out.gain.value = muted ? 0 : LEVEL;
			out.connect(ctx.destination);
			loadSamples(ctx);
			onLoop(apply);
		}
		// iOS also leaves it "interrupted" after switching apps.
		if (ctx.state !== "running") void ctx.resume();
		apply();
	} catch {
		ctx = null;
		out = null;
	}
}

/** Unlocks on the first tap or key press anywhere, and follows the tab being hidden. Once. */
function arm() {
	if (armed || typeof window === "undefined") return;
	armed = true;
	window.addEventListener("pointerdown", unlock, { capture: true });
	window.addEventListener("keydown", unlock, { capture: true });
	document.addEventListener("visibilitychange", apply);
}

/** Brings every loop in line with what the screen wants (quiet while the tab is hidden). */
function apply() {
	const hidden = typeof document !== "undefined" && document.hidden;
	for (const id of Object.keys(loops) as Loop[]) loops[id].set(ctx, out, want.has(id) && !hidden);
}

/** A Roxy screen is showing: its music and background. */
export function scene(s: Scene) {
	arm();
	clearTimeout(leaving);
	want = new Set(SCENES[s]);
	apply();
}

/** A Roxy screen went away. If another follows straight on, its `scene()` takes over; otherwise everything stops. */
export function leave() {
	clearTimeout(leaving);
	leaving = setTimeout(() => {
		want = new Set();
		for (const id of Object.keys(loops) as Loop[]) loops[id].stop(ctx);
	}, 200);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Plays a recording, if it's loaded. */
function shot(id: Shot, gain: number, opts: { rate?: number; vary?: number; at?: number } = {}) {
	if (!ctx || !out || muted) return;
	const buf = shotBuffer(id);
	if (!buf) return;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = (opts.rate ?? 1) * (opts.vary ? rand(1 - opts.vary, 1 + opts.vary) : 1);
	const g = ctx.createGain();
	g.gain.value = gain;
	src.connect(g).connect(out);
	src.onended = () => {
		src.disconnect();
		g.disconnect();
	};
	src.start(ctx.currentTime + (opts.at ?? 0));
}

/** Something tried on: a swish of cloth and a twinkle as she hops. */
export function tryOn() {
	shot("tryon", 0.4, { vary: 0.06 });
	shot("twinkle", 0.22, { vary: 0.05, at: 0.12 });
}

/** Something taken off. */
export const takeOff = () => shot("away", 0.3, { vary: 0.05 });

/** A button, a tab, a colour: a soft pop. */
export const tap = () => shot("ui", 0.3, { vary: 0.06 });

/** Bought something. */
export const bought = () => shot("unlock", 0.45);

/** Not yet: it costs a bit more, or something's in the way. */
export const nope = () => shot("nope", 0.4);

/** A holiday gift opened. */
export const gift = () => shot("gift", 0.45);

/** A look saved to the gallery: the camera. */
export const saved = () => shot("save", 0.45);

/** A find picked up. */
export const found = () => shot("find", 0.45);

/** Off to another place. */
export const travel = () => shot("travel", 0.4);

/** A hop. */
export const hop = () => shot("hop", 0.3, { vary: 0.06 });

/** Home: a piece set down, turned, nudged a square, put away; the walls or floor changed. */
export const placed = () => shot("place", 0.42, { vary: 0.05 });
export const turned = () => shot("turn", 0.38, { vary: 0.05 });
export const nudged = () => shot("place", 0.22, { rate: 1.15, vary: 0.05 });
export const putAway = () => shot("away", 0.4, { vary: 0.05 });
export const decorated = () => shot("decor", 0.4, { vary: 0.04 });

/** One footstep on what's underfoot. Tile and carpet borrow the path's and the grass's, quieter. */
export function step(surface: Surface) {
	if (!ctx) return;
	if (ctx.currentTime - lastStep < 0.15) return;
	lastStep = ctx.currentTime;
	const id: Shot = surface === "wood" ? "step-wood" : surface === "path" || surface === "tile" ? "step-path" : "step-grass";
	shot(id, surface === "carpet" ? 0.07 : surface === "tile" ? 0.1 : 0.13, { vary: 0.08 });
}
