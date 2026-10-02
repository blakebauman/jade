import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAppearance, initTheme, resolveTheme, storedAppearance } from "./theme.ts";

function deviceIsDark(dark: boolean) {
	const listeners: ((e: { matches: boolean }) => void)[] = [];
	const mql = { matches: dark, addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn) };
	vi.stubGlobal("matchMedia", () => mql);
	return (next: boolean) => {
		mql.matches = next;
		for (const fn of listeners) fn({ matches: next });
	};
}

// Node's own localStorage stub shadows jsdom's here; a plain in-memory store is all theme.ts needs.
beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete document.documentElement.dataset.theme;
});

describe("resolveTheme", () => {
	it("follows the device on Auto, and a parent's choice otherwise", () => {
		expect(resolveTheme("auto", true)).toBe("night");
		expect(resolveTheme("auto", false)).toBe("day");
		expect(resolveTheme("day", true)).toBe("day");
		expect(resolveTheme("night", false)).toBe("night");
	});
});

describe("theme on the page", () => {
	it("lights the page, keeps the choice on the device, and ignores anything it doesn't know", () => {
		deviceIsDark(false);
		applyAppearance("night");
		expect(document.documentElement.dataset.theme).toBe("night");
		expect(storedAppearance()).toBe("night");
		localStorage.setItem("jade.appearance", "dusk");
		expect(storedAppearance()).toBe("auto");
	});

	it("turns with the device while on Auto, and holds while a parent has chosen", () => {
		const flip = deviceIsDark(false);
		initTheme();
		expect(document.documentElement.dataset.theme).toBe("day");
		flip(true);
		expect(document.documentElement.dataset.theme).toBe("night");
		applyAppearance("day");
		flip(true);
		expect(document.documentElement.dataset.theme).toBe("day");
	});
});
