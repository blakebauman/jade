import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "#/lib/auth.ts";
import { forgetDevice, rememberedUser, rememberUser } from "#/lib/device.ts";
import { parentQuery } from "#/lib/queries.ts";
import { applyAppearance } from "#/lib/theme.ts";

type User = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>["user"];

/**
 * The last confirmed user is kept on the device. If the server can't be reached (offline, or opening the installed app
 * with no connection), the app carries on as that user; answers wait in the offline queue. A server that says
 * "no session" always wins.
 */
const knownUser = () => rememberedUser<User>();

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		if (knownUser() && !navigator.onLine) return { user: knownUser()! };
		let res: Awaited<ReturnType<typeof authClient.getSession>>;
		try {
			res = await authClient.getSession();
		} catch (err) {
			if (knownUser()) return { user: knownUser()! };
			throw err;
		}
		if (res.data) {
			rememberUser(res.data.user);
			return { user: res.data.user };
		}
		// An error without a "you're not signed in" answer (offline, 5xx) isn't a sign-out.
		const status = res.error?.status;
		if (res.error && knownUser() && status !== 401 && status !== 403) return { user: knownUser()! };
		void forgetDevice();
		throw redirect({ to: "/", search: { next: location.href } });
	},
	component: Authed,
});

/** The family's Day / Night choice comes with the account, so every device they sign in on is lit the same way. */
function Authed() {
	const { data: parent } = useQuery(parentQuery);
	const appearance = parent?.appearance;
	useEffect(() => {
		if (appearance) applyAppearance(appearance);
	}, [appearance]);
	return <Outlet />;
}
