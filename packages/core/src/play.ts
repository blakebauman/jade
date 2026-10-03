import { z } from "zod";

/**
 * Learn and Play. Games are their own world: they pay tickets, and tickets are spent only in games. Practice stars are
 * a learning record. A parent can, per kid, make games free, let stars be spent in games too, open games only after
 * today's practice, and make play time cost stars. All of it is plain rules here; the API and the screens follow them.
 */

/** What opens Play when "practice first" is on: a finished round today, or a number of stars earned today. */
export const PLAY_GOALS = ["round", "stars10", "stars20"] as const;
export type PlayGoal = (typeof PLAY_GOALS)[number];

export const playSettingsSchema = z.object({
	/** Every item in every game is open; no wallets, no prices. */
	free: z.boolean(),
	/** Stars can pay for game items, as well as tickets. */
	stars: z.boolean(),
	/** Games stay shut until today's goal is met. */
	practiceFirst: z.boolean(),
	goal: z.enum(PLAY_GOALS),
	/** Play time is bought with stars. */
	timeCosts: z.boolean(),
});
export type PlaySettings = z.infer<typeof playSettingsSchema>;

/** A kid with no settings saved: games kept apart from learning, open, and earning tickets. */
export const DEFAULT_PLAY: PlaySettings = { free: false, stars: false, practiceFirst: false, goal: "round", timeCosts: false };

/** One purchase of play time. */
export const TIME_BLOCK = { stars: 5, minutes: 10 } as const;
/** The heads-up before play time runs out. */
export const TIME_WARN_S = 60;
/** Tickets for each thing found around town. */
export const FIND_TICKETS = 10;
/** The most one go of a game can pay (a Gobble round), whatever it reports. */
export const MAX_TICKETS_PER_GO = 30;
/** A round counts toward "practice first" once it's finished with at least this many answers. */
export const ROUND_MIN_ANSWERS = 5;

export type Today = { rounds: number; stars: number };

export const GOAL_LABEL: Record<PlayGoal, string> = {
	round: "Finish 1 round",
	stars10: "Earn 10 stars",
	stars20: "Earn 20 stars",
};

/** How far today's practice is toward the goal: `have` of `need`, in the goal's own units. */
export function goalProgress(goal: PlayGoal, today: Today): { have: number; need: number; unit: "round" | "star" } {
	if (goal === "round") return { have: Math.min(today.rounds, 1), need: 1, unit: "round" };
	const need = goal === "stars10" ? 10 : 20;
	return { have: Math.min(today.stars, need), need, unit: "star" };
}

export const goalMet = (goal: PlayGoal, today: Today) => {
	const p = goalProgress(goal, today);
	return p.have >= p.need;
};

/** What a kid still has to do today, in their words: "Finish 1 round today", "6 more stars today". */
export function goalLeft(goal: PlayGoal, today: Today): string {
	const { have, need, unit } = goalProgress(goal, today);
	if (unit === "round") return "Finish 1 round today";
	const left = need - have;
	return `Earn ${left} more ${left === 1 ? "star" : "stars"} today`;
}

/** Whole minutes left, rounded up, so "1 min" shows until the very end. */
export const minutesLeft = (seconds: number) => Math.max(0, Math.ceil(seconds / 60));

/**
 * Where play stands for a kid right now. `shut` is practice-first not yet met; `outOfTime` is play time used up.
 * Both can be true: the door opens first, then minutes are bought.
 */
export function playState(settings: PlaySettings, today: Today, secondsLeft: number) {
	const shut = settings.practiceFirst && !goalMet(settings.goal, today);
	const outOfTime = settings.timeCosts && secondsLeft <= 0;
	return { shut, outOfTime, open: !shut && !outOfTime };
}
