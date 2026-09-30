import { DEFAULT_PIN_RELOCK_MINUTES } from "@jade/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "#/components/Brand.tsx";
import { ApiError, api } from "#/lib/api.ts";
import { signOut } from "#/lib/auth.ts";
import { forgetDevice } from "#/lib/device.ts";
import { discardPending, flushPending, pendingRounds } from "#/lib/offline.ts";
import { isParentUnlocked, lockParent, unlockParent } from "#/lib/parentLock.ts";
import { parentQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent")({ component: ParentLayout });

const PIN_ERRORS = {
	wrong: "That PIN didn’t match.",
	busy: "Too many tries. Wait a minute, then try again.",
	offline: "Couldn’t check the PIN. Check the connection and try again.",
} as const;

function PinGate({ onUnlock }: { onUnlock: () => void }) {
	const [error, setError] = useState<keyof typeof PIN_ERRORS | null>(null);
	const [checking, setChecking] = useState(false);
	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const pin = String(new FormData(form).get("pin"));
		setChecking(true);
		try {
			const { ok } = await api<{ ok: boolean }>("/api/parent/verify-pin", { method: "POST", json: { pin } });
			if (ok) return onUnlock();
			setError("wrong");
			form.reset();
		} catch (err) {
			setError(err instanceof ApiError && err.status === 429 ? "busy" : "offline");
		} finally {
			setChecking(false);
		}
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
						aria-invalid={error === "wrong"}
					/>
				</label>
				{error && (
					<p role="alert" className="text-sm">
						{PIN_ERRORS[error]}
					</p>
				)}
				<button type="submit" className="key w-full" data-variant="go" disabled={checking}>
					Unlock
				</button>
				<Link to="/profiles" className="block text-sm text-felt-muted underline underline-offset-4">
					Back to practice
				</Link>
			</form>
		</main>
	);
}

/**
 * Keeps an unlocked parent area unlocked while the parent is using it: any tap or key restarts the idle clock. It locks
 * once the clock runs out (checked on a timer and whenever the tab comes back, since a sleeping iPad pauses timers) and
 * whenever the parent area is left, e.g. for Practice.
 */
function useParentUnlock(user: string, idleMs: number) {
	const [unlocked, setUnlocked] = useState(() => isParentUnlocked(user, idleMs));
	// The first check can run before the parent's own idle time has loaded (it starts at the default); look again once it has.
	useEffect(() => {
		if (isParentUnlocked(user, idleMs)) setUnlocked(true);
	}, [user, idleMs]);
	useEffect(() => {
		if (!unlocked) return;
		unlockParent(user);
		let last = 0;
		const touch = () => {
			// Throttled: one write every few seconds is plenty for a clock of a minute or more.
			if (Date.now() - last < 5_000) return;
			last = Date.now();
			if (isParentUnlocked(user, idleMs)) unlockParent(user);
		};
		const check = () => {
			if (!isParentUnlocked(user, idleMs)) setUnlocked(false);
		};
		const timer = setInterval(check, 15_000);
		const events = ["pointerdown", "keydown"] as const;
		for (const e of events) window.addEventListener(e, touch, { capture: true, passive: true });
		document.addEventListener("visibilitychange", check);
		return () => {
			clearInterval(timer);
			for (const e of events) window.removeEventListener(e, touch, { capture: true });
			document.removeEventListener("visibilitychange", check);
			lockParent();
		};
	}, [unlocked, user, idleMs]);
	return [unlocked, useCallback(() => setUnlocked(true), [])] as const;
}

const NAV = [
	{ to: "/parent", label: "Lists" },
	{ to: "/parent/kids", label: "Kids" },
	{ to: "/parent/settings", label: "Settings" },
] as const;

function ParentLayout() {
	const { user } = Route.useRouteContext();
	const { data: parent, isPending } = useQuery(parentQuery);
	const [unlocked, unlock] = useParentUnlock(user.id, (parent?.pinRelockMinutes ?? DEFAULT_PIN_RELOCK_MINUTES) * 60_000);
	// With no PIN the area is open; count it as unlocked so a PIN set in Settings doesn't lock the parent out that moment.
	useEffect(() => {
		if (parent?.hasPin === false) unlock();
	}, [parent?.hasPin, unlock]);
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [notice, setNotice] = useState<{ kind: "failed" } | { kind: "unsaved"; rounds: number } | null>(null);

	/** Sign out, but never silently lose practice that hasn't reached the server yet. */
	async function leave(discard: boolean) {
		setNotice(null);
		if (!discard) {
			await flushPending().catch(() => {});
			const rounds = await pendingRounds();
			if (rounds > 0) return setNotice({ kind: "unsaved", rounds });
		}
		const res = await signOut().catch(() => null);
		// Signing out needs the server; if it didn't happen, keep everything as it was and say so.
		if (!res || res.error) return setNotice({ kind: "failed" });
		// Nothing about this family stays on a shared device, including writes queued for their account.
		await discardPending();
		await forgetDevice();
		qc.clear();
		navigate({ to: "/" });
	}

	// Fail closed: nothing shows until we know there's no PIN. If that can't be learned (offline, nothing cached), ask for it.
	if (isPending) return null;
	if (parent?.hasPin !== false && !unlocked) return <PinGate onUnlock={unlock} />;
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
					<button type="button" className="key" data-variant="felt" aria-label="Sign out" onClick={() => void leave(false)}>
						<LogOut className="size-5" aria-hidden />
					</button>
				</nav>
			</header>
			{notice?.kind === "failed" && (
				<p role="alert" className="-mt-2 mb-6 text-right text-sm">
					Couldn’t sign out. Check the connection and try again.
				</p>
			)}
			{notice?.kind === "unsaved" && (
				<section className="patch mb-8 flex flex-wrap items-center justify-between gap-4 p-5" aria-labelledby="unsaved-heading">
					<div className="max-w-prose space-y-1" role="alert">
						<h2 id="unsaved-heading" className="text-xl font-semibold">
							Practice from {notice.rounds} {notice.rounds === 1 ? "round hasn’t" : "rounds haven’t"} been saved yet
						</h2>
						<p className="text-sm text-felt-muted">
							It uploads by itself once this device is online and signed in. Signing out now throws it away.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button type="button" className="key" onClick={() => setNotice(null)}>
							Stay signed in
						</button>
						<button type="button" className="key" onClick={() => void leave(true)}>
							Sign out anyway
						</button>
					</div>
				</section>
			)}
			<Outlet />
		</div>
	);
}
