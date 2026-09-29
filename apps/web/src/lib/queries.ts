import { queryOptions } from "@tanstack/react-query";
import { api, type Child, type ListSummary, type Pack, type Progress, type WordInfo, type WordList } from "./api.ts";

export const childrenQuery = queryOptions({ queryKey: ["children"], queryFn: () => api<Child[]>("/api/children") });
export const listsQuery = queryOptions({ queryKey: ["lists"], queryFn: () => api<ListSummary[]>("/api/lists") });
export const packsQuery = queryOptions({
	queryKey: ["packs"],
	queryFn: () => api<Pack[]>("/api/lists/packs"),
	staleTime: Number.POSITIVE_INFINITY,
});
export const listQuery = (id: string) => queryOptions({ queryKey: ["lists", id], queryFn: () => api<WordList>(`/api/lists/${id}`) });
export const progressQuery = (childId: string) =>
	queryOptions({ queryKey: ["progress", childId], queryFn: () => api<Progress>(`/api/children/${childId}/progress`) });
export const wordQuery = (word: string) =>
	queryOptions({
		queryKey: ["word", word],
		queryFn: () => api<WordInfo>(`/api/words/${encodeURIComponent(word)}`),
		staleTime: Number.POSITIVE_INFINITY,
	});
export const parentQuery = queryOptions({
	queryKey: ["parent"],
	queryFn: () => api<{ hasPin: boolean; timeZone: string | null }>("/api/parent"),
});
