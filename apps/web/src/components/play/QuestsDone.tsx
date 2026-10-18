import type { Quest } from "@jade/core";
import { BadgeCheck } from "lucide-react";

/** On a game's results: the daily quests this go finished, to collect on the Play page. */
export function QuestsDone({ quests }: { quests: Quest[] }) {
	if (quests.length === 0) return null;
	return (
		<ul className="mt-3 space-y-1 text-sm font-medium" aria-label="Quests done">
			{quests.map((q) => (
				<li key={q.id} className="flex items-center justify-center gap-1.5">
					<BadgeCheck className="size-4 shrink-0" aria-hidden /> Quest done: {q.label}
				</li>
			))}
		</ul>
	);
}
