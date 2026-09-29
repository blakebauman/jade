import { type QueryClient, queryOptions } from "@tanstack/react-query";
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
/**
 * Progress for starting a round: fresh from the server when it can be, otherwise whatever this device last loaded, so a
 * round still starts with the network down (its answers wait in the offline queue).
 */
export async function roundProgress(qc: QueryClient, childId: string): Promise<Progress> {
	const q = progressQuery(childId);
	const cached = qc.getQueryData(q.queryKey);
	if (cached && !navigator.onLine) return cached;
	try {
		return await qc.fetchQuery({ ...q, retry: cached ? false : 1 });
	} catch (err) {
		if (cached) return cached;
		throw err;
	}
}
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
