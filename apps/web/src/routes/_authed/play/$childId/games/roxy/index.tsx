import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "#/components/roxy/Studio.tsx";
import { useChild } from "#/lib/child.ts";
import { roxyQuery } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: RoxyStudio,
});

function RoxyStudio() {
	const child = useChild();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	return <Studio key={child.id} childId={child.id} data={data} />;
}
