import { type Quest, type QuestDay, questCollectable, questDone, questHave } from "@jade/core";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ticket } from "lucide-react";
import { useId, useState } from "react";
import { type PlayStatus, playQuery } from "#/lib/play.ts";
import { collectQuest, useQuests } from "#/lib/quests.ts";
import { Tickets } from "./PlayBits.tsx";

const TILTS = ["-1.5deg", "1deg", "-0.75deg"];

/**
 * Today's three quests on the Play page. One still to do is a slot printed on the page with how far along it is; a
 * finished one is a berry sticker with its tickets to collect (or just "Done" while games are Free).
 */
export function QuestBoard({ childId, status }: { childId: string; status: PlayStatus }) {
	const id = useId();
	const { quests, state } = useQuests(childId);
	const done = quests.filter((q) => questDone(q, state)).length;
	return (
		<section aria-labelledby={id} className="mt-8">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 id={id} className="font-display text-2xl font-semibold">
					Today’s quests
				</h2>
				<span className="text-sm font-medium text-page-muted">
					{done} of {quests.length} done
				</span>
			</div>
			<ul className="mt-3 grid gap-4 sm:grid-cols-3">
				{quests.map((q, i) => (
					<QuestCard key={q.id} childId={childId} quest={q} state={state} free={status.settings.free} tilt={TILTS[i % TILTS.length]!} />
				))}
			</ul>
		</section>
	);
}

function QuestCard({ childId, quest, state, free, tilt }: { childId: string; quest: Quest; state: QuestDay; free: boolean; tilt: string }) {
	const qc = useQueryClient();
	const [busy, setBusy] = useState(false);
	const have = questHave(quest, state);
	const collected = state.collected.includes(quest.id);

	if (!questDone(quest, state))
		return (
			<li className="slot min-h-32 gap-2 p-4 text-center">
				<span className="font-display text-lg font-medium text-page-ink">{quest.label}</span>
				<span className="text-sm font-medium text-page-muted tabular-nums">
					{have} of {quest.need}
					<span className="sr-only"> (not yet)</span>
				</span>
				{!free && (
					<span className="inline-flex items-center gap-1.5 text-sm font-medium text-page-muted">
						<Ticket className="size-4" aria-hidden /> {quest.tickets} tickets
					</span>
				)}
			</li>
		);

	async function collect() {
		setBusy(true);
		try {
			const s = await collectQuest(childId, quest);
			if (s) qc.setQueryData(playQuery(childId).queryKey, s);
		} finally {
			setBusy(false);
		}
	}

	return (
		<li
			className="sticker flex min-h-32 flex-col items-center justify-center gap-3 p-4 text-center"
			data-place="roxy"
			style={{ "--tilt": tilt } as React.CSSProperties}
		>
			<span className="font-display text-lg font-medium">{quest.label}</span>
			{/* Finished while games were Free: done, and never paid (as a go on Free never is). */}
			{free || !questCollectable(quest, state) ? (
				<span className="inline-flex items-center gap-1.5 text-sm font-semibold">
					<BadgeCheck className="size-5" aria-hidden /> {collected ? `Done! ${quest.tickets} tickets collected` : "Done!"}
				</span>
			) : (
				<button type="button" className="key" data-variant="go" onClick={collect} disabled={busy}>
					Collect <Tickets count={quest.tickets} />
				</button>
			)}
		</li>
	);
}
