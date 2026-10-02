import { MAX_SAVED_LOOKS } from "@jade/core/roxy";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, House, Pencil, Shirt, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { useChild } from "#/lib/child.ts";
import { useOnline } from "#/lib/hooks.ts";
import { progressQuery } from "#/lib/queries.ts";
import { roxyApi, roxyQuery, type SavedLook, shownLook } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/looks")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: MyLooks,
});

/** The child's profile, for their family only: their Roxy and pet, a few numbers, and every look they've saved. */
function MyLooks() {
	const child = useChild();
	const qc = useQueryClient();
	const navigate = useNavigate();
	const online = useOnline();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	const { data: progress } = useQuery(progressQuery(child.id));
	const stickers = progress?.badges.filter((b) => b.earned).length ?? 0;
	const look = shownLook(child.id, data);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const refresh = () => qc.invalidateQueries({ queryKey: roxyQuery(child.id).queryKey });

	async function act(fn: () => Promise<unknown>, then?: () => void) {
		setError(null);
		try {
			await fn();
			// The studio's draft follows the server after this, not the old one on the device.
			localStorage.removeItem(`jade.roxy.${child.id}`);
			await refresh();
			then?.();
		} catch {
			setError("Couldn’t do that. Check the connection and try again.");
		}
	}

	const wearAndEdit = (look: SavedLook) =>
		act(
			() => roxyApi.wear(child.id, look.id),
			() => void navigate({ to: "/play/$childId/games/roxy", params: { childId: child.id } }),
		);

	return (
		<main className="mx-auto min-h-dvh max-w-6xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center gap-3">
				<Link to="/play/$childId/games/roxy" params={{ childId: child.id }} className="key" data-variant="felt">
					<ArrowLeft className="size-5" aria-hidden /> Roxy
				</Link>
				<h1 className="font-display text-3xl font-semibold">{child.name}’s looks</h1>
			</header>

			<section aria-label={`${child.name}’s profile`} className="patch mt-8 flex flex-wrap items-center gap-6 p-5 md:p-6">
				<div className="w-36 shrink-0 overflow-hidden rounded-xl md:w-44">
					<RoxyFigure look={look} title={`${child.name}’s Roxy`} className="block h-auto w-full" />
				</div>
				<div className="min-w-0 flex-1 space-y-4">
					<div>
						<p className="font-display text-3xl font-semibold">{child.name}</p>
						{look.slots.pet && look.petName && <p className="text-page-muted">with {look.petName}</p>}
					</div>
					<dl className="flex flex-wrap gap-x-8 gap-y-2">
						<div>
							<dt className="text-sm text-page-muted">Stars to spend</dt>
							<dd className="flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
								<Star className="size-5 fill-current" aria-hidden /> {data.balance}
							</dd>
						</div>
						<div>
							<dt className="text-sm text-page-muted">Saved looks</dt>
							<dd className="font-display text-2xl font-semibold tabular-nums">
								{data.looks.length} of {MAX_SAVED_LOOKS}
							</dd>
						</div>
						<div>
							<dt className="text-sm text-page-muted">Stickers</dt>
							<dd className="font-display text-2xl font-semibold tabular-nums">{stickers}</dd>
						</div>
					</dl>
					<div className="flex flex-wrap gap-2">
						<Link to="/play/$childId/games/roxy" params={{ childId: child.id }} className="key">
							<Shirt className="size-5" aria-hidden /> Style
						</Link>
						<Link to="/play/$childId/games/roxy/home" params={{ childId: child.id }} className="key">
							<House className="size-5" aria-hidden /> Visit home
						</Link>
					</div>
				</div>
			</section>

			{error && (
				<p role="alert" className="mt-6 font-medium">
					{error}
				</p>
			)}
			{!online && <p className="mt-6 text-page-muted">You’re offline. Your looks are here to see; changes need the internet.</p>}

			{data.looks.length === 0 ? (
				<section className="patch mt-10 flex flex-wrap items-center justify-between gap-5 p-6">
					<div>
						<h2 className="text-2xl font-semibold">No saved looks yet</h2>
						<p className="text-page-muted">Style your Roxy, then tap Save look to keep it here.</p>
					</div>
					<Link to="/play/$childId/games/roxy" params={{ childId: child.id }} className="key" data-variant="go">
						<Shirt className="size-5" aria-hidden /> Style Roxy
					</Link>
				</section>
			) : (
				<ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
					{[...data.looks].reverse().map((look) => {
						const wearing = look.id === data.wornLookId;
						return (
							<li key={look.id} className="patch flex flex-col gap-3 p-3">
								<div className="overflow-hidden rounded-xl">
									<RoxyFigure look={look.look} title={look.name} className="block h-auto w-full" />
								</div>
								<div className="flex items-baseline justify-between gap-2 px-1">
									<h2 className="truncate font-display text-xl font-semibold">
										{look.name}
										{look.look.petName && <span className="font-normal text-page-muted"> and {look.look.petName}</span>}
									</h2>
									{wearing && <span className="shrink-0 text-sm text-page-muted">On stage</span>}
								</div>
								{deleting === look.id ? (
									<Confirm
										className="!p-3"
										message={`Delete ${look.name}?`}
										confirmLabel="Delete"
										onConfirm={() =>
											void act(
												() => roxyApi.remove(child.id, look.id),
												() => setDeleting(null),
											)
										}
										onCancel={() => setDeleting(null)}
									/>
								) : (
									<div className="flex gap-2">
										<button type="button" className="key flex-1 !px-3" disabled={!online} onClick={() => void wearAndEdit(look)}>
											<Pencil className="size-4" aria-hidden /> {wearing ? "Edit" : "Wear"}
										</button>
										<button
											type="button"
											className="key !px-3"
											disabled={!online}
											aria-label={`Delete ${look.name}`}
											onClick={() => setDeleting(look.id)}
										>
											<Trash2 className="size-4" aria-hidden />
										</button>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</main>
	);
}
