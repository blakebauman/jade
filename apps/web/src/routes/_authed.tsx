import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "#/lib/auth.ts";

type User = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>["user"];

/**
 * The last confirmed user in this app session. If the network drops mid-practice, moving between screens keeps working
 * on it instead of failing the session check (answers wait in the offline queue). A server that says "no session"
 * always wins.
 */
let lastUser: User | null = null;

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		if (lastUser && !navigator.onLine) return { user: lastUser };
		let res: Awaited<ReturnType<typeof authClient.getSession>>;
		try {
			res = await authClient.getSession();
		} catch (err) {
			if (lastUser) return { user: lastUser };
			throw err;
		}
		if (res.data) {
			lastUser = res.data.user;
			return { user: lastUser };
		}
		// No answer from the server (offline, 5xx) is not the same as "signed out".
		if (res.error && lastUser && (res.error.status === 0 || res.error.status >= 500)) return { user: lastUser };
		lastUser = null;
		throw redirect({ to: "/", search: { next: location.href } });
	},
	component: Outlet,
});
