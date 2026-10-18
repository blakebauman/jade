import { B, isLeaves, isLog, isPlant } from "@jade/core/woods";

/**
 * Campfire Woods' sounds, made on the spot with Web Audio: taps while mining, a crunch when a block gives (lower for
 * stone, softer for leaves), a clunk when one's placed, the fire taking a log, a chime when an animal comes home or a
 * goal is met, and an owl at nightfall. Footsteps, hops and landings follow the ground underfoot. Under it all runs a
 * soft bed: birds and a breeze by day, crickets and a far-off owl by night, and the campfire crackling when you're
 * near it. Quiet by design; muting is remembered on the device.
 *
 * Nothing here plays until `unlock()` has run from a tap or key press: before that every call is a no-op.
 */

const MUTE_KEY = "jade.woods.muted";
const LEVEL = 0.5;
/** At most this many one-shots sound at once; more are dropped rather than piling up. */
const MAX_VOICES = 24;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = readMuted();
/** Two seconds of white noise, made once and shared by every crunch, step, crackle and breeze. */
let noiseBuf: AudioBuffer | null = null;
let voices = 0;

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
		}
		if (ctx.state !== "running") void ctx.resume();
	} catch {
		ctx = null;
		out = null;
	}
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function noiseBuffer(c: AudioContext) {
	if (!noiseBuf) {
		const len = c.sampleRate * 2;
		noiseBuf = c.createBuffer(1, len, c.sampleRate);
		const data = noiseBuf.getChannelData(0);
		for (let k = 0; k < len; k++) data[k] = Math.random() * 2 - 1;
	}
	return noiseBuf;
}

/** Room for one more one-shot? Counts it in; `release` counts it out and unhooks its nodes when it ends. */
function claim() {
	if (!ctx || !out || muted || voices >= MAX_VOICES) return false;
	voices++;
	return true;
}

function release(src: AudioScheduledSourceNode, nodes: AudioNode[]) {
	src.onended = () => {
		voices--;
		for (const n of nodes) n.disconnect();
	};
}

type ToneOpts = { type?: OscillatorType; gain?: number; at?: number; dest?: AudioNode };

function tone(f0: number, f1: number, dur: number, opts: ToneOpts = {}) {
	if (!ctx || !out || !claim()) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = opts.type ?? "sine";
	osc.frequency.setValueAtTime(f0, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(opts.dest ?? out);
	release(osc, [osc, g]);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

type NoiseOpts = {
	gain?: number;
	at?: number;
	/** Bandpass by default; highpass for an airy puff, lowpass for a thump. */
	type?: BiquadFilterType;
	q?: number;
	/** Seconds to swell in (default: almost at once). */
	attack?: number;
	/** Where the filter ends up by the end, for a whoosh. */
	sweep?: number;
	dest?: AudioNode;
};

/** A short burst of noise through a filter: crunches, steps and crackles. */
function noise(dur: number, freq: number, opts: NoiseOpts = {}) {
	if (!ctx || !out || !claim()) return;
	const t = ctx.currentTime + (opts.at ?? 0);
	const src = ctx.createBufferSource();
	src.buffer = noiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = opts.type ?? "bandpass";
	filter.frequency.setValueAtTime(freq, t);
	if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
	filter.Q.value = opts.q ?? 1.2;
	const g = ctx.createGain();
	const peak = opts.gain ?? 0.4;
	const attack = opts.attack ?? 0.003;
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(peak, t + attack);
	g.gain.linearRampToValueAtTime(0, t + dur);
	src
		.connect(filter)
		.connect(g)
		.connect(opts.dest ?? out);
	release(src, [src, filter, g]);
	// Start somewhere different in the buffer each time, so repeats don't sound copied.
	src.start(t, Math.random() * 1.5, dur + 0.02);
}

export const tap = () => noise(0.05, 1800, { gain: 0.18 });

const HARD = new Set<number>([B.stone, B.mossyStone, B.coal, B.iron, B.gold, B.gem, B.brick, B.bedrock, B.glass]);

export function dig(block: number) {
	const low = HARD.has(block) && block !== B.glass && block !== B.bedrock;
	const soft = isLeaves(block) || isPlant(block) || block === B.sand;
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

/** A rescued animal's sparkle is the same rising four notes as coming home. */
export const rescueSparkle = home;

function hoot(gain: number, dest?: AudioNode) {
	tone(420, 380, 0.35, { gain, dest });
	tone(400, 340, 0.5, { gain, at: 0.45, dest });
}

export const owl = () => hoot(0.12);

export function dawn() {
	for (const [k, f] of [392, 494, 587, 784].entries()) tone(f, f, 0.4, { type: "triangle", gain: 0.12, at: k * 0.14 });
}

/**
 * One footstep on the block underfoot: a soft thump on grass, dirt, sand, leaves and wool; a harder tick on stone,
 * brick, ore, glass and bedrock; a hollow knock on planks and logs; a little splash in water. Each one varies a bit.
 */
export function step(surface: number) {
	if (surface === B.air) return;
	const v = rand(0.85, 1.15);
	if (surface === B.water) {
		noise(0.16, 1400 * v, { gain: 0.12, q: 0.8, attack: 0.02, sweep: 700 });
		tone(900 * v, 500 * v, 0.08, { gain: 0.04 });
	} else if (surface === B.planks || isLog(surface)) {
		tone(190 * v, 150 * v, 0.07, { type: "triangle", gain: 0.1 });
		noise(0.04, 700 * v, { gain: 0.08, q: 3 });
	} else if (HARD.has(surface)) {
		noise(0.035, 2600 * v, { gain: 0.1, q: 2 });
		noise(0.05, 500 * v, { gain: 0.06, type: "lowpass" });
	} else {
		const crisp = isLeaves(surface) || isPlant(surface) || surface === B.sand;
		noise(0.08, (crisp ? 1500 : 450) * v, { gain: rand(0.09, 0.13), type: crisp ? "bandpass" : "lowpass", q: 0.9 });
	}
}

/** A small whoosh going up. */
export const jump = () => noise(0.18, 500, { gain: 0.08, q: 0.8, attack: 0.05, sweep: 1600 });

/** A thump coming down: `hard` 0 (a hop) to 1 (a long fall). */
export function land(hard: number) {
	const h = clamp01(hard);
	noise(0.08 + h * 0.08, 380, { gain: 0.08 + h * 0.14, type: "lowpass", q: 0.7 });
	if (h > 0.3) tone(110, 60, 0.12 + h * 0.08, { gain: 0.05 + h * 0.08 });
}

/** A soft "fff" as a torch is blown out. */
export const snuff = () => noise(0.4, 3200, { gain: 0.14, type: "highpass", q: 0.5, attack: 0.06, sweep: 2200 });

/** Two gentle falling notes: the fire's getting low. */
export function lowFire() {
	tone(587, 587, 0.35, { type: "triangle", gain: 0.1 });
	tone(440, 440, 0.5, { type: "triangle", gain: 0.09, at: 0.28 });
}

// ---- The ambience bed -------------------------------------------------------------------------------------------

export type AmbienceState = {
	/** 0 at night, 1 in full day. */
	sun: number;
	/** Blocks from the campfire. */
	fireDistance: number;
	/** 0 (out) to 1 (roaring). */
	fireStrength: number;
	/** Muffles the bed. */
	underwater?: boolean;
	/** False while paused or hidden: everything fades out, and fades back in when it's true again. */
	running: boolean;
};

type Bed = {
	sources: AudioScheduledSourceNode[];
	nodes: AudioNode[];
	master: GainNode;
	muffle: BiquadFilterNode;
	wind: GainNode;
	birds: GainNode;
	night: GainNode;
	crickets: GainNode[];
	fire: GainNode;
	nextBird: number;
	nextOwl: number;
};

let bed: Bed | null = null;
/** How far the fire can be heard, in blocks. */
const FIRE_RANGE = 18;
/** Time constant for every level change: about a second to settle, so nothing clicks. */
const EASE = 0.35;

function loop(c: AudioContext, b: AudioBuffer) {
	const src = c.createBufferSource();
	src.buffer = b;
	src.loop = true;
	return src;
}

function buildBed(c: AudioContext, dest: AudioNode): Bed {
	const nb = noiseBuffer(c);
	const sources: AudioScheduledSourceNode[] = [];
	const nodes: AudioNode[] = [];
	const gain = (v = 0) => {
		const g = c.createGain();
		g.gain.value = v;
		nodes.push(g);
		return g;
	};

	const master = gain(0);
	const muffle = c.createBiquadFilter();
	muffle.type = "lowpass";
	muffle.frequency.value = 18000;
	nodes.push(muffle);
	master.connect(muffle).connect(dest);

	// Wind: noise through a low filter, slowly swaying.
	const windSrc = loop(c, nb);
	const windFilter = c.createBiquadFilter();
	windFilter.type = "lowpass";
	windFilter.frequency.value = 420;
	windFilter.Q.value = 0.6;
	const sway = c.createOscillator();
	sway.frequency.value = 0.07;
	const swayDepth = gain(160);
	sway.connect(swayDepth).connect(windFilter.frequency);
	const wind = gain(0);
	windSrc.connect(windFilter).connect(wind).connect(master);
	sources.push(windSrc, sway);
	nodes.push(windSrc, windFilter, sway);

	// Birds: one-shots land here, so day/night can fade them as a group.
	const birds = gain(0);
	birds.connect(master);

	// Night: two crickets, each a steady high tone whose gate is opened in little pulses by `chirp`.
	const night = gain(0);
	night.connect(master);
	const crickets: GainNode[] = [];
	for (const f of [4400, 4750]) {
		const osc = c.createOscillator();
		osc.frequency.value = f;
		const gate = gain(0);
		osc.connect(gate).connect(night);
		sources.push(osc);
		nodes.push(osc);
		crickets.push(gate);
	}

	// Campfire: a low rumble and a brighter hiss from the same noise, with pops added by `ambience`.
	const fire = gain(0);
	fire.connect(master);
	const rumbleSrc = loop(c, nb);
	const rumble = c.createBiquadFilter();
	rumble.type = "lowpass";
	rumble.frequency.value = 260;
	const rumbleGain = gain(0.6);
	rumbleSrc.connect(rumble).connect(rumbleGain).connect(fire);
	const hissSrc = loop(c, nb);
	const hiss = c.createBiquadFilter();
	hiss.type = "bandpass";
	hiss.frequency.value = 2400;
	hiss.Q.value = 0.7;
	const hissGain = gain(0.12);
	hissSrc.connect(hiss).connect(hissGain).connect(fire);
	sources.push(rumbleSrc, hissSrc);
	nodes.push(rumbleSrc, rumble, hissSrc, hiss);

	for (const [k, s] of sources.entries()) {
		// Offset the noise loops so they don't line up with each other.
		if (s instanceof AudioBufferSourceNode) s.start(c.currentTime, k * 0.37);
		else s.start(c.currentTime);
	}
	const now = c.currentTime;
	return { sources, nodes, master, muffle, wind, birds, night, crickets, fire, nextBird: now + rand(1, 3), nextOwl: now + rand(20, 40) };
}

/** A cricket's chirp: three quick pulses, eased on and off so they don't click. */
function chirp(gate: GainNode, t: number) {
	for (let k = 0; k < 3; k++) {
		const on = t + k * 0.045;
		gate.gain.setTargetAtTime(0.05, on, 0.004);
		gate.gain.setTargetAtTime(0, on + 0.022, 0.006);
	}
}

/** A little bird phrase: two to four quick sweeps around a randomly chosen note. */
function birdsong(dest: AudioNode) {
	const base = rand(2400, 3600);
	const notes = 2 + Math.floor(Math.random() * 3);
	let at = 0;
	for (let k = 0; k < notes; k++) {
		const f = base * rand(0.9, 1.15);
		const dur = rand(0.06, 0.12);
		tone(f, f * rand(1.1, 1.35), dur, { gain: 0.05, at, dest });
		at += dur + rand(0.03, 0.08);
	}
}

/**
 * Keeps the background bed going. Call about four times a second with what's around the player; it builds itself the
 * first time (after `unlock()`), crossfades day into night by `sun`, and brings the campfire up as you get close.
 */
export function ambience(state: AmbienceState) {
	if (!ctx || !out) return;
	if (!bed) {
		if (!state.running) return;
		try {
			bed = buildBed(ctx, out);
		} catch {
			return;
		}
	}
	const b = bed;
	const now = ctx.currentTime;
	const running = state.running && ctx.state === "running";
	b.master.gain.setTargetAtTime(running ? 1 : 0, now, running ? EASE * 2 : 0.15);
	if (!running) return;

	const sun = clamp01(state.sun);
	const day = sun * sun * (3 - 2 * sun);
	const nightness = 1 - day;
	b.muffle.frequency.setTargetAtTime(state.underwater ? 500 : 18000, now, 0.15);
	b.wind.gain.setTargetAtTime(0.02 + 0.025 * day, now, EASE);
	b.birds.gain.setTargetAtTime(day, now, EASE);
	b.night.gain.setTargetAtTime(nightness, now, EASE);

	const near = clamp01(1 - state.fireDistance / FIRE_RANGE);
	const strength = clamp01(state.fireStrength);
	const fireLevel = strength * near * near * 0.35;
	b.fire.gain.setTargetAtTime(fireLevel, now, EASE);

	if (muted) return;

	// Crickets chirp in their own rhythm, a little out of step with each other.
	if (nightness > 0.05) {
		for (const [k, gate] of b.crickets.entries()) {
			if (Math.random() < 0.7) chirp(gate, now + 0.02 + k * 0.11 + Math.random() * 0.06);
		}
	}
	if (day > 0.3 && now >= b.nextBird) {
		birdsong(b.birds);
		b.nextBird = now + rand(2, 6);
	}
	if (nightness > 0.7 && now >= b.nextOwl) {
		hoot(0.05, b.night);
		b.nextOwl = now + rand(25, 50);
	}
	if (fireLevel > 0.005) {
		// A couple of pops a tick at full strength, fewer as it dies down.
		const pops = Math.random() < strength ? 1 + Math.floor(Math.random() * 2 * strength) : 0;
		for (let k = 0; k < pops; k++) {
			noise(rand(0.01, 0.03), rand(1800, 4200), { gain: rand(0.3, 0.8), q: 1.5, at: rand(0, 0.24), dest: b.fire });
		}
	}
}

/** Tears the bed down (when the game screen goes away). Safe to call any time; `ambience` builds it again. */
export function stopAmbience() {
	if (!bed || !ctx) {
		bed = null;
		return;
	}
	const b = bed;
	bed = null;
	const now = ctx.currentTime;
	b.master.gain.cancelScheduledValues(now);
	b.master.gain.setTargetAtTime(0, now, 0.05);
	for (const s of b.sources) {
		try {
			s.stop(now + 0.3);
		} catch {}
	}
	setTimeout(() => {
		for (const n of b.nodes) n.disconnect();
	}, 400);
}
