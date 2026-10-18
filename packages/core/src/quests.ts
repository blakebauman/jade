import { seeded } from "./math/rng.ts";
import { seedFrom } from "./roxy/look.ts";

/**
 * Daily quests: three small goals a day in the games, each paying tickets once. They're play, not practice: nothing
 * here looks at spelling or math. Which three a kid gets is seeded by kid and day, one from each of three games, and
 * progress is counted from what the games report as they're played.
 */

export const QUEST_GAMES = ["gobble", "jelly", "town", "studio"] as const;
export type QuestGame = (typeof QUEST_GAMES)[number];

/** What a game reports: the end of a go, a place visited, something tried on. */
export type QuestEvent =
	| { game: "gobble"; score: number; ate: Partial<Record<string, number>>; holes: number }
	| { game: "jelly"; rows: number; score: number }
	| { game: "town"; place: string }
	| { game: "studio"; item: string };

/**
 * One quest. `sum` adds up across goes, `best` keeps the best single go, `distinct` counts different things (places,
 * items). `value` reads what an event adds, or null when the event isn't this quest's.
 */
export type Quest = {
	id: string;
	game: QuestGame;
	label: string;
	need: number;
	tickets: number;
	mode: "sum" | "best" | "distinct";
	value: (e: QuestEvent) => number | string | null;
};

const gobble = (f: (e: Extract<QuestEvent, { game: "gobble" }>) => number) => (e: QuestEvent) => (e.game === "gobble" ? f(e) : null);
const jelly = (f: (e: Extract<QuestEvent, { game: "jelly" }>) => number) => (e: QuestEvent) => (e.game === "jelly" ? f(e) : null);
const place = (id?: string) => (e: QuestEvent) => (e.game === "town" && (!id || e.place === id) ? e.place : null);

export const QUESTS: readonly Quest[] = [
	{ id: "gobble-play", game: "gobble", label: "Play a round of Gobble Town", need: 1, tickets: 5, mode: "sum", value: gobble(() => 1) },
	{ id: "gobble-cars", game: "gobble", label: "Gobble 5 cars", need: 5, tickets: 8, mode: "sum", value: gobble((e) => e.ate.car ?? 0) },
	{
		id: "gobble-trees",
		game: "gobble",
		label: "Gobble 12 trees",
		need: 12,
		tickets: 8,
		mode: "sum",
		value: gobble((e) => e.ate.tree ?? 0),
	},
	{ id: "gobble-bus", game: "gobble", label: "Gobble a bus", need: 1, tickets: 10, mode: "sum", value: gobble((e) => e.ate.bus ?? 0) },
	{
		id: "gobble-score",
		game: "gobble",
		label: "Gobble 200 in one round",
		need: 200,
		tickets: 10,
		mode: "best",
		value: gobble((e) => e.score),
	},
	{ id: "gobble-hole", game: "gobble", label: "Gobble another hole", need: 1, tickets: 10, mode: "sum", value: gobble((e) => e.holes) },
	{ id: "jelly-play", game: "jelly", label: "Play a game of Jelly Blocks", need: 1, tickets: 5, mode: "sum", value: jelly(() => 1) },
	{ id: "jelly-rows", game: "jelly", label: "Pop 10 rows in Jelly Blocks", need: 10, tickets: 8, mode: "sum", value: jelly((e) => e.rows) },
	{ id: "jelly-big", game: "jelly", label: "Pop 8 rows in one game", need: 8, tickets: 10, mode: "best", value: jelly((e) => e.rows) },
	{ id: "town-places", game: "town", label: "Visit 3 places in town", need: 3, tickets: 8, mode: "distinct", value: place() },
	{ id: "town-park", game: "town", label: "Take Roxy to the park", need: 1, tickets: 5, mode: "distinct", value: place("park") },
	{ id: "town-petshop", game: "town", label: "Take Roxy to the pet shop", need: 1, tickets: 5, mode: "distinct", value: place("petshop") },
	{ id: "town-school", game: "town", label: "Take Roxy to school", need: 1, tickets: 5, mode: "distinct", value: place("school") },
	{
		id: "studio-try",
		game: "studio",
		label: "Try on 3 different things in the studio",
		need: 3,
		tickets: 5,
		mode: "distinct",
		value: (e) => (e.game === "studio" ? e.item : null),
	},
];

export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
export const QUESTS_PER_DAY = 3;

/** Today's quests for a kid: three games picked, then one quest from each, the same all day on every device. */
export function questsFor(childId: string, day: string): Quest[] {
	const rng = seeded(seedFrom(`quests|${childId}|${day}`));
	const games = [...QUEST_GAMES];
	for (let i = games.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[games[i], games[j]] = [games[j]!, games[i]!];
	}
	return games.slice(0, QUESTS_PER_DAY).map((g) => {
		const pool = QUESTS.filter((q) => q.game === g);
		return pool[Math.floor(rng() * pool.length)]!;
	});
}

/** A day's quest progress, as the device keeps it. */
export type QuestDay = { day: string; progress: Record<string, number | string[]>; collected: string[] };
export const emptyQuestDay = (day: string): QuestDay => ({ day, progress: {}, collected: [] });

/** How far along a quest is, never past done. */
export function questHave(q: Quest, state: QuestDay): number {
	const p = state.progress[q.id];
	const have = Array.isArray(p) ? p.length : (p ?? 0);
	return Math.min(have, q.need);
}
export const questDone = (q: Quest, state: QuestDay) => questHave(q, state) >= q.need;

/** Counts an event toward today's quests. Returns the new state and the quests this event finished. */
export function recordQuestEvent(state: QuestDay, quests: readonly Quest[], e: QuestEvent): { state: QuestDay; done: Quest[] } {
	const progress = { ...state.progress };
	const done: Quest[] = [];
	for (const q of quests) {
		const v = q.value(e);
		if (v === null || questDone(q, state)) continue;
		const was = progress[q.id];
		if (q.mode === "distinct") {
			const seen = Array.isArray(was) ? was : [];
			if (typeof v === "string" && !seen.includes(v)) progress[q.id] = [...seen, v];
		} else {
			const n = typeof was === "number" ? was : 0;
			const add = typeof v === "number" && v > 0 ? v : 0;
			progress[q.id] = q.mode === "sum" ? n + add : Math.max(n, add);
		}
		const next = { ...state, progress };
		if (questDone(q, next)) done.push(q);
	}
	return { state: { ...state, progress }, done };
}

/** The ticket key a quest pays under: once per kid per day per quest. */
export const questKey = (day: string, q: Quest) => `quest:${day}-${q.id}`;
