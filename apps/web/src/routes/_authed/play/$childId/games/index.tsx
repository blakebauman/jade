import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The Play home is the home shelf now: every game is a tile there beside Spelling and Math, and quests, badges and more
 * time are its buttons. This address stays, since games' back keys and a shut Play's redirect still point here.
 */
export const Route = createFileRoute("/_authed/play/$childId/games/")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/play/$childId", params, replace: true });
	},
});
