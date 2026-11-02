import { createContext, type RefObject, useContext } from "react";
import { beatAt, dancers, type Game, HYPE_MAX, inRise } from "./sim.ts";

/**
 * What the scene reads each frame: the game (mutated in place by the screen), the song clock, and moments the screen
 * hands over for show (the Phoenix rising, a streak, a request met). Everything that moves to the music reads
 * `Beat`, worked out once a frame by the `Conductor`.
 */

export type Moment = "rise" | "streak" | "match" | "end" | "pick";

export type Live = {
	game: Game;
	/** The song clock in seconds (see `sound.songTime`). */
	time: () => number;
	/** Moments waiting to be shown; the scene empties it. */
	moments: Moment[];
	/** Held still (paused, or a test capture). */
	frozen: boolean;
};

export type Beat = {
	/** Beats since the song began (between songs, a slow idle groove). */
	beat: number;
	/** 0 on each beat, rising to 1 just before the next. */
	frac: number;
	/** A kick-shaped pulse: 1 on the beat, falling away. */
	pulse: number;
	/** How hot the party is, 0–1, eased. */
	energy: number;
	/** The Phoenix is up (a Fire Drop). */
	rise: boolean;
	/** How many guests are on the floor. */
	dancers: number;
	/** A song is playing. */
	playing: boolean;
	/** Seconds per beat. */
	spb: number;
	/** Scene time in seconds. */
	t: number;
	/** Seconds since this frame's last one. */
	dt: number;
};

export const newBeat = (): Beat => ({
	beat: 0,
	frac: 0,
	pulse: 0,
	energy: 0.3,
	rise: false,
	dancers: 3,
	playing: false,
	spb: 0.6,
	t: 0,
	dt: 0,
});

/** Works the beat out from the game and the clock; between songs a slow idle groove keeps the party breathing. */
export function conduct(b: Beat, live: Live, t: number, dt: number, reduced: boolean) {
	const g = live.game;
	b.t = t;
	b.dt = dt;
	b.playing = g.phase === "song" && !!g.track;
	if (b.playing) {
		const now = live.time();
		b.spb = 60 / g.track!.bpm;
		b.beat = Math.max(0, beatAt(g, now));
	} else {
		b.spb = 60 / 96;
		b.beat = t / b.spb;
	}
	b.frac = b.beat - Math.floor(b.beat);
	b.pulse = reduced ? 0 : Math.exp(-b.frac * 6) * (b.playing ? 1 : 0.35);
	const want = g.phase === "song" ? g.hype / HYPE_MAX : 0.25;
	b.energy += (want - b.energy) * Math.min(1, dt * 2);
	b.rise = inRise(g);
	b.dancers = dancers(g);
}

export const BeatContext = createContext<RefObject<Beat> | null>(null);
export const useBeat = () => {
	const b = useContext(BeatContext);
	if (!b) throw new Error("useBeat outside the scene");
	return b;
};
