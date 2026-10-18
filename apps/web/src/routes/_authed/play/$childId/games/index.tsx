import { FINDS } from "@jade/core/roxy";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarHeart } from "lucide-react";
import { useId, useMemo } from "react";
import { MoreTime, PlayClosed, PlayWallet } from "#/components/play/PlayBits.tsx";
import { QuestBoard } from "#/components/play/QuestBoard.tsx";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { useChild } from "#/lib/child.ts";
import { playQuery } from "#/lib/play.ts";
import { roxyQuery, shownLook } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.prefetchQuery(roxyQuery(params.childId)),
			context.queryClient.prefetchQuery({ ...playQuery(params.childId), staleTime: 0 }),
		]),
	component: GamesHome,
});

function GamesHome() {
	const child = useChild();
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const { data: play, isLoading } = useQuery(playQuery(child.id));
	const holiday = roxy?.holidays[0];
	const best = useMemo(() => readBest(`jade.gobble.best.${child.id}`), [child.id]);
	const jellyBest = useMemo(() => readBest(`jade.jelly.best.${child.id}`), [child.id]);
	const roxyArt = (
		<span className="block w-20 shrink-0 overflow-hidden rounded-xl sm:w-28 md:w-32" aria-hidden>
			{roxy ? (
				<RoxyFigure look={shownLook(child.id, roxy)} className="block h-auto w-full" />
			) : (
				<span className="block aspect-[5/8] bg-page-deep/40" />
			)}
		</span>
	);

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center gap-3">
				<Link to="/play/$childId" params={{ childId: child.id }} className="key" data-variant="felt">
					<ArrowLeft className="size-5" aria-hidden /> Subjects
				</Link>
				<KidTile name={child.name} avatar={child.avatar} size={48} />
				<span className="font-display text-2xl font-medium">{child.name}</span>
			</header>

			<div className="mt-12 space-y-3">
				<h1 className="text-balance text-3xl font-semibold">What shall we play, {child.name}?</h1>
				{play?.open && <PlayWallet status={play} />}
			</div>

			{/* Until Play says it's open, and while it's shut, the games wait on the page as printed outlines, never vanish. */}
			{isLoading || (play && !play.open) ? (
				<div className="mt-8 space-y-8">
					{play && <PlayClosed childId={child.id} status={play} level="h2" />}
					<ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4" aria-label="Games waiting for you">
						<Waiting label="Roxy">
							{roxy && <RoxyFigure look={shownLook(child.id, roxy)} omit={["background"]} className="block h-24 w-auto sm:h-28" />}
						</Waiting>
						<Waiting label="Roxy’s town">
							<TownArt />
						</Waiting>
						<Waiting label="Gobble Town">
							<HoleArt />
						</Waiting>
						<Waiting label="Jelly Blocks">
							<JellyArt />
						</Waiting>
					</ul>
				</div>
			) : (
				<>
					{play && <QuestBoard childId={child.id} status={play} />}
					<div className="mt-10 space-y-12">
						<section className="space-y-5" aria-labelledby="roxy-world">
							<h2 id="roxy-world" className="text-2xl font-semibold">
								Roxy’s world
							</h2>
							<ul className="grid gap-6 md:grid-cols-2">
								<GameSticker
									to="/play/$childId/games/roxy"
									childId={child.id}
									tilt={-1.5}
									art={roxyArt}
									title="Roxy"
									about="Style your own character, then turn them into an animal with a magic gem."
								>
									{holiday && (
										<span className="foil px-3 py-1 text-sm font-semibold">
											<CalendarHeart className="size-4" aria-hidden /> {holiday.label} collection
										</span>
									)}
								</GameSticker>
								<GameSticker
									to="/play/$childId/games/roxy/town"
									childId={child.id}
									tilt={2}
									art={<TownArt />}
									title="Roxy’s town"
									about="Take Roxy and your pet to the park, the pet shop and school, and find what’s hidden."
								>
									{roxy && (
										<span className="text-sm font-semibold tabular-nums">
											{roxy.finds.length} of {FINDS.length} found
										</span>
									)}
								</GameSticker>
							</ul>
						</section>
						<section className="space-y-5" aria-labelledby="quick-games">
							<h2 id="quick-games" className="text-2xl font-semibold">
								Quick games
							</h2>
							<ul className="grid gap-6 md:grid-cols-2">
								<GameSticker
									to="/play/$childId/games/gobble"
									childId={child.id}
									tilt={1.5}
									art={<HoleArt />}
									title="Gobble Town"
									about="Be a hungry hole! Gobble flowers, then cars, then whole houses, and be the biggest in town."
								>
									{best > 0 && <span className="text-sm font-semibold tabular-nums">Your best: {best.toLocaleString()}</span>}
								</GameSticker>
								<GameSticker
									to="/play/$childId/games/jelly"
									childId={child.id}
									tilt={-2}
									art={<JellyArt />}
									title="Jelly Blocks"
									about="Turn and drop wobbly jelly blocks to fill whole rows. Fill a row and it pops!"
								>
									{jellyBest > 0 && <span className="text-sm font-semibold tabular-nums">Your best: {jellyBest.toLocaleString()}</span>}
								</GameSticker>
							</ul>
						</section>
						{/* Buying time comes after the games, so the page leads with what there is to play, not with spending. */}
						{play?.open && <MoreTime childId={child.id} status={play} />}
					</div>
				</>
			)}
		</main>
	);
}

type GamePath =
	| "/play/$childId/games/roxy"
	| "/play/$childId/games/roxy/town"
	| "/play/$childId/games/gobble"
	| "/play/$childId/games/jelly";

/**
 * One game as a berry sticker. The link is named by the game alone and described by its line and stat, so a screen
 * reader hears "Jelly Blocks" and then what it is, not the whole sticker run together.
 */
function GameSticker({
	to,
	childId,
	tilt,
	art,
	title,
	about,
	children,
}: {
	to: GamePath;
	childId: string;
	tilt: number;
	art: React.ReactNode;
	title: string;
	about: string;
	children?: React.ReactNode;
}) {
	const id = useId();
	return (
		<li className="flex">
			<Link
				to={to}
				params={{ childId }}
				className="sticker flex w-full items-center gap-4 p-4 sm:gap-5 sm:p-5 md:p-6"
				data-place="roxy"
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-about ${id}-more`}
				style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
			>
				{art}
				<span className="min-w-0 space-y-2">
					<h3 id={`${id}-title`} className="font-display text-2xl font-semibold sm:text-3xl">
						{title}
					</h3>
					<span id={`${id}-about`} className="block text-sm font-medium">
						{about}
					</span>
					<span id={`${id}-more`} className="flex flex-wrap items-center gap-2 empty:hidden">
						{children}
					</span>
				</span>
			</Link>
		</li>
	);
}

/** A game while Play is shut: its outline printed on the page, as a badge waits before it's earned. */
function Waiting({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<li className="flex flex-col items-center gap-2 text-center">
			<span aria-hidden className="slot silhouette size-28 sm:size-32 [&>svg:only-child]:size-20 sm:[&>svg:only-child]:size-24">
				{children}
			</span>
			<span className="text-sm font-medium leading-tight">
				{label}
				<span className="sr-only"> (waiting)</span>
			</span>
		</li>
	);
}

function readBest(key: string) {
	try {
		return Number(localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}

/** Every game's art is drawn on the same 120 square, a step smaller on a phone so the stickers stay short. */
const ART = "block size-20 shrink-0 sm:size-28 md:size-32";

/** Roxy's town's sticker art: a corner of the park on its toy board, with a find twinkling by the bench. */
function TownArt() {
	return (
		<svg viewBox="0 0 120 120" className={ART} aria-hidden="true">
			<ellipse cx="60" cy="86" rx="52" ry="22" fill="#b0784a" />
			<ellipse cx="60" cy="80" rx="52" ry="22" fill="#94c972" />
			<path d="M24 92 C 44 80, 70 82, 94 70" stroke="#efe2c4" strokeWidth="9" strokeLinecap="round" fill="none" />
			<rect x="20" y="44" width="34" height="30" rx="3" fill="#f6f1ff" />
			<path d="M15 47 L37 28 L59 47 Z" fill="#e0457b" />
			<rect x="31" y="58" width="11" height="16" rx="2" fill="#3d74c9" />
			<rect x="24" y="51" width="6" height="6" rx="1.5" fill="#bfe3f0" />
			<rect x="44" y="51" width="6" height="6" rx="1.5" fill="#bfe3f0" />
			<rect x="85" y="52" width="7" height="22" rx="2" fill="#8a5a3b" />
			<circle cx="88" cy="42" r="15" fill="#5fae5a" />
			<circle cx="78" cy="50" r="9" fill="#5fae5a" />
			<circle cx="99" cy="49" r="9" fill="#4f9a4b" />
			<rect x="60" y="74" width="20" height="5" rx="2" fill="#c9965a" />
			<rect x="62" y="79" width="3" height="6" fill="#8a5a3b" />
			<rect x="75" y="79" width="3" height="6" fill="#8a5a3b" />
			<path d="M100 76 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill="#f6f1ff" />
		</svg>
	);
}

/** Jelly Blocks' sticker art: a little stack of jelly cubes with a T piece dropping in. */
function JellyArt() {
	const cube = (x: number, y: number, fill: string) => (
		<g key={`${x}-${y}`}>
			<rect x={x} y={y} width="19" height="19" rx="6" fill={fill} />
			<rect x={x + 4} y={y + 3} width="8" height="4" rx="2" fill="#fff" opacity="0.5" />
		</g>
	);
	return (
		<svg viewBox="0 0 120 120" className={ART} aria-hidden="true">
			<rect x="10" y="100" width="100" height="8" rx="4" fill="#e48bb0" />
			{cube(14, 80, "#ff5f8f")}
			{cube(34, 80, "#ff5f8f")}
			{cube(54, 80, "#4f7dff")}
			{cube(74, 80, "#2fcfc0")}
			{cube(94, 80, "#2fcfc0")}
			{cube(14, 60, "#ffd24d")}
			{cube(34, 60, "#ffd24d")}
			{cube(94, 60, "#8cd648")}
			{cube(54, 20, "#9a6bff")}
			{cube(34, 40, "#9a6bff")}
			{cube(54, 40, "#9a6bff")}
			{cube(74, 40, "#9a6bff")}
		</svg>
	);
}

/** Gobble Town's sticker art: a hole in the ground with a little car tipping in. */
function HoleArt() {
	return (
		<svg viewBox="0 0 120 120" className={ART} aria-hidden="true">
			<ellipse cx="60" cy="74" rx="50" ry="26" fill="#94c972" />
			<ellipse cx="60" cy="74" rx="34" ry="16" fill="#e0457b" />
			<ellipse cx="60" cy="75" rx="31" ry="14" fill="#1c1024" />
			<g transform="rotate(28 66 64)">
				<rect x="50" y="52" width="32" height="13" rx="5" fill="#3d74c9" />
				<rect x="56" y="44" width="18" height="11" rx="4" fill="#6d9be0" />
				<rect x="59" y="46" width="12" height="6" rx="2" fill="#bfe3f0" />
				<circle cx="57" cy="66" r="4" fill="#3a3d48" />
				<circle cx="75" cy="66" r="4" fill="#3a3d48" />
			</g>
			<circle cx="28" cy="66" r="4" fill="#f2c94c" />
			<circle cx="92" cy="80" r="4" fill="#f6f1ff" />
		</svg>
	);
}
