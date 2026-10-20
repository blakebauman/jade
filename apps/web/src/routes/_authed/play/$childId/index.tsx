import { BADGES, goalProgress, type Quest, questCollectable, questDone, type SPELLING_MODES, TIME_BLOCK } from "@jade/core";
import { TOPIC_LABEL } from "@jade/core/math";
import { characterName, FINDS } from "@jade/core/roxy";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, CalendarHeart, Clock, Flame, Lock, Star, Target, Ticket, Users, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BadgeIcon, badgeFace } from "#/components/BadgeIcon.tsx";
import { Brand } from "#/components/Brand.tsx";
import { MoreTime } from "#/components/play/PlayBits.tsx";
import { QuestBoard } from "#/components/play/QuestBoard.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { listIsFor, newestFirst, type Progress } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { resumableMath } from "#/lib/mathRound.ts";
import { type PlayStatus, playQuery } from "#/lib/play.ts";
import { listsQuery, progressQuery } from "#/lib/queries.ts";
import { useQuests } from "#/lib/quests.ts";
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
	component: Home,
});

type SpellingMode = (typeof SPELLING_MODES)[number];
type TileId = "roxy" | "town" | "gobble" | "jelly" | "woods" | "spelling" | "math";
const TILE_IDS: TileId[] = ["roxy", "gobble", "jelly", "spelling", "woods", "math", "town"];
const GAMES = new Set<TileId>(["roxy", "town", "gobble", "jelly", "woods"]);

/** The shelf leads with what the kid played last, as a console's home does; a new kid starts from the games. */
const orderKey = (childId: string) => `jade.shelf.${childId}`;
function readOrder(childId: string): TileId[] {
	try {
		const saved = JSON.parse(localStorage.getItem(orderKey(childId)) ?? "[]") as string[];
		const known = saved.filter((id): id is TileId => TILE_IDS.includes(id as TileId));
		return [...new Set([...known, ...TILE_IDS])];
	} catch {
		return TILE_IDS;
	}
}
function markPlayed(childId: string, id: TileId) {
	try {
		localStorage.setItem(orderKey(childId), JSON.stringify([id, ...readOrder(childId).filter((t) => t !== id)]));
	} catch {}
}

/** The shelf tile a quest's game lives on: the studio's is Roxy's. */
const tileOf = (q: Quest): TileId => (q.game === "studio" ? "roxy" : q.game);

function readNumber(key: string) {
	try {
		return Number(localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}

/** How to earn a badge, in the kid's words, under its empty slot. */
const hint = (id: string) => BADGES.find((d) => d.id === id)?.hint;
/** Small, fixed tilts, so earned badges look pressed on by hand but never shift between visits. */
const TILT = [-5, 4, -3, 6, -4, 3, -6, 4];

/** The badge sheet: every badge has its place, earned ones stuck down, the rest a dim disc saying how to earn it. */
function BadgeSheet({ badges }: { badges: Progress["badges"] }) {
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
						<span className="grid size-16 place-items-center rounded-2xl bg-page-deep text-page-muted md:size-[4.5rem]">
							<BadgeIcon icon={b.icon} className="size-6" />
						</span>
					)}
					<span className={b.earned ? "text-xs font-medium leading-tight" : "text-xs leading-tight text-page-muted"}>
						{b.label}
						{!b.earned && <span className="sr-only"> (not yet)</span>}
					</span>
					{!b.earned && hint(b.id) && <span className="text-sm leading-tight text-balance text-page-muted">{hint(b.id)}</span>}
				</li>
			))}
		</ul>
	);
}

/** One sheet over the home, for badges, quests or more time; Esc, Close or a tap outside closes it. */
function Sheet({
	sheetRef,
	title,
	children,
}: {
	sheetRef: React.RefObject<HTMLDialogElement | null>;
	title: React.ReactNode;
	children: React.ReactNode;
}) {
	const id = useId();
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only a tap on the backdrop; the keyboard closes it with Esc or Close.
		<dialog
			ref={sheetRef}
			aria-labelledby={id}
			className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.75rem] bg-page-raised p-6 text-page-ink shadow-2xl backdrop:bg-black/55 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-safe-6 md:p-8"
			onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
		>
			<div className="mb-6 flex items-center justify-between gap-4">
				<h2 id={id} className="text-2xl font-semibold">
					{title}
				</h2>
				<button type="button" className="key size-12 !px-0" aria-label="Close" onClick={() => sheetRef.current?.close()}>
					<X className="size-5" aria-hidden />
				</button>
			</div>
			{children}
		</dialog>
	);
}

type Tile = {
	id: TileId;
	name: string;
	/** One line under the shelf while it's lit. */
	line: string;
	/** A short fact beside the line: a best score, finds, a round to finish. */
	stat?: React.ReactNode;
	art: React.ReactNode;
	/** A red count on the tile's corner: words or facts waiting. */
	count?: number;
	/** How far a waiting round has come, as a bar along the tile's foot. */
	progress?: number;
	/** Where the tile goes; a game while Play is shut goes nowhere. */
	go?: () => void;
	locked?: boolean;
	/** One of today's quests is in this game and not done yet. */
	quest?: boolean;
};

/**
 * Under a shut game: one line for what opens it (a strip for a star goal) and one key to where practice waits; out of
 * time, the minutes stars can buy.
 */
function ClosedLine({ play, childId, go }: { play: PlayStatus; childId: string; go?: React.ReactNode }) {
	const p = goalProgress(play.settings.goal, play.today);
	const left = Math.max(1, p.need - p.have);
	// The goal in words is the line; a star goal's strip comes after it, as how far today has come.
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
			<p id="shelf-shut" className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<span className="flex items-center gap-2.5 text-lg font-medium text-balance">
					<Lock className="size-5 shrink-0 text-page-muted" aria-hidden />
					{!play.shut
						? "Out of play time for today"
						: p.unit === "star"
							? `Earn ${left} more ${left === 1 ? "star" : "stars"} to open the games`
							: "Finish a round to open the games"}
				</span>
				{play.shut && p.unit === "star" && (
					<span className="flex items-center gap-2.5 text-sm font-semibold text-page-muted tabular-nums">
						<span className="block h-2 w-28 overflow-hidden rounded-full bg-page-line" aria-hidden>
							<span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (p.have / p.need) * 100)}%` }} />
						</span>
						{p.have} of {p.need} today
					</span>
				)}
			</p>
			{play.shut ? go : <MoreTime childId={childId} status={play} />}
		</div>
	);
}

/** Key art from the game or round itself (public/tiles), edge to edge. */
function Art({ src }: { src: string }) {
	return <img src={src} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />;
}

function Home() {
	const child = useChild();
	const navigate = useNavigate();
	const { data: progress } = useQuery(progressQuery(child.id));
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const roxyName = characterName(roxy && shownLook(child.id, roxy));
	const { data: play } = useQuery(playQuery(child.id));
	const { data: lists } = useQuery(listsQuery);
	const spellingLeft = resumableRound(child.id);
	const mathLeft = resumableMath(child.id);
	const spellingDue = progress?.reviewDue.length ?? 0;
	const factsDue = progress?.math.factsDue.length ?? 0;
	const stars = progress?.stats.totalStars ?? 0;
	const streak = progress?.stats.currentStreak ?? 0;
	const earned = progress?.badges.filter((b) => b.earned).length ?? 0;
	const locked = !!play && !play.open;
	const newest = lists && newestFirst(lists.filter((l) => listIsFor(l, child.id)))[0];
	const played = newest?.perChild.find((p) => p.childId === child.id && p.lastPlayedAt);
	const holiday = roxy?.holidays[0];
	const [best] = useState(() => ({
		gobble: readNumber(`jade.gobble.best.${child.id}`),
		jelly: readNumber(`jade.jelly.best.${child.id}`),
		nights: readNumber(`jade.woods.nights.${child.id}`),
	}));
	const game =
		(
			to:
				| "/play/$childId/games/roxy"
				| "/play/$childId/games/roxy/town"
				| "/play/$childId/games/gobble"
				| "/play/$childId/games/jelly"
				| "/play/$childId/games/woods",
		) =>
		() =>
			navigate({ to, params: { childId: child.id } });

	const tiles: Record<TileId, Tile> = {
		roxy: {
			id: "roxy",
			name: roxyName,
			line: "Style your own character, then turn them into an animal with a magic gem.",
			stat: holiday && (
				<>
					<CalendarHeart className="size-4" aria-hidden /> {holiday.label} collection
				</>
			),
			art: roxy ? (
				<RoxyFigure look={shownLook(child.id, roxy)} viewBox="10 0 380 380" className="absolute inset-0 size-full" />
			) : (
				<span className="absolute inset-0 bg-roxy" />
			),
			go: game("/play/$childId/games/roxy"),
		},
		town: {
			id: "town",
			name: `${roxyName}’s town`,
			line: `Take ${roxyName} and your pet to the park, the pet shop and school, and find what’s hidden.`,
			stat: roxy && `${roxy.finds.length} of ${FINDS.length} found`,
			art: <Art src="/tiles/town.webp" />,
			go: game("/play/$childId/games/roxy/town"),
		},
		gobble: {
			id: "gobble",
			name: "Gobble Town",
			line: "Be a hungry hole! Gobble flowers, then cars, then whole houses, and be the biggest in town.",
			stat: best.gobble > 0 && `Your best: ${best.gobble.toLocaleString()}`,
			art: <Art src="/tiles/gobble.webp" />,
			go: game("/play/$childId/games/gobble"),
		},
		jelly: {
			id: "jelly",
			name: "Jelly Blocks",
			line: "Turn and drop wobbly jelly blocks to fill whole rows. Fill a row and it pops!",
			stat: best.jelly > 0 && `Your best: ${best.jelly.toLocaleString()}`,
			art: <Art src="/tiles/jelly.webp" />,
			go: game("/play/$childId/games/jelly"),
		},
		woods: {
			id: "woods",
			name: "Campfire Woods",
			line: "Dig and build on your island, keep the campfire burning all night, and bring lost animals home.",
			stat: best.nights > 0 && `${best.nights} ${best.nights === 1 ? "night" : "nights"} by the fire`,
			art: <Art src="/tiles/woods.webp" />,
			go: game("/play/$childId/games/woods"),
		},
		spelling: {
			id: "spelling",
			name: "Spelling",
			line: spellingLeft
				? `Finish ${spellingLeft.listId ? spellingLeft.name : "your review words"}: ${spellingLeft.done} of ${spellingLeft.total} done.`
				: spellingDue > 0
					? `${spellingDue} ${spellingDue === 1 ? "word wants" : "words want"} another go.`
					: newest
						? played
							? `${newest.name}: ${played.mastered} of ${newest.wordCount} mastered.`
							: `${newest.name}: ${newest.wordCount} new ${newest.wordCount === 1 ? "word" : "words"}.`
						: "Hear the word, then spell it, like a real bee.",
			art: <Art src="/tiles/spelling.webp" />,
			// What's waiting: words due again, else this week's words they haven't started.
			// The bar speaks for a waiting round, so the count only shows when there isn't one.
			count: spellingLeft ? undefined : spellingDue || (newest && !played ? newest.wordCount : undefined),
			progress: spellingLeft ? spellingLeft.done / spellingLeft.total : undefined,
			go: spellingLeft
				? () =>
						navigate({
							to: "/play/$childId/round/$listId/$mode",
							params: { childId: child.id, listId: spellingLeft.listId ?? "review", mode: spellingLeft.mode as SpellingMode },
							search: { resume: true },
						})
				: () => navigate({ to: "/play/$childId/spelling", params: { childId: child.id } }),
		},
		math: {
			id: "math",
			name: "Math",
			line: mathLeft
				? `Finish your ${mathLeft.mode === "mathreview" ? "facts review" : TOPIC_LABEL[mathLeft.mode].toLowerCase()}: ${mathLeft.done} of ${mathLeft.total} done.`
				: factsDue > 0
					? `${factsDue} ${factsDue === 1 ? "fact wants" : "facts want"} another go.`
					: "Times tables, mental math, fractions and story problems.",
			art: <Art src="/tiles/math.webp" />,
			count: mathLeft ? undefined : factsDue || undefined,
			progress: mathLeft ? mathLeft.done / mathLeft.total : undefined,
			go: mathLeft
				? () =>
						navigate({
							to: "/play/$childId/math/$topic",
							params: { childId: child.id, topic: mathLeft.mode },
							search: { resume: true },
						})
				: () => navigate({ to: "/play/$childId/math", params: { childId: child.id } }),
		},
	};

	// A round waiting to be finished leads the shelf (the most recent of the two), whatever was tapped last.
	const [order] = useState(() => {
		const waiting = [
			spellingLeft && { id: "spelling" as const, at: spellingLeft.startedAt },
			mathLeft && { id: "math" as const, at: mathLeft.startedAt },
		]
			.filter((w): w is { id: "spelling" | "math"; at: number } => !!w)
			.sort((a, b) => b.at - a.at)
			.map((w) => w.id);
		return [...new Set<TileId>([...waiting, ...readOrder(child.id)])];
	});
	// While games are shut, Spelling and Math lead, so the shelf opens on what the kid can do, nothing cut off.
	const ordered = locked ? [...order.filter((id) => !GAMES.has(id)), ...order.filter((id) => GAMES.has(id))] : order;
	const { quests: today, state: questState } = useQuests(child.id);
	const questIn = new Set(today.filter((q) => !questDone(q, questState)).map((q) => tileOf(q)));
	const shelf = ordered.map((id) => {
		const t = tiles[id];
		const shut = locked && GAMES.has(id);
		const go = t.go;
		return {
			...t,
			locked: shut,
			quest: !locked && questIn.has(id),
			go:
				shut || !go
					? undefined
					: () => {
							markPlayed(child.id, id);
							speaker.unlock();
							go();
						},
		};
	});
	// A kid whose games are shut starts lit on the first thing they can open.
	const [nudged, setNudged] = useState<number | null>(null);
	const [lit, setLit] = useState(() =>
		Math.max(
			0,
			shelf.findIndex((t) => !t.locked),
		),
	);
	const shelfRef = useRef<HTMLUListElement>(null);
	// A swipe leaves the light behind off-screen; when the shelf settles with the lit tile out of view, the tile at the
	// shelf's start takes the light (without focus, so a touch screen shows no focus ring).
	useEffect(() => {
		const root = shelfRef.current;
		if (!root) return;
		let timer = 0;
		// Only a scroll the kid makes moves the light; a scroll position the browser restores on back or reload doesn't.
		let touched = false;
		const touch = () => {
			touched = true;
		};
		const settle = () => {
			if (!touched) return;
			const box = root.getBoundingClientRect();
			const r = buttons.current[lit]?.getBoundingClientRect();
			if (r && r.left >= box.left - 1 && r.right <= box.right + 1) return;
			const start = box.left + (Number.parseFloat(getComputedStyle(root).scrollPaddingLeft) || 0);
			let best = 0;
			let gap = Number.POSITIVE_INFINITY;
			buttons.current.forEach((el, i) => {
				const d = Math.abs((el?.getBoundingClientRect().left ?? 0) - start);
				if (d < gap) [best, gap] = [i, d];
			});
			setLit(best);
		};
		const onScroll = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(settle, 140);
		};
		root.addEventListener("scroll", onScroll, { passive: true });
		for (const type of ["pointerdown", "touchstart", "wheel"]) root.addEventListener(type, touch, { passive: true });
		return () => {
			root.removeEventListener("scroll", onScroll);
			for (const type of ["pointerdown", "touchstart", "wheel"]) root.removeEventListener(type, touch);
			window.clearTimeout(timer);
		};
	}, [lit]);
	const buttons = useRef<(HTMLElement | null)[]>([]);
	const current = shelf[lit] ?? shelf[0]!;

	// The line under the shelf stands under the lit tile's left edge, as its name does above it, and rides along as the
	// shelf scrolls; near the end it stops where it still fits.
	const lineRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const root = shelfRef.current;
		const line = lineRef.current;
		const box = line?.parentElement;
		if (!root || !line || !box) return;
		let frame = 0;
		const place = () => {
			frame = 0;
			const tile = buttons.current[lit]?.getBoundingClientRect();
			if (!tile) return;
			const b = box.getBoundingClientRect();
			const pad = Number.parseFloat(getComputedStyle(box).paddingLeft) || 0;
			const room = b.width - pad * 2 - line.offsetWidth;
			line.style.setProperty("--lit-x", `${Math.max(0, Math.min(tile.left - b.left - pad, room))}px`);
		};
		const queue = () => {
			if (!frame) frame = requestAnimationFrame(place);
		};
		place();
		root.addEventListener("scroll", queue, { passive: true });
		window.addEventListener("resize", queue);
		return () => {
			root.removeEventListener("scroll", queue);
			window.removeEventListener("resize", queue);
			cancelAnimationFrame(frame);
		};
	});

	function light(i: number) {
		const next = Math.max(0, Math.min(shelf.length - 1, i));
		setLit(next);
		const el = buttons.current[next];
		el?.focus({ preventScroll: true });
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
	}

	// The shelf opens at its start with the lit tile in view, ring and all (a shut Play lights Spelling), whatever scroll
	// position the browser kept from before.
	useEffect(() => {
		if (shelfRef.current) shelfRef.current.scrollLeft = 0;
		if (lit > 0) buttons.current[lit]?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
	}, []);

	// Arrows, Home and End move the light along the shelf from anywhere on the page, unless a field, a list or a sheet
	// has the keys. Enter or Space on the lit tile opens it, as a press does.
	// A key let go on this page arms Enter, so the Enter that picked them on "Who's playing?" can't also start a game.
	const armed = useRef(false);
	useEffect(() => {
		const arm = () => {
			armed.current = true;
		};
		window.addEventListener("keyup", arm);
		window.addEventListener("pointerdown", arm);
		return () => {
			window.removeEventListener("keyup", arm);
			window.removeEventListener("pointerdown", arm);
		};
	}, []);
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open]")) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest("input, textarea, select, [contenteditable], [role=slider], [role=listbox], [role=menu], [role=tablist]")) return;
			// Enter with nothing focused opens the lit tile, as the hint says.
			if (e.key === "Enter" && (t === document.body || t === null)) {
				if (e.repeat || !armed.current) return;
				e.preventDefault();
				if (current.go) current.go();
				else light(lit);
				return;
			}
			// The round buttons under the shelf are their own row: arrows there don't pull focus back up.
			if (t?.closest(".home-action")) return;
			const to =
				e.key === "Home" ? 0 : e.key === "End" ? shelf.length - 1 : e.key === "ArrowRight" ? lit + 1 : e.key === "ArrowLeft" ? lit - 1 : -1;
			if (to < 0 || to >= shelf.length) return;
			e.preventDefault();
			light(to);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const ready = play && !play.settings.free ? today.filter((q) => questCollectable(q, questState)).length : 0;
	const badges = useRef<HTMLDialogElement>(null);
	const quests = useRef<HTMLDialogElement>(null);
	const time = useRef<HTMLDialogElement>(null);
	// Where a shut Play sends the kid: the subject nearest the front of their shelf.
	const subject = shelf.find((t) => !GAMES.has(t.id));
	const timeCosts = !!play?.settings.timeCosts && !play.settings.free;
	const minutesLeft = play ? Math.ceil(play.time.secondsLeft / 60) : 0;
	// A quest card goes straight to its game, lit and remembered as a tile press would.
	const goQuest = (q: Quest) => {
		quests.current?.close();
		shelf.find((t) => t.id === tileOf(q))?.go?.();
	};

	return (
		<main className="grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-y-4 py-safe-5 short:gap-y-2 short:py-safe-3 md:py-safe-7 short:md:py-safe-3">
			<h1 className="sr-only">{child.name}’s games</h1>

			{/* Who's playing, and what they have: their sticker and name, then their stars and tickets as big numerals. */}
			<header className="flex items-center justify-between gap-4 px-safe-5 md:px-safe-12">
				<div className="flex min-w-0 items-center gap-3">
					<span aria-hidden className="shrink-0">
						<KidTile name={child.name} avatar={child.avatar} size={48} />
					</span>
					<span className="truncate font-display text-2xl font-semibold">{child.name}</span>
				</div>
				<dl className="flex shrink-0 items-center gap-5 font-display md:gap-7">
					<div className="flex items-center gap-2">
						<dt>
							<Star className="size-6 fill-silver text-silver-edge" aria-hidden />
							<span className="sr-only">Stars</span>
						</dt>
						<dd className={`text-2xl font-semibold tabular-nums md:text-3xl ${stars ? "" : "text-page-muted"}`}>{stars}</dd>
					</div>
					{play && !play.settings.free && (
						<div className="flex items-center gap-2">
							<dt>
								<Ticket className="size-6 text-roxy" aria-hidden />
								<span className="sr-only">Tickets</span>
							</dt>
							<dd className={`text-2xl font-semibold tabular-nums md:text-3xl ${play.wallet.tickets ? "" : "text-page-muted"}`}>
								{play.wallet.tickets}
							</dd>
						</div>
					)}
					{timeCosts && (
						<div className="flex items-center gap-2">
							<dt>
								<Clock className="size-6 text-page-muted" aria-hidden />
								<span className="sr-only">Play time left</span>
							</dt>
							<dd className={`text-2xl font-semibold tabular-nums md:text-3xl ${minutesLeft ? "" : "text-page-muted"}`}>
								{minutesLeft}
								<span className="ml-1 text-base font-medium text-page-muted md:text-lg">min</span>
							</dd>
						</div>
					)}
				</dl>
			</header>

			<section aria-label="Your games" className="flex min-w-0 flex-col justify-center gap-4">
				{/* The shelf: one row of big tiles, the one the kid played last first. One is lit at a time; the ring moves with
				    arrows, hover and focus, and a press goes. */}
				<ul ref={shelfRef} className="shelf" aria-label="Games, Spelling and Math">
					{shelf.map((t, i) => (
						<li key={t.id} className="shelf-slot">
							<span className="shelf-name" aria-hidden data-lit={i === lit || undefined}>
								{t.name}
							</span>
							<button
								ref={(el) => {
									buttons.current[i] = el;
								}}
								type="button"
								className="shelf-tile"
								data-lit={i === lit || undefined}
								data-locked={t.locked || undefined}
								data-nudge={nudged === i || undefined}
								aria-disabled={t.locked || undefined}
								onAnimationEnd={() => setNudged(null)}
								tabIndex={i === lit ? 0 : -1}
								aria-label={`${t.name}${t.count ? `, ${t.count} waiting` : ""}${t.quest ? ", a quest today" : ""}${t.locked ? (play?.shut ? ", opens after practice" : ", out of time") : ""}`}
								aria-describedby={t.locked ? "shelf-shut" : "shelf-line"}
								onFocus={() => setLit(i)}
								onPointerEnter={(e) => {
									// The pointer and the keyboard share one light: hovering a tile focuses it, so Enter opens what's lit.
									if (e.pointerType !== "mouse") return;
									setLit(i);
									buttons.current[i]?.focus({ preventScroll: true });
								}}
								onClick={() => {
									if (t.go) return t.go();
									// A shut game answers the press: it shakes, takes the light, and the line under the shelf offers the
									// way to practice.
									light(i);
									setNudged(i);
								}}
							>
								{t.art}
								{t.count ? (
									<span className="shelf-count" aria-hidden>
										{t.count > 99 ? "99+" : t.count}
									</span>
								) : null}
								{t.quest && (
									<span className="shelf-quest" aria-hidden>
										<Target className="size-4" />
									</span>
								)}
								{t.progress !== undefined && (
									<span className="shelf-progress" aria-hidden>
										<span style={{ width: `${Math.max(6, t.progress * 100)}%` }} />
									</span>
								)}
								{t.locked && (
									<span className="shelf-lock" aria-hidden>
										<Lock className="size-4" />
										{/* Every shut game shows its lock; only the lit one says why, so the shelf isn't a row of the same words. */}
										{i === lit && <span>{play?.shut ? "After practice" : "Out of time"}</span>}
									</span>
								)}
							</button>
						</li>
					))}
				</ul>

				{/* What the lit tile is: one line, and a fact when there is one. A shut game says what opens it instead. */}
				<div className="min-h-20 px-safe-5 short:min-h-0 md:px-safe-12">
					<div
						ref={lineRef}
						className="w-fit max-w-[min(44rem,100%)] space-y-3 transition-[translate] duration-300 ease-out-expo motion-reduce:transition-none"
						style={{ translate: "var(--lit-x, 0px) 0" }}
					>
						{!current.locked && (
							<p id="shelf-line" className="flex max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1">
								<span className="text-lg font-medium text-balance short:text-base">{current.line}</span>
								{current.stat && (
									<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-page-muted tabular-nums">
										{current.stat}
									</span>
								)}
							</p>
						)}
						{/* While games are shut it always says what opens them, whichever tile is lit; a lit game adds the way there. */}
						{locked && play && (
							<ClosedLine
								play={play}
								childId={child.id}
								go={
									current.locked &&
									subject?.go && (
										<button type="button" className="key" data-variant="go" onClick={subject.go}>
											Go to {subject.name}
										</button>
									)
								}
							/>
						)}
					</div>
				</div>
			</section>

			<footer className="flex flex-wrap items-end justify-between gap-6 px-safe-5 md:px-safe-12">
				<nav aria-label="More" className="flex items-start gap-5 md:gap-7">
					{play && (
						<button
							type="button"
							className="home-action"
							onClick={() => quests.current?.showModal()}
							aria-label={ready ? `Quests, ${ready} to collect` : undefined}
						>
							<span aria-hidden className="relative">
								<Target className="size-6" />
								{ready > 0 && <span className="home-action-count">{ready}</span>}
							</span>
							Quests
						</button>
					)}
					{progress && progress.badges.length > 0 && (
						<button type="button" className="home-action" onClick={() => badges.current?.showModal()}>
							<span aria-hidden>
								<Award className="size-6" />
							</span>
							Badges
						</button>
					)}
					{timeCosts && (
						<button type="button" className="home-action" onClick={() => time.current?.showModal()}>
							<span aria-hidden>
								<Clock className="size-6" />
							</span>
							More time
						</button>
					)}
					<Link to="/profiles" className="home-action" aria-label={`Who’s playing? Now ${child.name}`}>
						<span aria-hidden>
							<Users className="size-6" />
						</span>
						Who’s playing?
					</Link>
				</nav>
				<div className="flex items-center gap-8">
					<p className="hidden text-sm text-page-muted lg:[@media(pointer:fine)]:block" aria-hidden>
						<kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> choose · <kbd className="kbd">Enter</kbd> play
					</p>
					<p className="hidden text-sm text-page-muted md:[@media(pointer:coarse)]:block" aria-hidden>
						Swipe to look · tap a game to play
					</p>
					<Brand size={18} />
				</div>
			</footer>

			{progress && progress.badges.length > 0 && (
				<Sheet
					sheetRef={badges}
					title={
						<>
							Your badges{" "}
							<span className="text-base font-normal text-page-muted tabular-nums">
								· {earned} of {progress.badges.length}
							</span>
						</>
					}
				>
					{/* Their record of practice: every star ever earned (games never take from it) and the days in a row. */}
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
					<BadgeSheet badges={progress.badges} />
				</Sheet>
			)}
			{play && (
				<Sheet sheetRef={quests} title="Today’s quests">
					{locked && (
						<p className="mb-5 text-page-muted">
							{play.shut
								? "Games open after practice, then these are waiting."
								: "Out of play time for today. These are waiting for next time."}
						</p>
					)}
					<QuestBoard childId={child.id} status={play} heading={false} onGo={locked ? undefined : goQuest} />
				</Sheet>
			)}
			{timeCosts && play && (
				<Sheet sheetRef={time} title="More play time">
					<p className="mb-5 text-pretty">
						{minutesLeft > 0
							? `You have ${minutesLeft} ${minutesLeft === 1 ? "minute" : "minutes"} of play left today.`
							: "Your play time for today is used up."}{" "}
						<span className="text-page-muted">
							Every {TIME_BLOCK.stars} stars from Spelling and Math buy {TIME_BLOCK.minutes} more minutes.
						</span>
					</p>
					<MoreTime childId={child.id} status={play} />
				</Sheet>
			)}
		</main>
	);
}
