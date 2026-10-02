import { useEffect, useRef } from "react";
import { DRIVE_KEYS, type DriveInput, keysToInput } from "./drive.ts";

/** Typing, or moving round a tab list or a form: the keys belong to that, not to Roxy. */
const busy = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false;
	if (
		target.isContentEditable ||
		target.closest("input, textarea, select, [role='tablist'], [role='radiogroup'], dialog, section[aria-label]")
	)
		return true;
	return false;
};

/**
 * The input that walks Roxy, read by the frame loop each frame (a ref, so holding a key never re-renders). WASD or
 * the arrows walk and Space hops while `enabled`; the touch stick writes into the same ref.
 */
export function useDrive(enabled: boolean) {
	const drive = useRef<DriveInput>({ x: 0, y: 0, hop: false });
	useEffect(() => {
		if (!enabled) return;
		const pressed = new Set<string>();
		const sync = () => Object.assign(drive.current, keysToInput(pressed));
		const down = (e: KeyboardEvent) => {
			if (!DRIVE_KEYS.has(e.code) || e.metaKey || e.ctrlKey || e.altKey || busy(e.target)) return;
			// Space on a focused button presses it; leave that alone.
			if (e.code === "Space" && e.target instanceof HTMLElement && e.target.closest("button, a")) return;
			e.preventDefault();
			pressed.add(e.code);
			sync();
		};
		const up = (e: KeyboardEvent) => {
			if (pressed.delete(e.code)) sync();
		};
		const clear = () => {
			pressed.clear();
			sync();
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", clear);
		document.addEventListener("visibilitychange", clear);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", clear);
			document.removeEventListener("visibilitychange", clear);
			clear();
		};
	}, [enabled]);
	return drive;
}
