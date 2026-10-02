import { KidTile } from "@jade/ui/components/kid-tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarHeart } from "lucide-react";
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

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
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
						className="rack flex items-center gap-5 !p-5 transition-[filter,transform] hover:brightness-105 active:translate-y-px md:!p-6"
					>
						<span className="block w-28 shrink-0 overflow-hidden rounded-xl md:w-32" aria-hidden>
							{roxy ? (
								<RoxyFigure look={shownLook(child.id, roxy)} className="block h-auto w-full" />
							) : (
								<span className="block aspect-[5/8] bg-felt-deep" />
							)}
						</span>
						<span className="min-w-0 space-y-2">
							<span className="block font-display text-3xl font-semibold text-ink">Roxy</span>
							<span className="block text-sm font-medium text-ink">
								Style your own character, then turn them into an animal with a magic gem.
							</span>
							{holiday && (
								<span className="plaque gap-1.5 px-3 py-1 text-sm">
									<CalendarHeart className="size-4" aria-hidden /> {holiday.label} collection
								</span>
							)}
						</span>
					</Link>
				</li>
			</ul>
		</main>
	);
}
