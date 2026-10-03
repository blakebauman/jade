import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useMatch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TimeUp } from "#/components/play/TimeUp.tsx";
import { flushEarnings, PlayClock, type PlayStatus, playQuery, usePlayClock } from "#/lib/play.ts";

/**
 * Play: the Play home and every game under it. A game is reached only while Play is open for this kid (practice first
 * met, play time left); otherwise it's back to the Play home, which says why and what opens it. While a game is open
 * its play time is counted. A speed bump a parent sets, like the PIN: the server keeps the books, not the gate.
 */
export const Route = createFileRoute("/_authed/play/$childId/games")({
	beforeLoad: async ({ context, params, location }) => {
		if (/\/games\/?$/.test(location.pathname)) return;
		const query = playQuery(params.childId);
		const status = await context.queryClient
			.fetchQuery({ ...query, staleTime: 0 })
			.catch(() => context.queryClient.getQueryData<PlayStatus>(query.queryKey));
		if (status && !status.open) throw redirect({ to: "/play/$childId/games", params });
	},
	component: PlayLayout,
});

function PlayLayout() {
	const { childId } = Route.useParams();
	const home = useMatch({ from: "/_authed/play/$childId/games/", shouldThrow: false });
	const { data } = useQuery(playQuery(childId));
	// Only a game uses play time; the Play home is where it's bought.
	const clock = usePlayClock(childId, home ? undefined : data);
	const [held, hold] = useState(false);
	// Tickets a game paid while offline go as soon as Play opens online, and whenever the connection is back.
	const qc = useQueryClient();
	useEffect(() => {
		const send = () => void flushEarnings(childId).then((s) => s && qc.setQueryData(playQuery(childId).queryKey, s));
		send();
		window.addEventListener("online", send);
		return () => window.removeEventListener("online", send);
	}, [childId, qc]);
	const value = useMemo(() => ({ ...clock, hold }), [clock]);
	return (
		<PlayClock.Provider value={value}>
			{/* Behind the sheet nothing can be reached, by Tab or by tap. */}
			<div inert={clock.up && !held} className="contents">
				<Outlet />
			</div>
			{/* Time's up on every game screen; a go under way (a Gobble round) finishes first. */}
			{clock.up && !held && <TimeUp />}
		</PlayClock.Provider>
	);
}
