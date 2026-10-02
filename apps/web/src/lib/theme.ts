import { APPEARANCES, type Appearance, DEFAULT_APPEARANCE } from "@jade/core";

/**
 * Day or Night. The parent chooses Auto, Day or Night in Settings (stored on the account). Auto follows the device's
 * light or dark setting, live, so an iPad that turns dark at sunset takes the album with it. The choice is kept on the
 * device too, so the inline script in index.html can light the page before React loads, and so it holds offline.
 */
export type Theme = "day" | "night";

const KEY = "jade.appearance";
/** The page colour per theme, for the browser chrome (`<meta name="theme-color">`). Keep in step with index.css. */
export const THEME_COLOR: Record<Theme, string> = { day: "#d4ebe1", night: "#0e4f43" };

const DARK = "(prefers-color-scheme: dark)";

/** localStorage can throw (private mode, blocked site data); the page is lit either way. */
function read(): string | null {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

export function storedAppearance(): Appearance {
	const v = read();
	return (APPEARANCES as readonly string[]).includes(v ?? "") ? (v as Appearance) : DEFAULT_APPEARANCE;
}

export function resolveTheme(appearance: Appearance, prefersDark: boolean): Theme {
	if (appearance === "auto") return prefersDark ? "night" : "day";
	return appearance;
}

const prefersDark = () => typeof matchMedia === "function" && matchMedia(DARK).matches;

function paint(theme: Theme) {
	const root = document.documentElement;
	if (root.dataset.theme !== theme) root.dataset.theme = theme;
	document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

let current: Appearance = DEFAULT_APPEARANCE;

/** Light the page for this appearance and remember it on the device. */
export function applyAppearance(appearance: Appearance) {
	current = appearance;
	try {
		localStorage.setItem(KEY, appearance);
	} catch {}
	paint(resolveTheme(appearance, prefersDark()));
}

/** Start from what this device remembers, and follow the device's own setting while on Auto. Call once at startup. */
export function initTheme() {
	current = storedAppearance();
	paint(resolveTheme(current, prefersDark()));
	if (typeof matchMedia === "function") {
		matchMedia(DARK).addEventListener("change", (e) => {
			if (current === "auto") paint(resolveTheme("auto", e.matches));
		});
	}
}
