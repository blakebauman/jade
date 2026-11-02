export type Mood = "chill" | "funky" | "bouncy" | "big";
export type TrackId = "sunset" | "funk" | "pop" | "drop";
export type Track = { id: TrackId; name: string; mood: Mood; bpm: number; bars: number; loopStart: number; loopEnd: number };

/**
 * The four DJ sets: instrumental Music API tracks (`audio/track-*.mp3`, prompts in `audio/prompts.tsv`), each cut to
 * 16 bars on the bar lines of a steady four-on-the-floor stretch, with a 12ms blend at the seam and 0.1s of
 * wrap-around either side (`loopStart`–`loopEnd`), so MP3 padding never lands on the seam. `loopStart` is a downbeat
 * and every beat after it is `loopStart + n·60/bpm`. Re-decoded, every kick of every loop lands within 7.7ms of that
 * grid (sunset 7.0, funk 6.3, pop 4.8, drop 7.7; mean under 3ms), and the seams don't click.
 */
export const TRACKS: readonly Track[] = [
	{ id: "sunset", name: "Sunset Glow", mood: "chill", bpm: 100, bars: 16, loopStart: 0.1, loopEnd: 38.5 },
	{ id: "funk", name: "Feather Funk", mood: "funky", bpm: 110, bars: 16, loopStart: 0.1, loopEnd: 35.009091 },
	{ id: "pop", name: "Ember Pop", mood: "bouncy", bpm: 120, bars: 16, loopStart: 0.1, loopEnd: 32.1 },
	{ id: "drop", name: "Firebird Drop", mood: "big", bpm: 126, bars: 16, loopStart: 0.1, loopEnd: 30.57619 },
];

export const TRACK = Object.fromEntries(TRACKS.map((t) => [t.id, t])) as Record<TrackId, Track>;

/** The rooftop crowd bed (`audio/crowd.mp3`): a 12s seamless loop with 0.1s of wrap-around either side. */
export const CROWD_LOOP = { loopStart: 0.1, loopEnd: 12.1 } as const;
