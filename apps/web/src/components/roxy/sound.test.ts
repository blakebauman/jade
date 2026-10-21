import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOOP_URLS, LOOPS, SHOT_IDS, SHOT_URLS } from "./samples.ts";
import { surfaceAt } from "./world/PlaceScene.tsx";
import { PATH } from "./world/place/parkKit.tsx";

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

describe("roxy sound", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("does nothing, safely, when there's no Web Audio", async () => {
		const s = await import("./sound.ts");
		expect(() => {
			s.scene("park");
			s.unlock();
			s.tryOn();
			s.takeOff();
			s.tap();
			s.bought();
			s.nope();
			s.gift();
			s.saved();
			s.found();
			s.travel();
			s.hop();
			s.placed();
			s.turned();
			s.nudged();
			s.putAway();
			s.decorated();
			for (const f of ["grass", "path", "wood", "tile", "carpet"] as const) s.step(f);
			s.scene("studio");
			s.leave();
		}).not.toThrow();
	});

	it("remembers muting on the device", async () => {
		const s = await import("./sound.ts");
		s.setMuted(true);
		expect(localStorage.getItem("jade.roxy.muted")).toBe("1");
		vi.resetModules();
		expect((await import("./sound.ts")).isMuted()).toBe(true);
	});

	it("has a file for every recorded sound, and several takes of the frequent ones", () => {
		expect([...SHOT_URLS.keys()].sort()).toEqual([...SHOT_IDS].sort());
		expect([...LOOP_URLS.keys()].sort()).toEqual(Object.keys(LOOPS).sort());
		for (const id of ["step-grass", "step-path", "step-wood"]) expect(SHOT_URLS.get(id)!.length).toBeGreaterThanOrEqual(4);
		for (const id of ["tryon", "ui", "hop"]) expect(SHOT_URLS.get(id)!.length).toBeGreaterThanOrEqual(2);
	});

	it("knows what's underfoot in each place", () => {
		const onPath = (PATH.z0 + PATH.z1) / 2;
		expect(surfaceAt("park", { x: 6, z: onPath })).toBe("path");
		expect(surfaceAt("park", { x: 6, z: PATH.z1 + 1 })).toBe("grass");
		expect(surfaceAt("petshop", { x: 3, z: 3 })).toBe("tile");
		expect(surfaceAt("school", { x: 3, z: 3 })).toBe("wood");
	});
});
