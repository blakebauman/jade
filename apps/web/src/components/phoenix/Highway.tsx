import { Diamond, Flame, Heart, Star } from "lucide-react";
import { type MutableRefObject, useEffect, useRef } from "react";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { type Game, inRise, LANES } from "./sim.ts";

/**
 * The note highway: four lanes over the party, notes falling to the pads on the beat. Drawn on a 2D canvas every frame
 * from the game and the song clock (never through React), so it stays smooth on an iPad. Each lane has its own colour
 * and its own shape (a flame, a star, a heart, a diamond), so colour is never the only way to tell them apart.
 *
 * Feedback keeps the colour laws: a hit flashes marigold (right), a missed note sky (missing), a tap with no note
 * stone (extra). The lanes' own colours stay clear of all four.
 */

export const LANE_COLOUR = ["#e0337a", "#7c4ddb", "#34a853", "#109c9c"] as const;
export const LANE_NAME = ["Flame", "Star", "Heart", "Diamond"] as const;
export const LANE_KEYS = ["D", "F", "J", "K"] as const;
const LANE_ICON = [Flame, Star, Heart, Diamond];

const LAW = { right: "#f2b632", missing: "#5aa9e6", extra: "#9a9186" };
/** How far ahead the highway shows, in seconds: the time a note takes to fall. */
const LEAD_S = 1.7;

export type Flash = { kind: "perfect" | "good" | "miss" | "extra"; at: number };

type Shape = (ctx: CanvasRenderingContext2D, r: number) => void;
const SHAPES: Shape[] = [
	// A flame.
	(ctx, r) => {
		ctx.moveTo(0, -r);
		ctx.bezierCurveTo(r * 0.5, -r * 0.4, r * 0.9, 0, r * 0.65, r * 0.55);
		ctx.bezierCurveTo(r * 0.4, r * 1.05, -r * 0.4, r * 1.05, -r * 0.65, r * 0.55);
		ctx.bezierCurveTo(-r * 0.9, r * 0.05, -r * 0.35, -r * 0.25, -r * 0.2, -r * 0.55);
		ctx.bezierCurveTo(-r * 0.05, -r * 0.3, 0, -r * 0.6, 0, -r);
	},
	// A star.
	(ctx, r) => {
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + (i * Math.PI) / 5;
			const rr = i % 2 ? r * 0.48 : r;
			if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
			else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
		}
		ctx.closePath();
	},
	// A heart.
	(ctx, r) => {
		ctx.moveTo(0, r * 0.85);
		ctx.bezierCurveTo(-r * 1.25, 0, -r * 0.7, -r * 1.05, 0, -r * 0.4);
		ctx.bezierCurveTo(r * 0.7, -r * 1.05, r * 1.25, 0, 0, r * 0.85);
	},
	// A diamond.
	(ctx, r) => {
		ctx.moveTo(0, -r);
		ctx.lineTo(r * 0.8, 0);
		ctx.lineTo(0, r);
		ctx.lineTo(-r * 0.8, 0);
		ctx.closePath();
	},
];

function shape(ctx: CanvasRenderingContext2D, lane: number, x: number, y: number, r: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.beginPath();
	SHAPES[lane]!(ctx, r);
	ctx.restore();
}

export function Highway({
	game,
	time,
	flashes,
	held,
	onPress,
}: {
	game: MutableRefObject<Game>;
	time: () => number;
	flashes: MutableRefObject<(Flash | null)[]>;
	/** Which pads are down (keys or fingers), for the lane glow. */
	held: MutableRefObject<boolean[]>;
	/** A pad pressed; `at` is the event's own time (`performance.now()` clock), however late it's handled. */
	onPress: (lane: number, at: number) => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const pads = useRef<HTMLDivElement>(null);
	const press = useRef(onPress);
	press.current = onPress;

	useEffect(() => {
		const c = canvas.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		const reduced = prefersReducedMotion();
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const w = c.clientWidth;
			const h = c.clientHeight;
			if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
				c.width = Math.round(w * dpr);
				c.height = Math.round(h * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const g = game.current;
			const now = performance.now();
			const lane = w / LANES;
			const hitY = h - lane * 0.55;
			const r = Math.min(lane * 0.3, 26);
			const fire = inRise(g);

			// The track: a dark glass strip, warmer in a Fire Drop, with lane dividers.
			const bg = ctx.createLinearGradient(0, 0, 0, h);
			bg.addColorStop(0, "rgba(20,14,34,0)");
			bg.addColorStop(0.25, fire ? "rgba(70,20,10,0.5)" : "rgba(20,14,34,0.5)");
			bg.addColorStop(1, fire ? "rgba(90,30,10,0.72)" : "rgba(20,14,34,0.72)");
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < LANES; i++) {
				if (held.current[i]) {
					const glow = ctx.createLinearGradient(0, hitY, 0, hitY - h * 0.6);
					glow.addColorStop(0, `${LANE_COLOUR[i]}88`);
					glow.addColorStop(1, `${LANE_COLOUR[i]}00`);
					ctx.fillStyle = glow;
					ctx.fillRect(i * lane, 0, lane, hitY);
				}
				if (i) {
					ctx.fillStyle = "rgba(255,255,255,0.12)";
					ctx.fillRect(i * lane - 0.5, 0, 1, h);
				}
			}

			const t = time();
			const ahead = (dt: number) => hitY - (dt / LEAD_S) * hitY;
			// Beat lines scrolling down with the notes; a bar line is brighter.
			if (g.phase === "song" && g.track) {
				const spb = 60 / g.track.bpm;
				const first = Math.ceil(t / spb);
				for (let b = first; b * spb - t < LEAD_S; b++) {
					const y = ahead(b * spb - t);
					ctx.fillStyle = b % 4 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
					ctx.fillRect(0, y - (b % 4 === 0 ? 1 : 0.5), w, b % 4 === 0 ? 2 : 1);
				}
			}

			// The receptors: each lane's shape, outlined, on the hit line.
			for (let i = 0; i < LANES; i++) {
				const x = (i + 0.5) * lane;
				const f = flashes.current[i];
				const age = f ? (now - f.at) / 260 : 1;
				const pop = !reduced && age < 1 ? 1 + 0.25 * (1 - age) : 1;
				shape(ctx, i, x, hitY, r * 1.08 * pop);
				ctx.lineWidth = 3;
				ctx.strokeStyle = held.current[i] ? "#ffffff" : "rgba(255,255,255,0.55)";
				ctx.stroke();
				if (f && age < 1) {
					const colour = f.kind === "miss" ? LAW.missing : f.kind === "extra" ? LAW.extra : LAW.right;
					ctx.globalAlpha = 1 - age;
					ctx.lineWidth = 5;
					ctx.strokeStyle = colour;
					ctx.beginPath();
					ctx.arc(x, hitY, r * (1.2 + (reduced ? 0 : age * 0.7)), 0, Math.PI * 2);
					ctx.stroke();
					ctx.globalAlpha = 1;
				}
			}

			// The notes.
			if (g.phase === "song") {
				for (let i = g.next; i < g.notes.length; i++) {
					const n = g.notes[i]!;
					const dt = n.t - t;
					if (dt > LEAD_S) break;
					if (n.grade === "perfect" || n.grade === "good") continue;
					const x = (n.lane + 0.5) * lane;
					const y = ahead(dt);
					const missed = n.grade === "miss";
					ctx.globalAlpha = missed ? 0.3 : dt > LEAD_S * 0.8 ? (LEAD_S - dt) / (LEAD_S * 0.2) : 1;
					shape(ctx, n.lane, x, y, r);
					ctx.fillStyle = missed ? LAW.missing : LANE_COLOUR[n.lane]!;
					ctx.fill();
					ctx.lineWidth = 2.5;
					ctx.strokeStyle = "#ffffff";
					ctx.stroke();
					ctx.globalAlpha = 1;
				}
			}

			// What the last hit was, over each lane, fading up and away.
			ctx.textAlign = "center";
			ctx.font = `600 ${Math.max(13, Math.min(18, lane * 0.2))}px Fredoka, system-ui, sans-serif`;
			for (let i = 0; i < LANES; i++) {
				const f = flashes.current[i];
				if (!f || f.kind === "extra") continue;
				const age = (now - f.at) / 520;
				if (age >= 1) continue;
				ctx.globalAlpha = 1 - age;
				ctx.fillStyle = f.kind === "miss" ? LAW.missing : LAW.right;
				ctx.fillText(
					f.kind === "perfect" ? "Perfect!" : f.kind === "good" ? "Good" : "Miss",
					(i + 0.5) * lane,
					hitY - r * 1.6 - (reduced ? 0 : age * 18),
				);
				ctx.globalAlpha = 1;
			}
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [game, time, flashes, held]);

	// Pads: a finger's touch is taken at once (touchstart, every finger, both thumbs at once); a mouse or pen uses
	// pointerdown. Neither waits for a click, which comes too late for a beat.
	useEffect(() => {
		const el = pads.current;
		if (!el) return;
		const laneOf = (target: EventTarget | null) => {
			const b = target instanceof Element ? target.closest<HTMLElement>("[data-lane]") : null;
			return b ? Number(b.dataset.lane) : -1;
		};
		const down = (lane: number, at: number) => {
			if (lane < 0) return;
			held.current[lane] = true;
			press.current(lane, at);
		};
		const up = (lane: number) => {
			if (lane >= 0) held.current[lane] = false;
		};
		const touches = new Map<number, number>();
		const tStart = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			for (const t of Array.from(e.changedTouches)) {
				const lane = laneOf(document.elementFromPoint(t.clientX, t.clientY));
				touches.set(t.identifier, lane);
				down(lane, e.timeStamp);
			}
		};
		const tEnd = (e: TouchEvent) => {
			for (const t of Array.from(e.changedTouches)) {
				up(touches.get(t.identifier) ?? -1);
				touches.delete(t.identifier);
			}
		};
		const pDown = (e: PointerEvent) => {
			// Fingers and an Apple Pencil arrive as touch events too; only a mouse is taken here, or a pen would press twice.
			if (e.pointerType !== "mouse") return;
			e.preventDefault();
			down(laneOf(e.target), e.timeStamp);
		};
		const release = () => {
			for (let i = 0; i < LANES; i++) held.current[i] = false;
		};
		const pUp = (e: PointerEvent) => {
			if (e.pointerType === "mouse") release();
		};
		el.addEventListener("touchstart", tStart, { passive: false });
		el.addEventListener("touchend", tEnd);
		el.addEventListener("touchcancel", tEnd);
		el.addEventListener("pointerdown", pDown);
		window.addEventListener("pointerup", pUp);
		// A key or finger still down when the window loses focus or the highway goes never stays lit.
		window.addEventListener("blur", release);
		return () => {
			release();
			window.removeEventListener("blur", release);
			el.removeEventListener("touchstart", tStart);
			el.removeEventListener("touchend", tEnd);
			el.removeEventListener("touchcancel", tEnd);
			el.removeEventListener("pointerdown", pDown);
			window.removeEventListener("pointerup", pUp);
		};
	}, [held]);

	return (
		<div className="pointer-events-auto flex h-full flex-col">
			<canvas ref={canvas} className="min-h-0 w-full flex-1 rounded-t-[1.4rem]" aria-hidden />
			<div
				ref={pads}
				className="grid grid-cols-4 gap-1.5 rounded-b-[1.4rem] bg-[rgb(20_14_34/0.72)] p-1.5 select-none"
				style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
			>
				{LANE_ICON.map((Icon, i) => (
					<button
						key={LANE_NAME[i]}
						type="button"
						data-lane={i}
						tabIndex={-1}
						aria-label={`${LANE_NAME[i]} pad (${LANE_KEYS[i]})`}
						className="phoenix-pad flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-white max-md:h-14 short:h-11"
						style={{ "--pad": LANE_COLOUR[i] } as React.CSSProperties}
					>
						<Icon className="size-6 short:size-5" aria-hidden strokeWidth={2.5} />
						<span className="text-[0.7rem] font-semibold tracking-wide opacity-80 [@media(pointer:coarse)]:hidden">{LANE_KEYS[i]}</span>
					</button>
				))}
			</div>
		</div>
	);
}
