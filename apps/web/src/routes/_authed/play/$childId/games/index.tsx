import { FINDS } from "@jade/core/roxy";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarHeart, MapPinned } from "lucide-react";
import { useMemo } from "react";
import { RoxyFigure } from "#/components/roxy/RoxyFigure.tsx";
import { useChild } from "#/lib/child.ts";
import { roxyQuery, shownLook } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/")({
	loader: ({ context, params }) => context.queryClient.prefetchQuery(roxyQuery(params.childId)),
	component: GamesHome,
});

function GamesHome() {
	const child = useChild();
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const holiday = roxy?.holidays[0];
	const best = useMemo(() => {
		try {
			return Number(localStorage.getItem(`jade.gobble.best.${child.id}`)) || 0;
		} catch {
			return 0;
		}
	}, [child.id]);

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center gap-3">
				<Link to="/play/$childId" params={{ childId: child.id }} className="key" data-variant="felt">
					<ArrowLeft className="size-5" aria-hidden /> Subjects
				</Link>
				<KidTile name={child.name} avatar={child.avatar} size={48} />
				<span className="font-display text-2xl font-medium">{child.name}</span>
			</header>

			<h1 className="mt-12 text-3xl font-semibold">Games</h1>
			<ul className="mt-5 grid gap-6 md:grid-cols-2">
				<li>
					<Link
						to="/play/$childId/games/roxy"
						params={{ childId: child.id }}
						className="sticker flex items-center gap-5 p-5 md:p-6"
						data-place="roxy"
						style={{ "--tilt": "-1.5deg" } as React.CSSProperties}
					>
						<span className="block w-28 shrink-0 overflow-hidden rounded-xl md:w-32" aria-hidden>
							{roxy ? (
								<RoxyFigure look={shownLook(child.id, roxy)} className="block h-auto w-full" />
							) : (
								<span className="block aspect-[5/8] bg-page-deep/40" />
							)}
						</span>
						<span className="min-w-0 space-y-2">
							<span className="block font-display text-3xl font-semibold">Roxy</span>
							<span className="block text-sm font-medium">Style your own character, then turn them into an animal with a magic gem.</span>
							{holiday && (
								<span className="foil gap-1.5 px-3 py-1 text-sm">
									<CalendarHeart className="size-4" aria-hidden /> {holiday.label} collection
								</span>
							)}
						</span>
					</Link>
				</li>
				<li>
					<Link
						to="/play/$childId/games/roxy/town"
						params={{ childId: child.id }}
						className="sticker flex items-center gap-5 p-5 md:p-6"
						data-place="roxy"
						style={{ "--tilt": "1.5deg" } as React.CSSProperties}
					>
						<span className="grid size-28 shrink-0 place-items-center rounded-xl bg-page-deep/20 md:size-32" aria-hidden>
							<MapPinned className="size-14" />
						</span>
						<span className="min-w-0 space-y-2">
							<span className="block font-display text-3xl font-semibold">Town</span>
							<span className="block text-sm font-medium">
								Take Roxy and your pet to the park, the pet shop and school, and find what’s hidden.
							</span>
							{roxy && (
								<span className="foil gap-1.5 px-3 py-1 text-sm">
									{roxy.finds.length} of {FINDS.length} found
								</span>
							)}
						</span>
					</Link>
				</li>
				<li>
					<Link
						to="/play/$childId/games/gobble"
						params={{ childId: child.id }}
						className="sticker flex items-center gap-5 p-5 md:p-6"
						data-place="roxy"
						style={{ "--tilt": "-1deg" } as React.CSSProperties}
					>
						<span className="grid size-28 shrink-0 place-items-center rounded-xl bg-page-deep/20 md:size-32" aria-hidden>
							<HoleArt />
						</span>
						<span className="min-w-0 space-y-2">
							<span className="block font-display text-3xl font-semibold">Gobble Town</span>
							<span className="block text-sm font-medium">
								Be a hungry hole! Gobble flowers, then cars, then whole houses, and be the biggest in town.
							</span>
							{best > 0 && <span className="block text-sm font-semibold">Your best: {best}</span>}
						</span>
					</Link>
				</li>
			</ul>
		</main>
	);
}

/** Gobble Town's sticker art: a hole in the ground with a little car tipping in. */
function HoleArt() {
	return (
		<svg viewBox="0 0 120 120" className="size-24 md:size-28" aria-hidden="true">
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
