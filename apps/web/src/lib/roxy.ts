import {
	type HolidayId,
	type Home,
	ITEM,
	type Item,
	type Look,
	normalizeHome,
	normalizeLook,
	type Slot,
	type Worn,
	wear,
} from "@jade/core/roxy";
import { type QueryClient, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";
import { dayKey, prefersReducedMotion } from "./hooks.ts";
import { permanent } from "./offline.ts";

export type SavedLook = { id: string; name: string; look: Look; createdAt: number };
export type OpenHoliday = {
	id: HolidayId;
	label: string;
	note: string;
	start: string;
	first: string;
	end: string;
	gift: string;
	claimed: boolean;
};
export type Studio = {
	current: Look;
	wornLookId: string | null;
	looks: SavedLook[];
	unlocked: string[];
	balance: number;
	holidays: OpenHoliday[];
	holidaysOff: HolidayId[];
	home: Home;
	/** Things found around town. */
	finds: string[];
};

export const roxyQuery = (childId: string) =>
	queryOptions({ queryKey: ["roxy", childId], queryFn: () => api<Studio>(`/api/children/${childId}/roxy?day=${dayKey()}`) });

const base = (childId: string) => `/api/children/${childId}/roxy`;
export const roxyApi = {
	unlock: (childId: string, itemId: string) =>
		api<{ ok: true; balance: number }>(`${base(childId)}/unlock`, { method: "POST", json: { itemId } }),
	claim: (childId: string, holidayId: HolidayId) =>
		api<{ ok: true; itemId: string }>(`${base(childId)}/claim`, { method: "POST", json: { holidayId, day: dayKey() } }),
	save: (childId: string, name: string, look: Look) => api<SavedLook>(`${base(childId)}/looks`, { method: "POST", json: { name, look } }),
	wear: (childId: string, lookId: string) => api(`${base(childId)}/looks/${lookId}`, { method: "PATCH", json: { wear: true } }),
	rename: (childId: string, lookId: string, name: string) => api(`${base(childId)}/looks/${lookId}`, { method: "PATCH", json: { name } }),
	remove: (childId: string, lookId: string) => api(`${base(childId)}/looks/${lookId}`, { method: "DELETE" }),
	find: (childId: string, findId: string) => api(`${base(childId)}/find`, { method: "POST", json: { findId } }),
	home: (childId: string, home: Home) => api<Home>(`${base(childId)}/home`, { method: "PUT", json: { home } }),
	current: (childId: string, look: Look, wornLookId: string | null) =>
		api<{ ok: true; look: Look; wornLookId: string | null }>(`${base(childId)}/current`, { method: "PUT", json: { look, wornLookId } }),
};

/** The server's copy, fetched fresh: what a device adopts when the server won't take its own. */
async function serverCopy(qc: QueryClient, childId: string): Promise<Studio | null> {
	return qc.fetchQuery({ ...roxyQuery(childId), staleTime: 0 }).catch(() => null);
}

/** Put an item on, keeping the colours already chosen in that slot when they fit (so hair stays the same colour across styles). */
export function tryOn(look: Look, slot: Slot, item: Item): Look {
	const prev = look.slots[slot];
	const prevItem = prev && ITEM.get(prev.item);
	const worn: Worn = { item: item.id };
	item.colors?.forEach((palette, i) => {
		const key = i === 0 ? "c1" : "c2";
		const kept = prevItem?.colors?.[i] === palette ? prev?.[key] : undefined;
		const value = kept ?? item.defaults?.[i];
		if (value) worn[key] = value;
	});
	return wear(look, slot, worn);
}

type Draft = { look: Look; wornLookId: string | null; dirty: boolean };
const draftKey = (childId: string) => `jade.roxy.${childId}`;

function readDraft(childId: string): Draft | null {
	try {
		const raw = localStorage.getItem(draftKey(childId));
		if (!raw) return null;
		const d = JSON.parse(raw) as Draft;
		const look = normalizeLook(d.look);
		return look ? { ...d, look } : null;
	} catch {
		return null;
	}
}
function writeDraft(childId: string, d: Draft) {
	try {
		localStorage.setItem(draftKey(childId), JSON.stringify(d));
	} catch {
		// Storage full or blocked: the server copy still saves.
	}
}

/** The look to show for a child: an unsaved change on this device if there is one, else the server's. */
export function shownLook(childId: string, server: Studio): Look {
	const local = readDraft(childId);
	return local?.dirty ? local.look : server.current;
}

const UNDO_LIMIT = 40;
const AUTOSAVE_MS = 1200;

/**
 * The look on the stage while the studio is open. Every change is kept on this device straight away and sent to the
 * server shortly after; with no connection it waits and goes when the device is back online.
 */
export function useRoxyDraft(childId: string, server: Studio) {
	const qc = useQueryClient();
	const [state, setState] = useState<Draft>(() => {
		const local = readDraft(childId);
		return local?.dirty ? local : { look: server.current, wornLookId: server.wornLookId, dirty: false };
	});
	const [past, setPast] = useState<Look[]>([]);
	const pastRef = useRef(past);
	pastRef.current = past;
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const latest = useRef(state);
	latest.current = state;

	const flush = useCallback(async () => {
		const d = latest.current;
		if (!d.dirty || !navigator.onLine) return;
		try {
			// The server may take things off (a holiday a parent turned off); the stage shows what it kept.
			const saved = await roxyApi.current(childId, d.look, d.wornLookId);
			qc.setQueryData(roxyQuery(childId).queryKey, (old) => old && { ...old, current: saved.look, wornLookId: saved.wornLookId });
			if (latest.current === d) {
				const clean = { look: saved.look, wornLookId: saved.wornLookId, dirty: false };
				setState(clean);
				writeDraft(childId, clean);
			}
		} catch (err) {
			// Offline or a server hiccup: kept locally as dirty, and the next change or reconnect tries again.
			if (!permanent(err)) return;
			// Refused (say, something here is locked): sending it again never helps, so take the server's copy instead.
			const server = await serverCopy(qc, childId);
			if (latest.current !== d) return;
			const clean = server ? { look: server.current, wornLookId: server.wornLookId, dirty: false } : { ...d, dirty: false };
			setState(clean);
			writeDraft(childId, clean);
		}
	}, [childId, qc]);

	useEffect(() => {
		writeDraft(childId, state);
		if (!state.dirty) return;
		clearTimeout(timer.current);
		timer.current = setTimeout(flush, AUTOSAVE_MS);
		return () => clearTimeout(timer.current);
	}, [childId, state, flush]);

	useEffect(() => {
		const online = () => void flush();
		window.addEventListener("online", online);
		return () => {
			window.removeEventListener("online", online);
			void flush();
		};
	}, [flush]);

	/** The kind of the last change, so a run of the same small change (typing a name) is one step to undo. */
	const lastKind = useRef<string | null>(null);
	/** A new look, or a change to the latest one (for changes that land after an await, so nothing made meanwhile is lost). */
	const set = useCallback((next: Look | ((look: Look) => Look), wornLookId: string | null = null, kind?: string) => {
		const prev = latest.current.look;
		if (!kind || kind !== lastKind.current) setPast([...pastRef.current.slice(-UNDO_LIMIT + 1), prev]);
		lastKind.current = kind ?? null;
		const look = typeof next === "function" ? next(prev) : next;
		latest.current = { look, wornLookId, dirty: true };
		setState(latest.current);
	}, []);

	const undo = useCallback(() => {
		const prev = pastRef.current.at(-1);
		if (!prev) return;
		lastKind.current = null;
		setPast(pastRef.current.slice(0, -1));
		setState({ look: prev, wornLookId: null, dirty: true });
	}, []);

	/** After a save or "wear" the server already has this look. */
	const settle = useCallback(
		(look: Look, wornLookId: string | null) => {
			const clean = { look, wornLookId, dirty: false };
			setState(clean);
			writeDraft(childId, clean);
		},
		[childId],
	);

	return { look: state.look, wornLookId: state.wornLookId, set, undo, canUndo: past.length > 0, settle };
}

/** Friendly names to pick from when saving, so naming a look never needs the keyboard. */
export const LOOK_NAMES = [
	"Sunny",
	"Starlight",
	"Comet",
	"Pebble",
	"Maple",
	"Willow",
	"Jazz",
	"Breeze",
	"Nova",
	"Clover",
	"Ember",
	"Pixel",
];

const homeKey = (childId: string) => `jade.roxyhome.${childId}`;

/**
 * The home while it's being decorated. Like the look, each change is kept on this device at once and sent shortly
 * after, or when the device is back online.
 */
export function useHomeDraft(childId: string, server: Home) {
	const qc = useQueryClient();
	const [state, setState] = useState<{ home: Home; dirty: boolean }>(() => {
		try {
			const raw = localStorage.getItem(homeKey(childId));
			const local = raw ? (JSON.parse(raw) as { home: unknown; dirty: boolean }) : null;
			const home = local?.dirty ? normalizeHome(local.home) : null;
			if (home) return { home, dirty: true };
		} catch {
			// Fall through to the server copy.
		}
		return { home: server, dirty: false };
	});
	const latest = useRef(state);
	latest.current = state;
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const flush = useCallback(async () => {
		const d = latest.current;
		if (!d.dirty || !navigator.onLine) return;
		try {
			// The server drops what doesn't fit or is from a holiday a parent turned off; the room shows what it kept.
			const saved = await roxyApi.home(childId, d.home);
			qc.setQueryData(roxyQuery(childId).queryKey, (old) => old && { ...old, home: saved });
			if (latest.current === d) setState({ home: saved, dirty: false });
		} catch (err) {
			// Offline or a server hiccup: stays dirty on this device, and the next change or reconnect tries again.
			if (!permanent(err)) return;
			// Refused: sending it again never helps, so take the server's copy instead.
			const server = await serverCopy(qc, childId);
			if (latest.current === d) setState({ home: server?.home ?? d.home, dirty: false });
		}
	}, [childId, qc]);

	useEffect(() => {
		try {
			localStorage.setItem(homeKey(childId), JSON.stringify(state));
		} catch {
			// Storage blocked: the server copy still saves.
		}
		if (!state.dirty) return;
		clearTimeout(timer.current);
		timer.current = setTimeout(flush, AUTOSAVE_MS);
		return () => clearTimeout(timer.current);
	}, [childId, state, flush]);

	useEffect(() => {
		const online = () => void flush();
		window.addEventListener("online", online);
		return () => {
			window.removeEventListener("online", online);
			void flush();
		};
	}, [flush]);

	const set = useCallback((home: Home) => {
		latest.current = { home, dirty: true };
		setState(latest.current);
	}, []);
	/** The home as it is now, for changes that land after an await (the one a render saw may be out of date). */
	const current = useCallback(() => latest.current.home, []);
	return { home: state.home, set, current, saving: state.dirty };
}

const findsKey = (childId: string) => `jade.roxyfinds.${childId}`;

/** Finds made on this device that the server hasn't confirmed yet. */
export function pendingFinds(childId: string): string[] {
	try {
		const raw = JSON.parse(localStorage.getItem(findsKey(childId)) ?? "[]");
		return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
	} catch {
		return [];
	}
}
function writePendingFinds(childId: string, ids: string[]) {
	try {
		if (ids.length === 0) localStorage.removeItem(findsKey(childId));
		else localStorage.setItem(findsKey(childId), JSON.stringify(ids));
	} catch {
		// Storage blocked: it's still sent now if online.
	}
}

/** Remember a find on this device, then send every one still waiting. */
export function recordFind(childId: string, findId: string): Promise<boolean> {
	const waiting = pendingFinds(childId);
	if (!waiting.includes(findId)) writePendingFinds(childId, [...waiting, findId]);
	return flushFinds(childId);
}

/**
 * Send the finds waiting on this device. Finding is idempotent, so a resend is harmless. A refusal (say, a find the
 * catalog no longer has) is dropped; anything else waits for the next try. Resolves true if any reached the server.
 */
export async function flushFinds(childId: string): Promise<boolean> {
	let sent = false;
	for (const findId of pendingFinds(childId)) {
		if (!navigator.onLine) break;
		try {
			await roxyApi.find(childId, findId);
			sent = true;
		} catch (err) {
			if (!permanent(err)) break;
		}
		writePendingFinds(
			childId,
			pendingFinds(childId).filter((id) => id !== findId),
		);
	}
	return sent;
}

/** Send finds made offline as soon as a Roxy screen opens online, and again whenever the connection comes back. */
export function useSendFinds(childId: string) {
	const qc = useQueryClient();
	useEffect(() => {
		const send = () =>
			void flushFinds(childId).then((sent) => {
				if (sent) void qc.invalidateQueries({ queryKey: roxyQuery(childId).queryKey });
			});
		send();
		window.addEventListener("online", send);
		return () => window.removeEventListener("online", send);
	}, [childId, qc]);
}

/** Bring a prompt that just opened into view: the item grids may have been scrolled far below it. */
export function useRevealed<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	useEffect(() => {
		ref.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
	}, []);
	return ref;
}
