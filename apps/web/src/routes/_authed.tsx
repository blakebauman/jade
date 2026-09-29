import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "#/lib/auth.ts";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const { data } = await authClient.getSession();
		if (!data) throw redirect({ to: "/", search: { next: location.href } });
		return { user: data.user };
	},
	component: Outlet,
});
