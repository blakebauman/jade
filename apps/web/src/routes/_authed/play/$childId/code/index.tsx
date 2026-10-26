import { CODE_SKILLS, type CodeSkill, SKILL_HINT, SKILL_LABEL, unitOpen } from "@jade/core/code";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Footprints, Hash, Lock, Play, Repeat, RotateCcw, Signpost, Tag, Wand } from "lucide-react";
import { useChild } from "#/lib/child.ts";
import { progressQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/code/")({
	loader: ({ context, params }) => context.queryClient.prefetchQuery(progressQuery(params.childId)),
	component: CodeHome,
});

const SKILL_ICON: Record<CodeSkill, typeof Play> = { seq: Footprints, args: Hash, loops: Repeat, vars: Tag, ifs: Signpost, funcs: Wand };

function CodeHome() {
	const child = useChild();
	const { data: progress } = useQuery(progressQuery(child.id));
	const levels = progress?.code?.levels ?? {};
	const due = progress?.code?.due ?? [];

	return (
		<main className="mx-auto min-h-dvh max-w-5xl px-safe-5 py-safe-6 md:px-safe-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Link to="/play/$childId" params={{ childId: child.id }} className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> Home
					</Link>
					<KidTile name={child.name} avatar={child.avatar} size={48} />
					<span className="font-display text-2xl font-medium">{child.name}</span>
				</div>
			</header>

			<h1 className="sr-only">Code</h1>

			{due.length > 0 && (
				<section className="sticker mt-10 flex flex-wrap items-center justify-between gap-5 p-6" data-place="code">
					<div>
						<h2 className="text-2xl font-semibold">
							{due.length} {due.length === 1 ? "puzzle wants" : "puzzles want"} another go
						</h2>
						<p>Puzzles that were tricky come back, in a new garden, until they stick.</p>
					</div>
					<Link
						to="/play/$childId/code/$topic"
						params={{ childId: child.id, topic: "codereview" }}
						onClick={() => speaker.unlock()}
						className="key"
						data-variant="go"
					>
						<RotateCcw className="size-5" aria-hidden /> Review
					</Link>
				</section>
			)}

			<section className="mt-12 space-y-5">
				<h2 className="text-3xl font-semibold">Code: pick a unit</h2>
				<p className="max-w-[60ch] text-page-muted">
					Write real Python to steer Tuck the turtle round the garden. Each unit opens when the one before reaches level 2.
				</p>
				<ul className="grid gap-5">
					{CODE_SKILLS.map((skill, i) => {
						const Icon = SKILL_ICON[skill];
						const open = unitOpen(skill, levels);
						const level = levels[skill] ?? 1;
						return (
							<li
								key={skill}
								className={`sticker flex flex-wrap items-center justify-between gap-4 p-4 md:px-6 ${open ? "" : "opacity-70 saturate-50"}`}
								data-place="code"
							>
								<div className="flex min-w-[13rem] flex-1 items-center gap-4">
									<span className="vinyl-disc size-13" aria-hidden>
										<Icon className="relative size-6" strokeWidth={2.4} />
									</span>
									<div className="min-w-0">
										<div className="flex items-center gap-x-3">
											<h3 className="font-display text-xl font-medium">
												{i + 1}. {SKILL_LABEL[skill]}
											</h3>
											{open && (
												<>
													<span aria-hidden className="inline-flex">
														<Pips box={level} />
													</span>
													<span className="sr-only">Level {level} of 5</span>
												</>
											)}
										</div>
										<p className="text-sm text-page-muted">
											{open ? SKILL_HINT[skill] : `Opens when ${SKILL_LABEL[CODE_SKILLS[i - 1]!]} reaches level 2`}
										</p>
									</div>
								</div>
								{open ? (
									<Link
										to="/play/$childId/code/$topic"
										params={{ childId: child.id, topic: skill }}
										onClick={() => speaker.unlock()}
										className="key ml-auto shrink-0 sm:min-w-[7rem]"
										data-variant="go"
									>
										<Play className="size-5" aria-hidden /> Play
									</Link>
								) : (
									<span className="ml-auto inline-flex items-center gap-2 font-display text-lg">
										<Lock className="size-5" aria-hidden /> Not yet
									</span>
								)}
							</li>
						);
					})}
				</ul>
			</section>
		</main>
	);
}
