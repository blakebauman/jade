import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/** `compact`: little height to work with (the keyboard is up, or a phone on its side), so screens tighten up. */
export type ViewportState = { height: number; top: number; keyboard: boolean; compact: boolean };

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
		compact: false,
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
			const compact = keyboard || height < 480;
			document.documentElement.style.setProperty("--vvh", `${height}px`);
			document.documentElement.style.setProperty("--vvtop", `${top}px`);
			setState((s) =>
				s.height === height && s.top === top && s.keyboard === keyboard && s.compact === compact ? s : { height, top, keyboard, compact },
			);
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
	// Measure before the first paint, so tile rows never flash at a default size (and overflow) for a frame.
	useLayoutEffect(() => {
		if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
	}, []);
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

const subscribeOnline = (cb: () => void) => {
	window.addEventListener("online", cb);
	window.addEventListener("offline", cb);
	return () => {
		window.removeEventListener("online", cb);
		window.removeEventListener("offline", cb);
	};
};

/** Whether the device thinks it's online, kept up to date. */
export function useOnline() {
	return useSyncExternalStore(
		subscribeOnline,
		() => navigator.onLine,
		() => true,
	);
}

/** A media query, kept up to date: an iPad picks up a trackpad, or the family flips Reduced Motion. */
export function useMedia(query: string) {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(query);
			mq.addEventListener("change", cb);
			return () => mq.removeEventListener("change", cb);
		},
		() => window.matchMedia(query).matches,
		() => false,
	);
}

/** A finger, not a mouse: touch screens get on-screen controls (the stick) instead of keyboard hints. */
export const useCoarsePointer = () => useMedia("(pointer: coarse)");

/**
 * Keeps the screen awake while `active` (a round, a game scene): a kid thinking over a word shouldn't come back to a
 * locked iPad. iOS drops the lock whenever the app is hidden, so it's asked for again on the way back.
 */
export function useWakeLock(active: boolean) {
	useEffect(() => {
		if (!active || !("wakeLock" in navigator)) return;
		let lock: WakeLockSentinel | undefined;
		let gone = false;
		const take = async () => {
			if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
			try {
				const l = await navigator.wakeLock.request("screen");
				if (gone) void l.release();
				else lock = l;
			} catch {
				// Refused (Low Power Mode, an iframe, a browser without it): the screen just sleeps as usual.
			}
		};
		void take();
		document.addEventListener("visibilitychange", take);
		return () => {
			gone = true;
			document.removeEventListener("visibilitychange", take);
			void lock?.release().catch(() => {});
		};
	}, [active]);
}
