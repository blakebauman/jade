import { useThree } from "@react-three/fiber";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "#/lib/hooks.ts";

/**
 * How often a 3D scene draws. The canvases run on demand: while something is moving (Roxy walking, the camera
 * gliding, a find popping) it draws every frame; left alone it ticks slowly, which is plenty for her
 * breathing and saves an iPad's battery. Anything that moves calls `useWake()`'s function from its frame loop
 * while it's moving; scenery that moves all the time (a butterfly, bubbles in a tank) calls it with "ambient",
 * which draws at half speed, smooth enough for scenery.
 */

type Waker = (kind?: "move" | "ambient") => void;
const Wake = createContext<Waker>(() => {});

/** The function a moving thing calls each frame it's still moving. */
export const useWake = () => useContext(Wake);

/** How long after the last wake the scene keeps drawing every frame. */
const SETTLE_MS = 250;

export function Pace({ children }: { children: ReactNode }) {
	const invalidate = useThree((s) => s.invalidate);
	const lastWake = useRef(performance.now());
	const lastAmbient = useRef(0);
	const wake = useMemo<Waker>(
		() =>
			(kind = "move") => {
				if (kind === "ambient") lastAmbient.current = performance.now();
				else lastWake.current = performance.now();
			},
		[],
	);
	useEffect(() => {
		// Idle: a slow breath. With reduced motion nothing breathes, but a few frames a second keep things that ease
		// back on their own (the studio turntable) working.
		const idleMs = 1000 / (prefersReducedMotion() ? 4 : 15);
		const ambientMs = 1000 / 30;
		let last = 0;
		let raf = 0;
		const tick = (now: number) => {
			const every = now - lastAmbient.current < SETTLE_MS ? Math.min(idleMs, ambientMs) : idleMs;
			// A little slack, so a 60Hz screen draws every other frame rather than every third.
			if (now - lastWake.current < SETTLE_MS || now - last >= every - 4) {
				last = now;
				invalidate();
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [invalidate]);
	return <Wake.Provider value={wake}>{children}</Wake.Provider>;
}

/**
 * Watches for the browser taking the WebGL context away. three.js picks up again if it's given back; if it isn't
 * within a few seconds (iOS sometimes never does), `lost` turns true so the screen can show its no-3D fallback.
 * Pass `onCreated` to the Canvas.
 */
export function useContextLoss() {
	const [lost, setLost] = useState(false);
	const cleanup = useRef<() => void>(() => {});
	useEffect(() => () => cleanup.current(), []);
	const onCreated = ({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
		const canvas = gl.domElement;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onLost = (e: Event) => {
			e.preventDefault();
			timer = setTimeout(() => setLost(true), 3000);
		};
		const onRestored = () => clearTimeout(timer);
		canvas.addEventListener("webglcontextlost", onLost);
		canvas.addEventListener("webglcontextrestored", onRestored);
		cleanup.current = () => {
			clearTimeout(timer);
			canvas.removeEventListener("webglcontextlost", onLost);
			canvas.removeEventListener("webglcontextrestored", onRestored);
		};
	};
	if (lost) throw new Error("The 3D view stopped working");
	return onCreated;
}
