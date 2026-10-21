import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOOP_URLS, LOOPS, SHOT_IDS, SHOT_URLS } from "./samples.ts";

/** A plain in-memory store: some jsdom setups leave `localStorage` undefined. */
function memoryStorage(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		getItem: (k) => m.get(k) ?? null,
		key: (i) => [...m.keys()][i] ?? null,
		removeItem: (k) => void m.delete(k),
		setItem: (k, v) => void m.set(k, String(v)),
	};
}

describe("jelly sound", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("does nothing, safely, when there's no Web Audio", async () => {
		const s = await import("./sound.ts");
		expect(() => {
			s.unlock();
			s.tick();
			s.turn(false);
			s.turn(true);
			s.plop(2);
			s.plop(18);
			s.pop(4, true);
			s.swish();
			s.levelUp();
			s.setMusic(true);
			s.keepMusic();
			s.full();
			s.stopMusic();
		}).not.toThrow();
	});

	it("remembers muting on the device", async () => {
		const s = await import("./sound.ts");
		s.setMuted(true);
		expect(localStorage.getItem("jade.jelly.muted")).toBe("1");
	});

	it("has a file for every recorded sound, and several takes of the quick ones", () => {
		expect([...SHOT_URLS.keys()].sort()).toEqual([...SHOT_IDS].sort());
		expect([...LOOP_URLS.keys()].sort()).toEqual(Object.keys(LOOPS).sort());
		for (const id of ["move", "turn", "plop-s"]) expect(SHOT_URLS.get(id)!.length).toBeGreaterThanOrEqual(3);
	});
});
