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

export type Child = { id: string; name: string; avatar: string; grade: number | null; settings: ChildSettings };
export type ListSummary = { id: string; name: string; grade: number | null; source: string; wordCount: number; updatedAt: string };
export type ListWord = { word: string; sentence: string | null; definition: string | null };
export type WordList = { id: string; name: string; grade: number | null; source: string; words: ListWord[] };
export type Pack = { id: string; name: string; grade: number; wordCount: number; preview: string[] };
export type BadgeView = { id: string; label: string; icon: string; earned?: boolean };
export type Progress = {
	child: Child;
	stats: { currentStreak: number; bestStreak: number; lastDay: string | null; totalStars: number; wordsSpelled: number };
	badges: BadgeView[];
	reviewDue: string[];
	mastered: number;
	boxes: Record<string, number>;
	trouble: { word: string; misses: number; box: number }[];
	recent: { id: string; mode: Mode; listId: string | null; startedAt: string; correct: number; total: number; stars: number }[];
};
export type RoundSummary = { correct: number; total: number; stars: number; streak: number; newBadges: BadgeView[] };
export type { WordInfo };
