import { describe, expect, it } from "vitest";
import { MAX_TICKETS_PER_GO } from "../play.ts";
import {
	emptyQuestDay,
	QUEST_BY_ID,
	QUEST_GAMES,
	QUESTS,
	questCollectable,
	questDone,
	questHave,
	questKey,
	questsFor,
	recordQuestEvent,
} from "../quests.ts";
import { PLACES } from "../roxy/places.ts";

const q = (id: string) => QUEST_BY_ID[id]!;

describe("quests", () => {
	it("gives three quests from three different games, the same all day", () => {
		for (let d = 1; d <= 28; d++) {
			const day = `2026-10-${String(d).padStart(2, "0")}`;
			const quests = questsFor("kid-1", day);
			expect(quests).toHaveLength(3);
			expect(new Set(quests.map((x) => x.game)).size).toBe(3);
			expect(questsFor("kid-1", day)).toEqual(quests);
		}
	});

	it("changes from day to day and from kid to kid", () => {
		const days = new Set(
			Array.from({ length: 14 }, (_, d) =>
				questsFor("kid-1", `2026-11-${String(d + 1).padStart(2, "0")}`)
					.map((x) => x.id)
					.join(),
			),
		);
		expect(days.size).toBeGreaterThan(5);
		expect(questsFor("kid-1", "2026-10-18")).not.toEqual(questsFor("kid-2", "2026-10-18"));
	});

	it("has quests every game can offer, with keys the earn route takes, never paying past a go's cap", () => {
		for (const g of QUEST_GAMES) expect(QUESTS.some((x) => x.game === g)).toBe(true);
		expect(new Set(QUESTS.map((x) => x.id)).size).toBe(QUESTS.length);
		for (const x of QUESTS) {
			expect(questKey("2026-10-18", x)).toMatch(/^[a-z]+:[\w-]{1,64}$/);
			expect(x.tickets).toBeGreaterThan(0);
			expect(x.tickets).toBeLessThanOrEqual(MAX_TICKETS_PER_GO);
		}
		// Every place quest names a real place.
		for (const p of PLACES) expect(q("town-places").value({ game: "town", place: p })).toBe(p);
	});

	it("counts what's done in Campfire Woods as it happens", () => {
		const quests = [q("woods-build"), q("woods-rescue")];
		let s = emptyQuestDay("2026-10-19");
		for (let k = 0; k < 15; k++) s = recordQuestEvent(s, quests, { game: "woods", did: "built", n: 1 }).state;
		expect(questDone(q("woods-build"), s)).toBe(true);
		expect(questDone(q("woods-rescue"), s)).toBe(false);
		expect(recordQuestEvent(s, quests, { game: "woods", did: "rescued", n: 1 }).done.map((x) => x.id)).toEqual(["woods-rescue"]);
	});

	it("adds up across goes, keeps the best go, and counts different things once", () => {
		const quests = [q("gobble-cars"), q("gobble-score"), q("town-places")];
		let s = emptyQuestDay("2026-10-18");
		s = recordQuestEvent(s, quests, { game: "gobble", score: 120, ate: { car: 3 }, holes: 0 }).state;
		s = recordQuestEvent(s, quests, { game: "gobble", score: 90, ate: { car: 1, tree: 4 }, holes: 1 }).state;
		expect(questHave(q("gobble-cars"), s)).toBe(4);
		expect(questHave(q("gobble-score"), s)).toBe(120);
		s = recordQuestEvent(s, quests, { game: "town", place: "park" }).state;
		s = recordQuestEvent(s, quests, { game: "town", place: "park" }).state;
		expect(questHave(q("town-places"), s)).toBe(1);
	});

	it("says which quests an event finished, once", () => {
		const quests = [q("jelly-rows"), q("town-park")];
		let s = emptyQuestDay("2026-10-18");
		let r = recordQuestEvent(s, quests, { game: "jelly", rows: 12, score: 900 });
		expect(r.done.map((x) => x.id)).toEqual(["jelly-rows"]);
		expect(questHave(q("jelly-rows"), r.state)).toBe(10);
		s = r.state;
		r = recordQuestEvent(s, quests, { game: "jelly", rows: 3, score: 100 });
		expect(r.done).toEqual([]);
		expect(questDone(q("jelly-rows"), r.state)).toBe(true);
		// Another place doesn't count for the park.
		expect(recordQuestEvent(s, quests, { game: "town", place: "school" }).done).toEqual([]);
		expect(recordQuestEvent(s, quests, { game: "town", place: "park" }).done.map((x) => x.id)).toEqual(["town-park"]);
	});

	it("never pays a quest finished while games were Free", () => {
		const quests = [q("jelly-play"), q("town-park")];
		let s = recordQuestEvent(emptyQuestDay("2026-10-18"), quests, { game: "jelly", rows: 0, score: 0 }, { free: true }).state;
		expect(questDone(q("jelly-play"), s)).toBe(true);
		expect(questCollectable(q("jelly-play"), s)).toBe(false);
		// Free turned off: what's finished from now on pays, what was finished on Free still doesn't.
		s = recordQuestEvent(s, quests, { game: "town", place: "park" }).state;
		expect(questCollectable(q("town-park"), s)).toBe(true);
		expect(questCollectable(q("jelly-play"), s)).toBe(false);
		expect(questCollectable(q("town-park"), { ...s, collected: ["town-park"] })).toBe(false);
	});
});
