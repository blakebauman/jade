import { DEFAULT_PIN_RELOCK_MINUTES } from "@jade/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Brand } from "#/components/Brand.tsx";
import { Pending } from "#/components/Pending.tsx";
import { Problem } from "#/components/Problem.tsx";
import { SignOut } from "#/components/SignOut.tsx";
import { ApiError, api } from "#/lib/api.ts";
import { isParentUnlocked, lockParent, unlockParent } from "#/lib/parentLock.ts";
import { parentQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent")({ component: ParentLayout });

const PIN_ERRORS = {
	short: "The PIN is 4 digits.",
	wrong: "That PIN didn’t match. Try again, or use your account password below.",
	wrongPassword: "That password didn’t match.",
	busy: "Too many tries. Wait a minute, then try again.",
	offline: "Couldn’t check that. Check the connection and try again.",
} as const;

/**
 * The PIN gate never strands anyone: a forgotten PIN gives way to the account password (then Settings, to choose a new
 * PIN), and signing out works from here too.
 */
function PinGate({ onUnlock }: { onUnlock: (forgotPin: boolean) => void }) {
	const [error, setError] = useState<keyof typeof PIN_ERRORS | null>(null);
	const [checking, setChecking] = useState(false);
	const [usePassword, setUsePassword] = useState(false);
	const id = useId();
	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const value = String(new FormData(form).get("secret"));
		// Checked here rather than by the browser, whose validation bubble belongs to no part of the board.
		if (!usePassword && !/^\d{4}$/.test(value)) return setError("short");
		if (!value) return;
		setChecking(true);
		try {
			const { ok } = usePassword
				? await api<{ ok: boolean }>("/api/parent/verify-password", { method: "POST", json: { password: value } })
				: await api<{ ok: boolean }>("/api/parent/verify-pin", { method: "POST", json: { pin: value } });
			if (ok) return onUnlock(usePassword);
			setError(usePassword ? "wrongPassword" : "wrong");
			form.reset();
			form.querySelector("input")?.focus();
		} catch (err) {
			setError(err instanceof ApiError && err.status === 429 ? "busy" : "offline");
		} finally {
			setChecking(false);
		}
	}
	function switchTo(password: boolean) {
		setError(null);
		setUsePassword(password);
	}
	return (
		<main className="grid min-h-dvh place-items-center p-6">
			<div className="w-full max-w-xs space-y-6">
				<form onSubmit={submit} noValidate className="patch space-y-4 p-6 text-center" key={String(usePassword)}>
					<h1 className="text-2xl font-semibold">Parents only</h1>
					<label className="block text-sm text-felt-muted" htmlFor={`${id}-secret`}>
						{usePassword ? "Your account password" : "Enter the 4-digit PIN"}
					</label>
					{usePassword ? (
						<input
							id={`${id}-secret`}
							name="secret"
							type="password"
							autoComplete="current-password"
							required
							// biome-ignore lint/a11y/noAutofocus: the password field is what this step is for
							autoFocus
							className="field"
							aria-invalid={error === "wrongPassword"}
							aria-describedby={error ? `${id}-error` : undefined}
						/>
					) : (
						<input
							id={`${id}-secret`}
							name="secret"
							type="password"
							inputMode="numeric"
							pattern="\d{4}"
							maxLength={4}
							required
							autoComplete="off"
							// biome-ignore lint/a11y/noAutofocus: the PIN field is the only thing on this screen
							autoFocus
							className="field text-center text-3xl tracking-[0.5em]"
							aria-invalid={error === "wrong" || error === "short"}
							aria-describedby={error ? `${id}-error` : undefined}
						/>
					)}
					{error && (
						<Problem id={`${id}-error`} className="text-left">
							{PIN_ERRORS[error]}
						</Problem>
					)}
					<button type="submit" className="key w-full" data-variant="go" disabled={checking}>
						{checking ? "Checking…" : "Unlock"}
					</button>
					<button
						type="button"
						className="min-h-11 text-sm text-felt-muted underline underline-offset-4 hover:text-felt-ink"
						onClick={() => switchTo(!usePassword)}
					>
						{usePassword ? "Use the PIN instead" : "Forgot the PIN?"}
					</button>
				</form>
				<div className="flex flex-wrap items-start justify-center gap-3">
					<Link to="/profiles" className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> Back to practice
					</Link>
					<SignOut className="flex flex-col items-center" />
				</div>
			</div>
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
	{ to: "/parent", label: "Lists", match: (path: string) => path === "/parent" || path.startsWith("/parent/lists") },
	{ to: "/parent/kids", label: "Kids", match: (path: string) => path.startsWith("/parent/kids") || path.startsWith("/parent/progress") },
	{ to: "/parent/settings", label: "Settings", match: (path: string) => path.startsWith("/parent/settings") },
] as const;

/** True once `ms` has passed, so a quick load shows nothing rather than a flash of the loading board. */
function useAfter(ms: number) {
	const [done, setDone] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setDone(true), ms);
		return () => clearTimeout(t);
	}, [ms]);
	return done;
}

function ParentLayout() {
	const { user } = Route.useRouteContext();
	const { data: parent, isPending } = useQuery(parentQuery);
	const [unlocked, unlock] = useParentUnlock(user.id, (parent?.pinRelockMinutes ?? DEFAULT_PIN_RELOCK_MINUTES) * 60_000);
	// With no PIN the area is open; count it as unlocked so a PIN set in Settings doesn't lock the parent out that moment.
	useEffect(() => {
		if (parent?.hasPin === false) unlock();
	}, [parent?.hasPin, unlock]);
	const navigate = useNavigate();
	const path = useLocation({ select: (l) => l.pathname.replace(/\/$/, "") });
	const slow = useAfter(600);

	// Fail closed: nothing shows until we know there's no PIN. If that can't be learned (offline, nothing cached), ask for it.
	if (isPending) return slow ? <Pending /> : null;
	if (parent?.hasPin !== false && !unlocked)
		return (
			<PinGate
				onUnlock={(forgotPin) => {
					unlock();
					if (forgotPin) navigate({ to: "/parent/settings", search: { newPin: true } });
				}}
			/>
		);
	return (
		<div className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 md:px-10">
			<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-5 md:py-6">
				{/* The brand is a mark, not a second way to Practice: the Practice key is the one exit. */}
				<Brand size={28} />
				<nav
					className="order-last grid w-full grid-cols-3 gap-2 sm:order-none sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center"
					aria-label="Parent"
				>
					{NAV.map((n) => {
						const current = n.match(path);
						return (
							<Link
								key={n.to}
								to={n.to}
								className="key"
								data-variant="felt"
								data-pressed={current || undefined}
								aria-current={current ? "page" : undefined}
							>
								{n.label}
							</Link>
						);
					})}
				</nav>
				{/* The way out of the parent area, set apart from the section keys it could be mistaken for. */}
				<Link to="/profiles" className="key sm:ml-3">
					<ArrowLeft className="size-5" aria-hidden /> Practice
				</Link>
			</header>
			<Outlet />
		</div>
	);
}
