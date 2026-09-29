import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { childrenQuery } from "./queries.ts";

/** The child whose play area we're in (the /play/$childId layout guarantees it exists). */
export function useChild() {
	const { childId } = useParams({ strict: false }) as { childId: string };
	const { data } = useSuspenseQuery(childrenQuery);
	return data.find((k) => k.id === childId)!;
}
