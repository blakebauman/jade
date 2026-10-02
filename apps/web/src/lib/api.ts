import type { ChildSettings, Mode, WordInfo } from "@jade/core";

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
	const headers = new Headers(init.headers);
	let body = init.body;
	if (init.json !== undefined) {
		headers.set("Content-Type", "application/json");
		body = JSON.stringify(init.json);
	}
	const res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
	if (res.status === 204) return undefined as T;
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
	return data as T;
}

/**
 * What to tell a parent when a request fails: what didn't happen and what to try, never a status code or a raw server
 * message. `what` completes "Couldn't …", e.g. "save the list".
 */
export function failure(err: unknown, what: string) {
	if (err instanceof ApiError && err.status === 429) return `Couldn’t ${what}: too many tries in a row. Wait a minute, then try again.`;
	if (err instanceof ApiError && (err.status === 401 || err.status === 403))
		return `Couldn’t ${what}: you’ve been signed out. Sign in again.`;
	if (err instanceof ApiError && err.status === 404) return `Couldn’t ${what}: it isn’t there any more. Go back and try again.`;
	if (err instanceof ApiError && err.status < 500) return `Couldn’t ${what}: something in it wasn’t accepted. Check it and try again.`;
	return `Couldn’t ${what}. Check the connection and try again.`;
}

export type Child = { id: string; name: string; avatar: string; grade: number | null; settings: ChildSettings };
export type ListSummary = {
	id: string;
	name: string;
	grade: number | null;
	source: string;
	wordCount: number;
	updatedAt: string;
	preview: string[];
	/** In past lists: kids no longer see it. */
	archived: boolean;
	/** The kids it's for; empty means every kid. */
	childIds: string[];
	/** Each kid who has played it: when they last did, and how many of its words they've mastered (4+ pips). */
	perChild: { childId: string; lastPlayedAt: string | number | null; mastered: number }[];
};

/**
 * Lists newest first. Timestamps are whole seconds, so lists saved in the same second fall back to the API's own order
 * (oldest created first): a later position there is newer.
 */
export function newestFirst<T extends Pick<ListSummary, "updatedAt">>(lists: T[]): T[] {
	return lists
		.map((l, i) => ({ l, i }))
		.sort((a, b) => new Date(b.l.updatedAt).getTime() - new Date(a.l.updatedAt).getTime() || b.i - a.i)
		.map((x) => x.l);
}

/** Whether a kid sees a list on their Spelling screen: it's current, and it's for them (or for everyone). */
export const listIsFor = (l: Partial<Pick<ListSummary, "archived" | "childIds">>, childId: string) =>
	// A summary cached before lists could be archived or assigned has neither field: it's current and for everyone.
	!l.archived && (!l.childIds?.length || l.childIds.includes(childId));
export type ListWord = { word: string; sentence: string | null; definition: string | null };
export type WordList = {
	id: string;
	name: string;
	grade: number | null;
	source: string;
	archived: boolean;
	childIds: string[];
	words: ListWord[];
};
export type Pack = { id: string; name: string; grade: number; wordCount: number; preview: string[] };
export type BadgeView = { id: string; label: string; icon: string; earned?: boolean };
export type Progress = {
	child: Child;
	stats: {
		currentStreak: number;
		bestStreak: number;
		lastDay: string | null;
		totalStars: number;
		/** Spent in Roxy; the spendable balance is totalStars − starsSpent. Missing in progress cached before Roxy. */
		starsSpent?: number;
		wordsSpelled: number;
	};
	badges: BadgeView[];
	reviewDue: string[];
	mastered: number;
	boxes: Record<string, number>;
	trouble: { word: string; misses: number; box: number }[];
	math: {
		levels: Partial<Record<string, number>>;
		factsDue: string[];
		factsMastered: number;
		factBoxes: Record<string, number>;
		trouble: { word: string; misses: number; box: number }[];
	};
	recent: { id: string; mode: Mode; listId: string | null; startedAt: string; correct: number; total: number; stars: number }[];
};
export type RoundSummary = {
	correct: number;
	total: number;
	stars: number;
	streak: number;
	newBadges: BadgeView[];
	levels?: Record<string, number>;
};
export type { WordInfo };
