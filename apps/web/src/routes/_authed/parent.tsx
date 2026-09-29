import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Brand } from "#/components/Brand.tsx";
import { api } from "#/lib/api.ts";
import { signOut } from "#/lib/auth.ts";
import { forgetDevice } from "#/lib/device.ts";
import { parentQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent")({ component: ParentLayout });

const UNLOCK_KEY = "jade.parent-unlocked";
const isUnlocked = () => {
	try {
		return sessionStorage.getItem(UNLOCK_KEY) === "1";
	} catch {
		return false;
	}
};

function PinGate({ onUnlock }: { onUnlock: () => void }) {
	const [error, setError] = useState(false);
	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const pin = String(new FormData(e.currentTarget).get("pin"));
		const { ok } = await api<{ ok: boolean }>("/api/parent/verify-pin", { method: "POST", json: { pin } });
		if (!ok) return setError(true);
		try {
			sessionStorage.setItem(UNLOCK_KEY, "1");
		} catch {}
		onUnlock();
	}
	return (
		<main className="grid min-h-dvh place-items-center p-6">
			<form onSubmit={submit} className="patch w-full max-w-xs space-y-4 p-6 text-center">
				<h1 className="text-2xl font-semibold">Parents only</h1>
				<label className="block space-y-2">
					<span className="text-sm text-felt-muted">Enter the 4-digit PIN</span>
					<input
						name="pin"
						inputMode="numeric"
						pattern="\d{4}"
						maxLength={4}
						autoComplete="off"
						// biome-ignore lint/a11y/noAutofocus: the PIN field is the only thing on this screen
						autoFocus
						className="field text-center text-3xl tracking-[0.5em]"
						aria-invalid={error}
					/>
				</label>
				{error && (
					<p role="alert" className="text-sm">
						That PIN didn’t match.
					</p>
				)}
				<button type="submit" className="key w-full" data-variant="go">
					Unlock
				</button>
				<Link to="/profiles" className="block text-sm text-felt-muted underline underline-offset-4">
					Back to practice
				</Link>
			</form>
		</main>
	);
}

const NAV = [
	{ to: "/parent", label: "Lists" },
	{ to: "/parent/kids", label: "Kids" },
	{ to: "/parent/settings", label: "Settings" },
] as const;

function ParentLayout() {
	const { data: parent } = useQuery(parentQuery);
	const [unlocked, setUnlocked] = useState(isUnlocked);
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [signOutFailed, setSignOutFailed] = useState(false);
	if (parent?.hasPin && !unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
	return (
		<div className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 md:px-10">
			<header className="flex flex-wrap items-center justify-between gap-4 py-6">
				<Link to="/profiles" aria-label="Back to practice">
					<Brand size={28} />
				</Link>
				<nav className="flex flex-wrap items-center gap-2" aria-label="Parent">
					{NAV.map((n) => (
						<Link
							key={n.to}
							to={n.to}
							activeOptions={{ exact: true }}
							className="key"
							data-variant="felt"
							activeProps={{ "data-pressed": "true", "aria-current": "page" } as Record<string, string>}
						>
							{n.label}
						</Link>
					))}
					<Link to="/profiles" className="key">
						Practice
					</Link>
					<button
						type="button"
						className="key"
						data-variant="felt"
						aria-label="Sign out"
						onClick={async () => {
							setSignOutFailed(false);
							const res = await signOut().catch(() => null);
							// Signing out needs the server; if it didn't happen, keep everything as it was and say so.
							if (!res || res.error) return setSignOutFailed(true);
							// Nothing about this family stays on a shared device.
							await forgetDevice();
							qc.clear();
							navigate({ to: "/" });
						}}
					>
						<LogOut className="size-5" aria-hidden />
					</button>
				</nav>
			</header>
			{signOutFailed && (
				<p role="alert" className="-mt-2 mb-6 text-right text-sm">
					Couldn’t sign out. Check the connection and try again.
				</p>
			)}
			<Outlet />
		</div>
	);
}
