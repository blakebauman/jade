import type { SPELLING_MODES } from "@jade/core";
import { TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Play, Star } from "lucide-react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { useChild } from "#/lib/child.ts";
import { resumableMath } from "#/lib/mathRound.ts";
import { progressQuery } from "#/lib/queries.ts";
import { resumableRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/")({
	loader: ({ context, params }) => context.queryClient.prefetchQuery(progressQuery(params.childId)),
	component: SubjectHub,
});

type SpellingMode = (typeof SPELLING_MODES)[number];

/** A subject as a big maple plaque: a word built from tiles, and what's waiting in it. */
function SubjectTile({
	to,
	word,
	label,
	note,
}: {
	to: "/play/$childId/spelling" | "/play/$childId/math" | "/play/$childId/games";
	word: string;
	label: string;
	note: string;
}) {
	const child = useChild();
	return (
		<Link
			to={to}
			params={{ childId: child.id }}
			onClick={() => speaker.unlock()}
			className="rack flex min-h-44 flex-col justify-between gap-6 !p-6 transition-[filter,transform] hover:brightness-105 active:translate-y-px md:!p-8"
		>
			<span className="flex flex-wrap gap-1.5" aria-hidden>
				{[...word].map((c, i) => (
					<Tile key={`${c}-${i}`} letter={c} size={40} grain={i % 4} />
				))}
			</span>
			<span className="flex items-end justify-between gap-4">
				<span className="font-display text-3xl font-semibold text-ink">{label}</span>
				<span className="text-right text-sm font-medium text-ink">{note}</span>
			</span>
		</Link>
	);
}

function SubjectHub() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const spellingLeft = resumableRound(child.id);
	const mathLeft = resumableMath(child.id);
	const spellingDue = progress?.reviewDue.length ?? 0;
	const factsDue = progress?.math.factsDue.length ?? 0;
	const earned = progress?.badges.filter((b) => b.earned) ?? [];
	// One primary key per view: the round touched most recently gets it.
	const latest = !mathLeft || (spellingLeft && spellingLeft.startedAt >= mathLeft.startedAt) ? "spelling" : "math";

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
			<header className="flex items-center justify-between gap-4">
				<Link to="/profiles" className="flex items-center gap-3 rounded-xl" aria-label="Change who’s practicing">
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
							<dd className="font-display text-xl font-semibold tabular-nums">
								{progress.stats.totalStars - (progress.stats.starsSpent ?? 0)}
							</dd>
						</div>
					</dl>
				)}
			</header>

			<h1 className="sr-only">{child.name}’s practice</h1>

			{(spellingLeft || mathLeft) && (
				<section className="patch mt-10 p-6" aria-labelledby="resume-heading">
					<h2 id="resume-heading" className="text-2xl font-semibold">
						Pick up where you left off
					</h2>
					<ul className="mt-2 divide-y divide-felt-line/50">
						{spellingLeft && (
							<li className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 py-3">
								<p className="text-felt-muted">
									<span className="font-display text-lg font-medium text-felt-ink">Spelling</span> · {spellingLeft.name}:{" "}
									{spellingLeft.done} of {spellingLeft.total} words done
								</p>
								<Link
									to="/play/$childId/round/$listId/$mode"
									params={{ childId: child.id, listId: spellingLeft.listId ?? "review", mode: spellingLeft.mode as SpellingMode }}
									search={{ resume: true }}
									onClick={() => speaker.unlock()}
									className="key"
									data-variant={latest === "spelling" ? "go" : undefined}
									aria-label="Continue spelling"
								>
									<Play className="size-5" aria-hidden /> Continue
								</Link>
							</li>
						)}
						{mathLeft && (
							<li className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 py-3">
								<p className="text-felt-muted">
									<span className="font-display text-lg font-medium text-felt-ink">Math</span> ·{" "}
									{mathLeft.mode === "mathreview" ? "Facts review" : TOPIC_LABEL[mathLeft.mode]}: {mathLeft.done} of {mathLeft.total} done
								</p>
								<Link
									to="/play/$childId/math/$topic"
									params={{ childId: child.id, topic: mathLeft.mode }}
									search={{ resume: true }}
									onClick={() => speaker.unlock()}
									className="key"
									data-variant={latest === "math" ? "go" : undefined}
									aria-label="Continue math"
								>
									<Play className="size-5" aria-hidden /> Continue
								</Link>
							</li>
						)}
					</ul>
				</section>
			)}

			<section className="mt-12 space-y-5">
				<h2 className="text-3xl font-semibold">What shall we practice?</h2>
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<SubjectTile
						to="/play/$childId/spelling"
						word="spell"
						label="Spelling"
						note={spellingDue > 0 ? `${spellingDue} ${spellingDue === 1 ? "word" : "words"} to review` : "Hear it, spell it"}
					/>
					<SubjectTile
						to="/play/$childId/math"
						word="math"
						label="Math"
						note={factsDue > 0 ? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review` : "Facts, fractions, puzzles"}
					/>
					<SubjectTile to="/play/$childId/games" word="play" label="Games" note="Style your Roxy" />
				</div>
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
