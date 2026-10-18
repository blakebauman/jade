import { B } from "@jade/core/woods";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("woods sound", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("does nothing, safely, when there's no Web Audio", async () => {
		const s = await import("./sound.ts");
		expect(() => {
			s.unlock();
			s.tap();
			s.dig(B.stone);
			s.place();
			s.feed();
			s.chime();
			s.home();
			s.rescueSparkle();
			s.owl();
			s.dawn();
			for (const b of [B.air, B.grass, B.stone, B.planks, B.water, B.sand]) s.step(b);
			s.jump();
			s.land(0.5);
			s.snuff();
			s.lowFire();
			s.ambience({ sun: 0.5, fireDistance: 3, fireStrength: 1, running: true });
			s.ambience({ sun: 0, fireDistance: 30, fireStrength: 0, underwater: true, running: false });
			s.stopAmbience();
			s.stopAmbience();
		}).not.toThrow();
	});

	it("remembers muting on the device", async () => {
		const s = await import("./sound.ts");
		expect(s.isMuted()).toBe(false);
		s.setMuted(true);
		expect(localStorage.getItem("jade.woods.muted")).toBe("1");
		vi.resetModules();
		const again = await import("./sound.ts");
		expect(again.isMuted()).toBe(true);
		again.setMuted(false);
		expect(localStorage.getItem("jade.woods.muted")).toBe("0");
	});
});
