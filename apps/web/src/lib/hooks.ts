import { useEffect, useRef, useState } from "react";

export type ViewportState = { height: number; top: number; keyboard: boolean };

/**
 * Tracks the part of the screen the speller can actually see. On iPad the on-screen keyboard covers the page
 * without resizing it, and Safari shrinks `innerHeight` along with the visual viewport, so comparing those two
 * never detects the keyboard. Instead we compare against the tallest height seen at the current width
 * (reset on rotation). `top` is the visual viewport's offset: Safari scrolls the page when a field is focused,
 * and the round screen pins itself to `top`/`height` so that scroll can't slide the tiles under the keyboard.
 */
export function useVisualViewport(): ViewportState {
	const [state, setState] = useState<ViewportState>({
		height: typeof window === "undefined" ? 800 : window.innerHeight,
		top: 0,
		keyboard: false,
	});
	useEffect(() => {
		const vv = window.visualViewport;
		let baseline = { width: 0, height: 0 };
		const update = () => {
			const width = vv?.width ?? window.innerWidth;
			const height = vv?.height ?? window.innerHeight;
			const top = vv?.offsetTop ?? 0;
			// Width change = rotation or window resize: start a new baseline.
			if (Math.abs(width - baseline.width) > 40) baseline = { width, height: 0 };
			baseline.height = Math.max(baseline.height, height, document.documentElement.clientHeight);
			const keyboard = height < baseline.height * 0.8;
			document.documentElement.style.setProperty("--vvh", `${height}px`);
			document.documentElement.style.setProperty("--vvtop", `${top}px`);
			setState((s) => (s.height === height && s.top === top && s.keyboard === keyboard ? s : { height, top, keyboard }));
		};
		update();
		vv?.addEventListener("resize", update);
		vv?.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		return () => {
			vv?.removeEventListener("resize", update);
			vv?.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);
	return state;
}

export function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		if (!ref.current) return;
		const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
		ro.observe(ref.current);
		return () => ro.disconnect();
	}, []);
	return [ref, width] as const;
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function dayKey(date = new Date()) {
	return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
