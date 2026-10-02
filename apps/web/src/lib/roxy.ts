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
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";
import { dayKey } from "./hooks.ts";

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
	home: (childId: string, home: Home) => api<Home>(`${base(childId)}/home`, { method: "PUT", json: { home } }),
	current: (childId: string, look: Look, wornLookId: string | null) =>
		api(`${base(childId)}/current`, { method: "PUT", json: { look, wornLookId } }),
};

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
			await roxyApi.current(childId, d.look, d.wornLookId);
			qc.setQueryData(roxyQuery(childId).queryKey, (old) => old && { ...old, current: d.look, wornLookId: d.wornLookId });
			if (latest.current === d) {
				const clean = { ...d, dirty: false };
				setState(clean);
				writeDraft(childId, clean);
			}
		} catch {
			// Kept locally as dirty; the next change or reconnect tries again.
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

	const set = useCallback((next: Look, wornLookId: string | null = null) => {
		setPast([...pastRef.current.slice(-UNDO_LIMIT + 1), latest.current.look]);
		setState({ look: next, wornLookId, dirty: true });
	}, []);

	const undo = useCallback(() => {
		const prev = pastRef.current.at(-1);
		if (!prev) return;
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
			const saved = await roxyApi.home(childId, d.home);
			qc.setQueryData(roxyQuery(childId).queryKey, (old) => old && { ...old, home: saved });
			if (latest.current === d) setState({ home: d.home, dirty: false });
		} catch {
			// Stays dirty on this device; the next change or reconnect tries again.
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

	const set = useCallback((home: Home) => setState({ home, dirty: true }), []);
	return { home: state.home, set, saving: state.dirty };
}
