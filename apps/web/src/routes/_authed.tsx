import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Problem } from "#/components/Problem.tsx";
import { stopImpersonating } from "#/lib/admin.ts";
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
		// `impersonating`: an admin is signed in as this family (admin plugin). Only known online.
		if (knownUser() && !navigator.onLine) return { user: knownUser()!, impersonating: false };
		let res: Awaited<ReturnType<typeof authClient.getSession>>;
		try {
			res = await authClient.getSession();
		} catch (err) {
			if (knownUser()) return { user: knownUser()!, impersonating: false };
			throw err;
		}
		if (res.data) {
			rememberUser(res.data.user);
			return { user: res.data.user, impersonating: Boolean(res.data.session.impersonatedBy) };
		}
		// An error without a "you're not signed in" answer (offline, 5xx) isn't a sign-out.
		const status = res.error?.status;
		if (res.error && knownUser() && status !== 401 && status !== 403) return { user: knownUser()!, impersonating: false };
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
	return (
		<>
			<ImpersonationBar />
			<Outlet />
		</>
	);
}

/**
 * While an admin is signed in as another family: who, and the way back. Kept off play screens, which size themselves
 * to the viewport.
 */
function ImpersonationBar() {
	const { user, impersonating } = Route.useRouteContext();
	const playing = useLocation({ select: (l) => l.pathname.startsWith("/play") });
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	if (!impersonating || playing) return null;
	return (
		<div className="mx-auto max-w-6xl px-safe-5 pt-safe-4 md:px-safe-10">
			<div className="patch flex flex-wrap items-center justify-between gap-3 p-3 pl-5" role="status">
				<p className="text-sm">
					Signed in as <span className="font-semibold">{user.email}</span> from the admin area
				</p>
				<button
					type="button"
					className="key"
					disabled={busy}
					onClick={async () => {
						setBusy(true);
						setError(await stopImpersonating());
						setBusy(false);
					}}
				>
					<ArrowLeft className="size-5" aria-hidden /> Back to my account
				</button>
			</div>
			{error && <Problem className="mt-2">{error}</Problem>}
		</div>
	);
}
