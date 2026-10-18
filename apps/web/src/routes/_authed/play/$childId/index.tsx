import type { SPELLING_MODES } from "@jade/core";
import { TOPIC_LABEL } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Flame, Gamepad2, Play, Star, X } from "lucide-react";
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

/** The sticker sheet: every badge has its place, earned ones stuck down, the rest still a printed outline. */
function StickerSheet({ badges }: { badges: Progress["badges"] }) {
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
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
		<h2 id={id} className="font-display text-[clamp(3.5rem,11vw,6rem)] leading-[0.95] font-semibold tracking-[-0.02em] text-balance">
			{children}
		</h2>
	);
}

/** The place's lettering, printed huge across its face a tint off the hue and cropped by the rim. */
function Print({ children }: { children: string }) {
	return (
		<span
			className="place-print absolute top-[18%] -right-[4%] origin-top-right text-[min(58vh,52vw)] md:top-[9%] md:text-[min(58vh,44vw)]"
			style={{ transform: "rotate(-7deg)" }}
		>
			{children}
		</span>
	);
}

/** A white glyph on the rail with its count underneath, as on any feed. Foil when it counts practice. */
function RailItem({ icon, count, label, foil }: { icon: React.ReactNode; count: React.ReactNode; label: string; foil?: boolean }) {
	return (
		<>
			<span className={`grid size-12 place-items-center rounded-full ${foil ? "foil" : "bg-sticker-ink/95 text-[#1d2430]"}`} aria-hidden>
				{icon}
			</span>
			<span className="font-display text-base leading-none font-semibold tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">
				{count}
				<span className="sr-only"> {label}</span>
			</span>
		</>
	);
}

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
	const spellingNote =
		spellingDue > 0
			? `${spellingDue} ${spellingDue === 1 ? "word" : "words"} to review`
			: newest
				? played
					? `${newest.name} · ${played.mastered} of ${newest.wordCount} mastered`
					: `${newest.name} · ${newest.wordCount} new ${newest.wordCount === 1 ? "word" : "words"}`
				: "Hear it, spell it";

	// Open where she was last on this visit, else where a round is waiting, else at Spelling.
	const [current, setCurrent] = useState<PlaceId>(() => rememberedPlace(child.id) ?? (spellingLeft || mathLeft ? latest : "spelling"));
	const scroller = useRef<HTMLElement>(null);
	const sections = useRef(new Map<PlaceId, HTMLElement>());
	const badgesDialog = useRef<HTMLDialogElement>(null);

	function go(id: PlaceId) {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		sections.current.get(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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

	// Arrows and Page Up/Down move a whole place, wherever focus is on the page.
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.altKey || e.ctrlKey || e.metaKey || badgesDialog.current?.open) return;
			const step = e.key === "ArrowDown" || e.key === "PageDown" ? 1 : e.key === "ArrowUp" || e.key === "PageUp" ? -1 : 0;
			if (!step) return;
			const i = PLACES.findIndex((p) => p.id === current) + step;
			if (i < 0 || i >= PLACES.length) return;
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
					className="pointer-events-auto absolute top-[calc(max(0.625rem,var(--safe-top))+1rem)] left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/15 p-1 md:top-[calc(max(1rem,var(--safe-top))+1.4rem)]"
				>
					{PLACES.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => go(p.id)}
							aria-current={p.id === current ? "location" : undefined}
							className={`min-h-11 rounded-full px-4 font-display text-base font-semibold transition-colors duration-200 md:px-5 ${
								p.id === current ? "bg-sticker-ink" : "text-sticker-ink/85 hover:text-sticker-ink"
							}`}
							style={p.id === current ? { color: `var(--color-${hue})` } : undefined}
						>
							{p.label}
						</button>
					))}
				</nav>

				<div className="pointer-events-auto absolute top-1/2 right-[calc(max(0.625rem,var(--safe-right))+0.9rem)] flex -translate-y-1/2 flex-col items-center gap-5 md:right-[calc(max(1rem,var(--safe-right))+1.6rem)]">
					<Link
						to="/profiles"
						className="flex flex-col items-center gap-1.5 rounded-full"
						aria-label={`${child.name}: change who’s practicing`}
					>
						<KidTile name={child.name} avatar={child.avatar} size={52} />
					</Link>
					{progress && (
						<>
							<div className="flex flex-col items-center gap-1.5" title="Day streak">
								<RailItem foil icon={<Flame className="size-5" />} count={progress.stats.currentStreak} label="day streak" />
							</div>
							{/* Every star ever earned: a record of practice, which games never take from. */}
							<div className="flex flex-col items-center gap-1.5" title="Stars earned">
								<RailItem foil icon={<Star className="size-5 fill-current" />} count={progress.stats.totalStars} label="stars earned" />
							</div>
							{progress.badges.length > 0 && (
								<button
									type="button"
									className="flex flex-col items-center gap-1.5 rounded-full"
									onClick={() => badgesDialog.current?.showModal()}
									aria-haspopup="dialog"
								>
									<RailItem
										icon={<Award className="size-5" />}
										count={`${earned}/${progress.badges.length}`}
										label={`badges earned. See your badges`}
									/>
								</button>
							)}
						</>
					)}
				</div>
			</div>

			<main ref={scroller} className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none]">
				<PlacePage
					place={PLACES[0]}
					current={current === "spelling"}
					sectionRef={register("spelling")}
					media={
						<>
							<Print>spell</Print>
							{newest && (
								<span className="absolute top-[46%] right-[22%] flex flex-col items-end gap-3 md:top-[50%] md:right-[16%]">
									{newest.preview.slice(0, 3).map((w, i) => (
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
					<p className="text-lg font-medium">{spellingNote}</p>
					{spellingLeft ? (
						<div className="flex flex-wrap items-center gap-3">
							<Link
								to="/play/$childId/round/$listId/$mode"
								params={{ childId: child.id, listId: spellingLeft.listId ?? "review", mode: spellingLeft.mode as SpellingMode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key"
								data-variant={latest === "spelling" ? "go" : undefined}
							>
								<Play className="size-5" aria-hidden /> Continue {spellingLeft.name}
								<span className="font-normal opacity-75 tabular-nums">
									· {spellingLeft.done} of {spellingLeft.total}
								</span>
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
								<span className="absolute right-[30%] bottom-[39%] h-[3%] w-[34%] rounded-[50%] bg-black/25 blur-md md:right-[17%] md:bottom-[8%] md:h-[3.5%] md:w-[20%]" />
								<RoxyFigure
									look={shownLook(child.id, roxy)}
									omit={["background"]}
									className="absolute right-[26%] bottom-[40%] h-[42%] w-auto drop-shadow-[0_0.6rem_0.8rem_rgb(0_0_0/0.18)] md:right-[14%] md:bottom-[9%] md:h-[min(74%,42rem)]"
								/>
							</>
						)
					}
				>
					<PlaceName id="place-play-heading">Play</PlaceName>
					{play && !play.open ? (
						<>
							<div className="w-full max-w-sm">
								<PlayClosed childId={child.id} status={play} size="small" />
							</div>
							<Link to="/play/$childId/games" params={{ childId: child.id }} className="key">
								<Gamepad2 className="size-5" aria-hidden /> See the games
							</Link>
						</>
					) : (
						<>
							<p className="text-lg font-medium">Roxy, the town, Gobble Town and Jelly Blocks</p>
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
								{play && <PlayWallet status={play} />}
							</div>
						</>
					)}
				</PlacePage>

				<PlacePage place={PLACES[2]} current={current === "math"} sectionRef={register("math")} media={<Print>7×8</Print>}>
					<PlaceName id="place-math-heading">Math</PlaceName>
					<p className="text-lg font-medium">
						{factsDue > 0 ? `${factsDue} ${factsDue === 1 ? "fact" : "facts"} to review` : "Facts, fractions, puzzles"}
					</p>
					{mathLeft ? (
						<div className="flex flex-wrap items-center gap-3">
							<Link
								to="/play/$childId/math/$topic"
								params={{ childId: child.id, topic: mathLeft.mode }}
								search={{ resume: true }}
								onClick={() => speaker.unlock()}
								className="key"
								data-variant={latest === "math" ? "go" : undefined}
							>
								<Play className="size-5" aria-hidden /> Continue{" "}
								{mathLeft.mode === "mathreview" ? "facts review" : TOPIC_LABEL[mathLeft.mode]}
								<span className="font-normal opacity-75 tabular-nums">
									· {mathLeft.done} of {mathLeft.total}
								</span>
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

			{progress && progress.badges.length > 0 && (
				// biome-ignore lint/a11y/useKeyWithClickEvents: only a tap on the backdrop; the keyboard closes it with Esc or Close.
				<dialog
					ref={badgesDialog}
					aria-labelledby="badges-heading"
					className="scene-day m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[1.75rem] border-[0.35rem] border-vinyl bg-page-raised p-6 text-page-ink shadow-2xl backdrop:bg-black/55 md:p-8"
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
					<StickerSheet badges={progress.badges} />
				</dialog>
			)}
		</div>
	);
}
