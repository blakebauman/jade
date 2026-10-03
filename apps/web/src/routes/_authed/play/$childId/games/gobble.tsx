import { MAX_TICKETS_PER_GO } from "@jade/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KINDS } from "#/components/gobble/kinds.ts";
import {
	autopilot,
	COUNTDOWN_S,
	type Game,
	type GameEvent,
	newGame,
	PLAYER,
	R0,
	ranking,
	step,
	timeLeft,
} from "#/components/gobble/sim.ts";
import * as sound from "#/components/gobble/sound.ts";
import { Tickets } from "#/components/play/PlayBits.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { accent, GameScreen, GameStatus, Hint } from "#/components/roxy/GameScreen.tsx";
import { useDrive } from "#/components/roxy/world/useDrive.ts";
import { useChild } from "#/lib/child.ts";
import { earnTickets } from "#/lib/play.ts";

const scene = () => import("#/components/gobble/GobbleScene.tsx");
// three.js only loads on game screens.
const GobbleScene = lazy(() => scene().then((m) => ({ default: m.GobbleScene })));

export const Route = createFileRoute("/_authed/play/$childId/games/gobble")({
	component: GobbleScreen,
});

type Phase = "ready" | "play" | "paused" | "over";

/** A drag steering the hole (see `drag` in the screen). `ox`/`oy` is the stick's middle, `x`/`y` the steer (-1…1). */
type Drag = { on: boolean; by: "touch" | "pointer" | ""; id: number; ox: number; oy: number; x: number; y: number };
const NO_DRAG: Drag = { on: false, by: "", id: 0, ox: 0, oy: 0, x: 0, y: 0 };
const isPointerDrag = (d: Drag, id: number) => d.on && d.by === "pointer" && d.id === id;

/** What the HUD shows, refreshed a few times a second from the round. */
type Hud = {
	left: number;
	countdown: number;
	board: { i: number; name: string; colour: string; score: number; player: boolean; rank: number }[];
	score: number;
	rank: number;
	/** Gobbled: seconds until the player's hole is back. */
	back: number;
};

const bestKey = (childId: string) => `jade.gobble.best.${childId}`;
function readBest(childId: string) {
	try {
		return Number(localStorage.getItem(bestKey(childId))) || 0;
	} catch {
		return 0;
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
					This device can’t show 3D games, so Gobble Town can’t be played here.
				</p>
			);
		return this.props.children;
	}
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function GobbleScreen() {
	const child = useChild();
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [game, setGame] = useState(() => newGame(seed, child.name));
	const [phase, setPhase] = useState<Phase>("ready");
	const [hud, setHud] = useState<Hud>(() => snapshot(game));
	const [message, setMessage] = useState<string | null>(null);
	const [best, setBest] = useState(() => readBest(child.id));
	const [newBest, setNewBest] = useState(false);
	/** Tickets this round paid (the server pays each round once, at most 30, and nothing while games are Free). */
	const [earned, setEarned] = useState(0);
	const [muted, setMuted] = useState(sound.isMuted);
	const [frozen, setFrozen] = useState(false);
	const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const lastPip = useRef(-1);

	const keys = useDrive(phase === "play");
	/**
	 * The drag steering the hole: whether there is one, what's doing it (a finger, or a mouse or pen) and its id. Kept
	 * apart rather than read off the id: iOS gives fingers huge identifiers, which can come through negative.
	 */
	const drag = useRef<Drag>({ ...NO_DRAG });
	const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
	// The scene reads this each frame: a drag wins over the keys.
	const steer = useMemo(
		() => ({
			get x() {
				return drag.current.on ? drag.current.x : keys.current.x;
			},
			get y() {
				return drag.current.on ? drag.current.y : keys.current.y;
			},
		}),
		[keys],
	);
	const steerRef = useMemo(() => ({ current: steer }), [steer]);

	const say = useCallback((text: string, ms = 2600) => {
		setMessage(text);
		clearTimeout(messageTimer.current);
		messageTimer.current = setTimeout(() => setMessage(null), ms);
	}, []);
	useEffect(() => () => clearTimeout(messageTimer.current), []);

	const finish = useCallback(
		(g: Game) => {
			// The HUD refreshes a few times a second; the results show the round exactly as it ended.
			setHud(snapshot(g));
			setPhase("over");
			const me = g.holes[PLAYER]!;
			const won = ranking(g)[0]!.i === PLAYER;
			sound.finish(won);
			const tickets = Math.min(MAX_TICKETS_PER_GO, Math.round(me.score / 10) + (won ? 5 : 0));
			setEarned(tickets);
			// Kept on the device and sent now, or when back online.
			if (tickets > 0) void earnTickets(child.id, `gobble:${seed}`, tickets);
			const was = readBest(child.id);
			setNewBest(me.score > was);
			if (me.score > was) {
				setBest(me.score);
				try {
					localStorage.setItem(bestKey(child.id), String(me.score));
				} catch {}
			}
		},
		[child.id, seed],
	);

	const onEvents = useCallback(
		(events: GameEvent[]) => {
			for (const e of events) {
				if (e.type === "gulp" && e.hole === PLAYER) sound.gulp(e.value);
				else if (e.type === "milestone") {
					sound.chime();
					const k = KINDS[e.kind];
					say(`You’re big enough for ${k.label}!`);
				} else if (e.type === "gobbled") {
					if (e.eater === PLAYER) {
						sound.gobble(true);
						say(`You gobbled ${game.holes[e.eaten]!.name}!`);
					} else if (e.eaten === PLAYER) {
						sound.gobble(false);
						say(`${game.holes[e.eater]!.name} gobbled you! You keep your score.`, 3200);
					}
				} else if (e.type === "start") sound.pip(true);
				else if (e.type === "end") finish(game);
			}
		},
		[game, say, finish],
	);

	const onTick = useCallback((g: Game) => {
		const next = snapshot(g);
		// Countdown pips, once per second.
		if (g.phase === "countdown" && next.countdown !== lastPip.current && next.countdown > 0) {
			lastPip.current = next.countdown;
			sound.pip(false);
		}
		setHud((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
	}, []);

	function start() {
		sound.unlock();
		lastPip.current = -1;
		setMessage(null);
		if (phase === "over") {
			const s = Math.floor(Math.random() * 1e9);
			const g = newGame(s, child.name);
			setSeed(s);
			setGame(g);
			setHud(snapshot(g));
		}
		setPhase("play");
	}

	const togglePause = useCallback(() => {
		// Carrying on is a tap or key press: a chance to wake sound iOS put to sleep while the tab was away.
		sound.unlock();
		setPhase((p) => (p === "play" ? "paused" : p === "paused" ? "play" : p));
	}, []);
	// P or Escape pauses; switching away from the tab pauses too.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.code !== "KeyP" && e.code !== "Escape") || e.repeat || e.defaultPrevented) return;
			// Escape in a dialog belongs to the dialog; typing a P isn't a pause.
			const t = e.target;
			if (t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select, dialog, [role='dialog']"))) return;
			togglePause();
		};
		const onHide = () => {
			if (document.hidden) setPhase((p) => (p === "play" ? "paused" : p));
		};
		window.addEventListener("keydown", onKey);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.removeEventListener("visibilitychange", onHide);
		};
	}, [togglePause]);

	// Dev and test only: jump to a state for screenshots, and hold the round still while one is taken.
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		const run = (g: Game, seconds: number) => {
			for (let t = 0; t < seconds && g.phase !== "over"; t += 1 / 60) step(g, 1 / 60, autopilot(g));
			g.events.length = 0;
			void scene().then((m) => m.redrawAll(g));
			setHud(snapshot(g));
		};
		const fresh = (s: number) => {
			const g = newGame(s, child.name);
			setGame(g);
			return g;
		};
		(window as { __THREE_GAME_TEST_HOOKS__?: unknown }).__THREE_GAME_TEST_HOOKS__ = {
			setSeed: (s: number) => {
				setSeed(s);
				fresh(s);
				setPhase("ready");
				return { seed: s };
			},
			setState: async (name: string) => {
				const g = fresh(seed);
				if (name === "ready") setPhase("ready");
				else if (name === "active-play") {
					run(g, COUNTDOWN_S + 14);
					setPhase("play");
				} else if (name === "late-game") {
					run(g, COUNTDOWN_S + 95);
					setPhase("play");
				} else if (name === "gobbled") {
					run(g, COUNTDOWN_S + 40);
					const me = g.holes[PLAYER]!;
					Object.assign(me, { size: 0, r: R0, out: g.time + 3 });
					setPhase("play");
					setMessage(`${g.holes[1]!.name} gobbled you! You keep your score.`);
				} else if (name === "at-school" || name === "at-petshop") {
					// QA: the generated landmarks up close.
					Object.assign(g.holes[PLAYER]!, name === "at-school" ? { x: 9.5, z: 55.5 } : { x: 49.5, z: 21 });
					void scene().then((m) => m.redrawAll(g));
					setPhase("ready");
				} else if (name === "results") {
					run(g, COUNTDOWN_S + 200);
					finish(g);
				} else throw new Error(`Unknown state ${name}`);
				await new Promise((r) => setTimeout(r, 400));
				return { state: name };
			},
			setPausedForScreenshot: (paused: boolean) => {
				setFrozen(paused);
				return { paused };
			},
		};
	}, [child.name, seed, finish]);

	const me = game.holes[PLAYER]!;
	const running = phase === "play" && !frozen;
	const out = hud.back > 0;
	const won = phase === "over" && hud.rank === 1;

	// Steering by drag. A finger is followed with Touch Events, which every iPad and iPhone has (older iPadOS has no
	// pointer events at all, and newer iOS can hand a finger's pointer to the canvas in ways that end a drag); the
	// listeners aren't passive, so a held finger is never turned into a scroll, a bounce or the magnifier. A mouse or
	// pen uses pointer events. Only during a round: elsewhere taps on the scene stay ordinary.
	const sceneRef = useRef<HTMLDivElement>(null);
	const begin = (by: Drag["by"], id: number, x: number, y: number) => {
		drag.current = { on: true, by, id, ox: x, oy: y, x: 0, y: 0 };
		sound.unlock();
		setStick({ x, y, dx: 0, dy: 0 });
		debugLog("begin", `${by}#${id} @${Math.round(x)},${Math.round(y)}`);
	};
	const moveTo = (x: number, y: number) => {
		const d = drag.current;
		let dx = x - d.ox;
		let dy = y - d.oy;
		const len = Math.hypot(dx, dy);
		// A floating stick: 48px out is full speed; it follows the finger if it goes further.
		if (len > 48) {
			d.ox += (dx * (len - 48)) / len;
			d.oy += (dy * (len - 48)) / len;
			dx = x - d.ox;
			dy = y - d.oy;
		}
		const k = len < 6 ? 0 : 1 / 48;
		d.x = dx * k;
		d.y = -dy * k;
		setStick({ x: d.ox, y: d.oy, dx, dy });
	};
	const finishDrag = (why: string) => {
		drag.current = { ...NO_DRAG };
		setStick(null);
		debugLog("end", why);
	};
	const steering = useRef({ begin, moveTo, finishDrag });
	steering.current = { begin, moveTo, finishDrag };
	useEffect(() => {
		const el = sceneRef.current;
		if (!el || phase !== "play") return;
		const find = (list: TouchList) => {
			const d = drag.current;
			if (!d.on || d.by !== "touch") return null;
			for (let i = 0; i < list.length; i++) if (list[i]!.identifier === d.id) return list[i]!;
			return null;
		};
		const start = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			if (drag.current.on) return;
			const t = e.changedTouches[0];
			if (t) steering.current.begin("touch", t.identifier, t.clientX, t.clientY);
		};
		const move = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			const t = find(e.changedTouches);
			if (t) steering.current.moveTo(t.clientX, t.clientY);
		};
		const stop = (e: TouchEvent) => {
			if (find(e.changedTouches)) steering.current.finishDrag(e.type);
		};
		el.addEventListener("touchstart", start, { passive: false });
		el.addEventListener("touchmove", move, { passive: false });
		el.addEventListener("touchend", stop);
		el.addEventListener("touchcancel", stop);
		return () => {
			el.removeEventListener("touchstart", start);
			el.removeEventListener("touchmove", move);
			el.removeEventListener("touchend", stop);
			el.removeEventListener("touchcancel", stop);
			if (drag.current.on) steering.current.finishDrag("round paused or over");
		};
	}, [phase]);

	// A mouse or pen: pointer events (a finger's pointer events are left to the touch listeners above).
	function onPointerDown(e: React.PointerEvent) {
		if (e.pointerType === "touch" || phase !== "play" || drag.current.on) return;
		// No text selection or focus change while steering.
		e.preventDefault();
		e.currentTarget.setPointerCapture?.(e.pointerId);
		begin("pointer", e.pointerId, e.clientX, e.clientY);
	}
	function onPointerMove(e: React.PointerEvent) {
		if (e.pointerType !== "touch" && isPointerDrag(drag.current, e.pointerId)) moveTo(e.clientX, e.clientY);
	}
	function onPointerEnd(e: React.PointerEvent) {
		if (e.pointerType === "touch" || !isPointerDrag(drag.current, e.pointerId)) return;
		// Capture lost by something inside (the canvas) bubbles up here too; only this element's own loss ends it.
		if (e.type === "lostpointercapture" && e.target !== e.currentTarget) return;
		finishDrag(e.type);
	}

	return (
		<GameScreen
			panelLabel="How to play"
			goInProgress={phase === "play" || phase === "paused"}
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
				>
					<NoWebGL>
						<Suspense fallback={<GameLoading />}>
							<GobbleScene
								game={game}
								steer={steerRef}
								running={running}
								onEvents={onEvents}
								onTick={onTick}
								label={`Gobble Town. You are ${ordinal(hud.rank)}.`}
							/>
						</Suspense>
					</NoWebGL>
					<TouchDebug phase={phase} drag={drag} />
					{stick && (
						<div className="pointer-events-none fixed z-30" style={{ left: stick.x - 44, top: stick.y - 44 }} aria-hidden>
							<div className="glass size-[88px] rounded-full opacity-80" />
							<div
								className="absolute top-[26px] left-[26px] size-9 rounded-full bg-roxy shadow-lg"
								style={{ transform: `translate(${stick.dx * 0.9}px, ${stick.dy * 0.9}px)` }}
							/>
						</div>
					)}
					{phase !== "ready" && phase !== "over" && <Timer left={hud.left} countdown={hud.countdown} />}
					{(phase === "play" || phase === "paused") && <Board board={hud.board} />}
					{/* What just happened, bottom centre, where a thumb steers: it never catches a touch. */}
					<div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.75rem,var(--safe-bottom))+0.25rem)] flex flex-col items-center gap-2 px-3 md:bottom-[max(1.5rem,var(--safe-bottom))]">
						{phase === "play" && out && <p className="glass glass-pill font-display font-semibold">Back in {Math.ceil(hud.back)}…</p>}
						<p role="status" className={message && phase === "play" ? "glass glass-pill text-center text-sm font-medium" : "sr-only"}>
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
			title={accent("Gobble Town")}
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
					{(phase === "play" || phase === "paused") && (
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
			status={
				// On a phone the leaderboard says the same, and this corner is the clock's.
				phase !== "ready" && (
					<div className="max-md:hidden">
						<GameStatus>
							<span className="tabular-nums">{hud.score}</span> gobbled · {ordinal(hud.rank)}
						</GameStatus>
					</div>
				)
			}
			hints={
				<>
					<Hint keys={["W", "A", "S", "D"]}>steer</Hint>
					<Hint keys={["Drag"]}>steer</Hint>
					<Hint keys={["P"]}>pause</Hint>
				</>
			}
			prompt={
				<div aria-live="polite" className="flex flex-col items-center gap-2">
					{phase === "ready" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							<p className="font-display text-2xl font-semibold">You’re a hungry hole!</p>
							<p className="mt-2 text-sm text-page-muted">
								Steer round town and gobble things smaller than you. Grow big enough for cars, then houses, then the clock tower. Steer
								clear of bigger holes!
							</p>
							{best > 0 && (
								<p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
									<Trophy className="size-4" aria-hidden /> Your best: <span className="tabular-nums">{best}</span>
								</p>
							)}
						</div>
					)}
					{phase === "paused" && <p className="glass glass-pill font-display font-semibold">Paused</p>}
					{phase === "over" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							<p className="font-display text-3xl font-semibold">{won ? "You’re the biggest!" : `You came ${ordinal(hud.rank)}!`}</p>
							<p className="mt-1 text-sm">
								You gobbled <span className="font-semibold tabular-nums">{hud.score}</span>
								{me.gobbles > 0 && ` and ${me.gobbles} ${me.gobbles === 1 ? "hole" : "holes"}`}.
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
										Your best: <span className="tabular-nums">{best}</span>
									</>
								)}
							</p>
							<ol className="mt-4 space-y-1 text-left text-sm">
								{hud.board.slice(0, 5).map((b) => (
									<li key={b.i} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${b.player ? "bg-roxy/15 font-semibold" : ""}`}>
										<span className="w-5 tabular-nums text-page-muted">{b.rank}</span>
										<span className="size-3 shrink-0 rounded-full" style={{ background: b.colour }} aria-hidden />
										<span className="min-w-0 flex-1 truncate">{b.player ? `${b.name} (you)` : b.name}</span>
										<span className="tabular-nums">{b.score}</span>
									</li>
								))}
							</ol>
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

function snapshot(g: Game): Hud {
	const order = ranking(g);
	const me = g.holes[PLAYER]!;
	return {
		left: Math.ceil(timeLeft(g)),
		countdown: g.phase === "countdown" ? Math.ceil(COUNTDOWN_S - g.time) : 0,
		board: order.map((e, k) => ({ i: e.i, name: e.h.name, colour: e.h.colour, score: e.h.score, player: e.h.player, rank: k + 1 })),
		score: me.score,
		rank: order.findIndex((e) => e.i === PLAYER) + 1,
		back: me.out ? Math.max(0, me.out - g.time) : 0,
	};
}

/** The clock, top centre; during the countdown, the big 3, 2, 1. */
function Timer({ left, countdown }: { left: number; countdown: number }) {
	if (countdown > 0)
		return (
			<p
				className="pointer-events-none absolute inset-x-0 top-[38%] text-center font-display text-[clamp(4rem,14vw,8rem)] font-semibold text-white [text-shadow:0_4px_0_rgb(0_0_0/0.25)]"
				aria-live="assertive"
			>
				{countdown}
			</p>
		);
	const low = left <= 10;
	return (
		<p
			className={`glass glass-pill pointer-events-none absolute top-[max(0.75rem,var(--safe-top))] left-1/2 -translate-x-1/2 font-display text-xl font-semibold tabular-nums md:top-[max(1.5rem,var(--safe-top))] max-md:top-[calc(max(0.75rem,var(--safe-top))+3.6rem)] max-md:left-[calc(max(0.75rem,var(--safe-left))+3.75rem)] max-md:translate-x-0 ${low ? "text-roxy" : ""}`}
			role="timer"
			aria-label={`${left} seconds left`}
		>
			{clock(left)}
		</p>
	);
}

/** The leaderboard, top right under the round keys: the top five, and the player if they're further down. */
function Board({ board }: { board: Hud["board"] }) {
	const top = board.slice(0, 5);
	const me = board.find((b) => b.player);
	const rows = me && !top.includes(me) ? [...top.slice(0, 4), me] : top;
	return (
		<ol
			className="glass pointer-events-none absolute top-[calc(max(0.75rem,var(--safe-top))+3.6rem)] right-[max(0.75rem,var(--safe-right))] w-40 space-y-0.5 rounded-2xl p-2 text-xs md:top-[calc(max(1.5rem,var(--safe-top))+3.8rem)] md:right-[max(1.5rem,var(--safe-right))] md:w-48 md:text-sm"
			aria-label="Leaderboard"
		>
			{rows.map((b) => (
				<li key={b.i} className={`flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 ${b.player ? "bg-roxy/20 font-semibold" : ""}`}>
					<span className="w-4 tabular-nums text-page-muted">{b.rank}</span>
					<span className="size-2.5 shrink-0 rounded-full" style={{ background: b.colour }} aria-hidden />
					<span className="min-w-0 flex-1 truncate">{b.player ? "You" : b.name}</span>
					<span className="tabular-nums">{b.score}</span>
				</li>
			))}
		</ol>
	);
}

// ── ?debug=touch: what this device sends when a finger touches the town, on screen (for an iPad with no Mac to inspect it) ──

const debugOn = () => {
	try {
		return new URLSearchParams(window.location.search).get("debug") === "touch";
	} catch {
		return false;
	}
};
let debugLines: string[] = [];
let debugBump: (() => void) | null = null;
function debugLog(kind: string, detail: string) {
	if (!debugBump) return;
	debugLines = [`${(performance.now() / 1000).toFixed(1)} ${kind} ${detail}`, ...debugLines].slice(0, 14);
	debugBump();
}

/** The last few touch and pointer events anywhere on the page, what's under the finger, and whether steering took it. */
function TouchDebug({ phase, drag }: { phase: Phase; drag: React.RefObject<Drag> }) {
	const [on] = useState(debugOn);
	const [, setN] = useState(0);
	useEffect(() => {
		if (!on) return;
		debugBump = () => setN((n) => n + 1);
		const name = (t: EventTarget | null) => {
			if (!(t instanceof Element)) return String(t);
			const cls = typeof t.className === "string" ? t.className.split(" ").slice(0, 2).join(".") : "";
			return `${t.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
		};
		// Moves a few times a second each, so a burst of pointer moves doesn't crowd out the touch ones.
		const lastMove: Record<string, number> = {};
		const log = (e: Event) => {
			if (e.type.endsWith("move")) {
				if (performance.now() - (lastMove[e.type] ?? 0) < 400) return;
				lastMove[e.type] = performance.now();
			}
			const p = e as PointerEvent;
			const t = e as TouchEvent;
			const at = "clientX" in p ? p : t.changedTouches?.[0];
			const under = at ? name(document.elementFromPoint(at.clientX, at.clientY)) : "";
			const kind = "pointerType" in p ? `${p.pointerType}#${p.pointerId}` : `touches:${t.touches?.length ?? "?"}`;
			debugLog(e.type, `${kind} on ${name(e.target)} under ${under}${e.defaultPrevented ? " (prevented)" : ""}`);
		};
		const types = [
			"pointerdown",
			"pointermove",
			"pointerup",
			"pointercancel",
			"lostpointercapture",
			"touchstart",
			"touchmove",
			"touchend",
			"touchcancel",
		];
		for (const ty of types) window.addEventListener(ty, log, true);
		debugLog("debug", `PointerEvent:${"PointerEvent" in window} touch:${"ontouchstart" in window} ${navigator.userAgent.slice(0, 90)}`);
		return () => {
			for (const ty of types) window.removeEventListener(ty, log, true);
			debugBump = null;
		};
	}, [on]);
	if (!on) return null;
	const d = drag.current;
	return (
		<pre className="pointer-events-none fixed top-24 left-2 z-40 max-w-[min(34rem,95vw)] overflow-hidden rounded-lg bg-black/75 p-2 text-[11px] leading-tight whitespace-pre-wrap text-white">
			{`phase ${phase} · drag ${d.on ? `${d.by}#${d.id} steer ${d.x.toFixed(2)},${d.y.toFixed(2)}` : "none"}\n${debugLines.join("\n")}`}
		</pre>
	);
}
