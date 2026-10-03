/**
 * Gobble Town's sounds, made on the spot with Web Audio (no files to download, so they work offline): a gulp that's
 * deeper the bigger the thing, a bloop when a hole gets gobbled, a chime when the hole is big enough for something
 * new, countdown pips and a little tune at the end. Quiet by design; muting is remembered on the device.
 */

const MUTE_KEY = "jade.gobble.muted";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
/** Gulps come in bursts; this keeps a sweep of flowers from turning into a roar. */
let lastGulp = 0;

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

/** Something dropped into the player's hole; `value` is what it was worth (1 a flower … 160 the clock tower). */
export function gulp(value: number) {
	if (!ctx) return;
	const now = ctx.currentTime;
	if (value < 5 && now - lastGulp < 0.06) return;
	lastGulp = now;
	const size = Math.min(1, Math.log2(1 + value) / 7.4);
	const f = 720 - size * 560 + Math.random() * 60;
	tone(f, f * 0.45, 0.12 + size * 0.3, { gain: 0.18 + size * 0.2 });
	if (value >= 12) tone(f * 0.5, f * 0.2, 0.25 + size * 0.35, { type: "triangle", gain: 0.22, at: 0.03 });
}

/** A hole was gobbled: up for the player when they did it, down when it was them. */
export function gobble(mine: boolean) {
	if (mine) {
		tone(300, 900, 0.18, { type: "triangle", gain: 0.3 });
		tone(450, 1300, 0.22, { type: "sine", gain: 0.22, at: 0.1 });
	} else {
		tone(520, 110, 0.6, { type: "triangle", gain: 0.3 });
	}
}

/** Big enough for something new. */
export function chime() {
	[660, 830, 990, 1320].forEach((f, i) => {
		tone(f, f, 0.22, { type: "triangle", gain: 0.16, at: i * 0.07 });
	});
}

/** The countdown: three pips and a higher "go". */
export function pip(go: boolean) {
	tone(go ? 880 : 520, go ? 880 : 520, go ? 0.35 : 0.14, { type: "square", gain: 0.08 });
}

/** The round's over: a bright little run if the player won, a gentle one otherwise. */
export function finish(won: boolean) {
	const notes = won ? [523, 659, 784, 1047, 1319] : [523, 494, 523, 659];
	notes.forEach((f, i) => {
		tone(f, f, 0.26, { type: "triangle", gain: 0.2, at: i * 0.12 });
	});
}
