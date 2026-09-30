import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useId, useState } from "react";
import { Problem } from "#/components/Problem.tsx";
import { signOut } from "#/lib/auth.ts";
import { forgetDevice } from "#/lib/device.ts";
import { discardPending, flushPending, pendingRounds } from "#/lib/offline.ts";

/**
 * Sign out, but never silently lose practice that hasn't reached the server yet. Lives in Settings and on the PIN gate,
 * so a parent who can't get past the gate can still hand the device back signed out.
 */
export function SignOut({ className = "" }: { className?: string }) {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const id = useId();
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<{ kind: "failed" } | { kind: "unsaved"; rounds: number } | null>(null);

	async function leave(discard: boolean) {
		setNotice(null);
		setBusy(true);
		try {
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
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className={`space-y-4 ${className}`}>
			<button
				type="button"
				className="key"
				data-variant="felt"
				disabled={busy}
				aria-describedby={notice?.kind === "failed" ? `${id}-failed` : undefined}
				onClick={() => void leave(false)}
			>
				<LogOut className="size-5" aria-hidden /> Sign out
			</button>
			{notice?.kind === "failed" && <Problem id={`${id}-failed`}>Couldn’t sign out. Check the connection and try again.</Problem>}
			{notice?.kind === "unsaved" && (
				<section className="patch space-y-4 p-5 text-left" aria-labelledby={`${id}-unsaved`}>
					<div className="max-w-prose space-y-1" role="status">
						<h2 id={`${id}-unsaved`} className="text-xl font-semibold">
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
						<button type="button" className="key" disabled={busy} onClick={() => void leave(true)}>
							Sign out anyway
						</button>
					</div>
				</section>
			)}
		</div>
	);
}
