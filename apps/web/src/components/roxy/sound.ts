import { musicLoop } from "#/lib/music.ts";
import { LOOPS, type Loop, loadSamples, loopBuffer, onLoop, type Shot, shotBuffer } from "./samples.ts";

/**
 * Roxy's sounds, for the studio, home, the town and its places (recordings, `samples.ts`). Until a one-shot or a
 * footstep has loaded, or if it never does (offline before it was ever heard), it's made on the spot with Web Audio
 * instead; the music and the place backgrounds are recordings only, so until they arrive there's simply none. Each
 * screen says which it is with `scene()` on mount and `leave()` on unmount (`SoundOrb` does both): that picks the music (the studio's in the studio and its gallery, the
 * town's on the town map, at home and in the places) and the place's background. Moving between Roxy's screens keeps
 * the music going; leaving them all stops it.
 * Sound starts on the first tap or key press anywhere (browsers only allow it from one). Muting is remembered on the
 * device.
 */

const MUTE_KEY = "jade.roxy.muted";
const LEVEL = 0.5;
const MUSIC_LEVEL = 0.2;
const AMBIENCE_LEVEL = 0.35;

export type Scene = "studio" | "gallery" | "town" | "home" | "park" | "petshop" | "school";
export type Surface = "grass" | "path" | "wood" | "tile" | "carpet";

const SCENES: Record<Scene, Loop[]> = {
	studio: ["music-studio"],
	gallery: ["music-studio"],
	town: ["music-town"],
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

let noiseBuf: AudioBuffer | null = null;

function noiseBuffer(c: AudioContext) {
	if (!noiseBuf) {
		const len = c.sampleRate * 2;
		noiseBuf = c.createBuffer(1, len, c.sampleRate);
		const data = noiseBuf.getChannelData(0);
		for (let k = 0; k < len; k++) data[k] = Math.random() * 2 - 1;
	}
	return noiseBuf;
}

/** One tone: a sweep from `f0` to `f1` over `dur`, with a quick attack and an easy release. */
function tone(f0: number, f1: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number } = {}) {
	if (!ctx || !out || muted) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = opts.type ?? "sine";
	osc.frequency.setValueAtTime(f0, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.1, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(out);
	osc.onended = () => {
		osc.disconnect();
		g.disconnect();
	};
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** A breath of filtered noise (cloth, air, a footfall), its filter swept from `f0` to `f1`. */
function noise(dur: number, f0: number, f1: number, opts: { gain?: number; q?: number; type?: BiquadFilterType; at?: number } = {}) {
	if (!ctx || !out || muted) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const src = ctx.createBufferSource();
	src.buffer = noiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = opts.type ?? "bandpass";
	filter.frequency.setValueAtTime(f0, t);
	filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
	filter.Q.value = opts.q ?? 1.2;
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(opts.gain ?? 0.2, t + Math.min(0.03, dur / 3));
	g.gain.linearRampToValueAtTime(0, t + dur);
	src.connect(filter).connect(g).connect(out);
	src.onended = () => {
		src.disconnect();
		filter.disconnect();
		g.disconnect();
	};
	// Somewhere different in the buffer each time, so repeats don't sound copied.
	src.start(t, Math.random() * 1.5, dur + 0.02);
}

/** A few bright notes, one after another. */
function notes(freqs: number[], opts: { gap?: number; dur?: number; gain?: number; at?: number } = {}) {
	freqs.forEach((f, i) => {
		tone(f, f, opts.dur ?? 0.2, { type: "triangle", gain: opts.gain ?? 0.07, at: (opts.at ?? 0) + i * (opts.gap ?? 0.07) });
	});
}

/** Plays a recording if it's loaded (true), else false so the caller can make the sound instead. */
function shot(id: Shot, gain: number, opts: { rate?: number; vary?: number; at?: number } = {}) {
	if (!ctx || !out) return false;
	const buf = shotBuffer(id);
	if (!buf) return false;
	if (muted) return true;
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
	return true;
}

/** Something tried on: a swish of cloth and a twinkle as she hops. */
export function tryOn() {
	if (!shot("tryon", 0.4, { vary: 0.06 })) noise(0.2, 900, 3200, { gain: 0.14 });
	if (!shot("twinkle", 0.22, { vary: 0.05, at: 0.12 })) notes([1568, 2093, 2637], { at: 0.12, gap: 0.05, dur: 0.18, gain: 0.04 });
}

/** Something taken off, or a piece put away: a swish going down. */
function away(gain: number) {
	if (!shot("away", gain, { vary: 0.05 })) noise(0.16, 2600, 700, { gain: gain * 0.35 });
}
export const takeOff = () => away(0.3);

/** A button, a tab, a colour: a soft pop. */
export function tap() {
	if (!shot("ui", 0.3, { vary: 0.06 })) tone(rand(640, 700), 480, 0.06, { gain: 0.08 });
}

/** Bought something: a little rising fanfare. */
export function bought() {
	if (!shot("unlock", 0.45)) notes([523, 659, 784, 1047], { gap: 0.08, dur: 0.24, gain: 0.08 });
}

/** Not yet: it costs a bit more, or something's in the way. Two soft notes going down, never a buzzer. */
export function nope() {
	if (!shot("nope", 0.4)) {
		tone(392, 380, 0.16, { gain: 0.08 });
		tone(330, 320, 0.22, { gain: 0.08, at: 0.14 });
	}
}

/** A holiday gift opened: a ribbon's rustle, then a sparkle climbing. */
export function gift() {
	if (shot("gift", 0.45)) return;
	noise(0.18, 1500, 4000, { gain: 0.1 });
	notes([784, 988, 1175, 1568, 2093], { at: 0.12, gap: 0.06, gain: 0.06 });
}

/** A look saved to the gallery: the camera's click and wind-on. */
export function saved() {
	if (shot("save", 0.45)) return;
	noise(0.03, 3500, 3000, { gain: 0.3, q: 2 });
	noise(0.05, 2200, 1800, { gain: 0.2, q: 2, at: 0.07 });
	noise(0.22, 1200, 1800, { gain: 0.05, q: 3, at: 0.16 });
}

/** A find picked up: a bright chime. */
export function found() {
	if (shot("find", 0.45)) return;
	tone(784, 1175, 0.12, { type: "triangle", gain: 0.08 });
	notes([1175, 1568], { at: 0.1, gap: 0.08, dur: 0.3, gain: 0.07 });
}

/** Off to another place: a whoosh. */
export function travel() {
	if (!shot("travel", 0.4)) noise(0.45, 400, 2400, { gain: 0.16, q: 0.8 });
}

/** A hop: a springy blip. */
export function hop() {
	if (!shot("hop", 0.3, { vary: 0.06 })) tone(rand(280, 320), 620, 0.12, { gain: 0.07 });
}

/** Home: a piece set down (a soft wooden knock), turned (a short scrape), nudged a square, put away; the walls or floor changed. */
function knock(gain: number, rate = 1) {
	tone(170 * rate, 90 * rate, 0.12, { gain });
	noise(0.05, 900 * rate, 500 * rate, { gain: gain * 0.6, type: "lowpass", q: 0.7 });
}
export function placed() {
	if (!shot("place", 0.42, { vary: 0.05 })) knock(0.16);
}
export function turned() {
	if (!shot("turn", 0.38, { vary: 0.05 })) noise(0.14, 700, 1300, { gain: 0.1, q: 2 });
}
export function nudged() {
	if (!shot("place", 0.22, { rate: 1.15, vary: 0.05 })) knock(0.09, 1.15);
}
export const putAway = () => away(0.4);
export function decorated() {
	if (shot("decor", 0.4, { vary: 0.04 })) return;
	noise(0.25, 1800, 900, { gain: 0.08, q: 0.8 });
	notes([1047, 1319], { at: 0.12, gap: 0.08, gain: 0.05 });
}

/** One footstep on what's underfoot. Tile and carpet borrow the path's and the grass's, quieter. */
export function step(surface: Surface) {
	if (!ctx) return;
	if (ctx.currentTime - lastStep < 0.15) return;
	lastStep = ctx.currentTime;
	const id: Shot = surface === "wood" ? "step-wood" : surface === "path" || surface === "tile" ? "step-path" : "step-grass";
	if (shot(id, surface === "carpet" ? 0.07 : surface === "tile" ? 0.1 : 0.13, { vary: 0.08 })) return;
	// Made up: a soft scuff, brighter on hard ground, with a hollow knock on boards.
	const f = { grass: 700, carpet: 450, path: 1600, tile: 2200, wood: 600 }[surface] * rand(0.9, 1.1);
	noise(0.07, f, f * 0.7, { gain: surface === "carpet" ? 0.03 : 0.05, q: 0.9 });
	if (surface === "wood") tone(rand(150, 175), 110, 0.07, { gain: 0.04 });
}
