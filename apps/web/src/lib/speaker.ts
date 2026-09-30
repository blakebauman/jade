import type { TTS_KINDS, VOICES } from "@jade/core";

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

/** Reverb mix, room length, and the fade (seconds) that softens clips ending in a hard cut. */
const REVERB_WET = 0.18;
const REVERB_SECONDS = 0.9;
const REVERB_PREDELAY = 0.015;
const TAIL_FADE = 0.12;

type Fx = { ctx: AudioContext; input: GainNode; master: GainNode };

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
	/** The Web Audio graph the <audio> element plays through; `false` once it's known to be unavailable (dry playback). */
	private fxGraph: Fx | false | null = null;
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
	 * <audio> → input ─┬─ dry ─────────────────────────────┬─ master → speakers
	 *                  └─ pre-delay → room reverb → wet ───┘
	 * Built once (an element can only have one source node), inside a tap so iOS lets the context run.
	 * `input` fades each clip's end while the reverb rings on; `master` cuts everything on stop().
	 */
	private fx(): Fx | null {
		if (this.fxGraph !== null) return this.fxGraph || null;
		this.fxGraph = false;
		const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return null;
		try {
			const ctx = new Ctx();
			const source = ctx.createMediaElementSource(this.el());
			const input = ctx.createGain();
			const master = ctx.createGain();
			const predelay = ctx.createDelay(0.1);
			predelay.delayTime.value = REVERB_PREDELAY;
			const reverb = ctx.createConvolver();
			reverb.buffer = roomImpulse(ctx, REVERB_SECONDS, 3);
			const wet = ctx.createGain();
			wet.gain.value = REVERB_WET;
			source.connect(input);
			input.connect(master);
			input.connect(predelay).connect(reverb).connect(wet).connect(master);
			master.connect(ctx.destination);
			this.fxGraph = { ctx, input, master };
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

	private playAura(text: string, kind: Kind, rate: number, token: number, opts: SpeakOptions) {
		const a = this.el();
		const fx = this.resumeFx();
		if (fx) {
			const now = fx.ctx.currentTime;
			for (const g of [fx.input.gain, fx.master.gain]) {
				g.cancelScheduledValues(now);
				g.setValueAtTime(1, now);
			}
		}
		return new Promise<void>((resolve, reject) => {
			const timers: number[] = [];
			const cleanup = () => {
				a.onended = a.onerror = a.onloadedmetadata = a.onplaying = null;
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
			if (fx)
				a.onplaying = () => {
					// Ease the voice out over its last moment; the reverb keeps ringing after, for a soft tail.
					if (!Number.isFinite(a.duration)) return;
					const remaining = (a.duration - a.currentTime) / rate;
					// `playing` fires again after a stall; replace the earlier schedule rather than fading early.
					fx.input.gain.cancelScheduledValues(fx.ctx.currentTime);
					fx.input.gain.setValueAtTime(1, fx.ctx.currentTime);
					fx.input.gain.setTargetAtTime(0, fx.ctx.currentTime + Math.max(0, remaining - TAIL_FADE), TAIL_FADE / 3);
				};
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
