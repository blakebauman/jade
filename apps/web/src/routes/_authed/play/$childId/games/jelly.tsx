import { MAX_TICKETS_PER_GO } from "@jade/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsDown,
	Pause,
	Play,
	RotateCcw,
	RotateCw,
	Trophy,
	Volume2,
	VolumeX,
} from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Backend, Slot } from "#/components/jelly/JellyScene.tsx";
import { FLAVOURS, JAR_H, JAR_W } from "#/components/jelly/look.ts";
import {
	type Action,
	autopilot,
	type Game,
	type GameEvent,
	type Input,
	newGame,
	type PieceType,
	type Speed,
	START_LEVELS,
	shape,
	step,
	upcoming,
} from "#/components/jelly/sim.ts";
import * as sound from "#/components/jelly/sound.ts";
import { Tickets } from "#/components/play/PlayBits.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { accent, GameScreen, Hint } from "#/components/roxy/GameScreen.tsx";
import { useChild } from "#/lib/child.ts";
import { earnTickets, usePlayClockValue } from "#/lib/play.ts";

const scene = () => import("#/components/jelly/JellyScene.tsx");
// three.js only loads on game screens.
const JellyScene = lazy(() => scene().then((m) => ({ default: m.JellyScene })));

export const Route = createFileRoute("/_authed/play/$childId/games/jelly")({
	component: JellyScreen,
});

type Phase = "ready" | "play" | "paused" | "over";

/** What the trays and stats show, refreshed a few times a second from the game. */
type Hud = { score: number; lines: number; level: number; hold: PieceType | 0; holdUsed: boolean; next: PieceType[] };
const snapshot = (g: Game): Hud => ({
	score: g.score,
	lines: g.lines,
	level: g.level,
	hold: g.hold,
	holdUsed: g.holdUsed,
	next: upcoming(g, 3),
});

const bestKey = (childId: string) => `jade.jelly.best.${childId}`;
const SPEED_KEY = "jade.jelly.speed";
function readNumber(key: string) {
	try {
		return Number(localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}
function readSpeed(): Speed {
	try {
		const s = localStorage.getItem(SPEED_KEY);
		return s === "medium" || s === "fast" ? s : "slow";
	} catch {
		return "slow";
	}
}

/** If this device can't draw 3D, say so (the game can't be played without it). */
class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		if (this.state.failed)
			return (
				<p className="grid size-full place-items-center p-6 text-center text-page-muted">
					This device can’t show 3D games, so Jelly Blocks can’t be played here.
				</p>
			);
		return this.props.children;
	}
}

const CLEAR_WORDS = ["", "", "Double!", "Triple!", "Jelly jackpot!"];

function JellyScreen() {
	const child = useChild();
	const [speed, setSpeed] = useState(readSpeed);
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [game, setGame] = useState(() => newGame(seed, START_LEVELS[speed]));
	const [phase, setPhase] = useState<Phase>("ready");
	const [hud, setHud] = useState<Hud>(() => snapshot(game));
	const [message, setMessage] = useState<string | null>(null);
	const [best, setBest] = useState(() => readNumber(bestKey(child.id)));
	const [newBest, setNewBest] = useState(false);
	const [ended, setEnded] = useState<"full" | "time">("full");
	/** Tickets this game paid (the server pays each game once, at most 30, and nothing while games are Free). */
	const [earned, setEarned] = useState(0);
	const [muted, setMuted] = useState(sound.isMuted);
	const [frozen, setFrozen] = useState(false);
	const [backend, setBackend] = useState<Backend | null>(null);
	const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const say = useCallback((text: string, ms = 1400) => {
		setMessage(text);
		clearTimeout(messageTimer.current);
		messageTimer.current = setTimeout(() => setMessage(null), ms);
	}, []);
	useEffect(() => () => clearTimeout(messageTimer.current), []);

	// The HUD follows the game on screen only (a test hook can swap games between frames).
	const current = useRef(game);
	current.current = game;

	// ── Input: keys, the on-screen keys and swipes all feed one place the game reads each step ──
	const held = useRef({ keyL: false, keyR: false, keyD: false, padL: false, padR: false, padD: false, swipeD: false });
	/** Pressed since the game last looked: a press and release between two steps still counts once. */
	const pressed = useRef({ left: false, right: false, down: false });
	const taps = useRef<Action[]>([]);
	/** Dev and test only: the computer player plays (for recording real play). */
	const auto = useRef(false);
	const read = useCallback((): Input => {
		if (import.meta.env.DEV && auto.current) return autopilot(current.current);
		const h = held.current;
		const p = pressed.current;
		const actions = taps.current;
		taps.current = [];
		const input = {
			left: h.keyL || h.padL || p.left,
			right: h.keyR || h.padR || p.right,
			down: h.keyD || h.padD || h.swipeD || p.down,
			actions,
		};
		p.left = p.right = p.down = false;
		return input;
	}, []);
	const input = useMemo(() => ({ current: read }), [read]);
	const playing = phase === "play";
	// A few taps at most wait for the game (while the 3D is still starting, nothing is stepping).
	const tap = useCallback(
		(a: Action) => {
			if (playing && taps.current.length < 4) taps.current.push(a);
		},
		[playing],
	);
	const press = useCallback((k: keyof typeof held.current) => {
		held.current[k] = true;
		if (k === "keyL" || k === "padL") pressed.current.left = true;
		else if (k === "keyR" || k === "padR") pressed.current.right = true;
		else if (k === "keyD" || k === "padD") pressed.current.down = true;
	}, []);
	const letGo = useCallback(() => {
		for (const k of Object.keys(held.current) as (keyof typeof held.current)[]) held.current[k] = false;
	}, []);
	useEffect(() => {
		if (!playing) {
			letGo();
			taps.current = [];
		}
	}, [playing, letGo]);

	const finish = useCallback(
		(g: Game, why: "full" | "time") => {
			setHud(snapshot(g));
			setPhase("over");
			setEnded(why);
			sound.full();
			// A ticket for every row popped.
			const tickets = Math.min(MAX_TICKETS_PER_GO, g.lines);
			setEarned(tickets);
			if (tickets > 0) void earnTickets(child.id, `jelly:${seed}`, tickets);
			const was = readNumber(bestKey(child.id));
			setNewBest(g.score > was);
			if (g.score > was) {
				setBest(g.score);
				try {
					localStorage.setItem(bestKey(child.id), String(g.score));
				} catch {}
			}
		},
		[child.id, seed],
	);

	const onEvents = useCallback(
		(events: GameEvent[]) => {
			for (const e of events) {
				if (e.type === "move") sound.tick();
				else if (e.type === "rotate") sound.turn(e.kicked);
				else if (e.type === "hold") sound.swish();
				else if (e.type === "lock") sound.plop(e.fell);
				else if (e.type === "clear") {
					sound.pop(e.count, e.perfect);
					const words = e.perfect ? "Squeaky clean jar!" : CLEAR_WORDS[e.count];
					const combo = e.combo > 0 ? `${e.combo + 1} in a row!` : "";
					if (words || combo) say([words, combo].filter(Boolean).join(" "));
				} else if (e.type === "level") {
					sound.levelUp();
					say(`Level ${e.level}: faster!`, 1800);
				} else if (e.type === "over") finish(game, e.why);
			}
		},
		[game, say, finish],
	);

	const onTick = useCallback((g: Game) => {
		if (g !== current.current) return;
		const next = snapshot(g);
		setHud((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
	}, []);

	function start() {
		sound.unlock();
		setMessage(null);
		if (phase === "over" || game.pieces > 0 || game.startLevel !== START_LEVELS[speed]) {
			const s = Math.floor(Math.random() * 1e9);
			const g = newGame(s, START_LEVELS[speed]);
			setSeed(s);
			setGame(g);
			setHud(snapshot(g));
		}
		setPhase("play");
	}

	function chooseSpeed(s: Speed) {
		setSpeed(s);
		try {
			localStorage.setItem(SPEED_KEY, s);
		} catch {}
		const g = newGame(seed, START_LEVELS[s]);
		setGame(g);
		setHud(snapshot(g));
	}

	const togglePause = useCallback(() => {
		// Carrying on is a tap or key press: a chance to wake sound iOS put to sleep while the tab was away.
		sound.unlock();
		setPhase((p) => (p === "play" ? "paused" : p === "paused" ? "play" : p));
	}, []);

	// The keyboard: arrows or WASD, Space to drop, C or Shift to hold, Z to turn the other way, P or Escape to pause.
	useEffect(() => {
		const ignore = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return true;
			const t = e.target;
			return t instanceof HTMLElement && (t.isContentEditable || !!t.closest("input, textarea, select, dialog, [role='dialog']"));
		};
		const HELD: Record<string, keyof typeof held.current> = {
			ArrowLeft: "keyL",
			KeyA: "keyL",
			ArrowRight: "keyR",
			KeyD: "keyR",
			ArrowDown: "keyD",
			KeyS: "keyD",
		};
		const TAPS: Record<string, Action> = {
			ArrowUp: "cw",
			KeyW: "cw",
			KeyX: "cw",
			KeyZ: "ccw",
			KeyQ: "ccw",
			Space: "drop",
			KeyC: "hold",
			ShiftLeft: "hold",
			ShiftRight: "hold",
		};
		const onDown = (e: KeyboardEvent) => {
			if (ignore(e)) return;
			if (e.code === "KeyP" || e.code === "Escape") {
				if (!e.repeat) togglePause();
				return;
			}
			if (!playing) return;
			const h = HELD[e.code];
			const a = TAPS[e.code];
			if (!h && !a) return;
			// Keys the game uses don't scroll or press a focused button.
			e.preventDefault();
			// A key still down after a pause starts again on its repeat; taps never repeat.
			if (h) press(h);
			if (e.repeat) return;
			sound.unlock();
			if (a) tap(a);
		};
		const onUp = (e: KeyboardEvent) => {
			const h = HELD[e.code];
			if (h) held.current[h] = false;
		};
		const onHide = () => {
			if (document.hidden) setPhase((p) => (p === "play" ? "paused" : p));
		};
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		window.addEventListener("blur", letGo);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			window.removeEventListener("blur", letGo);
			document.removeEventListener("visibilitychange", onHide);
		};
	}, [playing, togglePause, letGo, press, tap]);

	// Play time ran out: the falling piece is the last (Time's up covers the screen after the results). More time bought
	// meanwhile takes that back.
	const clock = usePlayClockValue();
	useEffect(() => {
		const last = clock.up && phase === "play";
		if (last === game.lastPiece || game.phase !== "play") return;
		game.lastPiece = last;
		if (last) say("Play time’s up! This is your last piece.", 4000);
	}, [clock.up, phase, game, say]);

	// ── Where the jar goes: the page lays out the trays, and the scene fits the jar to the slot left between them ──
	const sceneRef = useRef<HTMLDivElement>(null);
	const slotRef = useRef<HTMLDivElement>(null);
	const [slot, setSlot] = useState<Slot | null>(null);
	useEffect(() => {
		const host = sceneRef.current;
		const el = slotRef.current;
		if (!host || !el) return;
		const measure = () => {
			const a = host.getBoundingClientRect();
			const b = el.getBoundingClientRect();
			const next = { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
			setSlot((was) =>
				was && Math.abs(was.x - next.x) + Math.abs(was.y - next.y) + Math.abs(was.w - next.w) + Math.abs(was.h - next.h) < 1 ? was : next,
			);
		};
		measure();
		const o = new ResizeObserver(measure);
		o.observe(host);
		o.observe(el);
		window.addEventListener("resize", measure);
		return () => {
			o.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, []);
	/** How many screen pixels a square is, for turning a swipe into steps. */
	const square = slot ? Math.min(slot.h / JAR_H, slot.w / JAR_W) : 30;

	// ── Swipes on the jar: across steps, down drops faster, a flick down drops, a flick up holds, a tap turns ──
	/**
	 * The swipe under way: whether there is one, what's doing it (a finger, or a mouse or pen) and its id. Kept apart
	 * rather than read off the id: iOS gives fingers huge identifiers, which can come through negative.
	 */
	const swipe = useRef({
		on: false,
		by: "touch" as "touch" | "pointer",
		id: 0,
		x0: 0,
		y0: 0,
		t0: 0,
		sx: 0,
		moved: false,
		axis: "" as "" | "x" | "y",
	});
	// Times are the events' own (when the finger touched and lifted), so a busy frame doesn't turn a tap into a hold.
	const swipeStart = (by: "touch" | "pointer", id: number, x: number, y: number, time: number) => {
		sound.unlock();
		swipe.current = { on: true, by, id, x0: x, y0: y, t0: time, sx: x, moved: false, axis: "" };
	};
	const swipeMove = (x: number, y: number) => {
		const s = swipe.current;
		// Half a square in, the swipe picks a way: across steps; up or down holds, drops faster or drops. A slanted flick
		// down never nudges the piece sideways first.
		const dx0 = x - s.x0;
		const dy0 = y - s.y0;
		if (!s.axis && Math.hypot(dx0, dy0) > square * 0.5) s.axis = Math.abs(dx0) > Math.abs(dy0) ? "x" : "y";
		if (s.axis === "y") {
			const down = dy0 > square * 1.2;
			held.current.swipeD = down;
			if (down) s.moved = true;
			return;
		}
		if (s.axis !== "x") return;
		const stepPx = square * 0.9;
		while (x - s.sx >= stepPx) {
			tap("right");
			s.sx += stepPx;
			s.moved = true;
		}
		while (s.sx - x >= stepPx) {
			tap("left");
			s.sx -= stepPx;
			s.moved = true;
		}
	};
	/** The swipe's over: lifted (`x`, `y` where it ended), or cancelled (no position: nothing more happens). */
	const swipeEnd = (x?: number, y?: number, time?: number) => {
		const s = swipe.current;
		s.on = false;
		held.current.swipeD = false;
		if (x === undefined || y === undefined || time === undefined) return;
		const dx = x - s.x0;
		const dy = y - s.y0;
		const ms = Math.max(1, time - s.t0);
		const fast = s.axis === "y" && Math.abs(dy) / ms > 0.8 && Math.abs(dy) > square * 2.5;
		if (fast) tap(dy > 0 ? "drop" : "hold");
		else if (!s.moved && Math.hypot(dx, dy) < 12 && ms < 350) tap("cw");
	};
	const swiping = useRef({ swipeStart, swipeMove, swipeEnd });
	swiping.current = { swipeStart, swipeMove, swipeEnd };
	// A finger is followed with Touch Events, which every iPad and iPhone has (newer iOS can hand a finger's pointer to
	// the canvas in ways that end a drag). The listeners aren't passive, so a held finger is never turned into a scroll,
	// a bounce or the magnifier. Only while playing: elsewhere taps on the scene stay ordinary.
	useEffect(() => {
		const el = sceneRef.current;
		if (!el || !playing) return;
		const find = (list: TouchList) => {
			const s = swipe.current;
			if (!s.on || s.by !== "touch") return null;
			for (let i = 0; i < list.length; i++) if (list[i]!.identifier === s.id) return list[i]!;
			return null;
		};
		const start = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			if (swipe.current.on) return;
			const t = e.changedTouches[0];
			if (t) swiping.current.swipeStart("touch", t.identifier, t.clientX, t.clientY, e.timeStamp);
		};
		const move = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			const t = find(e.changedTouches);
			if (t) swiping.current.swipeMove(t.clientX, t.clientY);
		};
		const end = (e: TouchEvent) => {
			const t = find(e.changedTouches);
			if (t) swiping.current.swipeEnd(t.clientX, t.clientY, e.timeStamp);
		};
		const cancel = (e: TouchEvent) => {
			if (find(e.changedTouches)) swiping.current.swipeEnd();
		};
		el.addEventListener("touchstart", start, { passive: false });
		el.addEventListener("touchmove", move, { passive: false });
		el.addEventListener("touchend", end);
		el.addEventListener("touchcancel", cancel);
		// Listening now (tests wait for this, not for the screen to say it's playing).
		el.dataset.swipes = "on";
		return () => {
			delete el.dataset.swipes;
			el.removeEventListener("touchstart", start);
			el.removeEventListener("touchmove", move);
			el.removeEventListener("touchend", end);
			el.removeEventListener("touchcancel", cancel);
			if (swipe.current.on) swiping.current.swipeEnd();
		};
	}, [playing]);
	// A mouse or pen: pointer events (a finger's are left to the touch listeners above).
	const isPointerSwipe = (id: number) => swipe.current.on && swipe.current.by === "pointer" && swipe.current.id === id;
	function onPointerDown(e: React.PointerEvent) {
		if (e.pointerType === "touch" || !playing || swipe.current.on) return;
		e.preventDefault();
		e.currentTarget.setPointerCapture?.(e.pointerId);
		swipeStart("pointer", e.pointerId, e.clientX, e.clientY, e.timeStamp);
	}
	function onPointerMove(e: React.PointerEvent) {
		if (e.pointerType !== "touch" && isPointerSwipe(e.pointerId)) swipeMove(e.clientX, e.clientY);
	}
	function onPointerEnd(e: React.PointerEvent) {
		if (e.pointerType === "touch" || !isPointerSwipe(e.pointerId)) return;
		// Capture lost by something inside (the canvas) bubbles up here too; only this element's own loss ends it.
		if (e.type === "lostpointercapture" && e.target !== e.currentTarget) return;
		if (e.type === "pointerup") swipeEnd(e.clientX, e.clientY, e.timeStamp);
		else swipeEnd();
	}

	// Dev and test only: jump to a state for screenshots, and hold the game still while one is taken.
	const seedRef = useRef(seed);
	seedRef.current = seed;
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		const pieces = (g: Game, n: number, steer = true) => {
			const until = g.pieces + n;
			for (let i = 0; i < 20000 && g.pieces < until && g.phase === "play"; i++)
				step(g, 1 / 60, steer ? autopilot(g) : { left: false, right: false, down: false, actions: ["drop"] });
			g.events.length = 0;
			void scene().then((m) => m.redrawAll(g));
			setHud(snapshot(g));
		};
		const fresh = (s: number) => {
			const g = newGame(s, START_LEVELS[speed]);
			setGame(g);
			setHud(snapshot(g));
			return g;
		};
		(window as { __THREE_GAME_TEST_HOOKS__?: unknown }).__THREE_GAME_TEST_HOOKS__ = {
			setSeed: (s: number) => {
				seedRef.current = s;
				setSeed(s);
				fresh(s);
				setPhase("ready");
				return { seed: s };
			},
			setState: async (name: string) => {
				const g = fresh(seedRef.current);
				current.current = g;
				if (name === "ready") setPhase("ready");
				else if (name === "active-play") {
					pieces(g, 34);
					setPhase("play");
				} else if (name === "late-game") {
					// A tall, messy stack: a careful start, then pieces dropped where they fall.
					pieces(g, 20);
					pieces(g, 9, false);
					setPhase("play");
				} else if (name === "results") {
					pieces(g, 40);
					pieces(g, 200, false);
					finish(g, "full");
				} else throw new Error(`Unknown state ${name}`);
				await new Promise((r) => setTimeout(r, 400));
				return { state: name };
			},
			peek: () => {
				const g = current.current;
				return { x: g.active?.x ?? null, rot: g.active?.rot ?? null, type: g.active?.type ?? null, pieces: g.pieces, score: g.score };
			},
			setAutopilot: (on: boolean) => {
				auto.current = on;
				return { autopilot: on };
			},
			setPausedForScreenshot: (paused: boolean) => {
				setFrozen(paused);
				return { paused };
			},
		};
	}, [speed, finish]);

	const running = playing && !frozen;
	// The scene is named once and kept up to date here, so a new score doesn't re-render it.
	const label = `Jelly Blocks. Score ${hud.score}, ${hud.lines} rows, level ${hud.level}.`;
	const firstLabel = useRef(label);
	useEffect(() => {
		sceneRef.current?.querySelector("[aria-label^='Jelly Blocks.']")?.setAttribute("aria-label", label);
	}, [label]);
	const inGame = phase === "play" || phase === "paused";

	return (
		<GameScreen
			panelLabel="How to play"
			goInProgress={inGame}
			scene={
				<div
					ref={sceneRef}
					className="relative size-full select-none"
					style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerEnd}
					onPointerCancel={onPointerEnd}
					onLostPointerCapture={onPointerEnd}
					data-backend={backend ?? undefined}
				>
					<NoWebGL>
						<Suspense fallback={<GameLoading label="Getting the jelly ready…" />}>
							<JellyScene
								game={game}
								input={input}
								running={running}
								slot={slot}
								onEvents={onEvents}
								onTick={onTick}
								onBackend={setBackend}
								label={firstLabel.current}
							/>
						</Suspense>
					</NoWebGL>
					<Trays hud={hud} slotRef={slotRef} />
					{/* What just happened, over the jar: it never catches a touch. */}
					<div className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center px-4">
						<p
							role="status"
							className={
								message && inGame
									? "text-center font-display text-[clamp(1.75rem,5vw,2.75rem)] font-semibold text-white [text-shadow:0_3px_0_rgb(0_0_0/0.28)]"
									: "sr-only"
							}
						>
							{message ?? ""}
						</p>
					</div>
				</div>
			}
			back={
				<Link
					to="/play/$childId/games"
					params={{ childId: child.id }}
					className="orb glass"
					aria-label="Back to Games"
					title="Back to Games"
				>
					<ArrowLeft aria-hidden />
				</Link>
			}
			eyebrow="Games"
			title={accent("Jelly Blocks")}
			orbs={
				<>
					<button
						type="button"
						className="orb glass"
						onClick={() => {
							sound.setMuted(!muted);
							setMuted(!muted);
						}}
						aria-pressed={muted}
						aria-label={muted ? "Sound on" : "Sound off"}
						title={muted ? "Sound on" : "Sound off"}
					>
						{muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
					</button>
					{inGame && (
						<button
							type="button"
							className="orb glass"
							onClick={togglePause}
							aria-label={phase === "paused" ? "Carry on" : "Pause"}
							title={phase === "paused" ? "Carry on" : "Pause"}
						>
							{phase === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
						</button>
					)}
				</>
			}
			hints={
				<>
					<Hint keys={["←", "→"]}>move</Hint>
					<Hint keys={["↑"]}>turn</Hint>
					<Hint keys={["↓"]}>faster</Hint>
					<Hint keys={["Space"]}>drop</Hint>
					<Hint keys={["C"]}>hold</Hint>
					<Hint keys={["P"]}>pause</Hint>
				</>
			}
			touch={playing && <Pad held={held} press={press} tap={tap} />}
			prompt={
				<div aria-live="polite" className="flex flex-col items-center gap-2">
					{phase === "ready" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							<p className="font-display text-2xl font-semibold">Stack the jelly!</p>
							<p className="mt-2 text-sm text-page-muted">
								Turn and drop the wobbly blocks to fill whole rows across the jar. A full row pops! Fill four at once for a jelly jackpot.
								Don’t let the jar fill to the top.
							</p>
							<fieldset className="mt-4">
								<legend className="sr-only">Starting speed</legend>
								<div className="flex justify-center gap-1.5">
									{(Object.keys(START_LEVELS) as Speed[]).map((s) => (
										<button
											key={s}
											type="button"
											className="key"
											data-variant="felt"
											data-pressed={speed === s}
											aria-pressed={speed === s}
											onClick={() => chooseSpeed(s)}
										>
											{s === "slow" ? "Slow" : s === "medium" ? "Medium" : "Fast"}
										</button>
									))}
								</div>
							</fieldset>
							{best > 0 && (
								<p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
									<Trophy className="size-4" aria-hidden /> Your best: <span className="tabular-nums">{best.toLocaleString()}</span>
								</p>
							)}
						</div>
					)}
					{phase === "paused" && <p className="glass glass-pill font-display font-semibold">Paused</p>}
					{phase === "over" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							<p className="font-display text-3xl font-semibold">{ended === "time" ? "Time’s up!" : "The jar’s full!"}</p>
							<p className="mt-1 text-sm">
								You popped <span className="font-semibold tabular-nums">{hud.lines}</span> {hud.lines === 1 ? "row" : "rows"} and scored{" "}
								<span className="font-semibold tabular-nums">{hud.score.toLocaleString()}</span>
								{hud.level > START_LEVELS[speed] && <>, up to level {hud.level}</>}.
							</p>
							{earned > 0 && (
								<p className="mt-3 flex justify-center">
									<Tickets count={earned} />
								</p>
							)}
							<p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
								<Trophy className="size-4" aria-hidden />{" "}
								{newBest ? (
									"A new best!"
								) : (
									<>
										Your best: <span className="tabular-nums">{best.toLocaleString()}</span>
									</>
								)}
							</p>
						</div>
					)}
				</div>
			}
			actions={
				phase === "ready" ? (
					<button type="button" className="key" data-variant="go" onClick={start}>
						<Play className="size-5" aria-hidden /> Start
					</button>
				) : phase === "over" ? (
					<>
						<button type="button" className="key" onClick={start}>
							<RotateCcw className="size-5" aria-hidden /> Play again
						</button>
						<Link to="/play/$childId/games" params={{ childId: child.id }} className="key" data-variant="felt">
							Games
						</Link>
					</>
				) : phase === "paused" ? (
					<button type="button" className="key" onClick={togglePause}>
						<Play className="size-5" aria-hidden /> Carry on
					</button>
				) : null
			}
		/>
	);
}

/** Bottom padding under the jar: the touch keys' row on a touch screen, the hints on a laptop, little on a phone on its side. */
const SLOT_PAD =
	"pt-[calc(max(0.75rem,var(--safe-top))+3.6rem)] pb-[calc(max(0.75rem,var(--safe-bottom))+4.75rem)] md:pt-[calc(max(1.5rem,var(--safe-top))+4.75rem)] [@media(pointer:fine)_and_(min-width:701px)]:pb-[calc(max(1.5rem,var(--safe-bottom))+2.5rem)] short:!pt-[max(0.75rem,var(--safe-top))] short:!pb-[max(0.75rem,var(--safe-bottom))]";

/**
 * Hold and Next beside the jar on wide screens and a phone on its side; on an upright phone a strip above it with the
 * score. The middle cell is the slot the scene fits the jar into.
 */
function Trays({ hud, slotRef }: { hud: Hud; slotRef: React.RefObject<HTMLDivElement | null> }) {
	const stats = (
		<dl className="grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5 text-sm">
			<dt className="text-page-muted">Score</dt>
			<dd className="text-right font-display text-xl font-semibold tabular-nums">{hud.score.toLocaleString()}</dd>
			<dt className="text-page-muted">Rows</dt>
			<dd className="text-right font-semibold tabular-nums">{hud.lines}</dd>
			<dt className="text-page-muted">Level</dt>
			<dd className="text-right font-semibold tabular-nums">{hud.level}</dd>
		</dl>
	);
	return (
		<div
			className={`pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 px-[max(0.75rem,var(--safe-left))] md:grid-cols-[1fr_auto_1fr] md:grid-rows-[minmax(0,1fr)] md:gap-5 short:grid-cols-[1fr_auto_1fr] short:grid-rows-[minmax(0,1fr)] ${SLOT_PAD}`}
		>
			<div className="hidden items-center justify-end md:flex short:flex">
				<Tray label="Hold">
					<div className={`grid h-12 w-20 place-items-center ${hud.holdUsed ? "opacity-40" : ""}`}>
						{hud.hold ? <MiniPiece type={hud.hold} size={18} /> : null}
					</div>
				</Tray>
			</div>
			{/* An upright phone: one strip above the jar. */}
			<div className="glass flex items-center justify-between gap-3 rounded-2xl px-3 py-2 md:hidden short:hidden">
				<section className="flex flex-col items-center" aria-label="Hold">
					<h2 className="eyebrow">Hold</h2>
					<div className={`grid h-8 w-12 place-items-center ${hud.holdUsed ? "opacity-40" : ""}`}>
						{hud.hold ? <MiniPiece type={hud.hold} size={11} /> : null}
					</div>
				</section>
				<p className="text-center text-sm">
					<span className="block font-display text-xl font-semibold leading-tight tabular-nums">{hud.score.toLocaleString()}</span>
					<span className="text-page-muted tabular-nums">
						{hud.lines} rows · level {hud.level}
					</span>
				</p>
				<section className="flex flex-col items-center" aria-label="Next">
					<h2 className="eyebrow">Next</h2>
					<div className="flex h-8 items-center gap-1.5">
						{hud.next.map((t, i) => (
							<MiniPiece key={i} type={t} size={i === 0 ? 10 : 7} />
						))}
					</div>
				</section>
			</div>
			<div ref={slotRef} className="h-full w-full md:aspect-[119/218] md:w-auto short:aspect-[119/218] short:w-auto" aria-hidden />
			<div className="hidden items-center justify-start md:flex short:flex">
				<div className="flex flex-col gap-3">
					<Tray label="Next">
						<div className="flex w-20 flex-col items-center gap-3">
							{hud.next.map((t, i) => (
								<div key={i} className="grid h-10 place-items-center">
									<MiniPiece type={t} size={i === 0 ? 18 : 13} />
								</div>
							))}
						</div>
					</Tray>
					<div className="glass rounded-2xl p-3 short:hidden">{stats}</div>
				</div>
			</div>
		</div>
	);
}

function Tray({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section className="glass rounded-2xl p-3" aria-label={label}>
			<h2 className="eyebrow mb-2">{label}</h2>
			{children}
		</section>
	);
}

/** A piece drawn flat in its flavour, for the trays. */
function MiniPiece({ type, size }: { type: PieceType; size: number }) {
	const cells = shape(type, 0);
	const xs = cells.map(([x]) => x);
	const ys = cells.map(([, y]) => y);
	const minX = Math.min(...xs);
	const maxY = Math.max(...ys);
	const w = Math.max(...xs) - minX + 1;
	const h = maxY - Math.min(...ys) + 1;
	return (
		<svg viewBox={`0 0 ${w * 10} ${h * 10}`} width={w * size} height={h * size} role="img" aria-label={`${PIECE_LABELS[type]} piece`}>
			{cells.map(([x, y]) => (
				<g key={`${x}-${y}`} transform={`translate(${(x - minX) * 10} ${(maxY - y) * 10})`}>
					<rect x="0.6" y="0.6" width="8.8" height="8.8" rx="2.6" fill={FLAVOURS[type]} />
					<rect x="2" y="1.8" width="4" height="2" rx="1" fill="#fff" opacity="0.45" />
				</g>
			))}
		</svg>
	);
}

const PIECE_LABELS: Record<PieceType, string> = { 1: "Long", 2: "Square", 3: "T", 4: "S", 5: "Z", 6: "J", 7: "L" };

/**
 * The touch keys, in two groups for two thumbs: move left, right and faster on the left; hold, drop and turn on the
 * right. Moves repeat while held (the game's own repeat, as with keys); a quick tap still steps once. A key pressed
 * from a keyboard, Switch Control or VoiceOver (a click with no pointer) does the same as a tap. `touch-action: none`:
 * a held key that drifts a little stays held instead of turning into a scroll.
 */
function Pad({
	held,
	press,
	tap,
}: {
	held: React.RefObject<Record<"padL" | "padR" | "padD", boolean>>;
	press: (k: "padL" | "padR" | "padD") => void;
	tap: (a: Action) => void;
}) {
	const hold = (k: "padL" | "padR" | "padD", a: Action | null) => {
		const off = () => {
			held.current[k] = false;
		};
		return {
			onPointerDown: (e: React.PointerEvent) => {
				e.preventDefault();
				sound.unlock();
				press(k);
			},
			onPointerUp: off,
			onPointerCancel: off,
			onPointerLeave: off,
			onClick: (e: React.MouseEvent) => {
				if (e.detail === 0 && a) tap(a);
			},
		};
	};
	const once = (a: Action) => ({
		onPointerDown: (e: React.PointerEvent) => {
			e.preventDefault();
			sound.unlock();
			tap(a);
		},
		onClick: (e: React.MouseEvent) => {
			if (e.detail === 0) tap(a);
		},
	});
	const key = "orb glass size-13 md:size-14 [touch-action:none] [&>svg]:size-7";
	return (
		<div className="flex items-end justify-between gap-2">
			<div className="flex gap-1.5 md:gap-2">
				<button type="button" className={key} aria-label="Move left" {...hold("padL", "left")}>
					<ChevronLeft aria-hidden />
				</button>
				<button type="button" className={key} aria-label="Move right" {...hold("padR", "right")}>
					<ChevronRight aria-hidden />
				</button>
				<button type="button" className={key} aria-label="Faster" {...hold("padD", null)}>
					<ChevronDown aria-hidden />
				</button>
			</div>
			<div className="flex gap-1.5 md:gap-2">
				<button type="button" className={`${key} font-display text-sm font-semibold`} aria-label="Hold" {...once("hold")}>
					Hold
				</button>
				<button type="button" className={key} aria-label="Drop" {...once("drop")}>
					<ChevronsDown aria-hidden />
				</button>
				<button type="button" className={key} aria-label="Turn" {...once("cw")}>
					<RotateCw aria-hidden />
				</button>
			</div>
		</div>
	);
}
