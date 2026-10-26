import { gradeAttempt } from "@jade/core";
import { SKILL_LABEL as CODE_LABEL, CODE_SKILLS, type CodeSkill, puzzleTitle, unitOpen } from "@jade/core/code";
import { MATH_SKILLS } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Pips } from "@jade/ui/components/tile";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ListPlus, Star } from "lucide-react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { Problem } from "#/components/Problem.tsx";
import { WordRack } from "#/components/WordRack.tsx";
import { api, failure, type Progress, type WordList } from "#/lib/api.ts";
import { listsQuery, progressQuery } from "#/lib/queries.ts";

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
	seq: "Code · Steps",
	args: "Code · Numbers",
	loops: "Code · Loops",
	vars: "Code · Names",
	ifs: "Code · Choices",
	funcs: "Code · Recipes",
	codereview: "Code · Review",
} as const;

const Underline = ({ law, children }: { law: string; children: string }) => (
	<span className={`underline decoration-[3px] underline-offset-4 text-page-ink ${law}`}>{children}</span>
);

const LAW_LINE = { wrong: "decoration-coral", extra: "decoration-stone" } as const;

/**
 * A wrong spelling as the kid typed it, every miss marked by the colour laws on an underline (the ink stays dark): coral
 * a wrong letter, stone an extra one, and a sky-underlined gap where one was left out.
 */
function Misspelt({ word, typed }: { word: string; typed: string }) {
	return (
		<span className="font-display text-lg tracking-wide" role="img" aria-label={`“${typed}”`}>
			{gradeAttempt(word, typed).letters.map((m, i) =>
				m.mark === "missing" ? (
					<span key={`m${i}`} aria-hidden className="mx-px inline-block w-[0.55em] border-b-[3px] border-sky" />
				) : (
					<span
						key={`t${i}`}
						aria-hidden
						className={m.mark === "ok" ? undefined : `underline decoration-[3px] underline-offset-4 ${LAW_LINE[m.mark]}`}
					>
						{m.typed}
					</span>
				),
			)}
		</span>
	);
}

function ProgressPage() {
	const { childId } = Route.useParams();
	const { data: p } = useSuspenseQuery(progressQuery(childId));
	const qc = useQueryClient();
	const navigate = useNavigate();
	const name = p.child.name;
	const played = p.recent.length > 0 || p.stats.wordsSpelled > 0;
	// List names for recent rounds; offline or still loading, rounds just show their mode.
	const { data: lists } = useQuery(listsQuery);
	const listName = (id: string | null) => (id ? lists?.find((l) => l.id === id)?.name : undefined);
	/** Trouble words become a list of their own, to practice tonight or trim first. */
	const makeList = useMutation({
		mutationFn: () =>
			api<WordList>("/api/lists", {
				method: "POST",
				json: {
					name: `${name}’s trouble words`,
					grade: p.child.grade,
					source: "paste",
					words: p.trouble.map((t) => ({ word: t.word })),
				},
			}),
		onSuccess: (list) => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			navigate({ to: "/parent/lists/$listId", params: { listId: list.id } });
		},
	});
	const facts = [
		{ label: "day streak", value: p.stats.currentStreak, note: `best ${p.stats.bestStreak}` },
		{ label: "right answers", value: p.stats.wordsSpelled, note: "words and problems" },
		{ label: "words mastered", value: p.mastered },
		{ label: "facts mastered", value: p.math.factsMastered },
		{ label: "stars", value: p.stats.totalStars },
	];
	return (
		<div className="space-y-12">
			<header className="space-y-5">
				<Link to="/parent/kids" className="key" data-variant="felt">
					<ArrowLeft className="size-5" aria-hidden /> Kids
				</Link>
				<div className="flex items-center gap-4">
					<KidTile name={name} avatar={p.child.avatar} size={64} />
					<h1 className="text-4xl font-semibold break-words">{name}’s progress</h1>
				</div>
				{played ? (
					<dl className="flex flex-wrap gap-x-6 gap-y-2 text-page-muted">
						{facts.map((f) => (
							<div key={f.label} className="flex items-baseline gap-1.5">
								<dd className="order-first font-display text-xl font-semibold text-page-ink tabular-nums">{f.value}</dd>
								<dt>
									{f.label}
									{f.note && <span className="text-sm"> ({f.note})</span>}
								</dt>
							</div>
						))}
					</dl>
				) : (
					<p className="patch max-w-prose p-5">
						{name} hasn’t played a round yet. Trouble words, streaks and the times-table grid fill in here as they practice. You can set a
						starting math level below if you know where they are.
					</p>
				)}
			</header>

			{played && (
				<div className="grid gap-12 lg:grid-cols-2">
					<section className="space-y-4" aria-labelledby="spelling-heading">
						<h2 id="spelling-heading" className="text-2xl font-semibold">
							Spelling
						</h2>
						<h3 className="text-lg font-semibold">Trouble words</h3>
						{p.trouble.some((t) => t.misspelt?.length) && (
							<p className="text-sm text-page-muted">
								Under each, how {name} spelled it lately: <Underline law="decoration-coral">a wrong letter</Underline>,{" "}
								<Underline law="decoration-stone">an extra one</Underline>,{" "}
								<span className="inline-block w-[1.1em] border-b-[3px] border-sky" /> a missing one.
							</p>
						)}
						{p.trouble.length === 0 ? (
							<p className="text-page-muted">No misses yet. Words that get missed show up here with how often.</p>
						) : (
							<>
								<ul className="space-y-3">
									{p.trouble.map((t) => (
										<li key={t.word} className="space-y-1.5">
											<div className="flex flex-wrap items-center gap-4">
												<WordRack word={t.word} max={26} />
												<span className="text-sm text-page-muted tabular-nums">missed {t.misses}×</span>
												<Pips box={t.box} />
											</div>
											{t.misspelt && t.misspelt.length > 0 && (
												<p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
													<span className="text-sm text-page-muted">Spelled</span>
													{t.misspelt.map((typed) => (
														<Misspelt key={typed} word={t.word} typed={typed} />
													))}
												</p>
											)}
										</li>
									))}
								</ul>
								<div className="space-y-2">
									<button type="button" className="key" data-variant="felt" disabled={makeList.isPending} onClick={() => makeList.mutate()}>
										<ListPlus className="size-5" aria-hidden /> {makeList.isPending ? "Making the list…" : "Make a list from these"}
									</button>
									{makeList.isError && <Problem>{failure(makeList.error, "make the list")}</Problem>}
								</div>
							</>
						)}
						{p.reviewDue.length > 0 && (
							<p className="text-sm text-page-muted">
								{p.reviewDue.length} {p.reviewDue.length === 1 ? "word is" : "words are"} due for review today.
							</p>
						)}
					</section>

					<section className="space-y-4" aria-labelledby="recent-heading">
						<h2 id="recent-heading" className="text-2xl font-semibold">
							Recent rounds
						</h2>
						<ul className="divide-y divide-page-line/60 text-sm">
							{p.recent.map((r) => (
								<li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
									<span className="min-w-0">
										<span className="block">
											{MODE_LABEL[r.mode]}
											{listName(r.listId) && <span className="text-page-muted"> · {listName(r.listId)}</span>}
										</span>
										<span className="block text-page-muted">
											{new Date(r.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
										</span>
									</span>
									<span className="flex items-center gap-4">
										<span className="tabular-nums">
											{r.correct}/{r.total} <span className="sr-only">right</span>
										</span>
										<span className="inline-flex gap-0.5" role="img" aria-label={`${r.stars} of 3 stars`}>
											{[1, 2, 3].map((i) => (
												<Star key={i} aria-hidden className={i <= r.stars ? "size-4 fill-maple text-maple" : "size-4 text-page-line"} />
											))}
										</span>
									</span>
								</li>
							))}
						</ul>
					</section>
				</div>
			)}

			<MathProgress childId={childId} math={p.math} played={played} />

			<CodeProgress childId={childId} name={name} code={p.code} />

			{played && (
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Badges</h2>
					<ul className="flex flex-wrap gap-3">
						{p.badges.map((b) => (
							<li
								key={b.id}
								className={
									b.earned
										? "word-sticker text-sm"
										: "flex items-center gap-2 rounded-[0.7rem] px-4 py-2 text-sm text-page-muted ring-1 ring-page-muted/50 ring-inset"
								}
							>
								<BadgeIcon icon={b.icon} className="size-4" />
								{b.label}
								<span className="sr-only">{b.earned ? "(earned)" : "(not yet)"}</span>
							</li>
						))}
					</ul>
				</section>
			)}
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
		.replace("x", "×")
		.replace("/", "÷");

/** Grid ramp in chalk, the same colour as filled mastery pips: recessed felt when unpracticed, brighter per box. */
const gridShade = (box: number) =>
	box === 0 ? "var(--color-page-pit)" : `color-mix(in oklab, var(--color-page-ink) ${12 + box * 17}%, var(--color-page-raised))`;

/** Math: adaptive level per skill (parents can nudge it), the times-table grid, and facts that keep slipping. */
function MathProgress({ childId, math, played }: { childId: string; math: Progress["math"]; played: boolean }) {
	const box = (a: number, b: number) => math.factBoxes[`m:mul:${Math.min(a, b)}x${Math.max(a, b)}`] ?? 0;
	const practised = Object.keys(math.factBoxes).some((k) => k.startsWith("m:mul:"));
	// What the grid shows, in words: which tables are all mastered, and how many facts are on their way.
	const masteredTables = Array.from({ length: 12 }, (_, i) => i + 1).filter((a) =>
		Array.from({ length: 12 }, (_, j) => j + 1).every((b) => box(a, b) >= 4),
	);
	const inProgress = Object.entries(math.factBoxes).filter(([k, b]) => k.startsWith("m:mul:") && b > 0 && b < 4).length;
	return (
		<section className="space-y-8">
			<h2 className="text-2xl font-semibold">Math</h2>
			<div className="grid gap-12 lg:grid-cols-2">
				<div className="space-y-3">
					<div className="flex flex-wrap items-baseline justify-between gap-3">
						<h3 className="text-lg font-semibold">Levels</h3>
						<Link
							to="/parent/kids"
							search={{ edit: childId }}
							className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-page-ink"
						>
							Change in Kids
						</Link>
					</div>
					<p className="text-sm text-page-muted">Levels move on their own from accuracy and pace.</p>
					<ul className="space-y-2">
						{MATH_SKILLS.map((skill) => {
							const level = math.levels[skill] ?? 1;
							return (
								<li key={skill} className="flex items-center justify-between gap-4">
									<span>{SKILL_LABEL[skill]}</span>
									<span className="text-sm text-page-muted tabular-nums">level {level} of 5</span>
								</li>
							);
						})}
					</ul>
				</div>
				{played && practised && (
					<div className="space-y-3">
						<h3 className="text-lg font-semibold">Times-table grid</h3>
						<p className="text-sm text-page-muted">
							Brighter squares are closer to mastered. {math.factsMastered} {math.factsMastered === 1 ? "fact" : "facts"} at 4+ pips.
						</p>
						<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-page-muted" aria-hidden>
							{[0, 1, 2, 3, 4, 5].map((b) => (
								<span key={b} className="inline-flex items-center gap-1.5">
									<span className="block size-3.5 rounded-[3px]" style={{ background: gridShade(b) }} />
									{b === 0 ? "Not yet" : b}
								</span>
							))}
						</p>
						<p className="sr-only">
							{masteredTables.length > 0 ? `Mastered: the ${masteredTables.join(", ")} times tables. ` : "No whole table mastered yet. "}
							{inProgress} {inProgress === 1 ? "fact is" : "facts are"} on the way.
						</p>
						<table className="border-separate border-spacing-[3px] text-xs tabular-nums" aria-hidden>
							<thead>
								<tr>
									<th className="w-6 text-page-muted font-normal" aria-label="times">
										×
									</th>
									{Array.from({ length: 12 }, (_, i) => (
										<th key={i} className="w-6 font-normal text-page-muted">
											{i + 1}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{Array.from({ length: 12 }, (_, r) => (
									<tr key={r}>
										<th className="font-normal text-page-muted">{r + 1}</th>
										{Array.from({ length: 12 }, (_, c) => {
											const b = box(r + 1, c + 1);
											return (
												<td key={c} className="p-0">
													<span
														className={`block size-6 rounded-[4px] ${b === 0 ? "inset-shadow-recess" : ""}`}
														style={{ background: gridShade(b) }}
														title={`${r + 1} × ${c + 1}: ${b === 0 ? "not practiced yet" : `mastery ${b} of 5`}`}
													/>
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
						{math.trouble.length > 0 && (
							<div className="space-y-2 pt-2">
								<h4 className="text-sm font-semibold">Tricky facts</h4>
								<ul className="flex flex-wrap gap-x-4 gap-y-2">
									{math.trouble.slice(0, 8).map((t) => (
										<li key={t.word}>
											<WordRack word={factLabel(t.word)} max={24} />
										</li>
									))}
								</ul>
								{math.trouble.length > 8 && <p className="text-sm text-page-muted">and {math.trouble.length - 8} more</p>}
							</div>
						)}
					</div>
				)}
			</div>
		</section>
	);
}

/**
 * Code: each unit's level (a parent can nudge it, which also opens a unit before its turn), and the puzzles that keep
 * tripping the kid up, with the programs they ran first, so a parent can see the thinking.
 */
function CodeProgress({ childId, name, code }: { childId: string; name: string; code: Progress["code"] }) {
	const qc = useQueryClient();
	const levels = code?.levels ?? {};
	const set = useMutation({
		mutationFn: (v: { skill: CodeSkill; level: number }) => api(`/api/children/${childId}/math-level`, { method: "PUT", json: v }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", childId] }),
	});
	const trouble = code?.trouble ?? [];
	return (
		<section className="space-y-8" aria-labelledby="code-heading">
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h2 id="code-heading" className="text-2xl font-semibold">
					Code
				</h2>
				<span className="text-sm text-page-muted" role="status">
					{set.isPending ? "Saving…" : set.isError ? "Couldn’t save. Try again." : set.isSuccess ? "Saved" : ""}
				</span>
			</div>
			<div className="grid gap-12 lg:grid-cols-2">
				<div className="space-y-3">
					<h3 className="text-lg font-semibold">Units</h3>
					<p className="max-w-prose text-sm text-page-muted">
						{name} writes real Python to steer a turtle. Units open in order, each once the one before reaches level 2. Levels move on their
						own; opening a unit early starts it at level 1.
					</p>
					<ul className="space-y-3">
						{CODE_SKILLS.map((skill) => {
							const open = unitOpen(skill, levels);
							const level = levels[skill] ?? 1;
							return (
								<li key={skill} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
									<span>
										{CODE_LABEL[skill]} <span className="text-page-muted">· {open ? `level ${level} of 5` : "not open yet"}</span>
									</span>
									<span className="flex gap-2">
										{open ? (
											<>
												<button
													type="button"
													className="key !min-h-11 text-sm"
													disabled={level <= 1 || set.isPending}
													aria-label={`Make ${CODE_LABEL[skill]} easier`}
													onClick={() => set.mutate({ skill, level: level - 1 })}
												>
													Easier
												</button>
												<button
													type="button"
													className="key !min-h-11 text-sm"
													disabled={level >= 5 || set.isPending}
													aria-label={`Make ${CODE_LABEL[skill]} harder`}
													onClick={() => set.mutate({ skill, level: level + 1 })}
												>
													Harder
												</button>
											</>
										) : (
											<button
												type="button"
												className="key !min-h-11 text-sm"
												disabled={set.isPending}
												aria-label={`Open ${CODE_LABEL[skill]} now`}
												onClick={() => set.mutate({ skill, level: 1 })}
											>
												Open now
											</button>
										)}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
				{trouble.length > 0 && (
					<div className="space-y-3">
						<h3 className="text-lg font-semibold">Tricky puzzles</h3>
						<p className="max-w-prose text-sm text-page-muted">What {name} ran first, the last few times it didn’t work.</p>
						<ul className="space-y-5">
							{trouble.slice(0, 6).map((t) => (
								<li key={t.word} className="space-y-2">
									<p>
										{puzzleTitle(t.word)}{" "}
										<span className="text-sm text-page-muted">
											· {CODE_LABEL[t.word.split(":")[1] as CodeSkill] ?? ""} · missed {t.misses}×
										</span>
									</p>
									{t.programs.slice(0, 2).map((src, i) => (
										<pre key={i} className="patch overflow-x-auto p-3 font-mono text-sm">
											{src}
										</pre>
									))}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</section>
	);
}
