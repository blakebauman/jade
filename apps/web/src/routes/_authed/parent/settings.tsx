import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { api } from "#/lib/api.ts";
import { useSession } from "#/lib/auth.ts";
import { parentQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent/settings")({ component: Settings });

function Settings() {
	const { data: parent } = useQuery(parentQuery);
	const { data: session } = useSession();
	const qc = useQueryClient();
	const [pin, setPin] = useState("");
	const [saved, setSaved] = useState<string | null>(null);
	const save = useMutation({
		mutationFn: (value: string | null) => api("/api/parent", { method: "PUT", json: { pin: value } }),
		onSuccess: (_, value) => {
			qc.invalidateQueries({ queryKey: ["parent"] });
			setPin("");
			setSaved(value ? "PIN saved. You’ll need it to open the parent area." : "PIN removed.");
		},
	});
	function submit(e: FormEvent) {
		e.preventDefault();
		save.mutate(pin);
	}
	return (
		<div className="max-w-xl space-y-10">
			<h1 className="text-4xl font-semibold">Settings</h1>
			<section className="space-y-4">
				<h2 className="text-2xl font-semibold">Parent PIN</h2>
				<p className="text-felt-muted">
					On a shared laptop or iPad, a 4-digit PIN keeps spellers out of list editing. It’s a speed bump, not a password. Anyone signed in
					on this device can still sign out.
				</p>
				<form onSubmit={submit} className="flex flex-wrap items-end gap-3">
					<label className="space-y-1.5">
						<span className="text-sm font-medium">{parent?.hasPin ? "New PIN" : "Choose a PIN"}</span>
						<input
							className="field w-40 text-center text-2xl tracking-[0.4em]"
							inputMode="numeric"
							pattern="\d{4}"
							maxLength={4}
							value={pin}
							onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
							autoComplete="off"
						/>
					</label>
					<button type="submit" className="key" data-variant="go" disabled={pin.length !== 4 || save.isPending}>
						Save PIN
					</button>
					{parent?.hasPin && (
						<button type="button" className="key" data-variant="felt" onClick={() => save.mutate(null)}>
							Remove PIN
						</button>
					)}
				</form>
				{saved && <p role="status">{saved}</p>}
			</section>
			<section className="space-y-2">
				<h2 className="text-2xl font-semibold">Account</h2>
				<p className="text-felt-muted">Signed in as {session?.user.email}</p>
			</section>
		</div>
	);
}
