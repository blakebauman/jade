import type { CodeEvent } from "@jade/core/code";

/**
 * The garden's few sounds, synthesised (soft tones, no recordings): a tap for each step, a dull bump at a hedge, a
 * chime for a seed, a lantern or a flower, and a small rising run when a puzzle's solved. Quiet under the voice.
 */
let ctx: AudioContext | null = null;

export function unlock() {
	if (ctx) return;
	try {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (AC) ctx = new AC();
	} catch {}
}

function tone(freq: number, at: number, len: number, gain: number, type: OscillatorType = "sine") {
	if (!ctx) return;
	const t = ctx.currentTime + at;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + len);
	o.connect(g).connect(ctx.destination);
	o.start(t);
	o.stop(t + len + 0.02);
}

/** The sound for one event as the board plays it, if it has one. */
export function forEvent(ev: CodeEvent) {
	if (ctx?.state === "suspended") void ctx.resume();
	switch (ev.t) {
		case "move":
			tone(520 + Math.random() * 60, 0, 0.07, 0.05, "triangle");
			break;
		case "turn":
			tone(380, 0, 0.05, 0.03, "triangle");
			break;
		case "bump":
			tone(110, 0, 0.22, 0.12, "sine");
			tone(80, 0.03, 0.2, 0.08, "sine");
			break;
		case "pick":
		case "light":
		case "plant":
			tone(880, 0, 0.25, 0.06);
			tone(1320, 0.06, 0.3, 0.04);
			break;
		case "say":
			tone(660, 0, 0.12, 0.04, "triangle");
			break;
	}
}

export function solved() {
	for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, i * 0.09, 0.35, 0.05);
}
