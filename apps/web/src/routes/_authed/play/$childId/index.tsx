import { BADGES, type SPELLING_MODES } from "@jade/core";
import { MATH_TOPICS, type MathTopic, TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Flame, Play, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BadgeIcon, badgeFace } from "#/components/BadgeIcon.tsx";
import { Brand } from "#/components/Brand.tsx";
import { PlayClosed, PlayWallet, usePlacedToday } from "#/components/play/PlayBits.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { WordRack } from "#/components/WordRack.tsx";
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
			context.queryClient.prefetchQuery(roxyQuery(params.childId)),
			context.queryClient.prefetchQuery({ ...playQuery(params.childId), staleTime: 0 }),
			context.queryClient.prefetchQuery(listsQuery),
		]),
	component: SubjectHub,
});

type SpellingMode = (typeof SPELLING_MODES)[number];

/** Learn and Play take turns, so neither is ever two flicks away. */
const PLACES = [
	{ id: "spelling", label: "Spelling", hue: "spell" },
	{ id: "play", label: "Play", hue: "roxy" },
	{ id: "math", label: "Math", hue: "math" },
] as const;
type PlaceId = (typeof PLACES)[number]["id"];

/** Small, fixed tilts, so stickers look pressed on by hand but never shift between visits. */
const TILT = [-5, 4, -3, 6, -4, 3, -6, 4];

const placeKey = (childId: string) => `jade.hub.place.${childId}`;

function rememberedPlace(childId: string): PlaceId | null {
	try {
		const v = sessionStorage.getItem(placeKey(childId));
		return PLACES.some((p) => p.id === v) ? (v as PlaceId) : null;
	} catch {
		return null;
	}
}

/** How to earn a badge, in the kid's words, under its empty slot. */
const hint = (id: string) => BADGES.find((d) => d.id === id)?.hint;

/** The sticker sheet: every badge has its place, earned ones stuck down, the rest still a printed outline. */
function StickerSheet({ badges }: { badges: Progress["badges"] }) {
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5">
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
					{!b.earned && hint(b.id) && <span className="text-xs leading-tight text-balance text-page-muted">{hint(b.id)}</span>}
				</li>
			))}
		</ul>
	);
}

/** One place, filling the screen as one big sticker: its own picture in the middle, its caption low on the left. */
function PlacePage({
	place,
	current,
	placed,
	media,
	children,
	sectionRef,
}: {
	place: (typeof PLACES)[number];
	current: boolean;
	/** Stuck down just now (Play opening after practice), so it's placed with the sticker's own motion. */
	placed?: boolean;
	media: React.ReactNode;
	children: React.ReactNode;
	sectionRef: (el: HTMLElement | null) => void;
}) {
	return (
		<section
			ref={sectionRef}
			id={`place-${place.id}`}
			data-id={place.id}
			className="place-page"
			data-place={place.hue}
			data-current={current || undefined}
			aria-labelledby={`place-${place.id}-heading`}
		>
			<div className={`place-face ${placed ? "animate-sticker-place" : ""}`}>
				<div className="absolute inset-0" aria-hidden>
					{media}
				</div>
				<div className="place-caption absolute inset-x-0 bottom-0 z-[2] flex max-w-2xl flex-col items-start gap-4 p-6 pr-24 pb-7 md:p-12 md:pr-36">
					{children}
				</div>
			</div>
		</section>
	);
}

/** A place's name: the caption's headline, as big as the screen allows. */
function PlaceName({ id, children }: { id: string; children: React.ReactNode }) {
	return (
		<h2
			id={id}
			tabIndex={-1}
			className="outline-none font-display text-[clamp(3.5rem,11vw,6rem)] leading-[0.95] font-semibold tracking-[-0.02em] text-balance"
		>
			{children}
		</h2>
	);
}

/** The place's lettering, printed huge across its face a tint off the hue and cropped by the rim. */
function Print({ children }: { children: string }) {
	return (
		<span
			className="place-print absolute top-[18%] -right-[4%] origin-top-right text-[min(58vh,52vw)] md:top-[9%] md:text-[min(58vh,44vw)] md:portrait:top-[14%] md:portrait:text-[60vw]"
			style={{ transform: "rotate(-7deg)" }}
		>
			{children}
		</span>
	);
}

/** A rail item's words, on a small white vinyl label so they read on any hue and over the print. */
function RailLabel({ children }: { children: React.ReactNode }) {
	return (
		<span aria-hidden className="word-sticker items-center gap-1 tabular-nums" style={{ fontSize: 13 }}>
			{children}
		</span>
	);
}

/** How a fact key reads on a disc: "m:mul:7x8" is 7×8. */
const factText = (k: string) =>
	k
		.replace(/^m:(mul|div):/, "")
		.replace("x", "×")
		.replace("/", "÷");

/** What each topic looks like, as a problem on a disc; story problems have no short face, so they lend none. */
const TOPIC_SAMPLE: Partial<Record<MathTopic, string>> = { facts: "6×7", mental: "48−19", fractions: "¾" };

function SubjectHub() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const { data: play } = useQuery(playQuery(child.id));
	const placed = usePlacedToday(child.id, play);
	const spellingLeft = resumableRound(child.id);
	const mathLeft = resumableMath(child.id);
	const spellingDue = progress?.reviewDue.length ?? 0;
	const factsDue = progress?.math.factsDue.length ?? 0;
	// One primary key per view: the round touched most recently gets it.
	const latest = !mathLeft || (spellingLeft && spellingLeft.startedAt >= mathLeft.startedAt) ? "spelling" : "math";
	const earned = progress?.badges.filter((b) => b.earned).length ?? 0;
	// What's waiting in Spelling: words due first, else this week's newest list, said as new or as how far along it is.
	const { data: lists } = useQuery(listsQuery);
	const newest = lists && newestFirst(lists.filter((l) => listIsFor(l, child.id)))[0];
	const played = newest?.perChild.find((p) => p.childId === child.id && p.lastPlayedAt);
	// A round in progress speaks for itself on its Continue key, so the line doesn't count the list over again.
	const spellingNote: { lead: string; tail?: string } = spellingLeft
		? { lead: "Pick up where you left off", tail: `${spellingLeft.done} of ${spellingLeft.total}` }
		: spellingDue > 0
			? { lead: `${spellingDue} ${spellingDue === 1 ? "word" : "words"} to review` }
			: newest
				? {
						lead: newest.name,
						tail: played
							? `${played.mastered} of ${newest.wordCount} mastered`
							: `${newest.wordCount} new ${newest.wordCount === 1 ? "word" : "words"}`,
					}
				: { lead: "Hear it, spell it" };
	// The words on Spelling's face are the ones waiting for her: review first, else this week's newest list.
	const faceWords = spellingDue > 0 ? (progress?.reviewDue ?? []).slice(0, 3) : (newest?.preview ?? []).slice(0, 3);
	const topics = MATH_TOPICS.filter((t) => child.settings.math.topics.includes(t));
	const stars = progress?.stats.totalStars ?? 0;
	const closed = !!play && !play.open;
	// Where closed Play sends her: the subject with something waiting, else Spelling.
	const practiceAt: PlaceId = mathLeft || (factsDue > 0 && !spellingLeft && spellingDue === 0) ? "math" : "spelling";
	const streak = progress?.stats.currentStreak ?? 0;

	// Open where she was last on this visit, else where a round is waiting, else at Spelling.
	const [current, setCurrent] = useState<PlaceId>(() => rememberedPlace(child.id) ?? (spellingLeft || mathLeft ? latest : "spelling"));
	const scroller = useRef<HTMLElement>(null);
	const sections = useRef(new Map<PlaceId, HTMLElement>());
	const badgesDialog = useRef<HTMLDialogElement>(null);

	function go(id: PlaceId) {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const section = sections.current.get(id);
		section?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
		// Focus follows to the place's name, so a screen reader says where she landed and Tab goes on to its keys.
		section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
	}

	// Land on the opening place without a scroll, before anything paints.
	useEffect(() => {
		sections.current.get(current)?.scrollIntoView({ behavior: "instant", block: "start" });
	}, []);

	// The place that fills the screen is the current one; the tabs and caption follow it.
	useEffect(() => {
		const root = scroller.current;
		if (!root) return;
		const seen = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) setCurrent(e.target.getAttribute("data-id") as PlaceId);
			},
			{ root, threshold: 0.6 },
		);
		for (const el of sections.current.values()) seen.observe(el);
		return () => seen.disconnect();
	}, []);

	useEffect(() => {
		try {
			sessionStorage.setItem(placeKey(child.id), current);
		} catch {}
	}, [child.id, current]);

	// Arrows and Page Up/Down move a whole place, Home and End go to the first and last, unless something that takes
	// keys of its own (a field, a slider, a list) has focus.
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.altKey || e.ctrlKey || e.metaKey || badgesDialog.current?.open) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest("input, textarea, select, [contenteditable], [role=slider], [role=listbox], [role=menu], [role=tablist]")) return;
			const at = PLACES.findIndex((p) => p.id === current);
			const i =
				e.key === "Home"
					? 0
					: e.key === "End"
						? PLACES.length - 1
						: e.key === "ArrowDown" || e.key === "PageDown"
							? at + 1
							: e.key === "ArrowUp" || e.key === "PageUp"
								? at - 1
								: -2;
			if (i === -2 || i < 0 || i >= PLACES.length || i === at) return;
			e.preventDefault();
			go(PLACES[i]?.id ?? current);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const hue = PLACES.find((p) => p.id === current)?.hue ?? "spell";
	const register = (id: PlaceId) => (el: HTMLElement | null) => {
		if (el) sections.current.set(id, el);
		else sections.current.delete(id);
	};

	return (
		<div className="relative">
			<h1 className="sr-only">{child.name}’s places</h1>

			{/* The chrome floats over whichever place fills the screen, inside its rim. */}
			<div className="pointer-events-none fixed inset-0 z-10 text-sticker-ink">
				<div className="absolute top-[calc(var(--place-inset-top,0.625rem)+1.1rem)] left-[calc(max(0.625rem,var(--safe-left))+1.4rem)] hidden md:left-[calc(max(1rem,var(--safe-left))+2rem)] md:top-[calc(max(1rem,var(--safe-top))+1.6rem)] sm:block">
					<Brand size={22} />
				</div>

				<nav
					aria-label="Places"
					className="pointer-events-auto absolute top-[calc(max(0.625rem,var(--safe-top))+1rem)] left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/25 p-1 md:top-[calc(max(1rem,var(--safe-top))+1.4rem)]"
				>
					{PLACES.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => go(p.id)}
							aria-current={p.id === current ? "location" : undefined}
							className={`min-h-11 rounded-full px-4 font-display text-base font-semibold transition-colors duration-200 md:px-5 ${
								p.id === current ? "bg-sticker-ink" : "text-sticker-ink hover:bg-black/15"
							}`}
							style={p.id === current ? { color: `var(--color-${hue})` } : undefined}
						>
							{p.label}
						</button>
					))}
				</nav>
			</div>

			<main ref={scroller} className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none]">
				<PlacePage
					place={PLACES[0]}
					current={current === "spelling"}
					sectionRef={register("spelling")}
					media={
						<>
							<Print>spell</Print>
							{faceWords.length > 0 && (
								<span className="absolute top-[26%] right-[22%] flex origin-right flex-col items-end gap-3 md:top-[50%] md:right-[16%] md:portrait:top-[52%] md:portrait:scale-125">
									{faceWords.map((w, i) => (
										<span key={w} style={{ transform: `rotate(${[-4, 3, -2][i]}deg)` }}>
											<WordRack word={w} max={i === 0 ? 46 : 34} />
										</span>
									))}
								</span>
							)}
						</>
					}
				>
					<PlaceName id="place-spelling-heading">Spelling</PlaceName>
					<p className="text-lg font-medium">
						{spellingNote.lead}
						{spellingNote.tail && <span className="whitespace-nowrap"> · {spellingNote.tail}</span>}
					</p>
					{spellingLeft ? (
						<div className="flex flex-wrap items-center gap-3">
							<Link
								to="/play/$childId/round/$listId/$mode"
								params={{ childId: child.id, listId: spellingLeft.listId ?? "review", mode: spellingLeft.mode as SpellingMode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key max-w-full whitespace-nowrap"
								data-variant={latest === "spelling" ? "go" : undefined}
							>
								<Play className="size-5 shrink-0" aria-hidden />
								<span className="max-w-[17ch] truncate sm:max-w-[24ch]">Continue {spellingLeft.name}</span>
								<span className="sr-only">{` · ${spellingLeft.done} of ${spellingLeft.total}`}</span>
							</Link>
							<Link to="/play/$childId/spelling" params={{ childId: child.id }} onClick={() => speaker.unlock()} className="key">
								All lists
							</Link>
						</div>
					) : (
						<Link
							to="/play/$childId/spelling"
							params={{ childId: child.id }}
							onClick={() => speaker.unlock()}
							className="key"
							data-variant="go"
						>
							Let’s spell
						</Link>
					)}
				</PlacePage>

				<PlacePage
					place={PLACES[1]}
					current={current === "play"}
					placed={placed}
					sectionRef={register("play")}
					media={
						roxy && (
							<>
								{/* Closed, the caption grows by the slot, so on a phone she steps up and back out of its way. */}
								<span
									className={`absolute h-[3%] rounded-[50%] bg-black/25 blur-md md:right-[17%] md:bottom-[8%] md:h-[3.5%] md:w-[20%] ${closed ? "right-[12%] bottom-[57%] w-[24%]" : "right-[30%] bottom-[39%] w-[34%]"}`}
								/>
								<RoxyFigure
									look={shownLook(child.id, roxy)}
									omit={["background"]}
									className={`absolute w-auto drop-shadow-[0_0.6rem_0.8rem_rgb(0_0_0/0.18)] md:right-[14%] md:bottom-[9%] md:h-[min(74%,42rem)] ${closed ? "right-[10%] bottom-[58%] h-[27%]" : "right-[26%] bottom-[40%] h-[42%]"}`}
								/>
							</>
						)
					}
				>
					<PlaceName id="place-play-heading">Play</PlaceName>
					{closed ? (
						<div className="w-full max-w-sm">
							<PlayClosed
								childId={child.id}
								status={play}
								size="small"
								next={
									<button type="button" className="key" data-variant="go" onClick={() => go(practiceAt)}>
										Go to {practiceAt === "math" ? "Math" : "Spelling"}
									</button>
								}
							/>
						</div>
					) : (
						<>
							<p className="text-lg font-medium md:max-w-[20rem]">Roxy, the town, Gobble Town, Jelly Blocks and Campfire Woods</p>
							<div className="flex flex-wrap items-center gap-3">
								<Link
									to="/play/$childId/games"
									params={{ childId: child.id }}
									onClick={() => speaker.unlock()}
									className="key"
									data-variant="go"
								>
									Let’s play
								</Link>
								{play && <PlayWallet status={play} stars={false} />}
							</div>
						</>
					)}
				</PlacePage>

				<PlacePage
					place={PLACES[2]}
					current={current === "math"}
					sectionRef={register("math")}
					media={
						<>
							<Print>7×8</Print>
							<span className="absolute top-[32%] right-[24%] flex origin-right -space-x-2 md:top-[50%] md:right-[16%] md:-space-x-3 md:portrait:top-[52%] md:portrait:scale-125">
								{factsDue > 0
									? progress?.math.factsDue.slice(0, 3).map((k, i) => (
											<span
												key={k}
												className="vinyl-disc size-20 text-2xl tabular-nums md:size-32 md:text-4xl"
												style={{ transform: `rotate(${[-6, 4, -3][i]}deg)` }}
											>
												{factText(k)}
											</span>
										))
									: topics
											.flatMap((t) => TOPIC_SAMPLE[t] ?? [])
											.map((q, i) => (
												<span
													key={q}
													className="vinyl-disc size-20 text-2xl tabular-nums md:size-32 md:text-4xl"
													style={{ transform: `rotate(${[-6, 4, -3][i]}deg)` }}
												>
													{q}
												</span>
											))}
							</span>
						</>
					}
				>
					<PlaceName id="place-math-heading">Math</PlaceName>
					<p className="text-lg font-medium">
						{mathLeft
							? `Pick up where you left off · ${mathLeft.done} of ${mathLeft.total}`
							: factsDue > 0
								? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review`
								: "Facts, fractions, puzzles"}
					</p>
					{mathLeft ? (
						<div className="flex flex-wrap items-center gap-3">
							<Link
								to="/play/$childId/math/$topic"
								params={{ childId: child.id, topic: mathLeft.mode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key max-w-full whitespace-nowrap"
								data-variant={latest === "math" ? "go" : undefined}
							>
								<Play className="size-5 shrink-0" aria-hidden />
								<span className="max-w-[17ch] truncate sm:max-w-[24ch]">
									Continue {mathLeft.mode === "mathreview" ? "facts review" : TOPIC_LABEL[mathLeft.mode]}
								</span>
								<span className="sr-only">{` · ${mathLeft.done} of ${mathLeft.total}`}</span>
							</Link>
							<Link to="/play/$childId/math" params={{ childId: child.id }} onClick={() => speaker.unlock()} className="key">
								All topics
							</Link>
						</div>
					) : (
						<Link
							to="/play/$childId/math"
							params={{ childId: child.id }}
							onClick={() => speaker.unlock()}
							className="key"
							data-variant="go"
						>
							Let’s do math
						</Link>
					)}
				</PlacePage>
			</main>

			{/* Who and what she has, after the places in reading order, so Tab goes from a place's name to its keys. */}
			<div className="pointer-events-none fixed inset-0 z-10 text-sticker-ink">
				<div className="pointer-events-auto absolute top-1/2 right-[calc(max(0.625rem,var(--safe-right))+0.9rem)] flex -translate-y-1/2 flex-col items-center gap-5 md:right-[calc(max(1rem,var(--safe-right))+1.6rem)]">
					<Link to="/profiles" className="flex flex-col items-center gap-1.5 rounded-full" aria-label={`Switch from ${child.name}`}>
						<KidTile name={child.name} avatar={child.avatar} size={52} />
						<RailLabel>Switch</RailLabel>
					</Link>
					{progress && progress.badges.length > 0 && (
						<button
							type="button"
							className="flex flex-col items-center gap-1.5 rounded-full"
							onClick={() => badgesDialog.current?.showModal()}
							aria-haspopup="dialog"
							aria-label={`Badges, stars and streak: ${stars} ${stars === 1 ? "star" : "stars"}, ${earned} of ${progress.badges.length} badges`}
						>
							<span className="vinyl-disc size-13" aria-hidden>
								<Award className="size-6" />
							</span>
							<RailLabel>
								<Star className="size-3.5 fill-current" />
								{stars}
							</RailLabel>
						</button>
					)}
				</div>
			</div>

			{progress && progress.badges.length > 0 && (
				// biome-ignore lint/a11y/useKeyWithClickEvents: only a tap on the backdrop; the keyboard closes it with Esc or Close.
				<dialog
					ref={badgesDialog}
					aria-labelledby="badges-heading"
					className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[1.75rem] border-[0.35rem] border-vinyl bg-page-raised p-6 text-page-ink shadow-2xl backdrop:bg-black/55 md:p-8"
					onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
				>
					<div className="mb-6 flex items-center justify-between gap-4">
						<h2 id="badges-heading" className="text-2xl font-semibold">
							Your badges{" "}
							<span className="text-base font-normal text-page-muted tabular-nums">
								· {earned} of {progress.badges.length}
							</span>
						</h2>
						<button type="button" className="key size-12 !px-0" aria-label="Close" onClick={() => badgesDialog.current?.close()}>
							<X className="size-5" aria-hidden />
						</button>
					</div>
					{/* Her record of practice: every star ever earned (games never take from it) and the days in a row. */}
					{stars > 0 ? (
						<div className="mb-6 flex flex-wrap gap-2.5">
							<span className="foil inline-flex items-center gap-2 px-4 py-2">
								<Star className="size-5 fill-current" aria-hidden />
								<span className="font-display text-xl font-semibold tabular-nums">{stars}</span>
								<span className="text-sm font-medium">{stars === 1 ? "star" : "stars"}</span>
							</span>
							{streak > 0 && (
								<span className="foil inline-flex items-center gap-2 px-4 py-2">
									<Flame className="size-5" aria-hidden />
									<span className="font-display text-xl font-semibold tabular-nums">{streak}</span>
									<span className="text-sm font-medium">{streak === 1 ? "day" : "days in a row"}</span>
								</span>
							)}
						</div>
					) : (
						<p className="mb-6 text-page-muted">Your first round starts your stars and your streak.</p>
					)}
					<StickerSheet badges={progress.badges} />
				</dialog>
			)}
		</div>
	);
}
