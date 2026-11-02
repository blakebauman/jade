import { samples } from "#/lib/samples.ts";
import { CROWD_LOOP, TRACKS, type Track } from "./tracks.ts";

/**
 * Phoenix DJ Party's sound, and its clock. The song playing *is* the game's clock: a note is judged against where the
 * music is, read from the AudioContext (`songTime`), so what the kid hears and what's scored never drift apart.
 * Pausing suspends the context, which stops both at once.
 *
 * The four songs are recorded loops cut on the bar lines (`tracks.ts`); one-shots are recorded too (cheers, the
 * Phoenix's cry, fireworks, a scratch, a hit per lane). Until a song's recording has loaded, or offline before it was
 * ever heard, a beat is synthesised on the same grid instead (kick, claps, hats), so a set can always be played; a
 * one-shot that hasn't loaded is a soft synthesised stand-in. Muting is remembered on the device; muted, the clock
 * still runs.
 */

const MUTE_KEY = "jade.phoenix.muted";
const MASTER = 0.6;
const MUSIC_LEVEL = 0.85;
const HIT_LEVEL = 0.3;
const CROWD_LEVEL = 0.22;
/** How far ahead of now a song is started, so its first beat isn't clipped. */
const LEAD_S = 0.12;
/** The MP3 encoder's delay at the head of each one-shot (the loops' lead-in is already trimmed to their loopStart). */
const ONE_SHOT_LEAD_S = 0.025;

const PADS = ["pad1", "pad2", "pad3", "pad4"] as const;
export const SHOT_IDS = ["cheer-s", "cheer-l", "aww", "rise", "firework", "scratch", "crate", "drop-in", "set-end", ...PADS] as const;
export type Shot = (typeof SHOT_IDS)[number];

const LOOPS = {
	...Object.fromEntries(TRACKS.map((t) => [`track-${t.id}`, { loopStart: t.loopStart, loopEnd: t.loopEnd }])),
	crowd: CROWD_LOOP,
} as Record<string, { loopStart: number; loopEnd: number }>;

const recorded = samples(import.meta.glob<string>("./audio/*.mp3", { eager: true, query: "?url", import: "default" }), SHOT_IDS, LOOPS);
export const SHOT_URLS = recorded.shotUrls;
export const LOOP_URLS = recorded.loopUrls;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let musicBus: GainNode | null = null;
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
	if (out) out.gain.value = m ? 0 : MASTER;
}

/** Call from a tap or key press: browsers only let sound begin from one. */
export function unlock() {
	try {
		if (!ctx) {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AC) return;
			ctx = new AC({ latencyHint: "interactive" });
			out = ctx.createGain();
			out.gain.value = muted ? 0 : MASTER;
			out.connect(ctx.destination);
			musicBus = ctx.createGain();
			musicBus.gain.value = MUSIC_LEVEL;
			musicBus.connect(out);
			recorded.load(ctx);
		}
		// iOS also leaves it "interrupted" after switching apps.
		if (ctx.state !== "running" && !paused) void ctx.resume();
	} catch {
		ctx = null;
	}
}

// ── The song clock ──

type Song = {
	track: Track;
	/** Context time of the song's first beat, when the audio is the clock. */
	at: number;
	/** Without a running context: page time of the first beat, and how long it's been held paused. */
	pageAt: number;
	src: AudioBufferSourceNode | null;
	gain: GainNode | null;
	/** The synthesised beat: the next beat to schedule. */
	synthBeat: number;
	/** The clock's last reading from the audio. */
	last: number;
};
let song: Song | null = null;
let paused = false;
let pausedAt = 0;
const audioClock = () => !!ctx && ctx.state === "running";

/** Roughly how late what's played reaches the ears; the clock is moved back by it so hits line up with what's heard. */
const latency = () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0);

/**
 * Starts a song now (its first beat a moment from now), or `from` seconds into it (for test captures). Read
 * `songTime` for where it is.
 */
export function startSong(track: Track, from = 0) {
	stopSong();
	unlock();
	const now = ctx?.currentTime ?? 0;
	const at = now + LEAD_S - from;
	const step = 60 / track.bpm;
	const s: Song = {
		track,
		at,
		pageAt: performance.now() / 1000 + LEAD_S - from,
		src: null,
		gain: null,
		synthBeat: Math.ceil(from / step),
		last: from - LEAD_S,
	};
	const buf = recorded.loop(`track-${track.id}`);
	if (ctx && musicBus && buf) {
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		src.loopStart = track.loopStart;
		src.loopEnd = track.loopEnd;
		const gain = ctx.createGain();
		src.connect(gain).connect(musicBus);
		const length = track.loopEnd - track.loopStart;
		src.start(now + LEAD_S, track.loopStart + (from % length));
		s.src = src;
		s.gain = gain;
	}
	song = s;
	if (!from) shot("drop-in", 0.5);
}

/** Bumped on leaving the game, so a song still waiting for its recording never starts after. */
let generation = 0;
export const currentGeneration = () => generation;

/**
 * Waits (at most `ms`) for a song's recording, so a record picked the moment the game opens isn't played as the
 * stand-in beat. Resolves true if it's there; offline before it was ever heard, false.
 */
export function trackReady(track: Track, ms = 4000): Promise<boolean> {
	unlock();
	const id = `track-${track.id}`;
	if (recorded.loop(id)) return Promise.resolve(true);
	if (!ctx) return Promise.resolve(false);
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			off();
			resolve(false);
		}, ms);
		const off = recorded.onLoop(() => {
			if (!recorded.loop(id)) return;
			clearTimeout(timer);
			off();
			resolve(true);
		});
	});
}

/** What the song playing is: its recording, the stand-in beat, or nothing. */
export const songSource = () => (!song ? "none" : song.src ? "recorded" : "synth");

/** Where the song is, in seconds from its first beat (negative during the lead-in). */
export function songTime() {
	if (!song) return 0;
	if (ctx && audioClock()) {
		const t = ctx.currentTime - song.at - latency();
		// Keep page time in step, so if the audio stops (iOS "interrupted") the clock carries on from here, not from
		// where page time drifted to.
		song.pageAt = performance.now() / 1000 - t;
		song.last = t;
		return t;
	}
	// A context that exists but isn't running mid-song (interrupted, or still resuming) holds the clock where the
	// music stopped: the notes wait for the music rather than running on into misses.
	if (ctx && song.src) return song.last;
	const now = paused ? pausedAt : performance.now() / 1000;
	return now - song.pageAt;
}

/** Fades the song out (a scratch on the way, when asked). */
export function stopSong(scratch = false) {
	const s = song;
	song = null;
	if (scratch) shot("scratch", 0.6);
	if (!s?.src || !s.gain || !ctx) return;
	const t = ctx.currentTime;
	s.gain.gain.setTargetAtTime(0, t, 0.08);
	try {
		s.src.stop(t + 0.5);
	} catch {}
	const { src, gain } = s;
	setTimeout(() => {
		src.disconnect();
		gain.disconnect();
	}, 700);
}

/** Pauses or carries on: the context is held, so the song and its clock stop together. */
export function setPaused(p: boolean) {
	if (p === paused) return;
	paused = p;
	if (p) pausedAt = performance.now() / 1000;
	else if (song) song.pageAt += performance.now() / 1000 - pausedAt;
	if (!ctx) return;
	if (p) void ctx.suspend();
	else void ctx.resume();
}

/**
 * Called every frame while a song plays: schedules the synthesised beat when there's no recording, and keeps the
 * crowd's chatter going.
 */
export function keep() {
	if (!ctx || !song || song.src || paused || !audioClock()) return;
	const step = 60 / song.track.bpm;
	const ahead = ctx.currentTime + 0.25;
	while (song.at + song.synthBeat * step < ahead) {
		const t = song.at + song.synthBeat * step;
		if (t >= ctx.currentTime - 0.02) synthBeat(t, song.synthBeat, step);
		song.synthBeat++;
	}
}

/** One beat of the stand-in groove: a kick on every beat, claps on 2 and 4, a hat on every off-beat. */
function synthBeat(t: number, beat: number, step: number) {
	if (!ctx || !musicBus) return;
	const c = ctx;
	const half = !!song?.track.half;
	// Half-time records (drum and bass) get a two-step: the kick on 1 and 3, the snare on 2 and 4, a bar of the record each.
	if (half && beat % 2 === 1) {
		noise(t, 0.14, 1600, 0.45, musicBus);
		noise(t + step / 2, 0.04, 7000, 0.12, musicBus);
		return;
	}
	const kick = c.createOscillator();
	const kg = c.createGain();
	kick.frequency.setValueAtTime(130, t);
	kick.frequency.exponentialRampToValueAtTime(45, t + 0.12);
	kg.gain.setValueAtTime(0.0001, t);
	kg.gain.exponentialRampToValueAtTime(0.8, t + 0.004);
	kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
	kick.connect(kg).connect(musicBus);
	kick.start(t);
	kick.stop(t + 0.32);
	if (beat % 2 === 1) noise(t, 0.12, 1800, 0.35, musicBus);
	noise(t + step / 2, 0.04, 7000, 0.12, musicBus);
	// A simple bass note on each bar's first beat, so it's music and not a metronome.
	if (beat % 4 === 0) {
		const roots = [55, 55, 65.4, 49];
		const bass = c.createOscillator();
		const bg = c.createGain();
		bass.type = "triangle";
		bass.frequency.value = roots[Math.floor(beat / 4) % roots.length]!;
		bg.gain.setValueAtTime(0.0001, t);
		bg.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
		bg.gain.exponentialRampToValueAtTime(0.0001, t + step * 3.5);
		bass.connect(bg).connect(musicBus);
		bass.start(t);
		bass.stop(t + step * 3.6);
	}
}

let noiseBuf: AudioBuffer | null = null;
function noise(t: number, dur: number, freq: number, level: number, dest: AudioNode) {
	if (!ctx) return;
	if (!noiseBuf) {
		noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
		const d = noiseBuf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	}
	const src = ctx.createBufferSource();
	src.buffer = noiseBuf;
	const f = ctx.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = freq;
	f.Q.value = 0.9;
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(level, t + 0.003);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(f).connect(g).connect(dest);
	src.start(t);
	src.stop(t + dur + 0.02);
}

function tone(f0: number, f1: number, dur: number, level: number, type: OscillatorType = "sine", at = 0) {
	if (!ctx || !out) return;
	const t = ctx.currentTime + at;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.setValueAtTime(f0, t);
	o.frequency.exponentialRampToValueAtTime(f1, t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(level, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g).connect(out);
	o.start(t);
	o.stop(t + dur + 0.02);
}

// ── One-shots ──

/** Plays a recording, or returns false when it hasn't loaded. */
function shot(id: Shot, level: number, rate = 1) {
	if (!ctx || !out || paused) return false;
	const buf = recorded.shot(id);
	if (!buf) return false;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate;
	const g = ctx.createGain();
	g.gain.value = level;
	src.connect(g).connect(out);
	// The encoder leaves about 25ms of silence in front of every one-shot; skip it so a hit lands on the press.
	src.start(ctx.currentTime, Math.min(ONE_SHOT_LEAD_S, buf.duration / 2));
	return true;
}

/** A lane's hit: each lane has its own recording (`pad1`…`pad4`), quieter for a Good than a Perfect. */
export function hit(lane: number, perfect: boolean) {
	const level = HIT_LEVEL * (perfect ? 1 : 0.75);
	if (!shot(PADS[lane] ?? "pad1", level) && ctx && out && !paused)
		noise(ctx.currentTime, 0.06, [1500, 3000, 6000, 900][lane] ?? 2000, level, out);
}

/** A tap with no note: a dull little tick. */
export const extra = () => tone(220, 180, 0.06, 0.08, "triangle");
export const miss = () => tone(300, 160, 0.12, 0.05, "triangle");
export const cheer = (big: boolean) => shot(big ? "cheer-l" : "cheer-s", big ? 0.55 : 0.45) || tone(660, 990, 0.25, 0.08);
export const aww = () => shot("aww", 0.4);
export const crate = () => shot("crate", 0.5) || tone(500, 700, 0.06, 0.06);
export const select = () => tone(700, 1050, 0.09, 0.07);
export function rise() {
	if (!shot("rise", 0.7)) {
		tone(400, 1400, 0.8, 0.12, "sawtooth");
		tone(600, 1800, 0.9, 0.08, "triangle", 0.1);
	}
	cheer(true);
}
export const firework = () => shot("firework", 0.35, 0.9 + Math.random() * 0.2) || tone(1200, 300, 0.3, 0.04);
export function setEnd() {
	if (shot("set-end", 0.6)) return;
	for (const [i, f] of [523, 659, 784, 1046].entries()) tone(f, f, 0.3, 0.08, "triangle", i * 0.12);
}

// ── The crowd ──

let crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** The party's chatter, louder the busier the floor (0–1); 0 stops it. */
export function setCrowd(level: number) {
	if (!ctx || !out) return;
	if (!crowd) {
		const buf = recorded.loop("crowd");
		if (!buf || level <= 0) return;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		src.loopStart = CROWD_LOOP.loopStart;
		src.loopEnd = CROWD_LOOP.loopEnd;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		src.connect(gain).connect(out);
		src.start(ctx.currentTime, CROWD_LOOP.loopStart);
		crowd = { src, gain };
	}
	crowd.gain.gain.setTargetAtTime(CROWD_LEVEL * Math.max(0, Math.min(1, level)), ctx.currentTime, 0.4);
}

/** Leaving the game: everything stops. */
export function stopAll() {
	generation++;
	stopSong();
	if (crowd && ctx) {
		const c = crowd;
		crowd = null;
		c.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
		try {
			c.src.stop(ctx.currentTime + 0.3);
		} catch {}
	}
	if (paused) setPaused(false);
}
