import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KINDS } from "./kinds.ts";
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

describe("gobble sound", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("does nothing, safely, when there's no Web Audio", async () => {
		const s = await import("./sound.ts");
		expect(() => {
			s.unlock();
			s.gulp(1);
			s.gulp(160);
			s.gobble(true);
			s.gobble(false);
			s.chime();
			s.pip(false);
			s.setMusic(true);
			s.keepMusic();
			s.finish(true);
			s.stopMusic();
		}).not.toThrow();
	});

	it("gulps bigger for bigger things, and every size is used", async () => {
		const { gulpSize } = await import("./sound.ts");
		expect(gulpSize(KINDS.flower.value)).toBe("gulp-s");
		expect(gulpSize(KINDS.tree.value)).toBe("gulp-m");
		expect(gulpSize(KINDS.car.value)).toBe("gulp-l");
		expect(gulpSize(KINDS.bus.value)).toBe("gulp-l");
		expect(gulpSize(KINDS.tower.value)).toBe("gulp-xl");
		expect(new Set(Object.values(KINDS).map((k) => gulpSize(k.value)))).toEqual(new Set(["gulp-s", "gulp-m", "gulp-l", "gulp-xl"]));
	});

	it("has a file for every recorded sound, and no file that isn't one", () => {
		expect([...SHOT_URLS.keys()].sort()).toEqual([...SHOT_IDS].sort());
		expect([...LOOP_URLS.keys()].sort()).toEqual(Object.keys(LOOPS).sort());
	});
});
