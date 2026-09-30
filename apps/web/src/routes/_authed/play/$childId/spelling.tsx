import type { SPELLING_MODES } from "@jade/core";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Blocks, BookOpen, Ear, Flame, Play, RotateCcw, Star } from "lucide-react";
import { type MouseEvent, useEffect, useId, useState } from "react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { Confirm } from "#/components/Confirm.tsx";
import { WordRack } from "#/components/WordRack.tsx";
import { type ListSummary, listIsFor, newestFirst, type Progress } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { listQuery, listsQuery, progressQuery } from "#/lib/queries.ts";
import { resumableRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

type SpellingMode = (typeof SPELLING_MODES)[number];
type PlayMode = Exclude<SpellingMode, "review">;

export const Route = createFileRoute("/_authed/play/$childId/spelling")({
	loader: async ({ context, params }) => {
		const [lists] = await Promise.all([
			context.queryClient.ensureQueryData(listsQuery),
			context.queryClient.prefetchQuery(progressQuery(params.childId)),
		]);
		// Fetch each list's words now (cached by the service worker too), so any list can start later with no connection.
		for (const l of lists) void context.queryClient.prefetchQuery(listQuery(l.id));
	},
	component: SpellingHome,
});

/** The three ways to practice a list, easiest first, each with the one line a kid needs to choose it. */
const MODES: Record<PlayMode, { label: string; icon: typeof Ear; hint: string }> = {
	learn: { label: "Learn", icon: BookOpen, hint: "study each word, then spell it" },
	tiles: { label: "Tiles", icon: Blocks, hint: "build each word from letter tiles" },
	bee: { label: "Bee", icon: Ear, hint: "hear the word and type it, like a real bee" },
};
const MODE_ORDER: PlayMode[] = ["learn", "tiles", "bee"];

/**
 * Which way to practice a list next, from how well this kid knows it: Learn while its words are new, Tiles while
 * they're settling, Bee once most are sure. The other two stay one tap away.
 */
function nextMode(words: string[], boxes: Record<string, number>): PlayMode {
	const seen = words.filter((w) => (boxes[w] ?? 0) > 0).length;
	const sure = words.filter((w) => (boxes[w] ?? 0) >= 4).length;
	if (words.length === 0 || seen === 0) return "learn";
	return sure * 3 < words.length ? "tiles" : "bee";
}

/** Re-render when the tab comes back, so a round finished or left in another tab shows up here. */
function useRefreshOnFocus() {
	const [, setTick] = useState(0);
	useEffect(() => {
		const onShow = () => document.visibilityState === "visible" && setTick((t) => t + 1);
		document.addEventListener("visibilitychange", onShow);
		return () => document.removeEventListener("visibilitychange", onShow);
	}, []);
}

function SpellingHome() {
	const child = useChild();
	useRefreshOnFocus();
	const { data: allLists } = useSuspenseQuery(listsQuery);
	// Only this week's lists meant for this speller, newest first; past lists' missed words still come back through Review.
	const lists = newestFirst(allLists.filter((l) => listIsFor(l, child.id)));
	const { data: progress } = useQuery(progressQuery(child.id));
	const boxes = progress?.boxes ?? {};
	const due = progress?.reviewDue ?? [];
	const unfinished = resumableRound(child.id);
	const headingId = useId();

	// One "start here" per screen: carry on, else review what's due, else the newest list.
	const first = lists[0];
	const start = unfinished ? "resume" : due.length > 0 ? "review" : first ? "list" : "none";

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Link to="/play/$childId" params={{ childId: child.id }} className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> Subjects
					</Link>
					<KidTile name={child.name} avatar={child.avatar} size={48} />
					<span className="font-display text-2xl font-medium">{child.name}</span>
				</div>
				{progress && <ProgressPlaque progress={progress} />}
			</header>

			<h1 className="sr-only">Spelling</h1>

			{start === "resume" && unfinished && (
				<section className="patch mt-10 flex flex-wrap items-center justify-between gap-5 p-6" aria-labelledby={`${headingId}-start`}>
					<div>
						<h2 id={`${headingId}-start`} className="text-3xl font-semibold">
							Pick up where you left off
						</h2>
						<p className="text-lg text-felt-muted">
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
						aria-label={`Continue ${unfinished.name}`}
					>
						<Play className="size-5" aria-hidden /> Continue
					</Link>
				</section>
			)}

			{due.length > 0 && (
				<section
					className={`patch flex flex-wrap items-center justify-between gap-5 p-6 ${start === "review" ? "mt-10" : "mt-4"}`}
					aria-labelledby={`${headingId}-review`}
				>
					<div className="flex items-center gap-5">
						<div className="flex -space-x-2" aria-hidden>
							{due.slice(0, 3).map((w, i) => (
								<Tile key={w} letter={w[0]} size={48} style={{ transform: `rotate(${(i - 1) * 7}deg)` }} />
							))}
						</div>
						<div>
							<h2 id={`${headingId}-review`} className={start === "review" ? "text-3xl font-semibold" : "text-2xl font-semibold"}>
								{due.length} {due.length === 1 ? "word wants" : "words want"} another go
							</h2>
							<p className="text-felt-muted">Words you missed come back until they stick.</p>
						</div>
					</div>
					<Link
						to="/play/$childId/round/$listId/$mode"
						params={{ childId: child.id, listId: "review", mode: "review" }}
						onClick={() => speaker.unlock()}
						className="key"
						data-variant={start === "review" ? "go" : "felt"}
						aria-label={`Review ${due.length} ${due.length === 1 ? "word" : "words"}`}
					>
						<RotateCcw className="size-5" aria-hidden /> Review
					</Link>
				</section>
			)}

			<section className="mt-12 space-y-5" aria-labelledby={`${headingId}-lists`}>
				<h2 id={`${headingId}-lists`} className="text-2xl font-semibold">
					{lists.length > 0 ? "Your lists" : "Spelling lists"}
				</h2>
				{lists.length === 0 ? (
					<div className="patch max-w-prose space-y-4 p-6">
						<p>No lists yet. Ask a grown-up to add this week’s words in the parent area.</p>
						{due.length === 0 && (
							<Link to="/play/$childId/math" params={{ childId: child.id }} className="key" data-variant="felt">
								Try Math instead
							</Link>
						)}
					</div>
				) : (
					<>
						<ModeGuide idBase={headingId} />
						<ul className="grid gap-4 md:grid-cols-2">
							{lists.map((l) => (
								<ListCard
									key={l.id}
									list={l}
									boxes={boxes}
									childId={child.id}
									upNext={start === "list" && l.id === first?.id}
									unfinished={unfinished}
									guideId={headingId}
								/>
							))}
						</ul>
					</>
				)}
			</section>

			{progress && <Badges badges={progress.badges} />}
		</main>
	);
}

/** Streak, stars and words mastered: the progress a kid can feel, on a maple plaque. */
function ProgressPlaque({ progress }: { progress: Progress }) {
	const streak = progress.stats.currentStreak;
	return (
		<dl className="plaque flex-wrap gap-x-4 gap-y-1 px-4 py-2">
			<div className="flex items-center gap-1.5">
				<dt>
					<Flame className="size-5 text-ink-soft" aria-hidden />
					<span className="sr-only">Day streak</span>
				</dt>
				{streak > 0 ? (
					<dd className="font-display text-xl font-semibold tabular-nums">{streak}</dd>
				) : (
					<dd className="text-sm font-medium">Start a streak today</dd>
				)}
			</div>
			<div className="flex items-center gap-1.5">
				<dt>
					<Star className="size-5 fill-ink-soft text-ink-soft" aria-hidden />
					<span className="sr-only">Stars</span>
				</dt>
				<dd className="font-display text-xl font-semibold tabular-nums">{progress.stats.totalStars}</dd>
			</div>
			<div className="flex items-center gap-1.5">
				<dt>
					<BadgeCheck className="size-5 text-ink-soft" aria-hidden />
					<span className="sr-only">Words mastered</span>
				</dt>
				<dd className="flex items-baseline gap-1">
					<span className="font-display text-xl font-semibold tabular-nums">{progress.mastered}</span>
					<span className="text-sm font-medium" aria-hidden>
						mastered
					</span>
				</dd>
			</div>
		</dl>
	);
}

/** The three ways to practice, said once and in plain words, so every key below can point back to it. */
function ModeGuide({ idBase }: { idBase: string }) {
	return (
		<ul className="flex flex-wrap gap-x-6 gap-y-2 text-felt-muted">
			{MODE_ORDER.map((m) => {
				const { label, icon: Icon, hint } = MODES[m];
				return (
					<li key={m} id={`${idBase}-${m}`} className="flex items-center gap-2">
						<Icon className="size-5 text-felt-ink" aria-hidden />
						<span>
							<span className="font-display font-medium text-felt-ink">{label}</span>: {hint}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * A list as a felt patch: its first words on a rack, how many this kid has mastered, one way to practice it next, and
 * the other two ways close by. Starting something new while a round is unfinished asks first.
 */
function ListCard({
	list: l,
	boxes,
	childId,
	upNext,
	unfinished,
	guideId,
}: {
	list: ListSummary;
	boxes: Record<string, number>;
	childId: string;
	upNext: boolean;
	unfinished: ReturnType<typeof resumableRound>;
	guideId: string;
}) {
	const navigate = useNavigate();
	const id = useId();
	const { data: full } = useQuery(listQuery(l.id));
	const words = full?.words.map((w) => w.word) ?? l.preview;
	const sure = words.filter((w) => (boxes[w] ?? 0) >= 4).length;
	const suggested = nextMode(words, boxes);
	const others = MODE_ORDER.filter((m) => m !== suggested);
	const carryOn = unfinished && unfinished.listId === l.id && unfinished.mode !== "review" ? (unfinished.mode as PlayMode) : null;
	const [asking, setAsking] = useState<PlayMode | null>(null);

	const go = (mode: PlayMode, resume = false) =>
		navigate({ to: "/play/$childId/round/$listId/$mode", params: { childId, listId: l.id, mode }, search: resume ? { resume: true } : {} });
	/** Starting a fresh round replaces the unfinished one on this device, so a kid mid-round is asked first. */
	function tap(e: MouseEvent, mode: PlayMode) {
		speaker.unlock();
		// The unfinished round's own list and way: the link already carries on from where it stopped.
		if (carryOn === mode) return;
		if (unfinished) {
			e.preventDefault();
			setAsking(mode);
		}
	}

	const main = carryOn ?? suggested;
	const M = MODES[main];
	return (
		<li className={`patch flex flex-col gap-4 p-5 ${upNext ? "ring-2 ring-felt-ink/60" : ""}`} aria-labelledby={`${id}-name`}>
			<div className="space-y-1">
				{upNext && <p className="text-sm font-medium text-felt-muted">Up next</p>}
				<h3 id={`${id}-name`} className="font-display text-xl font-medium break-words">
					{l.name}
				</h3>
				<p className="text-sm text-felt-muted tabular-nums">
					{l.wordCount} {l.wordCount === 1 ? "word" : "words"}
					{sure > 0 && ` · ${sure} mastered`}
				</p>
			</div>
			<div className="rack flex flex-wrap items-end gap-x-3 gap-y-2 self-start" aria-hidden>
				{l.preview.slice(0, 3).map((w) => (
					<WordRack key={w} word={w} max={24} min={12} />
				))}
			</div>
			<div className="space-y-3">
				<Link
					to="/play/$childId/round/$listId/$mode"
					params={{ childId, listId: l.id, mode: main }}
					search={carryOn ? { resume: true } : {}}
					onClick={(e) => tap(e, main)}
					className="key"
					data-variant={upNext ? "go" : "felt"}
					aria-label={
						carryOn ? `Continue ${M.label}: ${l.name}, ${unfinished?.done} of ${unfinished?.total} done` : `${M.label}: ${l.name}`
					}
					aria-describedby={`${guideId}-${main}`}
				>
					{carryOn ? <Play className="size-5" aria-hidden /> : <M.icon className="size-5" aria-hidden />}
					{carryOn ? `Continue ${M.label} (${unfinished?.done} of ${unfinished?.total})` : M.label}
				</Link>
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm text-felt-muted">or</span>
					{others.map((m) => {
						const O = MODES[m];
						return (
							<Link
								key={m}
								to="/play/$childId/round/$listId/$mode"
								params={{ childId, listId: l.id, mode: m }}
								onClick={(e) => tap(e, m)}
								className="key !min-h-11 text-sm"
								data-variant="felt"
								aria-label={`${O.label}: ${l.name}`}
								aria-describedby={`${guideId}-${m}`}
							>
								<O.icon className="size-4" aria-hidden /> {O.label}
							</Link>
						);
					})}
				</div>
			</div>
			{asking && unfinished && (
				<Confirm
					message="Start something new?"
					note={`You’re ${unfinished.done} of ${unfinished.total} through ${unfinished.name}. Starting ${MODES[asking].label} ends that round here; the words you’ve done are saved.`}
					cancelLabel={`Back to ${unfinished.name}`}
					confirmLabel={`Start ${MODES[asking].label}`}
					onCancel={() => setAsking(null)}
					onConfirm={() => go(asking)}
				/>
			)}
		</li>
	);
}

/** Badges earned, and the next one to aim for as an empty square waiting to be filled. */
function Badges({ badges }: { badges: Progress["badges"] }) {
	const earned = badges.filter((b) => b.earned);
	const next = badges.find((b) => !b.earned);
	if (earned.length === 0 && !next) return null;
	return (
		<section className="mt-14 space-y-3" aria-labelledby="badges-heading">
			<h2 id="badges-heading" className="text-lg font-semibold text-felt-muted">
				Your badges
			</h2>
			<ul className="flex flex-wrap gap-2">
				{earned.map((b) => (
					<li key={b.id} className="plaque px-3.5 py-1.5 text-sm">
						<BadgeIcon icon={b.icon} className="size-4" /> {b.label}
					</li>
				))}
				{next && (
					<li className="square flex items-center gap-2 rounded-[0.7rem] px-3.5 py-1.5 text-sm text-felt-muted">
						<BadgeIcon icon={next.icon} className="size-4" /> Next: {next.label}
					</li>
				)}
			</ul>
		</section>
	);
}
