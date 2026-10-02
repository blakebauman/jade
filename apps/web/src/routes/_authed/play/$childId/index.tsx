import type { SPELLING_MODES } from "@jade/core";
import { TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Play, Star } from "lucide-react";
import { BadgeIcon, badgeFace } from "#/components/BadgeIcon.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import type { Progress } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { resumableMath } from "#/lib/mathRound.ts";
import { progressQuery } from "#/lib/queries.ts";
import { resumableRound } from "#/lib/round.ts";
import { roxyQuery, shownLook } from "#/lib/roxy.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.prefetchQuery(progressQuery(params.childId)),
			context.queryClient.prefetchQuery(roxyQuery(params.childId)),
		]),
	component: SubjectHub,
});

type SpellingMode = (typeof SPELLING_MODES)[number];

/** Small, fixed tilts, so stickers look pressed on by hand but never shift between visits. */
const TILT = [-5, 4, -3, 6, -4, 3, -6, 4];

/** A place in the album as a big die-cut sticker: its word in tiles on the place's own hue, and what's waiting there. */
function PlaceSticker({
	to,
	place,
	word,
	label,
	note,
	tilt,
	children,
}: {
	to: "/play/$childId/spelling" | "/play/$childId/math" | "/play/$childId/games";
	place: "spell" | "math" | "roxy";
	word?: string;
	label: string;
	note: string;
	tilt: number;
	children?: React.ReactNode;
}) {
	const child = useChild();
	return (
		<Link
			to={to}
			params={{ childId: child.id }}
			onClick={() => speaker.unlock()}
			className={`sticker flex items-stretch gap-5 ${word ? "min-h-48 p-6 md:p-7" : "min-h-32 p-4 md:p-5"}`}
			data-place={place}
			style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
		>
			{children}
			<span className={`flex min-w-0 flex-1 flex-col gap-5 ${word ? "justify-between" : "justify-center"}`}>
				{word && (
					<span className="flex gap-1.5" aria-hidden>
						{[...word].map((c, i) => (
							<Tile key={`${c}-${i}`} letter={c} size={44} grain={i % 4} />
						))}
					</span>
				)}
				<span className="flex flex-col gap-1">
					<span className={`font-display font-semibold ${word ? "text-4xl" : "text-2xl"}`}>{label}</span>
					<span className={word ? "font-medium" : "text-sm font-medium"}>{note}</span>
				</span>
			</span>
		</Link>
	);
}

/** The sticker sheet: every badge has its place, earned ones stuck down, the rest still a printed outline. */
function StickerSheet({ badges }: { badges: Progress["badges"] }) {
	const earned = badges.filter((b) => b.earned).length;
	return (
		<section className="space-y-4" aria-labelledby="stickers-heading">
			<div className="flex items-baseline justify-between gap-4">
				<h2 id="stickers-heading" className="text-2xl font-semibold">
					Your badges
				</h2>
				<p className="text-sm text-page-muted tabular-nums">
					{earned} of {badges.length}
				</p>
			</div>
			<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
				{badges.map((b, i) => (
					<li key={b.id} className="flex flex-col items-center gap-2 text-center">
						{b.earned ? (
							<span
								className={`sticker grid size-16 animate-sticker-place place-items-center !rounded-2xl md:size-[4.5rem] ${badgeFace(b.icon) === "foil" ? "foil" : ""}`}
								data-place={badgeFace(b.icon) === "foil" ? undefined : badgeFace(b.icon)}
								style={{ "--tilt": `${TILT[i % TILT.length]}deg`, animationDelay: `${i * 60}ms` } as React.CSSProperties}
							>
								<BadgeIcon icon={b.icon} className="size-8" />
							</span>
						) : (
							<span className="slot size-16 !rounded-2xl md:size-[4.5rem]">
								<BadgeIcon icon={b.icon} className="size-6 opacity-70" />
							</span>
						)}
						<span className={b.earned ? "text-xs font-medium leading-tight" : "text-xs leading-tight text-page-muted"}>
							{b.label}
							{!b.earned && <span className="sr-only"> (not yet)</span>}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}

function SubjectHub() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const spellingLeft = resumableRound(child.id);
	const mathLeft = resumableMath(child.id);
	const spellingDue = progress?.reviewDue.length ?? 0;
	const factsDue = progress?.math.factsDue.length ?? 0;
	// One primary key per view: the round touched most recently gets it.
	const latest = !mathLeft || (spellingLeft && spellingLeft.startedAt >= mathLeft.startedAt) ? "spelling" : "math";

	return (
		<main className="mx-auto min-h-dvh max-w-6xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<Link to="/profiles" className="flex items-center gap-3 rounded-xl" aria-label="Change who’s practicing">
					<KidTile name={child.name} avatar={child.avatar} size={48} />
					<span className="font-display text-2xl font-medium">{child.name}</span>
				</Link>
				{progress && (
					<dl className="flex items-center gap-2.5">
						<div className="foil px-3.5 py-1.5" title="Day streak">
							<dt>
								<Flame className="size-5" aria-hidden />
								<span className="sr-only">Day streak</span>
							</dt>
							<dd className="font-display text-xl font-semibold tabular-nums">{progress.stats.currentStreak}</dd>
						</div>
						<div className="foil px-3.5 py-1.5" title="Stars">
							<dt>
								<Star className="size-5 fill-current" aria-hidden />
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

			<div className="mt-10 grid gap-y-6 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] md:gap-x-8">
				<section className="space-y-8" aria-labelledby="practice-heading">
					<h2 id="practice-heading" className="text-3xl font-semibold">
						What shall we practice?
					</h2>
					{(spellingLeft || mathLeft) && (
						<section className="patch p-5" aria-labelledby="resume-heading">
							<h3 id="resume-heading" className="text-xl font-semibold">
								Pick up where you left off
							</h3>
							<ul className="mt-1 divide-y divide-page-line/50">
								{spellingLeft && (
									<li className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 py-3">
										<p className="text-page-muted">
											<span className="font-display text-lg font-medium text-page-ink">Spelling</span> · {spellingLeft.name}:{" "}
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
										<p className="text-page-muted">
											<span className="font-display text-lg font-medium text-page-ink">Math</span> ·{" "}
											{mathLeft.mode === "mathreview" ? "Facts review" : TOPIC_LABEL[mathLeft.mode]}: {mathLeft.done} of {mathLeft.total}{" "}
											done
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
					<div className="grid gap-8">
						<PlaceSticker
							to="/play/$childId/spelling"
							place="spell"
							word="spell"
							label="Spelling"
							tilt={-1.5}
							note={spellingDue > 0 ? `${spellingDue} ${spellingDue === 1 ? "word" : "words"} to review` : "Hear it, spell it"}
						/>
						<PlaceSticker
							to="/play/$childId/math"
							place="math"
							word="math"
							label="Math"
							tilt={1.5}
							note={factsDue > 0 ? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review` : "Facts, fractions, puzzles"}
						/>
					</div>
				</section>

				<div className="spine h-6 md:h-auto" aria-hidden />

				<section className="space-y-10" aria-labelledby="play-heading">
					<h2 id="play-heading" className="sr-only">
						Play
					</h2>
					<PlaceSticker to="/play/$childId/games" place="roxy" label="Games" note="Style your Roxy" tilt={2}>
						<span className="block w-20 shrink-0 overflow-hidden rounded-xl md:w-24" aria-hidden>
							{roxy ? (
								<RoxyFigure look={shownLook(child.id, roxy)} className="block h-auto w-full" />
							) : (
								<span className="block aspect-[5/8] bg-page-deep/40" />
							)}
						</span>
					</PlaceSticker>
					{progress && progress.badges.length > 0 && <StickerSheet badges={progress.badges} />}
				</section>
			</div>
		</main>
	);
}
