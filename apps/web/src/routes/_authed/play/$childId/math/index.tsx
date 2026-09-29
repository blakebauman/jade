import { MATH_TOPICS, type MathTopic, TOPIC_LABEL, TOPIC_SKILLS } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips, Tile } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenText, Brain, ChartPie, Play, RotateCcw, X as Times } from "lucide-react";
import { useChild } from "#/lib/child.ts";
import { progressQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/math/")({
	loader: ({ context, params }) => context.queryClient.prefetchQuery(progressQuery(params.childId)),
	component: MathHome,
});

const TOPIC_ICON: Record<MathTopic, typeof Times> = { facts: Times, mental: Brain, fractions: ChartPie, problems: BookOpenText };
const TOPIC_HINT: Record<MathTopic, string> = {
	facts: "Times tables and division facts",
	mental: "Add, subtract, multiply in your head",
	fractions: "Fractions, decimals, comparing",
	problems: "Story problems, read aloud",
};

function MathHome() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const topics = MATH_TOPICS.filter((t) => child.settings.math.topics.includes(t));
	const levels = progress?.math.levels ?? {};
	const due = progress?.math.factsDue ?? [];

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 md:px-10">
			<header className="flex items-center justify-between gap-4">
				<Link
					to="/play/$childId"
					params={{ childId: child.id }}
					className="flex items-center gap-3 rounded-xl"
					aria-label="Back to subjects"
				>
					<KidTile name={child.name} avatar={child.avatar} size={48} />
					<span className="font-display text-2xl font-medium">{child.name}</span>
				</Link>
			</header>

			{due.length > 0 && (
				<section className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-felt-raised/70 p-6">
					<div className="flex items-center gap-5">
						<div className="flex -space-x-2" aria-hidden>
							{due.slice(0, 3).map((k, i) => (
								<Tile key={k} size={52} style={{ transform: `rotate(${(i - 1) * 7}deg)` }}>
									<span style={{ fontSize: 20 }}>
										{k
											.replace(/^m:(mul|div):/, "")
											.replace("x", "×")
											.replace("/", "÷")}
									</span>
								</Tile>
							))}
						</div>
						<div>
							<h2 className="text-2xl font-semibold">
								{due.length} {due.length === 1 ? "fact wants" : "facts want"} another go
							</h2>
							<p className="text-felt-muted">Facts you missed come back until they stick.</p>
						</div>
					</div>
					<Link
						to="/play/$childId/math/$topic"
						params={{ childId: child.id, topic: "mathreview" }}
						onClick={() => speaker.unlock()}
						className="key"
						data-variant="go"
					>
						<RotateCcw className="size-5" aria-hidden /> Review
					</Link>
				</section>
			)}

			<section className="mt-12 space-y-5">
				<h1 className="text-3xl font-semibold">Math: pick a topic</h1>
				<ul className="space-y-3">
					{topics.map((t) => {
						const Icon = TOPIC_ICON[t];
						const level = Math.min(...TOPIC_SKILLS[t].map((s) => levels[s] ?? 1));
						return (
							<li key={t} className="flex flex-wrap items-center justify-between gap-4 border-b border-felt-line/50 py-4">
								<div className="flex items-center gap-4">
									<Tile size={52} aria-hidden>
										<Icon className="size-6" strokeWidth={2.4} />
									</Tile>
									<div>
										<h2 className="font-display text-xl font-medium">{TOPIC_LABEL[t]}</h2>
										<p className="flex items-center gap-2 text-sm text-felt-muted">
											{TOPIC_HINT[t]} · <Pips box={level} /> <span className="sr-only">level {level} of 5</span>
										</p>
									</div>
								</div>
								<Link
									to="/play/$childId/math/$topic"
									params={{ childId: child.id, topic: t }}
									onClick={() => speaker.unlock()}
									className="key min-w-[7rem]"
									data-variant="go"
								>
									<Play className="size-5" aria-hidden /> Play
								</Link>
							</li>
						);
					})}
				</ul>
			</section>
		</main>
	);
}
