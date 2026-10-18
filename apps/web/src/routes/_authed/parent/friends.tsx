import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Undo2, UserMinus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { Problem } from "#/components/Problem.tsx";
import { api, failure } from "#/lib/api.ts";

export const Route = createFileRoute("/_authed/parent/friends")({
	component: Friends,
});

type Friend = { userId: string; label: string; since: number };
type FriendsData = { label: string; shownAs: string; guestsBuild: boolean; friends: Friend[] };

const friendsQuery = { queryKey: ["friends"], queryFn: () => api<FriendsData>("/api/parent/friends") };
const DAY_MS = 24 * 3600_000;

/**
 * Friends: families whose kids can visit each other's Campfire Woods islands. Parents link (one makes a code, the
 * other enters it), and can unlink, choose whether visitors may build, and take back what a family built here.
 * Kids never link anyone; they only ever see a friend's family name and other kids' initials.
 */
function Friends() {
	const id = useId();
	const qc = useQueryClient();
	const { data } = useQuery(friendsQuery);
	const [label, setLabel] = useState<string | null>(null);
	const [entered, setEntered] = useState("");
	const [found, setFound] = useState<{ code: string; label: string } | null>(null);
	const [made, setMade] = useState<{ code: string; expiresAt: number } | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [unlinking, setUnlinking] = useState<Friend | null>(null);
	const refresh = () => qc.invalidateQueries({ queryKey: ["friends"] });

	const save = useMutation({
		mutationFn: (body: { label?: string; guestsBuild?: boolean }) => api("/api/parent/friends", { method: "PUT", json: body }),
		onMutate: () => setStatus(null),
		onSuccess: (_, body) => {
			refresh();
			setStatus(
				body.guestsBuild === undefined
					? "Saved."
					: body.guestsBuild
						? "Friends can build on your island."
						: "Friends can look round your island, but not build.",
			);
		},
	});
	const code = useMutation({
		mutationFn: () => api<{ code: string; expiresAt: number }>("/api/parent/friends/code", { method: "POST" }),
		onSuccess: setMade,
	});
	const check = useMutation({
		mutationFn: (c: string) => api<{ label: string }>(`/api/parent/friends/code/${encodeURIComponent(c)}`),
		onSuccess: (r, c) => setFound({ code: c, label: r.label }),
	});
	const accept = useMutation({
		mutationFn: (c: string) => api<{ label: string }>("/api/parent/friends/accept", { method: "POST", json: { code: c } }),
		onSuccess: (r) => {
			setFound(null);
			setEntered("");
			setStatus(`You’re friends with ${r.label}. Your kids can visit each other’s islands in Campfire Woods.`);
			refresh();
		},
	});
	const unlink = useMutation({
		mutationFn: (f: Friend) => api(`/api/parent/friends/${encodeURIComponent(f.userId)}`, { method: "DELETE" }),
		onSuccess: (_, f) => {
			setUnlinking(null);
			setStatus(`${f.label} isn’t linked any more. Any visiting kids went home.`);
			refresh();
		},
	});
	const undo = useMutation({
		mutationFn: (v: { friend: Friend; since?: number }) =>
			api<{ undone: number }>("/api/parent/friends/undo", { method: "POST", json: { userId: v.friend.userId, since: v.since } }),
		onSuccess: (r, v) =>
			setStatus(
				r.undone
					? `Put back ${r.undone} ${r.undone === 1 ? "block" : "blocks"} ${v.friend.label} changed on your island.`
					: `${v.friend.label} hasn’t changed anything on your island${v.since ? " today" : ""}.`,
			),
	});

	function submitLabel(e: FormEvent) {
		e.preventDefault();
		if (label !== null) save.mutate({ label });
	}
	function submitCode(e: FormEvent) {
		e.preventDefault();
		const c = entered.trim().toUpperCase().replace(/[\s-]/g, "");
		if (c.length === 8) check.mutate(c);
	}

	return (
		<div className="space-y-10">
			<div className="space-y-2">
				<h1 className="text-4xl font-semibold">Friends</h1>
				<p className="max-w-2xl text-page-muted">
					Link with a friend’s family and your kids can play together on each other’s islands in Campfire Woods. There’s no chat: kids can
					only wave, send a heart or a star, and point. Friends see your kids by their first initial.
				</p>
			</div>
			<p role="status">{status}</p>

			<div className="grid grid-cols-1 items-start gap-x-12 gap-y-12 lg:grid-cols-2">
				<section className="max-w-xl space-y-4" aria-labelledby={`${id}-name`}>
					<h2 id={`${id}-name`} className="text-2xl font-semibold">
						Your family’s name
					</h2>
					<p className="text-page-muted">What friends see you called, here and on their kids’ list of islands.</p>
					<form onSubmit={submitLabel} className="flex flex-wrap items-end gap-3">
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Family name</span>
							<input
								className="field w-64"
								maxLength={40}
								placeholder={data?.shownAs}
								value={label ?? data?.label ?? ""}
								onChange={(e) => setLabel(e.target.value)}
							/>
						</label>
						<button type="submit" className="key" data-variant="go" disabled={label === null || save.isPending}>
							Save
						</button>
					</form>
					{save.isError && <Problem>{failure(save.error, "save that")}</Problem>}
				</section>

				<section className="patch max-w-xl space-y-4 p-6" aria-labelledby={`${id}-add`}>
					<h2 id={`${id}-add`} className="text-2xl font-semibold">
						Add a friend
					</h2>
					<p className="text-page-muted">
						Make a code and give it to the other parent, or type in the code they gave you. A code works once, for two days.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<button type="button" className="key" onClick={() => code.mutate()} disabled={code.isPending}>
							Make a code
						</button>
						{made && (
							<p className="flex items-center gap-2">
								<span className="font-mono text-2xl font-semibold tracking-[0.2em]">
									{made.code.slice(0, 4)}-{made.code.slice(4)}
								</span>
								<button
									type="button"
									className="key"
									data-variant="felt"
									aria-label="Copy the code"
									onClick={() => void navigator.clipboard?.writeText(made.code).then(() => setStatus("Code copied."))}
								>
									<Copy className="size-4" aria-hidden />
								</button>
							</p>
						)}
					</div>
					{code.isError && <Problem>{failure(code.error, "make a code")}</Problem>}
					<form onSubmit={submitCode} className="flex flex-wrap items-end gap-3">
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">A code from a friend</span>
							<input
								className="field w-48 font-mono uppercase tracking-[0.15em]"
								maxLength={9}
								autoComplete="off"
								autoCapitalize="characters"
								spellCheck={false}
								value={entered}
								onChange={(e) => {
									setEntered(e.target.value);
									setFound(null);
								}}
							/>
						</label>
						<button type="submit" className="key" disabled={entered.replace(/[\s-]/g, "").length !== 8 || check.isPending}>
							Look it up
						</button>
					</form>
					{check.isError && <Problem>That code doesn’t work. It may have been used, or run out. Ask for a new one.</Problem>}
					{found && (
						<div className="flex flex-wrap items-center gap-3">
							<p>
								This code is from <span className="font-semibold">{found.label}</span>.
							</p>
							<button type="button" className="key" data-variant="go" onClick={() => accept.mutate(found.code)} disabled={accept.isPending}>
								Be friends
							</button>
						</div>
					)}
					{accept.isError && <Problem>{failure(accept.error, "link with that family")}</Problem>}
				</section>
			</div>

			<section className="space-y-4" aria-labelledby={`${id}-list`}>
				<h2 id={`${id}-list`} className="text-2xl font-semibold">
					Your friends
				</h2>
				{!data?.friends.length ? (
					<p className="text-page-muted">No friends linked yet.</p>
				) : (
					<ul className="max-w-3xl divide-y divide-page-line">
						{data.friends.map((f) => (
							<li key={f.userId} className="flex flex-wrap items-center gap-3 py-3">
								<span className="min-w-0 flex-1 font-medium">{f.label}</span>
								<button
									type="button"
									className="key"
									data-variant="felt"
									onClick={() => undo.mutate({ friend: f, since: Date.now() - DAY_MS })}
								>
									<Undo2 className="size-4" aria-hidden /> Undo today’s building
								</button>
								<button type="button" className="key" data-variant="felt" onClick={() => undo.mutate({ friend: f })}>
									<Undo2 className="size-4" aria-hidden /> Undo all their building
								</button>
								<button type="button" className="key" data-variant="felt" onClick={() => setUnlinking(f)}>
									<UserMinus className="size-4" aria-hidden /> Unlink
								</button>
							</li>
						))}
					</ul>
				)}
				{undo.isError && <Problem>{failure(undo.error, "put those blocks back")}</Problem>}
				<label className="flex items-center gap-3 pt-2">
					<input
						type="checkbox"
						className="size-5"
						checked={save.isPending && save.variables?.guestsBuild !== undefined ? save.variables.guestsBuild : (data?.guestsBuild ?? true)}
						onChange={(e) => save.mutate({ guestsBuild: e.target.checked })}
					/>
					<span>Friends can build on our island (when off, they can only look round)</span>
				</label>
			</section>

			{unlinking && (
				<Confirm
					message={`Unlink ${unlinking.label}?`}
					note="Your kids won’t be able to visit each other’s islands. Anyone visiting now goes home straight away."
					confirmLabel="Unlink"
					busy={unlink.isPending}
					onCancel={() => setUnlinking(null)}
					onConfirm={() => unlink.mutate(unlinking)}
				/>
			)}
		</div>
	);
}
