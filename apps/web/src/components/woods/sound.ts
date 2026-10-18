import { B } from "@jade/core/woods";

/**
 * Campfire Woods' sounds, made on the spot with Web Audio: taps while mining, a crunch when a block gives (lower for
 * stone, softer for leaves), a clunk when one's placed, the fire taking a log, a chime when an animal comes home or a
 * goal is met, and an owl at nightfall. Quiet by design; muting is remembered on the device.
 */

const MUTE_KEY = "jade.woods.muted";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();

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
		if (ctx.state !== "running") void ctx.resume();
	} catch {
		ctx = null;
	}
}

function tone(f0: number, f1: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number } = {}) {
	if (!ctx || !out || muted) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = opts.type ?? "sine";
	osc.frequency.setValueAtTime(f0, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(out);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** A short burst of noise through a filter: crunches and crackles. */
function noise(dur: number, freq: number, opts: { gain?: number; at?: number } = {}) {
	if (!ctx || !out || muted) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const len = Math.ceil(ctx.sampleRate * dur);
	const buf = ctx.createBuffer(1, len, ctx.sampleRate);
	const data = buf.getChannelData(0);
	for (let k = 0; k < len; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / len);
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = freq;
	filter.Q.value = 1.2;
	const g = ctx.createGain();
	g.gain.value = opts.gain ?? 0.4;
	src.connect(filter).connect(g).connect(out);
	src.start(t);
}

export const tap = () => noise(0.05, 1800, { gain: 0.18 });

export function dig(block: number) {
	const low = block === B.stone || block === B.coal || block === B.iron || block === B.gold || block === B.gem || block === B.brick;
	const soft = block === B.leaves || block === B.sand;
	noise(soft ? 0.12 : 0.18, low ? 700 : soft ? 2600 : 1200, { gain: 0.45 });
	if (block === B.gem) chime();
}

export const place = () => {
	tone(220, 140, 0.09, { type: "triangle", gain: 0.25 });
	noise(0.05, 900, { gain: 0.2 });
};

export function feed() {
	for (let k = 0; k < 6; k++) noise(0.04, 2400 + Math.random() * 1200, { gain: 0.25, at: k * 0.05 + Math.random() * 0.03 });
	tone(160, 90, 0.4, { gain: 0.12 });
}

export function chime() {
	tone(784, 784, 0.25, { gain: 0.18 });
	tone(1175, 1175, 0.35, { gain: 0.14, at: 0.1 });
}

export function home() {
	for (const [k, f] of [523, 659, 784, 1047].entries()) tone(f, f, 0.22, { gain: 0.16, at: k * 0.09 });
}

export function owl() {
	tone(420, 380, 0.35, { gain: 0.12 });
	tone(400, 340, 0.5, { gain: 0.12, at: 0.45 });
}

export function dawn() {
	for (const [k, f] of [392, 494, 587, 784].entries()) tone(f, f, 0.4, { type: "triangle", gain: 0.12, at: k * 0.14 });
}
