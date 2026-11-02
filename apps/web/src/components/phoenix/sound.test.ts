import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRACKS } from "./tracks.ts";

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

describe("phoenix sound", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.resetModules();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("has a recording for every one-shot, every song and the crowd", async () => {
		const s = await import("./sound.ts");
		for (const id of s.SHOT_IDS) expect(s.SHOT_URLS.get(id)?.length, id).toBeGreaterThan(0);
		for (const t of TRACKS) expect(s.LOOP_URLS.get(`track-${t.id}`), t.id).toBeTruthy();
		expect(s.LOOP_URLS.get("crowd")).toBeTruthy();
	});

	it("loops each song over whole bars", () => {
		for (const t of TRACKS) {
			const bars = ((t.loopEnd - t.loopStart) * t.bpm) / 240;
			expect(bars, t.id).toBeCloseTo(t.bars, 4);
		}
	});

	it("does nothing, safely, when there's no Web Audio, and its clock still runs", async () => {
		const s = await import("./sound.ts");
		expect(() => {
			s.unlock();
			s.startSong(TRACKS[0]!);
			s.keep();
			s.hit(0, true);
			s.hit(3, false);
			s.extra();
			s.miss();
			s.cheer(true);
			s.aww();
			s.rise();
			s.firework();
			s.setCrowd(0.5);
			s.setPaused(true);
			s.setPaused(false);
			s.stopSong(true);
			s.setEnd();
			s.stopAll();
		}).not.toThrow();
		s.startSong(TRACKS[1]!, 12);
		expect(s.songTime()).toBeGreaterThan(11.5);
	});

	it("remembers muting", async () => {
		const s = await import("./sound.ts");
		s.setMuted(true);
		vi.resetModules();
		expect((await import("./sound.ts")).isMuted()).toBe(true);
	});
});

describe("the Phoenix model", () => {
	it("is in public/ and cut down for an iPad", () => {
		const file = join(process.cwd(), "public/models/phoenix/phoenix.glb");
		expect(statSync(file).size).toBeLessThan(200_000);
		const json = readFileSync(file).toString("latin1");
		expect(json).toContain("EXT_meshopt_compression");
		expect(json).not.toContain("normalTexture");
	});
});
