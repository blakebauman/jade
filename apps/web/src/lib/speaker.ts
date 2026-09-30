import type { TTS_KINDS, VOICES } from "@jade/core";
import { stretch } from "./stretch.ts";

type Kind = (typeof TTS_KINDS)[number];
type Voice = (typeof VOICES)[number];

/** A tiny valid WAV of silence, built at runtime. Playing it inside a tap unlocks the shared <audio> on iOS Safari. */
function silentWav(): string {
	const samples = 800; // 0.1s at 8kHz, 8-bit mono
	const buf = new DataView(new ArrayBuffer(44 + samples));
	const str = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) buf.setUint8(o + i, s.charCodeAt(i));
	};
	str(0, "RIFF");
	buf.setUint32(4, 36 + samples, true);
	str(8, "WAVEfmt ");
	buf.setUint32(16, 16, true);
	buf.setUint16(20, 1, true);
	buf.setUint16(22, 1, true);
	buf.setUint32(24, 8000, true);
	buf.setUint32(28, 8000, true);
	buf.setUint16(32, 1, true);
	buf.setUint16(34, 8, true);
	str(36, "data");
	buf.setUint32(40, samples, true);
	for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128);
	let bin = "";
	for (const b of new Uint8Array(buf.buffer)) bin += String.fromCharCode(b);
	return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * A small-room impulse response, built at runtime: stereo noise under a (1 - t)^decay envelope.
 * Short on purpose, so letter names and consonants stay crisp under the reverb.
 */
function roomImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	const ir = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = ir.getChannelData(ch);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
	}
	return ir;
}

/** Reverb mix and room length. */
const REVERB_WET = 0.18;
const REVERB_SECONDS = 0.9;
const REVERB_PREDELAY = 0.015;

/** Decoded, speed-adjusted clips kept for instant replays ("hear it again"), by URL and rate. */
const CLIP_CACHE = 24;

/**
 * Safari, and every browser on iPad and iPhone. There, the <audio> element routed through Web Audio loses about
 * the first 0.2s of each clip, so clips are decoded and played as buffers instead.
 */
const appleWebKit = () => typeof navigator !== "undefined" && navigator.vendor.startsWith("Apple");

/** `input` is where the voice enters: the <audio> element's source node, or each clip's buffer source on Apple WebKit. */
type Fx = { ctx: AudioContext; input: GainNode; master: GainNode; buffers: boolean };

export type SpeakOptions = { kind?: Kind; slow?: boolean; onBeat?: (index: number) => void; beats?: number };

export function ttsUrl(text: string, kind: Kind, voice: Voice) {
	return `/api/tts?${new URLSearchParams({ text, kind, voice })}`;
}

/**
 * One shared <audio> element for every clip. Aura audio from /api/tts (R2-cached, then service-worker-cached);
 * the browser's own voice when the network or the model fails. A single element matters on iOS: once a tap
 * has played it, later programmatic plays (auto-saying the next word) are allowed.
 */
class Speaker {
	private audio: HTMLAudioElement | null = null;
	private unlocked = false;
	/** The Web Audio graph the voice plays through; `false` once it's known to be unavailable (dry playback). */
	private fxGraph: Fx | false | null = null;
	/** The buffer source playing now (Apple WebKit), so stop() can end it. */
	private source: AudioBufferSourceNode | null = null;
	private clips = new Map<string, AudioBuffer>();
	private token = 0;
	voice: Voice = "luna";
	rate = 0.95;
	/** Last source actually used, for the "voice offline" hint in the UI. */
	lastSource: "aura" | "device" | null = null;

	private el() {
		if (!this.audio) {
			this.audio = new Audio();
			this.audio.preload = "auto";
			// Keep "say it slowly" at the same pitch.
			this.audio.preservesPitch = true;
		}
		return this.audio;
	}

	/**
	 * voice → input ─┬─ dry ─────────────────────────────┬─ master → speakers
	 *                └─ pre-delay → room reverb → wet ───┘
	 * The voice is the <audio> element (an element can only have one source node, so this is built once), or on
	 * Apple WebKit a buffer source per clip. Built inside a tap so iOS lets the context run.
	 * The reverb rings on after each clip ends; `master` cuts everything on stop().
	 * Nothing is scheduled against the element's clock: WebKit delivers its audio to the graph late.
	 */
	private fx(): Fx | null {
		if (this.fxGraph !== null) return this.fxGraph || null;
		this.fxGraph = false;
		const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return null;
		try {
			const buffers = appleWebKit();
			// Web Audio follows the iPad's silent mode unless the page's audio session says it's for playback.
			const session = (navigator as { audioSession?: { type: string } }).audioSession;
			if (buffers && session) session.type = "playback";
			const ctx = new Ctx();
			const input = ctx.createGain();
			if (!buffers) ctx.createMediaElementSource(this.el()).connect(input);
			const master = ctx.createGain();
			const predelay = ctx.createDelay(0.1);
			predelay.delayTime.value = REVERB_PREDELAY;
			const reverb = ctx.createConvolver();
			reverb.buffer = roomImpulse(ctx, REVERB_SECONDS, 3);
			const wet = ctx.createGain();
			wet.gain.value = REVERB_WET;
			input.connect(master);
			input.connect(predelay).connect(reverb).connect(wet).connect(master);
			master.connect(ctx.destination);
			this.fxGraph = { ctx, input, master, buffers };
		} catch {
			// Playback falls back to the element's own output.
		}
		return this.fxGraph || null;
	}

	/** iOS suspends the context after interruptions (calls, backgrounding); a suspended context plays silence. */
	private resumeFx() {
		const fx = this.fx();
		if (fx && fx.ctx.state !== "running") void fx.ctx.resume().catch(() => {});
		return fx;
	}

	/**
	 * The element keeps playing while the context is suspended, only silently, so a clip started before the
	 * context runs loses its first syllables. Wait (briefly) for it to run first.
	 */
	private async running(fx: Fx) {
		if (fx.ctx.state === "running") return;
		await Promise.race([fx.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 500))]);
	}

	/** Call from a tap/keypress handler before the first round. Safe to call repeatedly. */
	unlock() {
		this.resumeFx();
		if (this.unlocked) return;
		const a = this.el();
		a.src = silentWav();
		a.play().then(
			() => {
				this.unlocked = true;
			},
			() => {},
		);
		// iOS also gates speechSynthesis behind a gesture.
		if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
	}

	stop() {
		this.token++;
		this.audio?.pause();
		try {
			this.source?.stop();
		} catch {}
		this.source = null;
		// Cut the reverb tail quickly (no click) so it never smears into the next clip.
		if (this.fxGraph) this.fxGraph.master.gain.setTargetAtTime(0, this.fxGraph.ctx.currentTime, 0.01);
		if ("speechSynthesis" in window) window.speechSynthesis.cancel();
	}

	/** Resolves when speech finishes (or is interrupted by a newer call). */
	async say(text: string, opts: SpeakOptions = {}): Promise<void> {
		this.stop();
		const token = this.token;
		const kind = opts.kind ?? "word";
		const rate = opts.slow ? this.rate * 0.72 : this.rate;
		try {
			await this.playAura(text, kind, rate, token, opts);
			this.lastSource = "aura";
		} catch {
			if (token !== this.token) return;
			this.lastSource = "device";
			await this.playDevice(kind === "letters" ? text.replace(/\./g, ",") : text, rate, token, opts);
		}
	}

	/** Spell a word aloud letter by letter; `onBeat(i)` fires as each letter is (approximately) spoken. */
	spell(word: string, onBeat?: (index: number) => void) {
		const letters = [...word].filter((c) => /[a-z]/i.test(c));
		return this.say(`${letters.map((c) => c.toUpperCase()).join(". ")}.`, { kind: "letters", onBeat, beats: letters.length });
	}

	/** Warm the HTTP + service-worker cache so the next word plays instantly. */
	prefetch(text: string, kind: Kind = "word") {
		void fetch(ttsUrl(text, kind, this.voice), { credentials: "same-origin", priority: "low" } as RequestInit).catch(() => {});
	}

	private async playAura(text: string, kind: Kind, rate: number, token: number, opts: SpeakOptions) {
		const fx = this.resumeFx();
		if (fx) {
			await this.running(fx);
			if (token !== this.token) return;
			const now = fx.ctx.currentTime;
			fx.master.gain.cancelScheduledValues(now);
			fx.master.gain.setValueAtTime(1, now);
			if (fx.buffers) {
				try {
					return await this.playBuffer(fx, ttsUrl(text, kind, this.voice), rate, token, opts);
				} catch {
					// The element plays it dry instead (it isn't routed through the graph on Apple WebKit).
					if (token !== this.token) return;
				}
			}
		}
		return this.playElement(text, kind, rate, token, opts);
	}

	/** Fetch, decode and speed-adjust a clip (cached), then play it through the graph. Resolves when it ends or is stopped. */
	private async playBuffer(fx: Fx, url: string, rate: number, token: number, opts: SpeakOptions) {
		if (fx.ctx.state !== "running") throw new Error("audio context not running");
		const buffer = await this.clip(fx.ctx, url, rate);
		if (token !== this.token) return;
		const src = fx.ctx.createBufferSource();
		src.buffer = buffer;
		src.connect(fx.input);
		this.source = src;
		const timers: number[] = [];
		if (opts.onBeat && opts.beats) {
			// Spread beats across the clip, leaving a little lead-in and tail.
			const step = (buffer.duration * 0.9) / opts.beats;
			for (let i = 0; i < opts.beats; i++)
				timers.push(window.setTimeout(() => token === this.token && opts.onBeat?.(i), (buffer.duration * 0.05 + i * step) * 1000));
		}
		await new Promise<void>((resolve) => {
			src.onended = () => resolve();
			src.start();
		});
		for (const t of timers) clearTimeout(t);
		if (this.source === src) this.source = null;
	}

	private async clip(ctx: AudioContext, url: string, rate: number) {
		const key = `${rate}|${url}`;
		const hit = this.clips.get(key);
		if (hit) {
			this.clips.delete(key);
			this.clips.set(key, hit);
			return hit;
		}
		// The header marks a clip being played (not a prefetch) for the e2e tests; the service worker caches by URL alone.
		const res = await fetch(url, { credentials: "same-origin", headers: { "X-Voice-Play": "1" }, signal: AbortSignal.timeout(12_000) });
		if (!res.ok) throw new Error(`tts ${res.status}`);
		const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
		const mono = decoded.getChannelData(0);
		const samples = stretch(mono, rate, decoded.sampleRate);
		const out = ctx.createBuffer(1, samples.length, decoded.sampleRate);
		out.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
		this.clips.set(key, out);
		if (this.clips.size > CLIP_CACHE) this.clips.delete(this.clips.keys().next().value!);
		return out;
	}

	/** Play through the shared <audio> element (through the graph where it's routed there, dry otherwise). */
	private playElement(text: string, kind: Kind, rate: number, token: number, opts: SpeakOptions) {
		const a = this.el();
		return new Promise<void>((resolve, reject) => {
			const timers: number[] = [];
			const cleanup = () => {
				a.onended = a.onerror = a.onloadedmetadata = null;
				for (const t of timers) clearTimeout(t);
			};
			a.onerror = () => {
				cleanup();
				reject(new Error("audio error"));
			};
			a.onended = () => {
				cleanup();
				resolve();
			};
			// If playback stalls without an error (flaky network mid-clip), give up and let the device voice take over.
			timers.push(
				window.setTimeout(() => {
					cleanup();
					a.pause();
					reject(new Error("audio stalled"));
				}, 12_000),
			);
			if (opts.onBeat && opts.beats) {
				const beats = opts.beats;
				a.onloadedmetadata = () => {
					// Spread beats across the clip, leaving a little lead-in and tail.
					const span = (Number.isFinite(a.duration) ? a.duration : beats * 0.6) / rate;
					const step = (span * 0.9) / beats;
					for (let i = 0; i < beats; i++)
						timers.push(window.setTimeout(() => token === this.token && opts.onBeat?.(i), (span * 0.05 + i * step) * 1000));
				};
			}
			a.src = ttsUrl(text, kind, this.voice);
			a.playbackRate = rate;
			a.play().catch((e) => {
				cleanup();
				reject(e);
			});
		});
	}

	private playDevice(text: string, rate: number, token: number, opts: SpeakOptions) {
		return new Promise<void>((done) => {
			// Some engines (iOS after an interruption, headless browsers) never fire onend; never leave the round stuck.
			const guard = window.setTimeout(() => finish(), 1500 + (text.length * 110) / rate);
			const finish = () => {
				clearTimeout(guard);
				while (opts.onBeat && beat < (opts.beats ?? 0)) opts.onBeat(beat++);
				done();
			};
			let beat = 0;
			if (!("speechSynthesis" in window)) return finish();
			const u = new SpeechSynthesisUtterance(text);
			u.rate = rate;
			u.lang = "en-US";
			const en = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en") && v.localService);
			if (en) u.voice = en;
			// Letters are separated by commas; each boundary is roughly one letter.
			u.onboundary = () => token === this.token && opts.onBeat && beat < (opts.beats ?? 0) && opts.onBeat(beat++);
			u.onend = u.onerror = finish;
			window.speechSynthesis.speak(u);
		});
	}
}

export const speaker = new Speaker();
