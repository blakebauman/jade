import { musicLoop } from "#/lib/music.ts";
import { LOOPS, loadSamples, loopBuffer, type Shot, shotBuffer } from "./samples.ts";

/**
 * Jelly Blocks' sounds. Most are recordings (`samples.ts`): a squishy tap to step, a squelch to turn, a plop to land
 * (a bigger one from higher up), a juicy pop for each cleared row that climbs with the count, a sparkle for four or an
 * empty jar, a chime to level up, a jingle when the jar's full, and a sweet music loop under play. Until a recording
 * has loaded, or if it never does (offline before it was ever heard), the sound is made on the spot with Web Audio, as
 * it always was; the hold whoosh always is. Quiet by design; muting is remembered on the device.
 */

const MUTE_KEY = "jade.jelly.muted";
/** Under everything: a puzzle wants to be thought about. */
const MUSIC_LEVEL = 0.18;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
let lastTick = 0;
const music = musicLoop(MUSIC_LEVEL, () => loopBuffer("music"), LOOPS.music);

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
	if (out) out.gain.value = m ? 0 : 0.5;
}

/** Call from a tap or key press: browsers only let sound begin from one. */
export function unlock() {
	try {
		if (!ctx) {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AC) return;
			ctx = new AC();
			out = ctx.createGain();
			out.gain.value = muted ? 0 : 0.5;
			out.connect(ctx.destination);
			loadSamples(ctx);
		}
		// iOS also leaves it "interrupted" after switching apps.
		if (ctx.state !== "running") void ctx.resume();
	} catch {
		ctx = null;
	}
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
	const peak = opts.gain ?? 0.3;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(out);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Plays a recording if it's loaded (true), else false so the caller can make the sound instead. */
function shot(id: Shot, gain: number, rate = 1, at = 0) {
	if (!ctx || !out) return false;
	const buf = shotBuffer(id);
	if (!buf) return false;
	if (muted) return true;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate;
	const g = ctx.createGain();
	g.gain.value = gain;
	src.connect(g).connect(out);
	src.onended = () => {
		src.disconnect();
		g.disconnect();
	};
	src.start(ctx.currentTime + at);
	return true;
}

/** A step sideways (held keys repeat fast, so it's kept to a whisper and thinned out). */
export function tick() {
	if (!ctx) return;
	if (ctx.currentTime - lastTick < 0.04) return;
	lastTick = ctx.currentTime;
	if (shot("move", 0.16, rand(0.94, 1.08))) return;
	tone(900, 760, 0.04, { type: "triangle", gain: 0.05 });
}

/** A turn: a little upward squelch. */
export function turn(kicked: boolean) {
	// Off a wall it squelches a little lower.
	if (shot("turn", 0.28, (kicked ? 0.88 : 1) * rand(0.96, 1.06))) return;
	const f = kicked ? 380 : 440;
	tone(f, f * 1.6, 0.09, { type: "sine", gain: 0.12 });
}

/** A piece settles: a plop, deeper and fuller the further it fell. */
export function plop(fell: number) {
	const k = Math.min(1, fell / 18);
	if (shot(fell >= 6 ? "plop-l" : "plop-s", 0.3 + k * 0.15, rand(0.95, 1.05))) return;
	const f = 300 - k * 120 + Math.random() * 30;
	tone(f, f * 0.4, 0.14 + k * 0.08, { gain: 0.2 + k * 0.12 });
	tone(f * 2.2, f * 1.1, 0.06, { type: "triangle", gain: 0.06 });
}

/** Rows popped: one bright pop per row, climbing, and a sparkle on top for four or an empty jar. */
export function pop(count: number, perfect: boolean) {
	if (shotBuffer("pop")) {
		// One pop a row, each a step higher.
		for (let i = 0; i < count; i++) shot("pop", 0.36, [1, 1.12, 1.26, 1.5][i] ?? 1.5, i * 0.07);
		if (count >= 4 || perfect) shot("big-clear", 0.42, 1, 0.26);
		return;
	}
	const base = [523, 659, 784, 1047];
	for (let i = 0; i < count; i++) {
		tone(base[i]! * 1.5, base[i]!, 0.12, { type: "sine", gain: 0.2, at: i * 0.06 });
		tone(base[i]! * 3, base[i]! * 2, 0.08, { type: "triangle", gain: 0.06, at: i * 0.06 });
	}
	if (count >= 4 || perfect)
		[1319, 1568, 2093].forEach((f, i) => {
			tone(f, f, 0.18, { type: "triangle", gain: 0.1, at: 0.26 + i * 0.07 });
		});
}

/** Held for later. */
export function swish() {
	tone(600, 1100, 0.1, { type: "sine", gain: 0.08 });
}

/** Faster now. */
export function levelUp() {
	if (shot("level", 0.4)) return;
	[660, 880, 1100, 1320].forEach((f, i) => {
		tone(f, f, 0.2, { type: "triangle", gain: 0.14, at: i * 0.08 });
	});
}

/** The jar's full (or time's up): a gentle slide down, and the music stops for it. */
export function full() {
	music.set(ctx, out, false);
	if (shot("full", 0.45)) return;
	[523, 466, 415, 349].forEach((f, i) => {
		tone(f, f * 0.98, 0.3, { type: "triangle", gain: 0.16, at: i * 0.16 });
	});
}

/** The music loop, on while a game is being played (see `lib/music.ts`). */
export const setMusic = (on: boolean) => music.set(ctx, out, on);

/** Call now and then while playing: starts the music if it was asked for before the loop had loaded. */
export const keepMusic = () => music.keep(ctx, out);

/** Leaving the game. */
export const stopMusic = () => music.stop(ctx);
