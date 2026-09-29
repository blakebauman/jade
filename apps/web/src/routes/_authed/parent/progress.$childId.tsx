import { MATH_SKILLS } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips, WordTiles } from "@jade/ui/components/tile";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { api, type Progress } from "#/lib/api.ts";
import { progressQuery } from "#/lib/queries.ts";

export const Route = createFileRoute("/_authed/parent/progress/$childId")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(progressQuery(params.childId)),
	component: ProgressPage,
});

const MODE_LABEL = {
	bee: "Spelling · Bee",
	learn: "Spelling · Learn",
	tiles: "Spelling · Tiles",
	review: "Spelling · Review",
	facts: "Math · Times tables",
	mental: "Math · Mental",
	fractions: "Math · Fractions",
	problems: "Math · Word problems",
	mathreview: "Math · Review",
} as const;

function ProgressPage() {
	const { childId } = Route.useParams();
	const { data: p } = useSuspenseQuery(progressQuery(childId));
	const facts = [
		{ label: "day streak", value: p.stats.currentStreak, note: `best ${p.stats.bestStreak}` },
		{ label: "right answers", value: p.stats.wordsSpelled },
		{ label: "words mastered", value: p.mastered, note: "4+ pips" },
		{ label: "facts mastered", value: p.math.factsMastered, note: "4+ pips" },
		{ label: "stars", value: p.stats.totalStars },
	];
	return (
		<div className="space-y-12">
			<header className="flex items-center gap-4">
				<KidTile name={p.child.name} avatar={p.child.avatar} size={64} />
				<h1 className="text-4xl font-semibold">{p.child.name}’s progress</h1>
			</header>

			<dl className="flex flex-wrap gap-x-12 gap-y-6">
				{facts.map((f) => (
					<div key={f.label}>
						<dt className="text-sm text-felt-muted">{f.label}</dt>
						<dd className="font-display text-4xl font-semibold tabular-nums">
							{f.value}
							{f.note && <span className="ml-2 font-body text-sm font-normal text-felt-muted">{f.note}</span>}
						</dd>
					</div>
				))}
			</dl>

			<div className="grid gap-12 lg:grid-cols-2">
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Trouble words</h2>
					{p.trouble.length === 0 ? (
						<p className="text-felt-muted">No misses yet. Words that get missed show up here with how often.</p>
					) : (
						<ul className="space-y-3">
							{p.trouble.map((t) => (
								<li key={t.word} className="flex flex-wrap items-center gap-4">
									<WordTiles word={t.word} size={26} />
									<span className="text-sm text-felt-muted tabular-nums">missed {t.misses}×</span>
									<Pips box={t.box} />
								</li>
							))}
						</ul>
					)}
					{p.reviewDue.length > 0 && (
						<p className="text-sm text-felt-muted">
							{p.reviewDue.length} {p.reviewDue.length === 1 ? "word is" : "words are"} due for review today.
						</p>
					)}
				</section>

				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Recent rounds</h2>
					{p.recent.length === 0 ? (
						<p className="text-felt-muted">No rounds yet.</p>
					) : (
						<table className="w-full text-left text-sm">
							<thead className="text-felt-muted">
								<tr>
									<th className="py-2 font-normal">When</th>
									<th className="py-2 font-normal">Mode</th>
									<th className="py-2 text-right font-normal">Score</th>
									<th className="py-2 text-right font-normal">Stars</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-felt-line/60">
								{p.recent.map((r) => (
									<tr key={r.id}>
										<td className="py-2.5">
											{new Date(r.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
										</td>
										<td className="py-2.5">{MODE_LABEL[r.mode]}</td>
										<td className="py-2.5 text-right tabular-nums">
											{r.correct}/{r.total}
										</td>
										<td className="py-2.5 text-right">
											<span className="inline-flex gap-0.5" role="img" aria-label={`${r.stars} of 3 stars`}>
												{[1, 2, 3].map((i) => (
													<Star key={i} aria-hidden className={i <= r.stars ? "size-4 fill-maple text-maple" : "size-4 text-felt-line"} />
												))}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			</div>

			<MathProgress childId={childId} math={p.math} />

			<section className="space-y-4">
				<h2 className="text-2xl font-semibold">Badges</h2>
				<ul className="flex flex-wrap gap-3">
					{p.badges.map((b) => (
						<li
							key={b.id}
							className={
								b.earned
									? "plaque px-4 py-2 text-sm"
									: "flex items-center gap-2 rounded-[0.7rem] px-4 py-2 text-sm text-felt-muted ring-1 ring-felt-muted/50 ring-inset"
							}
						>
							<BadgeIcon icon={b.icon} className="size-4" />
							{b.label}
							<span className="sr-only">{b.earned ? "(earned)" : "(not yet)"}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}

const SKILL_LABEL: Record<string, string> = {
	mul: "Times tables",
	div: "Division facts",
	addsub: "Add & subtract",
	mixed: "Mixed & multi-step",
	fractions: "Fractions",
	decimals: "Decimals",
	problems: "Word problems",
};

const factLabel = (key: string) =>
	key
		.replace(/^m:(mul|div):/, "")
		.replace("x", " × ")
		.replace("/", " ÷ ");

/** Math: adaptive level per skill (parents can nudge it), the times-table grid, and facts that keep slipping. */
function MathProgress({ childId, math }: { childId: string; math: Progress["math"] }) {
	const qc = useQueryClient();
	const setLevel = useMutation({
		mutationFn: (v: { skill: string; level: number }) => api(`/api/children/${childId}/math-level`, { method: "PUT", json: v }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", childId] }),
	});
	const box = (a: number, b: number) => math.factBoxes[`m:mul:${Math.min(a, b)}x${Math.max(a, b)}`] ?? 0;
	return (
		<section className="space-y-8">
			<h2 className="text-2xl font-semibold">Math</h2>
			<div className="grid gap-12 lg:grid-cols-2">
				<div className="space-y-3">
					<h3 className="text-lg font-semibold">Levels</h3>
					<p className="text-sm text-felt-muted">
						Levels adjust on their own from accuracy and pace. Change one if it feels too easy or too hard.
					</p>
					<ul className="space-y-2">
						{MATH_SKILLS.map((skill) => {
							const level = math.levels[skill] ?? 1;
							return (
								<li key={skill} className="flex items-center justify-between gap-4">
									<span className="flex items-center gap-3">
										<Pips box={level} />
										<span>{SKILL_LABEL[skill]}</span>
									</span>
									<label className="flex items-center gap-2 text-sm text-felt-muted">
										<span className="sr-only">{SKILL_LABEL[skill]} level</span>
										<select
											className="field !min-h-10 !w-32 !py-1.5"
											value={level}
											onChange={(e) => setLevel.mutate({ skill, level: Number(e.target.value) })}
										>
											{[1, 2, 3, 4, 5].map((l) => (
												<option key={l} value={l}>
													Level {l}
												</option>
											))}
										</select>
									</label>
								</li>
							);
						})}
					</ul>
				</div>
				<div className="space-y-3">
					<h3 className="text-lg font-semibold">Times-table grid</h3>
					<p className="text-sm text-felt-muted">
						Brighter squares are facts mastered. {math.factsMastered} {math.factsMastered === 1 ? "fact" : "facts"} at 4+ pips.
					</p>
					<table className="border-separate border-spacing-[3px] text-xs tabular-nums">
						<thead>
							<tr>
								<th className="w-6 text-felt-muted font-normal" aria-label="times">
									×
								</th>
								{Array.from({ length: 12 }, (_, i) => (
									<th key={i} className="w-6 font-normal text-felt-muted">
										{i + 1}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{Array.from({ length: 12 }, (_, r) => (
								<tr key={r}>
									<th className="font-normal text-felt-muted">{r + 1}</th>
									{Array.from({ length: 12 }, (_, c) => {
										const b = box(r + 1, c + 1);
										return (
											<td key={c} className="p-0">
												<span
													className={`block size-6 rounded-[4px] ${b === 0 ? "bg-felt-deep/70" : "bg-maple"}`}
													style={b === 0 ? undefined : { opacity: 0.25 + b * 0.15 }}
													title={`${r + 1} × ${c + 1}: ${b === 0 ? "not practiced" : `${b} of 5`}`}
												/>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
					{math.trouble.length > 0 && (
						<p className="text-sm">
							<span className="text-felt-muted">Tricky facts: </span>
							{math.trouble
								.slice(0, 8)
								.map((t) => factLabel(t.word))
								.join(", ")}
						</p>
					)}
				</div>
			</div>
		</section>
	);
}
