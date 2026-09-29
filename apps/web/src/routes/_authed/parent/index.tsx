import { WordTiles } from "@jade/ui/components/tile";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { api, type WordList } from "#/lib/api.ts";
import { listsQuery, packsQuery } from "#/lib/queries.ts";
import { warmList } from "#/lib/warm.ts";

export const Route = createFileRoute("/_authed/parent/")({
	loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(listsQuery), context.queryClient.ensureQueryData(packsQuery)]),
	component: Lists,
});

const gradeLabel = (g: number | null) => (g === null ? null : g === 0 ? "K" : `Grade ${g}`);

function Lists() {
	const { data: lists } = useSuspenseQuery(listsQuery);
	const { data: packs } = useSuspenseQuery(packsQuery);
	const qc = useQueryClient();
	const navigate = useNavigate();
	const addPack = useMutation({
		mutationFn: (id: string) => api<WordList>(`/api/lists/packs/${id}`, { method: "POST" }),
		onSuccess: (list) => {
			void warmList(list.words);
			qc.invalidateQueries({ queryKey: ["lists"] });
			navigate({ to: "/parent/lists/$listId", params: { listId: list.id } });
		},
	});

	return (
		<div className="space-y-14">
			<section className="space-y-5">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<h1 className="text-4xl font-semibold">Word lists</h1>
					<Link to="/parent/lists/$listId" params={{ listId: "new" }} className="key" data-variant="go">
						<Plus className="size-5" aria-hidden /> New list
					</Link>
				</div>
				{lists.length === 0 ? (
					<p className="max-w-prose text-felt-muted">
						No lists yet. Paste this week’s school words, snap a photo of the sheet, or start from a grade pack below.
					</p>
				) : (
					<ul className="divide-y divide-felt-line/60">
						{lists.map((l) => (
							<li key={l.id}>
								<Link
									to="/parent/lists/$listId"
									params={{ listId: l.id }}
									className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-4 hover:bg-felt-raised/50"
								>
									<span className="space-y-1">
										<span className="block font-display text-xl font-medium">{l.name}</span>
										<span className="block text-sm text-felt-muted">
											{l.wordCount} words{gradeLabel(l.grade) ? ` · ${gradeLabel(l.grade)}` : ""}
										</span>
									</span>
									<span className="text-sm text-felt-muted underline underline-offset-4">Edit</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="space-y-5">
				<h2 className="text-2xl font-semibold">Grade packs</h2>
				<p className="max-w-prose text-felt-muted">
					Ready-made starters. Adding one copies it into your lists so you can trim or add words. K–3 are the Dolch sight words; 4th and 5th
					are commonly taught tricky words.
				</p>
				<ul className="grid gap-3 md:grid-cols-2">
					{packs.map((p) => (
						<li key={p.id} className="patch flex flex-col gap-3 p-5">
							<div className="flex items-baseline justify-between gap-3">
								<h3 className="font-display text-lg font-medium">{p.name}</h3>
								<span className="text-sm text-felt-muted tabular-nums">{p.wordCount} words</span>
							</div>
							<div className="flex flex-wrap gap-x-3 gap-y-2">
								{p.preview.slice(0, 4).map((w) => (
									<WordTiles key={w} word={w} size={22} />
								))}
							</div>
							<button type="button" className="key self-start" disabled={addPack.isPending} onClick={() => addPack.mutate(p.id)}>
								Add to my lists
							</button>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
