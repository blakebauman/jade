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
function SubjectTile({ to, word, note }: { to: "/play/$childId/spelling" | "/play/$childId/math"; word: string; note: string }) {
	const child = useChild();
	return (
		<Link
			to={to}
			params={{ childId: child.id }}
			onClick={() => speaker.unlock()}
			className="rack group flex min-h-44 flex-col justify-between gap-6 !p-6 transition-transform hover:-translate-y-1 md:!p-8"
		>
			<span className="flex flex-wrap gap-1.5" aria-hidden>
				{[...word].map((c, i) => (
					<Tile key={`${c}-${i}`} letter={c} size={48} grain={i % 4} />
				))}
			</span>
			<span className="flex items-end justify-between gap-4">
				<span className="font-display text-3xl font-semibold text-ink">{word === "spell" ? "Spelling" : "Math"}</span>
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

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
			<header className="flex items-center justify-between gap-4">
				<Link to="/profiles" className="flex items-center gap-3 rounded-xl" aria-label="Switch speller">
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

			{(spellingLeft || mathLeft) && (
				<section className="mt-10 space-y-3" aria-label="Unfinished rounds">
					{spellingLeft && (
						<div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-felt-raised/70 p-6">
							<div>
								<h2 className="text-2xl font-semibold">Pick up where you left off</h2>
								<p className="text-felt-muted">
									Spelling · {spellingLeft.name}: {spellingLeft.done} of {spellingLeft.total} words done
								</p>
							</div>
							<Link
								to="/play/$childId/round/$listId/$mode"
								params={{ childId: child.id, listId: spellingLeft.listId ?? "review", mode: spellingLeft.mode as SpellingMode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key"
								data-variant="go"
							>
								<Play className="size-5" aria-hidden /> Continue
							</Link>
						</div>
					)}
					{mathLeft && (
						<div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-felt-raised/70 p-6">
							<div>
								<h2 className="text-2xl font-semibold">Pick up where you left off</h2>
								<p className="text-felt-muted">
									Math · {mathLeft.mode === "mathreview" ? "Facts review" : TOPIC_LABEL[mathLeft.mode]}: {mathLeft.done} of {mathLeft.total}{" "}
									done
								</p>
							</div>
							<Link
								to="/play/$childId/math/$topic"
								params={{ childId: child.id, topic: mathLeft.mode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key"
								data-variant="go"
							>
								<Play className="size-5" aria-hidden /> Continue
							</Link>
						</div>
					)}
				</section>
			)}

			<section className="mt-12 space-y-5">
				<h1 className="text-3xl font-semibold">What shall we practice?</h1>
				<div className="grid gap-6 md:grid-cols-2">
					<SubjectTile
						to="/play/$childId/spelling"
						word="spell"
						note={spellingDue > 0 ? `${spellingDue} ${spellingDue === 1 ? "word" : "words"} to review` : "Hear it, spell it"}
					/>
					<SubjectTile
						to="/play/$childId/math"
						word="math"
						note={factsDue > 0 ? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review` : "Facts, fractions, puzzles"}
					/>
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
