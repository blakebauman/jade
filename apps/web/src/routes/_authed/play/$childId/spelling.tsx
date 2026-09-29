import type { SPELLING_MODES } from "@jade/core";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Blocks, BookOpen, Ear, Flame, Play, RotateCcw, Star } from "lucide-react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { useChild } from "#/lib/child.ts";
import { listsQuery, progressQuery } from "#/lib/queries.ts";
import { resumableRound } from "#/lib/round.ts";

type SpellingMode = (typeof SPELLING_MODES)[number];

import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/spelling")({
	loader: ({ context, params }) =>
		Promise.all([context.queryClient.ensureQueryData(listsQuery), context.queryClient.prefetchQuery(progressQuery(params.childId))]),
	component: SpellingHome,
});

const MODES = [
	{ mode: "bee", label: "Bee", icon: Ear, hint: "Hear it, spell it" },
	{ mode: "tiles", label: "Tiles", icon: Blocks, hint: "Build it from tiles" },
	{ mode: "learn", label: "Learn", icon: BookOpen, hint: "Study, then spell" },
] as const;

function SpellingHome() {
	const child = useChild();
	const { data: lists } = useSuspenseQuery(listsQuery);
	const { data: progress } = useQuery(progressQuery(child.id));
	const due = progress?.reviewDue.length ?? 0;
	const earned = progress?.badges.filter((b) => b.earned) ?? [];
	const unfinished = resumableRound(child.id);

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
			<header className="flex items-center justify-between gap-4">
				<Link
					to="/play/$childId"
					params={{ childId: child.id }}
					className="flex items-center gap-3 rounded-xl"
					aria-label="Back to subjects"
				>
					<KidTile name={child.name} avatar={child.avatar} size={48} />
					<span className="font-display text-2xl font-medium">{child.name}</span>
				</Link>
				{progress && (
					<dl className="plaque gap-4 px-4 py-2">
						<div className="flex items-center gap-1.5" title="Day streak">
							<dt>
								<Flame className="size-5 text-ink-soft" aria-hidden />
								<span className="sr-only">Day streak</span>
							</dt>
							<dd className="font-display text-xl font-semibold tabular-nums">{progress.stats.currentStreak}</dd>
						</div>
						<div className="flex items-center gap-1.5" title="Stars">
							<dt>
								<Star className="size-5 fill-ink-soft text-ink-soft" aria-hidden />
								<span className="sr-only">Stars</span>
							</dt>
							<dd className="font-display text-xl font-semibold tabular-nums">{progress.stats.totalStars}</dd>
						</div>
					</dl>
				)}
			</header>

			{unfinished && (
				<section className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-felt-raised/70 p-6">
					<div>
						<h2 className="text-2xl font-semibold">Pick up where you left off</h2>
						<p className="text-felt-muted">
							{unfinished.name}: {unfinished.done} of {unfinished.total} words done
						</p>
					</div>
					<Link
						to="/play/$childId/round/$listId/$mode"
						params={{ childId: child.id, listId: unfinished.listId ?? "review", mode: unfinished.mode as SpellingMode }}
						search={{ resume: true }}
						onClick={() => speaker.unlock()}
						className="key"
						data-variant="go"
					>
						<Play className="size-5" aria-hidden /> Continue
					</Link>
				</section>
			)}

			{due > 0 && (
				<section className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-felt-raised/70 p-6">
					<div className="flex items-center gap-5">
						<div className="flex -space-x-2" aria-hidden>
							{progress!.reviewDue.slice(0, 3).map((w, i) => (
								<Tile key={w} letter={w[0]} size={52} style={{ transform: `rotate(${(i - 1) * 7}deg)` }} />
							))}
						</div>
						<div>
							<h2 className="text-2xl font-semibold">
								{due} {due === 1 ? "word wants" : "words want"} another go
							</h2>
							<p className="text-felt-muted">Words you missed come back until they stick.</p>
						</div>
					</div>
					<Link
						to="/play/$childId/round/$listId/$mode"
						params={{ childId: child.id, listId: "review", mode: "review" }}
						onClick={() => speaker.unlock()}
						className="key"
						data-variant="go"
					>
						<RotateCcw className="size-5" aria-hidden /> Review
					</Link>
				</section>
			)}

			<section className="mt-12 space-y-5">
				<h1 className="text-3xl font-semibold">Spelling: pick a list</h1>
				{lists.length === 0 ? (
					<p className="text-felt-muted">No lists yet. Ask a grown-up to add this week’s words in the parent area.</p>
				) : (
					<ul className="space-y-3">
						{lists.map((l) => (
							<li key={l.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-felt-line/50 py-4">
								<div>
									<h2 className="font-display text-xl font-medium">{l.name}</h2>
									<p className="text-sm text-felt-muted">{l.wordCount} words</p>
								</div>
								<div className="flex flex-wrap gap-2">
									{MODES.map((m) => (
										<Link
											key={m.mode}
											to="/play/$childId/round/$listId/$mode"
											params={{ childId: child.id, listId: l.id, mode: m.mode }}
											onClick={() => speaker.unlock()}
											className="key min-w-[6.5rem]"
											data-variant={m.mode === "bee" ? "go" : undefined}
											title={m.hint}
										>
											<m.icon className="size-5" aria-hidden /> {m.label}
										</Link>
									))}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			{earned.length > 0 && (
				<section className="mt-14 space-y-3">
					<h2 className="text-lg font-semibold text-felt-muted">Your badges</h2>
					<ul className="flex flex-wrap gap-2">
						{earned.map((b) => (
							<li key={b.id} className="plaque px-3.5 py-1.5 text-sm">
								<BadgeIcon icon={b.icon} className="size-4" /> {b.label}
							</li>
						))}
					</ul>
				</section>
			)}
		</main>
	);
}
