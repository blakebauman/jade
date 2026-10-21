import { LOOPS, loadSamples, loopBuffer, type Shot, shotBuffer } from "./samples.ts";

/**
 * Gobble Town's sounds. Most are recordings (`samples.ts`): gulps that grow with the thing that fell in, a gobble
 * either way, a sparkle when the hole is big enough for something new, the end jingles, and a bouncy music loop under
 * play. Until a recording has loaded, or if it never does (offline before it was ever heard), the sound is made on the
 * spot with Web Audio, as it always was; the countdown pips always are. Quiet by design; muting is remembered on the
 * device.
 */

const MUTE_KEY = "jade.gobble.muted";
/** The music sits well under the gulps. */
const MUSIC_LEVEL = 0.22;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
/** Gulps come in bursts; this keeps a sweep of flowers from turning into a roar. */
let lastGulp = 0;
let music: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** Whether the game wants music now: it starts as soon as the loop has loaded. */
let wantMusic = false;

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

/** Call from a tap or key press (Start): browsers only let sound begin from one. */
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

/** One tone: a frequency sweep from `f0` to `f1` over `dur`, with a quick attack and an easy release. */
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
	g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(out);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** Plays a recording if it's loaded (true), else false so the caller can make the sound instead. */
function shot(id: Shot, gain: number, rate = 1) {
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
	src.start();
	return true;
}

/** Which gulp a thing makes by what it's worth: flowers and cones, bushes and trees, cars and buses, buildings. */
export function gulpSize(value: number): Shot {
	return value <= 3 ? "gulp-s" : value <= 9 ? "gulp-m" : value <= 26 ? "gulp-l" : "gulp-xl";
}

/** Something dropped into the player's hole; `value` is what it was worth (1 a flower … 160 the clock tower). */
export function gulp(value: number) {
	if (!ctx) return;
	const now = ctx.currentTime;
	if (value < 5 && now - lastGulp < 0.06) return;
	lastGulp = now;
	const size = Math.min(1, Math.log2(1 + value) / 7.4);
	const kind = gulpSize(value);
	// Louder for bigger things; a little pitch wobble so a sweep of flowers isn't one sound repeated.
	if (shot(kind, kind === "gulp-s" ? 0.3 : kind === "gulp-m" ? 0.38 : kind === "gulp-l" ? 0.46 : 0.55, 0.92 + Math.random() * 0.16)) return;
	const f = 720 - size * 560 + Math.random() * 60;
	tone(f, f * 0.45, 0.12 + size * 0.3, { gain: 0.18 + size * 0.2 });
	if (value >= 12) tone(f * 0.5, f * 0.2, 0.25 + size * 0.35, { type: "triangle", gain: 0.22, at: 0.03 });
}

/** A hole was gobbled: up for the player when they did it, down when it was them. */
export function gobble(mine: boolean) {
	if (shot(mine ? "gobble-win" : "gobble-lose", 0.5)) return;
	if (mine) {
		tone(300, 900, 0.18, { type: "triangle", gain: 0.3 });
		tone(450, 1300, 0.22, { type: "sine", gain: 0.22, at: 0.1 });
	} else {
		tone(520, 110, 0.6, { type: "triangle", gain: 0.3 });
	}
}

/** Big enough for something new. */
export function chime() {
	if (shot("milestone", 0.45)) return;
	[660, 830, 990, 1320].forEach((f, i) => {
		tone(f, f, 0.22, { type: "triangle", gain: 0.16, at: i * 0.07 });
	});
}

/** The countdown: three pips and a higher "go". */
export function pip(go: boolean) {
	tone(go ? 880 : 520, go ? 880 : 520, go ? 0.35 : 0.14, { type: "square", gain: 0.08 });
}

/** The round's over: a bright little run if the player won, a gentle one otherwise. The music stops for it. */
export function finish(won: boolean) {
	setMusic(false);
	if (shot(won ? "win" : "lose", 0.5)) return;
	const notes = won ? [523, 659, 784, 1047, 1319] : [523, 494, 523, 659];
	notes.forEach((f, i) => {
		tone(f, f, 0.26, { type: "triangle", gain: 0.2, at: i * 0.12 });
	});
}

/**
 * The music loop: on while a round is being played, faded out when paused, hidden or over (it carries on silently
 * underneath, and fades back in). `keepMusic` starts it if it finishes loading after it was asked for.
 */
export function setMusic(on: boolean) {
	wantMusic = on;
	if (!ctx || !out) return;
	const now = ctx.currentTime;
	if (!music) {
		const buf = loopBuffer("music");
		if (!on || !buf) return;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		src.loopStart = LOOPS.music.loopStart;
		src.loopEnd = LOOPS.music.loopEnd;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		src.connect(gain).connect(out);
		src.start(now, LOOPS.music.loopStart);
		music = { src, gain };
	}
	music.gain.gain.cancelScheduledValues(now);
	music.gain.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, now, on ? 0.3 : 0.12);
}

/** Call now and then while playing: starts the music if it was asked for before the loop had loaded. */
export function keepMusic() {
	if (wantMusic && !music) setMusic(true);
}

/** Leaving the game: the loop is stopped for good (`setMusic(true)` makes a new one). */
export function stopMusic() {
	wantMusic = false;
	if (!music || !ctx) return;
	const m = music;
	music = null;
	m.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
	try {
		m.src.stop(ctx.currentTime + 0.3);
	} catch {}
	setTimeout(() => {
		m.src.disconnect();
		m.gain.disconnect();
	}, 400);
}
