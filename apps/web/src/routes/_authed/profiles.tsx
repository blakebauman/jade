import { KidTile } from "@jade/ui/components/kid-tile";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { Brand } from "#/components/Brand.tsx";
import { childrenQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/profiles")({
	loader: ({ context }) => context.queryClient.ensureQueryData(childrenQuery),
	component: Profiles,
});

function Profiles() {
	const { data: kids } = useSuspenseQuery(childrenQuery);
	return (
		<main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-safe-5 py-safe-8 md:px-safe-10">
			<header className="flex items-center justify-between">
				<Brand size={30} />
				<Link to="/parent" className="key" data-variant="felt">
					<Settings2 className="size-5" aria-hidden /> Parents
				</Link>
			</header>
			<section className="grid flex-1 content-center gap-10 py-10">
				<h1 className="text-center text-4xl font-semibold md:text-5xl">Who’s practicing?</h1>
				{kids.length === 0 ? (
					<div className="mx-auto max-w-sm space-y-5 text-center">
						<p className="text-page-muted">No kids yet. A parent adds each child and their word lists first.</p>
						<Link to="/parent/kids" className="key" data-variant="go">
							Add a child
						</Link>
					</div>
				) : (
					<ul className="flex flex-wrap justify-center gap-8 md:gap-12">
						{kids.map((k, i) => (
							<li key={k.id}>
								{/* Each kid's album: a name sticker on the cover, their tile and their name. */}
								<Link
									to="/play/$childId"
									params={{ childId: k.id }}
									onClick={() => speaker.unlock()}
									className="sticker flex w-44 flex-col items-center gap-3 px-4 pt-6 pb-4 md:w-52"
									style={{ "--tilt": `${i % 2 ? 2.5 : -2.5}deg` } as React.CSSProperties}
								>
									<KidTile name={k.name} avatar={k.avatar} size={104} />
									<span className="font-display text-2xl font-medium text-page-ink">{k.name}</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
