import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "#/components/roxy/Studio.tsx";
import { useChild } from "#/lib/child.ts";
import { roxyQuery } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/")({
	// `tab`: open on one tab, e.g. Pets from the pet shop's adoption sign.
	validateSearch: (search: Record<string, unknown>): { tab?: string } => (typeof search.tab === "string" ? { tab: search.tab } : {}),
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: RoxyStudio,
});

function RoxyStudio() {
	const child = useChild();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	const { tab } = Route.useSearch();
	return <Studio key={child.id} childId={child.id} data={data} {...(tab && { initialTab: tab })} />;
}
