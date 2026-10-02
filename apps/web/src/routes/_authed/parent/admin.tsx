import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Ban, LogIn, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { Problem } from "#/components/Problem.tsx";
import { impersonate } from "#/lib/admin.ts";
import { authClient } from "#/lib/auth.ts";

/** Every family's account, for whoever has the admin role. The server checks the role on every call; this only hides it. */
export const Route = createFileRoute("/_authed/parent/admin")({
	beforeLoad: ({ context }) => {
		if (context.user.role !== "admin") throw redirect({ to: "/parent" });
	},
	component: Admin,
});

const usersQuery = {
	queryKey: ["admin", "users"],
	queryFn: async () => {
		const res = await authClient.admin.listUsers({ query: { limit: 500, sortBy: "createdAt", sortDirection: "desc" } });
		if (res.error) throw new Error(res.error.message ?? "Couldn’t load accounts");
		return res.data;
	},
};

type Account = NonNullable<Awaited<ReturnType<typeof usersQuery.queryFn>>>["users"][number];

const joined = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function Admin() {
	const { user } = Route.useRouteContext();
	const { data, isPending, error } = useQuery(usersQuery);
	const [filter, setFilter] = useState("");
	const id = useId();
	const q = filter.trim().toLowerCase();
	const users = (data?.users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-3xl font-semibold">Admin</h1>
					<p className="text-page-muted">
						{data ? `${data.total} ${data.total === 1 ? "family" : "families"} on Jade’s World` : "Every family’s account"}
					</p>
				</div>
				<label className="w-full space-y-1 sm:w-72" htmlFor={`${id}-find`}>
					<span className="text-sm text-page-muted">Find by name or email</span>
					<input id={`${id}-find`} type="search" className="field" value={filter} onChange={(e) => setFilter(e.target.value)} />
				</label>
			</div>
			{error && <Problem>Couldn’t load the accounts. Check the connection and try again.</Problem>}
			{isPending && <p className="text-page-muted">Loading…</p>}
			{data && users.length === 0 && <p className="text-page-muted">No account matches that.</p>}
			<ul className="space-y-3">
				{users.map((u) => (
					<AccountRow key={u.id} account={u} self={u.id === user.id} />
				))}
			</ul>
		</div>
	);
}

function AccountRow({ account, self }: { account: Account; self: boolean }) {
	const qc = useQueryClient();
	const [askBan, setAskBan] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	const [switching, setSwitching] = useState(false);
	const ban = useMutation({
		mutationFn: async (banned: boolean) => {
			const res = banned
				? await authClient.admin.banUser({ userId: account.id })
				: await authClient.admin.unbanUser({ userId: account.id });
			if (res.error) throw new Error(res.error.message);
		},
		onMutate: () => setProblem(null),
		onSuccess: () => {
			setAskBan(false);
			qc.invalidateQueries({ queryKey: ["admin", "users"] });
		},
		onError: () => setProblem("Couldn’t change that. Check the connection and try again."),
	});
	const isAdmin = account.role === "admin";
	return (
		<li className="patch space-y-3 p-4 sm:px-5">
			<div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
				<div className="min-w-0 space-y-0.5">
					<p className="flex flex-wrap items-baseline gap-x-2 font-display text-lg font-semibold">
						<span className="truncate">{account.name}</span>
						{isAdmin && <span className="text-sm font-medium text-page-muted">Admin</span>}
						{account.banned && <span className="text-sm font-medium text-page-muted">Banned</span>}
						{self && <span className="text-sm font-medium text-page-muted">You</span>}
					</p>
					<p className="truncate text-sm text-page-muted">
						{account.email} · joined {joined(account.createdAt)}
					</p>
				</div>
				{!self && !isAdmin && (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="key"
							data-variant="felt"
							disabled={switching || Boolean(account.banned)}
							onClick={async () => {
								setSwitching(true);
								setProblem(await impersonate(account.id));
								setSwitching(false);
							}}
						>
							<LogIn className="size-5" aria-hidden /> Sign in as
						</button>
						{account.banned ? (
							<button type="button" className="key" data-variant="felt" disabled={ban.isPending} onClick={() => ban.mutate(false)}>
								<Undo2 className="size-5" aria-hidden /> Lift ban
							</button>
						) : (
							<button type="button" className="key" data-variant="felt" onClick={() => setAskBan(true)}>
								<Ban className="size-5" aria-hidden /> Ban
							</button>
						)}
					</div>
				)}
			</div>
			{askBan && (
				<Confirm
					message={`Ban ${account.name}?`}
					note="They’re signed out on every device and can’t sign in until you lift it. Nothing is deleted."
					confirmLabel="Ban"
					busy={ban.isPending}
					onConfirm={() => ban.mutate(true)}
					onCancel={() => setAskBan(false)}
				/>
			)}
			{problem && <Problem>{problem}</Problem>}
		</li>
	);
}
