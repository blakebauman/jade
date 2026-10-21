import { type Quest, type QuestDay, questCollectable, questDone, questHave } from "@jade/core";
import { withName } from "@jade/core/roxy";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, Ticket } from "lucide-react";
import { useId, useState } from "react";
import { type PlayStatus, playQuery } from "#/lib/play.ts";
import { collectQuest, useQuests } from "#/lib/quests.ts";
import { useCharacterName } from "#/lib/roxy.ts";
import { Tickets } from "./PlayBits.tsx";

const TILTS = ["-0.6deg", "0.5deg", "-0.4deg"];

/**
 * Today's three quests, in the home shelf's Quests sheet, one row each with its game's tile art. One still to do says
 * how far along it is; a finished one is a berry sticker with its tickets to collect (or just "Done" while games are
 * Free). With `onGo`, a row still to do is a button that takes the kid to its game.
 */
/** `heading={false}` inside a sheet that already says "Today's quests". */
export function QuestBoard({
	childId,
	status,
	heading = true,
	onGo,
	art,
}: {
	childId: string;
	status: PlayStatus;
	heading?: boolean;
	onGo?: (quest: Quest) => void;
	/** The quest's game, as its shelf tile shows it. */
	art?: (quest: Quest) => React.ReactNode;
}) {
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
			<ul className="mt-3 grid gap-3">
				{quests.map((q, i) => (
					<QuestCard
						key={q.id}
						childId={childId}
						quest={q}
						state={state}
						free={status.settings.free}
						tilt={TILTS[i % TILTS.length]!}
						onGo={onGo}
						art={art?.(q)}
					/>
				))}
			</ul>
		</section>
	);
}

function QuestCard({
	childId,
	quest,
	state,
	free,
	tilt,
	onGo,
	art,
}: {
	childId: string;
	quest: Quest;
	state: QuestDay;
	free: boolean;
	tilt: string;
	onGo?: (quest: Quest) => void;
	art?: React.ReactNode;
}) {
	const qc = useQueryClient();
	const [busy, setBusy] = useState(false);
	const have = questHave(quest, state);
	const collected = state.collected.includes(quest.id);
	// Quests are written about Roxy; they say whatever this kid calls their character.
	const label = withName(quest.label, useCharacterName(childId));

	const thumb = art && (
		<span className="relative size-16 shrink-0 overflow-hidden rounded-xl shadow-sm md:size-[4.5rem]" aria-hidden>
			{art}
		</span>
	);

	if (!questDone(quest, state)) {
		const body = (
			<>
				{thumb}
				<span className="grid min-w-0 flex-1 gap-1">
					<span className="font-display text-lg leading-snug font-medium text-page-ink">{label}</span>
					<span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-medium text-page-muted tabular-nums">
						<span>
							{have} of {quest.need}
							<span className="sr-only"> (not yet)</span>
						</span>
						{!free && (
							<span className="inline-flex items-center gap-1.5">
								<Ticket className="size-4" aria-hidden /> {quest.tickets} tickets
							</span>
						)}
					</span>
				</span>
				{onGo && <ChevronRight className="size-6 shrink-0 text-page-muted" aria-hidden />}
			</>
		);
		const card = "flex w-full items-center gap-4 rounded-2xl bg-page-deep p-3 text-left";
		return onGo ? (
			<li className="flex">
				<button type="button" className={`quest-go ${card}`} onClick={() => onGo(quest)}>
					{body}
				</button>
			</li>
		) : (
			<li className={card}>{body}</li>
		);
	}

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
			className="sticker flex flex-wrap items-center gap-x-4 gap-y-3 p-3"
			data-place="roxy"
			style={{ "--tilt": tilt } as React.CSSProperties}
		>
			{thumb}
			<span className="min-w-0 flex-1 font-display text-lg leading-snug font-medium">{label}</span>
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
