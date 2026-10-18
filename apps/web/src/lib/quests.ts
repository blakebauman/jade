import {
	emptyQuestDay,
	type Quest,
	type QuestDay,
	type QuestEvent,
	questCollectable,
	questKey,
	questsFor,
	recordQuestEvent,
} from "@jade/core";
import { useCallback, useSyncExternalStore } from "react";
import { dayKey } from "./hooks.ts";
import { earnTickets, type PlayStatus } from "./play.ts";

/**
 * Daily quests on the device. Which quests a kid has is worked out from kid and day (`@jade/core` `quests.ts`); how
 * far along they are lives here, in `jade.quests.{childId}`, and starts over each day. A finished quest is collected
 * through the games' ticket queue under its own key, so the server pays it once even if it's sent again.
 */

const CHANGED = "jade:quests";
const storeKey = (childId: string) => `jade.quests.${childId}`;

function read(childId: string, day: string): QuestDay {
	try {
		const saved = JSON.parse(localStorage.getItem(storeKey(childId)) ?? "null") as QuestDay | null;
		if (saved?.day === day) return saved;
	} catch {
		// Unreadable or blocked: today starts fresh.
	}
	return emptyQuestDay(day);
}

function write(childId: string, state: QuestDay) {
	try {
		localStorage.setItem(storeKey(childId), JSON.stringify(state));
	} catch {
		// Storage blocked: progress lasts as long as the page.
	}
	window.dispatchEvent(new Event(CHANGED));
}

/**
 * A game reports something; returns the quests it just finished, for the game to say so. Pass whether games are Free
 * now: a quest finished on Free never pays, as a go played on Free never does.
 */
export function questEvent(childId: string, e: QuestEvent, free: boolean): Quest[] {
	const day = dayKey();
	const { state, done } = recordQuestEvent(read(childId, day), questsFor(childId, day), e, { free });
	write(childId, state);
	return done;
}

/** Collect a finished quest's tickets. Resolves to the play status when the server heard it. */
export async function collectQuest(childId: string, q: Quest): Promise<PlayStatus | null> {
	const day = dayKey();
	const state = read(childId, day);
	if (!questCollectable(q, state)) return null;
	write(childId, { ...state, collected: [...state.collected, q.id] });
	return earnTickets(childId, questKey(day, q), q.tickets);
}

const subscribe = (cb: () => void) => {
	window.addEventListener(CHANGED, cb);
	window.addEventListener("storage", cb);
	return () => {
		window.removeEventListener(CHANGED, cb);
		window.removeEventListener("storage", cb);
	};
};

/** Today's quests and how far along they are, kept current as games report. */
export function useQuests(childId: string) {
	const day = dayKey();
	// The snapshot is the stored text, so React sees a change only when it really changed.
	const raw = useSyncExternalStore(
		subscribe,
		useCallback(() => {
			try {
				return localStorage.getItem(storeKey(childId)) ?? "";
			} catch {
				return "";
			}
		}, [childId]),
	);
	const state = raw ? read(childId, day) : emptyQuestDay(day);
	return { quests: questsFor(childId, day), state };
}
