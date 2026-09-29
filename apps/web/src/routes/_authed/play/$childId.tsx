import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useChild } from "#/lib/child.ts";
import { childrenQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId")({
	loader: async ({ context, params }) => {
		const kids = await context.queryClient.ensureQueryData(childrenQuery);
		if (!kids.some((k) => k.id === params.childId)) throw notFound();
	},
	component: PlayLayout,
});

function PlayLayout() {
	const child = useChild();
	useEffect(() => {
		speaker.voice = child.settings.voice;
		speaker.rate = child.settings.rate;
	}, [child.settings.voice, child.settings.rate]);
	return (
		<div data-font={child.settings.font} className={child.settings.highContrast ? "contrast-125" : undefined}>
			<Outlet />
		</div>
	);
}
