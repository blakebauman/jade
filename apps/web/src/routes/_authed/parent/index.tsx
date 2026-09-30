import { PACKS } from "@jade/core/packs";
import { KidTile } from "@jade/ui/components/kid-tile";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, Check, ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Problem } from "#/components/Problem.tsx";
import { WordRack } from "#/components/WordRack.tsx";
import { api, type Child, failure, type ListSummary, type Pack, type WordList } from "#/lib/api.ts";
import { childrenQuery, listsQuery, packsQuery } from "#/lib/queries.ts";
import { warmList } from "#/lib/warm.ts";

export const Route = createFileRoute("/_authed/parent/")({
	// `saved`: the list the parent just saved, so it can be pointed out.
	validateSearch: (search: Record<string, unknown>): { saved?: string } =>
		typeof search.saved === "string" ? { saved: search.saved } : {},
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(listsQuery),
			context.queryClient.ensureQueryData(packsQuery),
			context.queryClient.ensureQueryData(childrenQuery),
		]),
	component: Lists,
});

const gradeLabel = (g: number | null) => (g === null ? null : g === 0 ? "K" : `Grade ${g}`);

/** "Mira", "Mira and Leo", "Mira, Leo and Sam". */
const names = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** "today", "yesterday", "Tuesday" within the week, then "Sep 12". */
function when(at: string | number, now = new Date()) {
	const d = new Date(at);
	const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
	if (days <= 0) return "today";
	if (days === 1) return "yesterday";
	if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The kids a list is for: its chosen kids, or everyone. */
const kidsFor = (l: ListSummary, kids: Child[]) => (l.childIds.length ? kids.filter((k) => l.childIds.includes(k.id)) : kids);

/** One kid's progress on a list: when they last played it and how much of it they've mastered. */
function kidProgress(l: ListSummary, kid: Child) {
	const p = l.perChild.find((x) => x.childId === kid.id);
	if (!p?.lastPlayedAt) return "not played yet";
	return `played ${when(p.lastPlayedAt)}${p.mastered > 0 ? ` · ${p.mastered} of ${l.wordCount} mastered` : ""}`;
}

/** Packs for the family's own grades first, then the nearest grades. */
function byKidGrades(packs: Pack[], grades: number[]) {
	if (grades.length === 0) return packs;
	const distance = (p: Pack) => Math.min(...grades.map((g) => Math.abs(g - p.grade)));
	return [...packs].sort((a, b) => distance(a) - distance(b) || a.grade - b.grade);
}

const newest = (a: ListSummary, b: ListSummary) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

function Lists() {
	const search = Route.useSearch();
	const { data: lists } = useSuspenseQuery(listsQuery);
	const { data: packs } = useSuspenseQuery(packsQuery);
	const { data: kids } = useSuspenseQuery(childrenQuery);
	const qc = useQueryClient();
	const navigate = useNavigate();
	const ids = { packs: useId(), past: useId() };

	// Point out the list just saved, once: the URL drops `saved` so a reload doesn't announce it again.
	const [saved] = useState(search.saved);
	useEffect(() => {
		if (search.saved) navigate({ to: "/parent", search: {}, replace: true });
	}, [search.saved, navigate]);
	/** What just happened, for the one status line that's always on the page (so screen readers hear each change). */
	const [status, setStatus] = useState<ReactNode>(null);

	const current = lists.filter((l) => !l.archived).sort(newest);
	const past = lists.filter((l) => l.archived).sort(newest);
	const [showPast, setShowPast] = useState(false);
	const [showPacks, setShowPacks] = useState(lists.length === 0);
	const justSaved = lists.find((l) => l.id === saved);
	// Older current lists for the same kids: the ones a new week's list usually replaces.
	const replaced = justSaved
		? current.filter((l) => l.id !== justSaved.id && kidsFor(l, kids).some((k) => kidsFor(justSaved, kids).includes(k)))
		: [];

	const archive = useMutation({
		mutationFn: async (v: { ids: string[]; archived: boolean }) => {
			for (const id of v.ids) await api(`/api/lists/${id}`, { method: "PATCH", json: { archived: v.archived } });
		},
		onSuccess: (_, v) => {
			const named = names(v.ids.map((id) => `“${lists.find((l) => l.id === id)?.name ?? "list"}”`));
			setStatus(
				v.archived
					? `${named} moved to past lists. Kids won’t see ${v.ids.length === 1 ? "it" : "them"} any more.`
					: `${named} is back in This week.`,
			);
			qc.invalidateQueries({ queryKey: ["lists"] });
		},
	});
	const addPack = useMutation({
		mutationFn: (id: string) => api<WordList>(`/api/lists/packs/${id}`, { method: "POST" }),
		onSuccess: (list) => {
			void warmList(list.words);
			qc.invalidateQueries({ queryKey: ["lists"] });
			navigate({ to: "/parent/lists/$listId", params: { listId: list.id } });
		},
	});

	const firstRun = kids.length === 0 || lists.length === 0;
	const kidGrades = kids.flatMap((k) => (k.grade === null ? [] : [k.grade]));
	const savedLine =
		justSaved &&
		(kids.length > 0
			? `${justSaved.name} is saved. ${names(kidsFor(justSaved, kids).map((k) => k.name))} can practice it now, under Spelling.`
			: `${justSaved.name} is saved. Add a child on the Kids page to practice it.`);

	return (
		<div className="space-y-12">
			<section className="space-y-5" aria-labelledby="this-week">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<h1 id="this-week" className="text-4xl font-semibold">
						This week
					</h1>
					<Link to="/parent/lists/$listId" params={{ listId: "new" }} className="key" data-variant="go">
						<Plus className="size-5" aria-hidden /> New list
					</Link>
				</div>

				{firstRun && (
					<ol className="patch grid gap-4 p-5 sm:grid-cols-2" aria-label="Getting started">
						<FirstRunStep n={1} done={kids.length > 0} title="Add your kids">
							{kids.length > 0 ? (
								`${names(kids.map((k) => k.name))} ${kids.length === 1 ? "is" : "are"} ready.`
							) : (
								<Link to="/parent/kids" className="underline underline-offset-4 hover:text-felt-ink">
									Each child gets their own tile, voice and math topics.
								</Link>
							)}
						</FirstRunStep>
						<FirstRunStep n={2} done={lists.length > 0} title="Add this week’s list">
							<Link to="/parent/lists/$listId" params={{ listId: "new" }} className="underline underline-offset-4 hover:text-felt-ink">
								Snap a photo of the school sheet or paste it
							</Link>
							, or start from a grade pack below.
						</FirstRunStep>
					</ol>
				)}

				{/* Always mounted, so each change of text is announced. */}
				<div role="status" className="space-y-3 empty:mb-0">
					{savedLine && <p className="text-lg">{savedLine}</p>}
					{status && <p>{status}</p>}
				</div>
				{justSaved && replaced.length > 0 && !archive.isSuccess && (
					<div className="patch flex flex-wrap items-center justify-between gap-4 p-4">
						<p className="min-w-0 flex-1">
							Done with {names(replaced.map((l) => `“${l.name}”`))}? Past lists leave the kids’ Spelling screen; missed words still come
							back in Review.
						</p>
						<button
							type="button"
							className="key"
							data-variant="felt"
							disabled={archive.isPending}
							onClick={() => archive.mutate({ ids: replaced.map((l) => l.id), archived: true })}
						>
							<Archive className="size-4" aria-hidden /> Move {replaced.length === 1 ? "it" : "them"} to past lists
						</button>
					</div>
				)}
				{archive.isError && <Problem>{failure(archive.error, "move that list")}</Problem>}

				{current.length > 0 ? (
					<ul className="grid gap-3 md:grid-cols-2">
						{current.map((l) => (
							<li key={l.id} className={`patch flex flex-col ${l.id === saved ? "ring-2 ring-felt-ink/70" : ""}`}>
								<Link
									to="/parent/lists/$listId"
									params={{ listId: l.id }}
									className="group flex flex-1 items-center gap-4 rounded-[1.25rem] p-5 hover:brightness-110"
									aria-label={`Edit ${l.name}, ${l.wordCount} words`}
								>
									<span className="min-w-0 flex-1 space-y-3">
										<span className="flex flex-wrap items-baseline justify-between gap-x-3">
											<span className="font-display text-xl font-medium break-words">{l.name}</span>
											<span className="text-sm text-felt-muted tabular-nums">
												{l.wordCount} {l.wordCount === 1 ? "word" : "words"}
												{gradeLabel(l.grade) ? ` · ${gradeLabel(l.grade)}` : ""}
											</span>
										</span>
										<span className="flex flex-wrap gap-x-3 gap-y-2" aria-hidden>
											{l.preview.map((w) => (
												<WordRack key={w} word={w} max={20} min={12} />
											))}
											{l.wordCount > l.preview.length && <span className="self-end text-sm text-felt-muted">…</span>}
										</span>
									</span>
									<ChevronRight className="size-5 shrink-0 text-felt-muted group-hover:text-felt-ink" aria-hidden />
								</Link>
								<div className="flex flex-wrap items-end justify-between gap-3 border-t border-felt-line/50 px-5 py-3">
									{kids.length > 0 ? (
										<ul className="min-w-0 space-y-1.5 text-sm" aria-label={`Who ${l.name} is for`}>
											{kidsFor(l, kids).map((k) => (
												<li key={k.id} className="flex items-center gap-2">
													<KidTile name={k.name} avatar={k.avatar} size={22} />
													<span>
														<span className="font-medium">{k.name}</span> <span className="text-felt-muted">{kidProgress(l, k)}</span>
													</span>
												</li>
											))}
										</ul>
									) : (
										<span className="text-sm text-felt-muted">For every kid you add</span>
									)}
									<button
										type="button"
										className="key !min-h-11 text-sm"
										data-variant="felt"
										disabled={archive.isPending}
										onClick={() => archive.mutate({ ids: [l.id], archived: true })}
										aria-label={`Move ${l.name} to past lists`}
									>
										<Archive className="size-4" aria-hidden /> Done with it
									</button>
								</div>
							</li>
						))}
					</ul>
				) : (
					lists.length > 0 && (
						<p className="max-w-prose text-felt-muted">Nothing this week yet. Add a new list, or bring one back from past lists below.</p>
					)
				)}
			</section>

			{past.length > 0 && (
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">
						<button
							type="button"
							className="key text-lg"
							data-variant="felt"
							aria-expanded={showPast}
							aria-controls={ids.past}
							onClick={() => setShowPast((v) => !v)}
						>
							Past lists ({past.length}) <ChevronDown className={`size-5 ${showPast ? "rotate-180" : ""}`} aria-hidden />
						</button>
					</h2>
					{showPast && (
						<ul id={ids.past} className="divide-y divide-felt-line/60">
							{past.map((l) => (
								<li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
									<Link to="/parent/lists/$listId" params={{ listId: l.id }} className="min-w-0 underline-offset-4 hover:underline">
										<span className="font-display text-lg font-medium">{l.name}</span>{" "}
										<span className="text-sm text-felt-muted tabular-nums">{l.wordCount} words</span>
									</Link>
									<button
										type="button"
										className="key !min-h-11 text-sm"
										data-variant="felt"
										disabled={archive.isPending}
										onClick={() => archive.mutate({ ids: [l.id], archived: false })}
										aria-label={`Bring ${l.name} back to This week`}
									>
										<RotateCcw className="size-4" aria-hidden /> Use again
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			<section className="space-y-5">
				<h2 className="text-2xl font-semibold">
					<button
						type="button"
						className="key text-lg"
						data-variant="felt"
						aria-expanded={showPacks}
						aria-controls={ids.packs}
						onClick={() => setShowPacks((v) => !v)}
					>
						Start from a grade pack <ChevronDown className={`size-5 ${showPacks ? "rotate-180" : ""}`} aria-hidden />
					</button>
				</h2>
				{showPacks && (
					<div id={ids.packs} className="space-y-5">
						<p className="max-w-prose text-felt-muted">
							Ready-made starters. Adding one copies it into your lists so you can trim or add words. K–3 are the Dolch sight words; 4th and
							5th are commonly taught tricky words.
							{kidGrades.length > 0 && " Your kids’ grades come first."}
						</p>
						<ul className="grid gap-3 md:grid-cols-2">
							{byKidGrades(packs, kidGrades).map((p) => (
								<PackCard
									key={p.id}
									pack={p}
									existing={lists.find((l) => l.source === "pack" && l.name === p.name)}
									adding={addPack.isPending && addPack.variables === p.id}
									disabled={addPack.isPending}
									failed={addPack.isError && addPack.variables === p.id}
									onAdd={() => addPack.mutate(p.id)}
								/>
							))}
						</ul>
					</div>
				)}
			</section>
		</div>
	);
}

/** A grade pack: a few words as tiles, every word on request, and a way to add it (once). */
function PackCard({
	pack: p,
	existing,
	adding,
	disabled,
	failed,
	onAdd,
}: {
	pack: Pack;
	existing?: ListSummary;
	adding: boolean;
	disabled: boolean;
	failed: boolean;
	onAdd: () => void;
}) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const words = PACKS.find((x) => x.id === p.id)?.words ?? p.preview;
	return (
		<li className="patch flex flex-col gap-3 p-5">
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="font-display text-lg font-medium">{p.name}</h3>
				<span className="text-sm text-felt-muted tabular-nums">{p.wordCount} words</span>
			</div>
			<div className="flex flex-wrap gap-x-3 gap-y-2" aria-hidden={open}>
				{p.preview.slice(0, 4).map((w) => (
					<WordRack key={w} word={w} max={22} min={12} />
				))}
			</div>
			{open && (
				<p id={id} className="text-sm leading-relaxed text-felt-muted">
					{words.join(", ")}
				</p>
			)}
			<div className="flex flex-wrap items-center gap-2">
				{existing ? (
					<Link to="/parent/lists/$listId" params={{ listId: existing.id }} className="key" data-variant="felt">
						<Check className="size-4" aria-hidden /> In your lists{existing.archived ? " (past)" : ""}
					</Link>
				) : (
					<button type="button" className="key" disabled={disabled} aria-label={`Add ${p.name} to my lists`} onClick={onAdd}>
						{adding ? "Adding…" : "Add to my lists"}
					</button>
				)}
				<button
					type="button"
					className="key !min-h-11 text-sm"
					data-variant="felt"
					aria-expanded={open}
					aria-controls={id}
					onClick={() => setOpen((v) => !v)}
				>
					{open ? "Hide words" : `See all ${p.wordCount}`}
				</button>
			</div>
			{failed && <Problem>Couldn’t add that pack. Check the connection and try again.</Problem>}
		</li>
	);
}

function FirstRunStep({ n, done, title, children }: { n: number; done: boolean; title: string; children: ReactNode }) {
	return (
		<li className="flex gap-4">
			<span
				className="grid size-10 shrink-0 place-items-center rounded-[0.7rem] bg-felt-deep font-display text-lg tabular-nums"
				aria-hidden
			>
				{done ? <Check className="size-5" /> : n}
			</span>
			<span className="space-y-1">
				<span className="block font-display text-lg font-medium">
					{title}
					{done && <span className="sr-only"> (done)</span>}
				</span>
				<span className="block text-sm text-felt-muted">{children}</span>
			</span>
		</li>
	);
}
