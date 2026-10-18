import { BADGES, type SPELLING_MODES } from "@jade/core";
import { TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, Flame, Play, RotateCcw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { BadgeIcon, badgeFace } from "#/components/BadgeIcon.tsx";
import { PlayClosed, PlayWallet, usePlacedToday } from "#/components/play/PlayBits.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { listIsFor, newestFirst, type Progress } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { resumableMath } from "#/lib/mathRound.ts";
import { playQuery } from "#/lib/play.ts";
import { listsQuery, progressQuery } from "#/lib/queries.ts";
import { resumableRound } from "#/lib/round.ts";
import { roxyQuery, shownLook } from "#/lib/roxy.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.prefetchQuery(progressQuery(params.childId)),
			context.queryClient.prefetchQuery(listsQuery),
			context.queryClient.prefetchQuery(roxyQuery(params.childId)),
			context.queryClient.prefetchQuery({ ...playQuery(params.childId), staleTime: 0 }),
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
	placed,
	aside,
	children,
}: {
	to: "/play/$childId/spelling" | "/play/$childId/math" | "/play/$childId/games";
	place: "spell" | "math" | "roxy";
	word?: string;
	label: string;
	note: string;
	tilt: number;
	/** Stuck down just now (Play opening after practice), so it's placed with the sticker's own motion. */
	placed?: boolean;
	/** What the place holds for this kid, in the sticker's right half; shown only where the sticker is wide enough. */
	aside?: React.ReactNode;
	children?: React.ReactNode;
}) {
	const child = useChild();
	return (
		<Link
			to={to}
			params={{ childId: child.id }}
			onClick={() => speaker.unlock()}
			className={`sticker @container flex min-h-48 items-stretch gap-5 ${word ? "p-6 md:p-7" : "p-5 md:p-6"} ${placed ? "animate-sticker-place" : ""}`}
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
					<span className="font-display text-4xl font-semibold">{label}</span>
					<span className="font-medium">{note}</span>
				</span>
			</span>
			{aside && <span className="hidden shrink-0 flex-col items-end justify-end gap-0.5 text-right @sm:flex">{aside}</span>}
		</Link>
	);
}

/** A count for a place sticker's right half: a big number over what it counts. */
function Tally({ count, of }: { count: number; of: string }) {
	return (
		<>
			<span className="font-display text-4xl font-semibold tabular-nums">{count}</span>
			<span className="text-sm font-medium">{of}</span>
		</>
	);
}

/**
 * How many empty slots to show before "See all", in the order badges usually come. Early on just the next one, so
 * the sheet leads with what's earned; after that enough to finish the last row of three.
 */
function nextSlots(earned: number) {
	if (earned < 3) return 1;
	return (3 - (earned % 3)) % 3 || 3;
}

/**
 * Badges earned since this device last showed the sheet. Only those are placed with the sticker's motion; the rest
 * were placed on an earlier visit and just sit there.
 */
function useFreshBadges(childId: string, earned: string[]) {
	const key = `jade.badges.seen.${childId}`;
	const [fresh] = useState(() => {
		try {
			const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
			return new Set(earned.filter((id) => !seen.has(id)));
		} catch {
			return new Set<string>();
		}
	});
	const ids = earned.join(",");
	useEffect(() => {
		try {
			localStorage.setItem(key, JSON.stringify(ids ? ids.split(",") : []));
		} catch {
			// Storage blocked: badges just won't be placed again.
		}
	}, [key, ids]);
	return fresh;
}

/**
 * The sticker sheet: earned badges stuck down, then the next few as printed outlines saying how to earn them. The
 * rest fold under "See all", so a new kid's page isn't a wall of empty slots.
 */
function StickerSheet({ childId, badges }: { childId: string; badges: Progress["badges"] }) {
	const earned = badges.filter((b) => b.earned);
	const waiting = badges.filter((b) => !b.earned);
	const fresh = useFreshBadges(
		childId,
		earned.map((b) => b.id),
	);
	const [all, setAll] = useState(false);
	const next = nextSlots(earned.length);
	const shown = all ? badges : [...earned, ...waiting.slice(0, next)];
	let placing = 0;
	return (
		<section className="space-y-4" aria-labelledby="stickers-heading">
			<div className="flex items-baseline justify-between gap-4">
				<h2 id="stickers-heading" className="text-2xl font-semibold">
					Your badges
				</h2>
				<p className="text-sm text-page-muted tabular-nums">
					{earned.length} of {badges.length}
				</p>
			</div>
			<ul id="stickers-list" className="grid grid-cols-3 gap-x-3 gap-y-5">
				{shown.map((b) => {
					const tilt = TILT[badges.indexOf(b) % TILT.length];
					const hint = BADGES.find((d) => d.id === b.id)?.hint;
					const placed = fresh.has(b.id);
					return (
						<li key={b.id} className="flex flex-col items-center gap-2 text-center">
							{b.earned ? (
								<span
									className={`sticker grid size-16 place-items-center !rounded-2xl md:size-[4.5rem] ${placed ? "animate-sticker-place" : ""} ${badgeFace(b.icon) === "foil" ? "foil" : ""}`}
									data-place={badgeFace(b.icon) === "foil" ? undefined : badgeFace(b.icon)}
									style={{ "--tilt": `${tilt}deg`, animationDelay: placed ? `${placing++ * 60}ms` : undefined } as React.CSSProperties}
								>
									<BadgeIcon icon={b.icon} className="size-8" />
								</span>
							) : (
								<span className="slot size-16 !rounded-2xl md:size-[4.5rem]">
									<BadgeIcon icon={b.icon} className="size-6" />
								</span>
							)}
							<span className="flex flex-col gap-0.5 text-sm leading-tight">
								<span className="font-medium">
									{b.label}
									{!b.earned && <span className="sr-only"> (not yet)</span>}
								</span>
								{!b.earned && hint && <span className="text-balance text-page-muted">{hint}</span>}
							</span>
						</li>
					);
				})}
			</ul>
			{waiting.length > next && (
				<button type="button" className="key" aria-expanded={all} aria-controls="stickers-list" onClick={() => setAll(!all)}>
					<ChevronDown className={`size-5 transition-transform ${all ? "rotate-180" : ""}`} aria-hidden />
					{all ? "Show fewer" : `See all ${badges.length}`}
				</button>
			)}
		</section>
	);
}

function SubjectHub() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const { data: play } = useQuery(playQuery(child.id));
	const { data: lists } = useQuery(listsQuery);
	const thisWeek = lists && newestFirst(lists.filter((l) => listIsFor(l, child.id)))[0];
	const placed = usePlacedToday(child.id, play);
	const spellingLeft = resumableRound(child.id);
	const mathLeft = resumableMath(child.id);
	const spellingDue = progress?.reviewDue.length ?? 0;
	const factsDue = progress?.math.factsDue.length ?? 0;
	// One primary key per view: the round touched most recently gets it.
	const latest = !mathLeft || (spellingLeft && spellingLeft.startedAt >= mathLeft.startedAt) ? "spelling" : "math";
	// Nothing to carry on but something due: that's today's practice, so it gets the one go key. Spelling leads.
	const today = spellingLeft || mathLeft ? null : spellingDue > 0 ? ("spelling" as const) : factsDue > 0 ? ("math" as const) : null;
	// Nothing practiced yet: a row of zeros reads as a scoreboard, so the header welcomes instead.
	const fresh = progress && progress.stats.totalStars === 0 && progress.stats.currentStreak === 0;

	return (
		<main className="mx-auto min-h-dvh max-w-6xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				{/* Named by what it shows ("Jade, switch who's practicing"), so a voice user can say what they see. */}
				<Link to="/profiles" className="flex items-center gap-3 rounded-xl">
					<span aria-hidden>
						<KidTile name={child.name} avatar={child.avatar} size={48} />
					</span>
					<span className="font-display text-2xl font-medium">{child.name}</span>
					<span className="sr-only">,</span>
					<span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-page-muted">
						<ArrowLeftRight className="size-4" aria-hidden />
						Switch<span className="sr-only"> who’s practicing</span>
					</span>
				</Link>
				{progress &&
					(fresh ? (
						<p className="text-page-muted">Your first round starts your stars and your streak.</p>
					) : (
						// Each count says what it is on the chip: an iPad never shows a tooltip.
						<dl className="flex items-center gap-2.5">
							<div className="foil px-3.5 py-1.5">
								<dt>
									<Flame className="size-5" aria-hidden />
									<span className="sr-only">Day streak</span>
								</dt>
								<dd className="flex items-baseline gap-1.5">
									<span className="font-display text-xl font-semibold tabular-nums">{progress.stats.currentStreak}</span>
									<span className="text-sm font-medium">{progress.stats.currentStreak === 1 ? "day" : "days"}</span>
								</dd>
							</div>
							{/* Every star ever earned: a record of practice, which games never take from. */}
							<div className="foil px-3.5 py-1.5">
								<dt>
									<Star className="size-5 fill-current" aria-hidden />
									<span className="sr-only">Stars earned</span>
								</dt>
								<dd className="flex items-baseline gap-1.5">
									<span className="font-display text-xl font-semibold tabular-nums">{progress.stats.totalStars}</span>
									<span className="text-sm font-medium">{progress.stats.totalStars === 1 ? "star" : "stars"}</span>
								</dd>
							</div>
						</dl>
					))}
			</header>

			<h1 className="sr-only">{child.name}’s practice</h1>

			{/* From md each page is a subgrid of two rows (heading, then the rest), so both pages' stickers start level. */}
			<div className="mt-10 grid gap-y-6 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-8">
				<section className="max-md:space-y-8 md:row-span-2 md:grid md:grid-rows-subgrid" aria-labelledby="practice-heading">
					<h2 id="practice-heading" className="text-balance text-3xl font-semibold">
						What shall we practice, {child.name}?
					</h2>
					<div className="space-y-8">
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
						{today && (
							<section className="patch flex flex-wrap items-center justify-between gap-x-5 gap-y-4 p-5" aria-labelledby="today-heading">
								<div className="flex items-center gap-4">
									{today === "spelling" && (
										<div className="flex -space-x-2" aria-hidden>
											{progress?.reviewDue.slice(0, 3).map((w, i) => (
												<Tile key={w} letter={w[0]} size={40} grain={i % 4} style={{ transform: `rotate(${(i - 1) * 7}deg)` }} />
											))}
										</div>
									)}
									<div>
										<h3 id="today-heading" className="text-xl font-semibold">
											{today === "spelling"
												? `${spellingDue} ${spellingDue === 1 ? "word wants" : "words want"} another go`
												: `${factsDue} ${factsDue === 1 ? "fact wants" : "facts want"} another go`}
										</h3>
										<p className="text-page-muted">Start here today.</p>
									</div>
								</div>
								{today === "spelling" ? (
									<Link
										to="/play/$childId/round/$listId/$mode"
										params={{ childId: child.id, listId: "review", mode: "review" }}
										onClick={() => speaker.unlock()}
										className="key"
										data-variant="go"
										aria-label={`Review ${spellingDue} ${spellingDue === 1 ? "word" : "words"}`}
									>
										<RotateCcw className="size-5" aria-hidden /> Review
									</Link>
								) : (
									<Link
										to="/play/$childId/math/$topic"
										params={{ childId: child.id, topic: "mathreview" }}
										onClick={() => speaker.unlock()}
										className="key"
										data-variant="go"
										aria-label={`Review ${factsDue} ${factsDue === 1 ? "fact" : "facts"}`}
									>
										<RotateCcw className="size-5" aria-hidden /> Review
									</Link>
								)}
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
								aside={
									progress && progress.mastered > 0 ? (
										<Tally count={progress.mastered} of={progress.mastered === 1 ? "word mastered" : "words mastered"} />
									) : (
										thisWeek && (
											<>
												<span className="max-w-[9rem] truncate font-display text-xl font-semibold">{thisWeek.name}</span>
												<span className="text-sm font-medium">{thisWeek.wordCount} words this week</span>
											</>
										)
									)
								}
							/>
							<PlaceSticker
								to="/play/$childId/math"
								place="math"
								word="math"
								label="Math"
								tilt={1.5}
								note={factsDue > 0 ? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review` : "Facts, fractions, puzzles"}
								aside={progress && progress.math.factsMastered > 0 && <Tally count={progress.math.factsMastered} of="facts mastered" />}
							/>
						</div>
					</div>
				</section>

				<div className="spine h-6 md:row-span-2 md:h-auto" aria-hidden />

				{/* Below md the pages stack in this order, so Play comes straight after Spelling and Math, ahead of the badges. */}
				<div className="max-md:space-y-6 md:row-span-2 md:grid md:grid-rows-subgrid">
					<div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 self-start">
						<h2 id="play-heading" className="text-3xl font-semibold">
							What shall we play?
						</h2>
						{/* Stars to spend stay inside Play: here the only star count is the header's, every star ever earned. */}
						{play?.open && <PlayWallet status={play} stars={false} />}
					</div>
					<div className="space-y-12">
						<section aria-labelledby="play-heading">
							{play && !play.open ? (
								<PlayClosed childId={child.id} status={play} />
							) : (
								<PlaceSticker
									to="/play/$childId/games"
									place="roxy"
									label="Play"
									note="Roxy, the town, Gobble Town and Jelly Blocks"
									tilt={2}
									placed={placed}
								>
									<span className="block w-24 shrink-0 self-center overflow-hidden rounded-xl md:w-28" aria-hidden>
										{roxy ? (
											<RoxyFigure look={shownLook(child.id, roxy)} className="block h-auto w-full" />
										) : (
											<span className="block aspect-[5/8] bg-page-deep/40" />
										)}
									</span>
								</PlaceSticker>
							)}
						</section>
						{progress && progress.badges.length > 0 && <StickerSheet childId={child.id} badges={progress.badges} />}
					</div>
				</div>
			</div>
		</main>
	);
}
