import { type PlaySettings, TIME_WARN_S } from "@jade/core";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";
import { dayKey } from "./hooks.ts";
import { permanent } from "./offline.ts";

/**
 * Learn and Play on the device. Games are their own world (tickets), and a parent can link them to learning per kid:
 * stars that spend, practice before play, and play time bought with stars. The rules are `@jade/core`'s `play.ts`;
 * the server keeps the books.
 */

export type PlayStatus = {
	settings: PlaySettings;
	/** What can be spent: tickets always; stars only matter while the parent lets them be spent in games. */
	wallet: { stars: number; tickets: number };
	today: { rounds: number; stars: number };
	time: { secondsLeft: number; secondsUsed: number };
	shut: boolean;
	outOfTime: boolean;
	open: boolean;
};

export const playQuery = (childId: string) =>
	queryOptions({ queryKey: ["play", childId], queryFn: () => api<PlayStatus>(`/api/children/${childId}/play?day=${dayKey()}`) });

const base = (childId: string) => `/api/children/${childId}/play`;
export const playApi = {
	set: (childId: string, settings: PlaySettings) =>
		api<PlayStatus & { kept: number }>(base(childId), { method: "PUT", json: { ...settings, day: dayKey() } }),
	buyTime: (childId: string) => api<PlayStatus>(`${base(childId)}/time`, { method: "POST", json: { day: dayKey() } }),
	used: (childId: string, secondsUsed: number) =>
		api<PlayStatus>(`${base(childId)}/time/used`, { method: "POST", json: { secondsUsed, day: dayKey() } }),
};

/** Whether this kid's Play page shows stars at all: only while stars do something in games. */
export const starsInPlay = (s: PlaySettings) => !s.free && (s.stars || s.timeCosts);

// ── Play time ──

/** Play time as the game screens see it. `metered` is false while play time is free. */
export type Clock = { metered: boolean; minutes: number; warn: boolean; up: boolean };
const UNMETERED: Clock = { metered: false, minutes: 0, warn: false, up: false };
/** `hold` is a game saying a go is under way, so time-up waits for it to finish. */
export const PlayClock = createContext<Clock & { hold: (on: boolean) => void }>({ ...UNMETERED, hold: () => {} });
export const usePlayClockValue = () => useContext(PlayClock);

const usedKey = (childId: string) => `jade.playtime.${childId}`;
function readUsed(childId: string): number {
	try {
		return Number(localStorage.getItem(usedKey(childId))) || 0;
	} catch {
		return 0;
	}
}
function writeUsed(childId: string, seconds: number) {
	try {
		localStorage.setItem(usedKey(childId), String(seconds));
	} catch {
		// Storage blocked: the server's count still holds what was last sent.
	}
}

const SYNC_S = 30;

/**
 * Counts play time while a game screen is open and in view. The running total lives on the device (so a game played
 * offline still counts) and goes to the server every half minute, when the screen is hidden, and on the way out; the
 * server only ever moves it forward. React hears about it once a minute, at the 1-minute heads-up and when it's up.
 */
export function usePlayClock(childId: string, status: PlayStatus | undefined): Clock {
	const qc = useQueryClient();
	const metered = !!status?.settings.timeCosts;
	const bought = status ? status.time.secondsUsed + status.time.secondsLeft : 0;
	// Read through a ref: every sync brings a new server count, which mustn't restart the clock.
	const serverUsed = useRef(0);
	serverUsed.current = status?.time.secondsUsed ?? 0;
	const used = useRef(0);
	const [clock, setClock] = useState<Clock>(UNMETERED);

	useEffect(() => {
		if (!metered) {
			setClock(UNMETERED);
			return;
		}
		used.current = Math.max(used.current, serverUsed.current, readUsed(childId));
		let sinceSync = 0;
		const show = () => {
			const left = Math.max(0, bought - used.current);
			const next = { metered: true, minutes: Math.ceil(left / 60), warn: left > 0 && left <= TIME_WARN_S, up: left <= 0 };
			setClock((c) => (c.minutes === next.minutes && c.warn === next.warn && c.up === next.up && c.metered ? c : next));
		};
		const sync = () => {
			sinceSync = 0;
			if (!navigator.onLine) return;
			void playApi.used(childId, used.current).then(
				(s) => qc.setQueryData(playQuery(childId).queryKey, s),
				() => {
					// Kept on the device; the next sync sends it.
				},
			);
		};
		show();
		const tick = setInterval(() => {
			if (document.visibilityState !== "visible" || used.current >= bought) return;
			used.current = Math.max(used.current, serverUsed.current) + 1;
			writeUsed(childId, used.current);
			show();
			if (++sinceSync >= SYNC_S || used.current >= bought) sync();
		}, 1000);
		const onHide = () => document.visibilityState === "hidden" && sync();
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("online", sync);
		return () => {
			clearInterval(tick);
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("online", sync);
			sync();
		};
	}, [childId, metered, bought, qc]);

	return clock;
}

// ── Tickets a game pays ──

type Earning = { key: string; tickets: number };
const earnKey = (childId: string) => `jade.playearn.${childId}`;
function pendingEarnings(childId: string): Earning[] {
	try {
		return JSON.parse(localStorage.getItem(earnKey(childId)) ?? "[]") as Earning[];
	} catch {
		return [];
	}
}
function writeEarnings(childId: string, list: Earning[]) {
	try {
		if (list.length === 0) localStorage.removeItem(earnKey(childId));
		else localStorage.setItem(earnKey(childId), JSON.stringify(list));
	} catch {
		// Storage blocked: it's still sent now if online.
	}
}

/**
 * Pay a game's tickets at the end of a go (`gobble:<seed>`). Kept on the device and sent now, or when the connection is
 * back; the server pays each key once, so a resend never pays twice. Resolves to the status if anything reached it.
 */
export async function earnTickets(childId: string, key: string, tickets: number): Promise<PlayStatus | null> {
	const waiting = pendingEarnings(childId).filter((e) => e.key !== key);
	writeEarnings(childId, [...waiting, { key, tickets }]);
	return flushEarnings(childId);
}

export async function flushEarnings(childId: string): Promise<PlayStatus | null> {
	let last: PlayStatus | null = null;
	for (const e of pendingEarnings(childId)) {
		if (!navigator.onLine) break;
		try {
			last = await api<PlayStatus>(`${base(childId)}/earn`, { method: "POST", json: { ...e, day: dayKey() } });
		} catch (err) {
			if (!permanent(err)) break;
		}
		writeEarnings(
			childId,
			pendingEarnings(childId).filter((x) => x.key !== e.key),
		);
	}
	return last;
}
