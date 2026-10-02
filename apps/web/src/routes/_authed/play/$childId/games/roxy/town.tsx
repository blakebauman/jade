import { FINDS, PLACE_INFO, PLACES } from "@jade/core/roxy";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, PawPrint, Trees } from "lucide-react";
import { useChild } from "#/lib/child.ts";
import { roxyQuery } from "#/lib/roxy.ts";

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/town")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: Town,
});

const ICON = { park: Trees, petshop: PawPrint, school: BookOpen } as const;

/** Roxy's town: the places she can go, and how much is still hidden in each. */
function Town() {
	const child = useChild();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	const found = new Set(data.finds);
	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center gap-3">
				<Link to="/play/$childId/games" params={{ childId: child.id }} className="key" data-variant="felt">
					<ArrowLeft className="size-5" aria-hidden /> Games
				</Link>
				<h1 className="font-display text-3xl font-semibold">Town</h1>
				<span className="foil px-3 py-1 text-sm">
					{data.finds.length} of {FINDS.length} found
				</span>
			</header>
			<ul className="mt-8 grid gap-6 md:grid-cols-3">
				{PLACES.map((id, i) => {
					const place = PLACE_INFO[id];
					const Icon = ICON[id];
					const finds = FINDS.filter((f) => f.place === id);
					const got = finds.filter((f) => found.has(f.id)).length;
					return (
						<li key={id}>
							<Link
								to="/play/$childId/games/roxy/place/$placeId"
								params={{ childId: child.id, placeId: id }}
								className="sticker flex h-full flex-col gap-4 p-5"
								data-place="roxy"
								style={{ "--tilt": `${(i - 1) * 1.5}deg` } as React.CSSProperties}
							>
								<Icon className="size-10" aria-hidden />
								<span className="block font-display text-2xl font-semibold">{place.label}</span>
								<span className="block text-sm font-medium">{place.note}</span>
								<span className="mt-auto text-sm font-medium">
									{got === finds.length ? "Everything found!" : `${got} of ${finds.length} found`}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</main>
	);
}
