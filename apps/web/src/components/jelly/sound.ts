/**
 * Jelly Blocks' sounds, made on the spot with Web Audio (no files, so they work offline): a soft tick to step, a
 * squelch to turn, a plop to land (deeper from higher up), a pop chord for each cleared row that climbs with the count,
 * a chime to level up and a slow slide down when the jar's full. Quiet by design; muting is remembered on the device.
 */

const MUTE_KEY = "jade.jelly.muted";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
let lastTick = 0;

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

/** A step sideways (held keys repeat fast, so it's kept to a whisper and thinned out). */
export function tick() {
	if (!ctx) return;
	if (ctx.currentTime - lastTick < 0.04) return;
	lastTick = ctx.currentTime;
	tone(900, 760, 0.04, { type: "triangle", gain: 0.05 });
}

/** A turn: a little upward squelch. */
export function turn(kicked: boolean) {
	const f = kicked ? 380 : 440;
	tone(f, f * 1.6, 0.09, { type: "sine", gain: 0.12 });
}

/** A piece settles: a plop, deeper and fuller the further it fell. */
export function plop(fell: number) {
	const k = Math.min(1, fell / 18);
	const f = 300 - k * 120 + Math.random() * 30;
	tone(f, f * 0.4, 0.14 + k * 0.08, { gain: 0.2 + k * 0.12 });
	tone(f * 2.2, f * 1.1, 0.06, { type: "triangle", gain: 0.06 });
}

/** Rows popped: one bright pop per row, climbing, and a sparkle on top for four or an empty jar. */
export function pop(count: number, perfect: boolean) {
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
	[660, 880, 1100, 1320].forEach((f, i) => {
		tone(f, f, 0.2, { type: "triangle", gain: 0.14, at: i * 0.08 });
	});
}

/** The jar's full: a gentle slide down. */
export function full() {
	[523, 466, 415, 349].forEach((f, i) => {
		tone(f, f * 0.98, 0.3, { type: "triangle", gain: 0.16, at: i * 0.16 });
	});
}
