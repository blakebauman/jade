import { type Quest, type QuestDay, questCollectable, questDone, questHave } from "@jade/core";
import { withName } from "@jade/core/roxy";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ticket } from "lucide-react";
import { useId, useState } from "react";
import { type PlayStatus, playQuery } from "#/lib/play.ts";
import { collectQuest, useQuests } from "#/lib/quests.ts";
import { useCharacterName } from "#/lib/roxy.ts";
import { Tickets } from "./PlayBits.tsx";

const TILTS = ["-1.5deg", "1deg", "-0.75deg"];

/**
 * Today's three quests, in the home shelf's Quests sheet. One still to do is a solid card with how far along it is; a
 * finished one is a berry sticker with its tickets to collect (or just "Done" while games are Free).
 */
/** `heading={false}` inside a sheet that already says "Today's quests". */
export function QuestBoard({ childId, status, heading = true }: { childId: string; status: PlayStatus; heading?: boolean }) {
	const id = useId();
	const { quests, state } = useQuests(childId);
	const done = quests.filter((q) => questDone(q, state)).length;
	return (
		<section
			aria-labelledby={heading ? id : undefined}
			aria-label={heading ? undefined : "Today’s quests"}
			className={heading ? "mt-8" : ""}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				{heading && (
					<h2 id={id} className="font-display text-2xl font-semibold">
						Today’s quests
					</h2>
				)}
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
	// Quests are written about Roxy; they say whatever this kid calls their character.
	const label = withName(quest.label, useCharacterName(childId));

	if (!questDone(quest, state))
		return (
			<li className="grid min-h-32 content-center justify-items-center gap-2 rounded-2xl bg-page-deep p-4 text-center">
				<span className="font-display text-lg font-medium text-page-ink">{label}</span>
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
			<span className="font-display text-lg font-medium">{label}</span>
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
