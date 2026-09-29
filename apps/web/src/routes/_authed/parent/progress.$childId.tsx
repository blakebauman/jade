import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips, WordTiles } from "@jade/ui/components/tile";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { progressQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent/progress/$childId")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(progressQuery(params.childId)),
	component: ProgressPage,
});

const MODE_LABEL = { bee: "Bee", learn: "Learn", tiles: "Tiles", review: "Review" } as const;

function ProgressPage() {
	const { childId } = Route.useParams();
	const { data: p } = useSuspenseQuery(progressQuery(childId));
	const facts = [
		{ label: "day streak", value: p.stats.currentStreak, note: `best ${p.stats.bestStreak}` },
		{ label: "words spelled right", value: p.stats.wordsSpelled },
		{ label: "words mastered", value: p.mastered, note: "4+ pips" },
		{ label: "stars", value: p.stats.totalStars },
	];
	return (
		<div className="space-y-12">
			<header className="flex items-center gap-4">
				<KidTile name={p.child.name} avatar={p.child.avatar} size={64} />
				<h1 className="text-4xl font-semibold">{p.child.name}’s progress</h1>
			</header>

			<dl className="flex flex-wrap gap-x-12 gap-y-6">
				{facts.map((f) => (
					<div key={f.label}>
						<dt className="text-sm text-felt-muted">{f.label}</dt>
						<dd className="font-display text-4xl font-semibold tabular-nums">
							{f.value}
							{f.note && <span className="ml-2 font-body text-sm font-normal text-felt-muted">{f.note}</span>}
						</dd>
					</div>
				))}
			</dl>

			<div className="grid gap-12 lg:grid-cols-2">
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Trouble words</h2>
					{p.trouble.length === 0 ? (
						<p className="text-felt-muted">No misses yet. Words that get missed show up here with how often.</p>
					) : (
						<ul className="space-y-3">
							{p.trouble.map((t) => (
								<li key={t.word} className="flex flex-wrap items-center gap-4">
									<WordTiles word={t.word} size={26} />
									<span className="text-sm text-felt-muted tabular-nums">missed {t.misses}×</span>
									<Pips box={t.box} />
								</li>
							))}
						</ul>
					)}
					{p.reviewDue.length > 0 && (
						<p className="text-sm text-felt-muted">
							{p.reviewDue.length} {p.reviewDue.length === 1 ? "word is" : "words are"} due for review today.
						</p>
					)}
				</section>

				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Recent rounds</h2>
					{p.recent.length === 0 ? (
						<p className="text-felt-muted">No rounds yet.</p>
					) : (
						<table className="w-full text-left text-sm">
							<thead className="text-felt-muted">
								<tr>
									<th className="py-2 font-normal">When</th>
									<th className="py-2 font-normal">Mode</th>
									<th className="py-2 text-right font-normal">Score</th>
									<th className="py-2 text-right font-normal">Stars</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-felt-line/60">
								{p.recent.map((r) => (
									<tr key={r.id}>
										<td className="py-2.5">
											{new Date(r.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
										</td>
										<td className="py-2.5">{MODE_LABEL[r.mode]}</td>
										<td className="py-2.5 text-right tabular-nums">
											{r.correct}/{r.total}
										</td>
										<td className="py-2.5 text-right">
											<span className="inline-flex gap-0.5" role="img" aria-label={`${r.stars} of 3 stars`}>
												{[1, 2, 3].map((i) => (
													<Star key={i} aria-hidden className={i <= r.stars ? "size-4 fill-maple text-maple" : "size-4 text-felt-line"} />
												))}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			</div>

			<section className="space-y-4">
				<h2 className="text-2xl font-semibold">Badges</h2>
				<ul className="flex flex-wrap gap-3">
					{p.badges.map((b) => (
						<li
							key={b.id}
							className={
								b.earned
									? "plaque px-4 py-2 text-sm"
									: "flex items-center gap-2 rounded-[0.7rem] px-4 py-2 text-sm text-felt-muted ring-1 ring-felt-muted/50 ring-inset"
							}
						>
							<BadgeIcon icon={b.icon} className="size-4" />
							{b.label}
							<span className="sr-only">{b.earned ? "(earned)" : "(not yet)"}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
