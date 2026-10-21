import type { LoopTimes } from "./samples.ts";

/**
 * A game's music loop: on while a round is played, faded out when paused, hidden or over (it carries on silently
 * underneath, and fades back in). If it's asked for before its recording has loaded, `keep()` (called now and then
 * while playing) starts it once it has. `stop()` on leaving the game.
 */
export function musicLoop(level: number, buffer: () => AudioBuffer | null, times: LoopTimes) {
	let playing: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
	let want = false;

	function set(ctx: AudioContext | null, dest: AudioNode | null, on: boolean) {
		want = on;
		if (!ctx || !dest) return;
		const now = ctx.currentTime;
		if (!playing) {
			const buf = buffer();
			if (!on || !buf) return;
			const src = ctx.createBufferSource();
			src.buffer = buf;
			src.loop = true;
			src.loopStart = times.loopStart;
			src.loopEnd = times.loopEnd;
			const gain = ctx.createGain();
			gain.gain.value = 0;
			src.connect(gain).connect(dest);
			src.start(now, times.loopStart);
			playing = { src, gain };
		}
		playing.gain.gain.cancelScheduledValues(now);
		playing.gain.gain.setTargetAtTime(on ? level : 0, now, on ? 0.3 : 0.12);
	}

	return {
		set,
		keep(ctx: AudioContext | null, dest: AudioNode | null) {
			if (want && !playing) set(ctx, dest, true);
		},
		stop(ctx: AudioContext | null) {
			want = false;
			if (!playing || !ctx) return;
			const m = playing;
			playing = null;
			m.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
			try {
				m.src.stop(ctx.currentTime + 0.3);
			} catch {}
			setTimeout(() => {
				m.src.disconnect();
				m.gain.disconnect();
			}, 400);
		},
	};
}
