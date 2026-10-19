/**
 * An island's day: six minutes of daylight, then four of night. The clock only runs while someone is on the island,
 * so `elapsed` is play time on that island, not wall time.
 */

export const DAY_S = 360;
export const NIGHT_S = 240;
export const CYCLE_S = DAY_S + NIGHT_S;
/** Dusk and dawn: how long the light takes to fade either side of night. */
export const TWILIGHT_S = 30;

export type Phase = {
	phase: "day" | "night";
	/** 0 to 1 through the current day or night. */
	progress: number;
	/** The night underway, or the next one by day. The first night is 1. */
	night: number;
	/** Seconds left of this day or night. */
	left: number;
	/** Daylight, 0 (deep night) to 1 (full day). */
	sun: number;
};

export function phaseAt(elapsed: number): Phase {
	const e = Math.max(0, elapsed);
	const cycle = Math.floor(e / CYCLE_S);
	const t = e - cycle * CYCLE_S;
	const night = cycle + 1;
	if (t < DAY_S) {
		const dusk = Math.min(1, (DAY_S - t) / TWILIGHT_S);
		const dawn = cycle === 0 ? 1 : Math.min(1, t / TWILIGHT_S);
		return { phase: "day", progress: t / DAY_S, night, left: DAY_S - t, sun: 0.5 + 0.5 * Math.min(dusk, dawn) };
	}
	const n = t - DAY_S;
	const fall = Math.min(1, n / TWILIGHT_S);
	return { phase: "night", progress: n / NIGHT_S, night, left: NIGHT_S - n, sun: 0.5 - 0.5 * fall };
}

/** The campfire. Fuel is seconds of burning; it burns one a second, day and night. */
export const FUEL_MAX = 300;
export const FUEL_START = 180;
/** Below this share of fuel the fire is low, and the Night Deer comes close. */
export const FUEL_LOW = 0.25;

export const burn = (fuel: number, dt: number) => Math.max(0, fuel - dt);
export const feed = (fuel: number, add: number) => Math.min(FUEL_MAX, fuel + add);

/** How far the firelight reaches, in blocks: a lost animal brought inside it is home. Even embers light a little. */
export const fireRadius = (fuel: number) => (fuel <= 0 ? 0 : 3 + 9 * Math.min(1, fuel / FUEL_MAX));

/** A shower lasts this long, easing in and out over `RAIN_EASE_S`. */
export const RAIN_S = 75;
export const RAIN_EASE_S = 8;

/**
 * How hard it's raining, 0 (dry) to 1, `elapsed` seconds into an island's time: about four days in ten have one
 * gentle shower in the middle of the day, never at night (nights are for the fire). The same on every screen.
 */
export function rainAt(seed: number, elapsed: number): number {
	const cycle = Math.floor(Math.max(0, elapsed) / CYCLE_S);
	let h = Math.imul(seed ^ Math.imul(cycle + 1, 0x9e3779b1), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	const r1 = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	if (r1 > 0.4) return 0;
	const start = 60 + (r1 / 0.4) * (DAY_S - RAIN_S - 120);
	const t = Math.max(0, elapsed) - cycle * CYCLE_S - start;
	if (t <= 0 || t >= RAIN_S) return 0;
	return Math.min(1, t / RAIN_EASE_S, (RAIN_S - t) / RAIN_EASE_S);
}
