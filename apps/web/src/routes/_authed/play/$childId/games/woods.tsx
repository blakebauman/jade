import {
	ANIMAL_LABEL,
	B,
	BLOCKS,
	blockInfo,
	canPlace,
	DAY_S,
	EMOTES,
	type Emote,
	FUEL_MAX,
	phaseAt,
	REACH_ANIMAL,
	REACH_FIRE,
} from "@jade/core/woods";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Flame, Hand, Heart, Moon, Pause, PawPrint, Play, Star, Sun, Volume2, VolumeX, WifiOff } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tickets } from "#/components/play/PlayBits.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { accent, GameScreen, GameStatus, Hint } from "#/components/roxy/GameScreen.tsx";
import { TouchControls } from "#/components/roxy/TouchControls.tsx";
import { useDrive } from "#/components/roxy/world/useDrive.ts";
import { drawAtlas, tileImage } from "#/components/woods/atlas.ts";
import { type Controls, turn } from "#/components/woods/controls.ts";
import * as sound from "#/components/woods/sound.ts";
import { IslandState, type WorldEvent, woodsUrl } from "#/components/woods/world.ts";
import { api } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { useCoarsePointer } from "#/lib/hooks.ts";
import { earnTickets, useGamesFree } from "#/lib/play.ts";

const scene = () => import("#/components/woods/WoodsScene.tsx");
// three.js only loads on game screens.
const WoodsScene = lazy(() => scene().then((m) => ({ default: m.WoodsScene })));

export const Route = createFileRoute("/_authed/play/$childId/games/woods")({
	component: WoodsScreen,
});

type Phase = "ready" | "play" | "paused";

/** What the HUD shows, refreshed a few times a second from the island. */
type Hud = {
	status: IslandState["status"];
	night: boolean;
	/** The sky is dark enough that words on it need light ink. */
	dark: boolean;
	nightNo: number;
	/** Minutes until the change (dawn or nightfall), rounded up. */
	minutes: number;
	fuel: number;
	nights: number;
	home: number;
	inv: Record<number, number>;
	others: number;
	/** What E (or the Use button) would do here. */
	use: { kind: "feed"; block: number } | { kind: "pickup"; id: string; label: string } | null;
};

const MOUSE_TURN = 0.0024;
const TOUCH_TURN = 0.0058;
/** How long a finger rests on the scene before it starts mining (a quick tap builds instead). */
const HOLD_MS = 260;
const FUEL_ORDER = [B.log, B.planks, B.coal];

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
					This device can’t show 3D games, so Campfire Woods can’t be played here.
				</p>
			);
		return this.props.children;
	}
}

function WoodsScreen() {
	const child = useChild();
	const free = useGamesFree(child.id);
	const coarse = useCoarsePointer();
	/** Whose island: this family's (undefined), or a linked friend family's. */
	const [island, setIsland] = useState<string | undefined>(undefined);
	const world = useMemo(() => new IslandState(woodsUrl(child.id, island)), [child.id, island]);
	const [phase, setPhase] = useState<Phase>("ready");
	const [hud, setHud] = useState<Hud>(() => readHud(world, null));
	const [muted, setMuted] = useState(sound.isMuted);
	const [message, setMessage] = useState<ReactNode>(null);
	const [kicked, setKicked] = useState<string | null>(null);
	const [selected, setSelected] = useState<number>(B.woolRed);
	const [frozen, setFrozen] = useState(false);
	/** The mouse is captured for looking round (a laptop). Escape lets it go; a click on the scene takes it back. */
	const [captured, setCaptured] = useState(false);
	const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sceneRef = useRef<HTMLDivElement>(null);

	const drive = useDrive(phase === "play");
	const controls = useMemo<Controls>(
		() => ({
			drive,
			look: { yaw: 0, pitch: -0.15 },
			mining: false,
			place: false,
			aim: null,
			selected: B.woolRed,
			body: null,
			target: null,
			progress: 0,
		}),
		[drive],
	);
	controls.selected = selected;

	const say = useCallback((text: ReactNode, ms = 3200) => {
		setMessage(text);
		clearTimeout(messageTimer.current);
		messageTimer.current = setTimeout(() => setMessage(null), ms);
	}, []);
	useEffect(() => () => clearTimeout(messageTimer.current), []);

	// The island: connect while this screen is open.
	useEffect(() => {
		world.connect();
		return () => world.close();
	}, [world]);

	useEffect(
		() =>
			world.listen((e: WorldEvent) => {
				if (e.t === "ready" && !world.island.mine)
					say(
						world.island.build
							? `You’re visiting ${world.island.label}!`
							: `You’re visiting ${world.island.label}. You can look round, but not build here.`,
						4500,
					);
				else if (e.t === "join") say(`${e.label} is here!`);
				else if (e.t === "leave") say(`${e.label} went home.`);
				else if (e.t === "night") {
					sound.owl();
					say(`Night ${e.night}. Keep the fire going, and look for lost animals!`, 4500);
				} else if (e.t === "dawn") {
					sound.dawn();
					say(
						e.kept ? `Morning! The fire lasted all of night ${e.night}.` : "Morning. The fire went out, so that night didn’t count.",
						4500,
					);
				} else if (e.t === "follow") say(`The ${ANIMAL_LABEL[e.animal]} is following you. Bring it to the fire!`);
				else if (e.t === "home") {
					sound.home();
					say(e.mine ? `You brought the ${ANIMAL_LABEL[e.animal]} home!` : `The ${ANIMAL_LABEL[e.animal]} is home!`);
				} else if (e.t === "goal") {
					sound.chime();
					// Nothing while this kid's games are Free (and nothing queued that would pay later).
					const paid = !free.current;
					if (paid) void earnTickets(child.id, e.key, e.tickets);
					say(
						<span className="inline-flex items-center gap-2">
							{e.label}! {paid && <Tickets count={e.tickets} />}
						</span>,
						4500,
					);
				} else if (e.t === "refused") {
					if (e.why === "visit") say("Friends can look round this island, but not build here.");
					else if (e.why === "full") say("This island can’t hold any more building.");
				} else if (e.t === "kicked") {
					setPhase("ready");
					setKicked(
						e.why === "elsewhere"
							? "You’re playing Campfire Woods on another screen now."
							: e.why === "full"
								? "The island is full right now. Try again in a little while."
								: "That island isn’t open to you any more.",
					);
				}
			}),
		[world, say, free, child.id],
	);

	// The HUD, a few times a second.
	useEffect(() => {
		const timer = setInterval(() => {
			const next = readHud(world, controls);
			// The Play home shows how many nights this kid has kept the fire going.
			if (world.stats.nights > 0)
				try {
					localStorage.setItem(`jade.woods.nights.${child.id}`, String(world.stats.nights));
				} catch {}
			setHud((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
		}, 250);
		return () => clearInterval(timer);
	}, [world, controls, child.id]);

	// The hotbar: whatever can be built with, in block order. Keeps a block in hand while there's any.
	const hotbar = useMemo(() => BLOCKS.filter((b) => canPlace(b.id) && (hud.inv[b.id] ?? 0) > 0).map((b) => b.id), [hud.inv]);
	useEffect(() => {
		if (hotbar.length && !hotbar.includes(selected)) setSelected(hotbar[0]!);
	}, [hotbar, selected]);
	const tiles = useMemo(() => {
		const atlas = drawAtlas();
		return new Map(BLOCKS.map((b) => [b.id, tileImage(b.tiles.side, atlas)]));
	}, []);

	const use = useCallback(() => {
		const u = readHud(world, controls).use;
		if (!u) return;
		if (u.kind === "feed") {
			world.send({ t: "feed", b: u.block });
			sound.feed();
		} else world.send({ t: "pickup", id: u.id });
	}, [world, controls]);

	const emote = useCallback((e: Emote) => world.send({ t: "emote", e }), [world]);

	function start() {
		sound.unlock();
		setKicked(null);
		if (world.status === "kicked") world.connect();
		setPhase("play");
		if (!coarse) Promise.resolve(sceneRef.current?.requestPointerLock?.()).catch(() => {});
	}

	const togglePause = useCallback(() => {
		sound.unlock();
		setPhase((p) => (p === "play" ? "paused" : p === "paused" ? "play" : p));
	}, []);

	// Keys: P pauses, E uses, 1–9 pick a block. Leaving the tab pauses.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.repeat || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
			const t = e.target;
			if (t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select, dialog, [role='dialog']"))) return;
			if (e.code === "KeyP") togglePause();
			else if (phase === "play" && e.code === "KeyE") use();
			else if (phase === "play" && /^Digit[1-9]$/.test(e.code)) {
				const b = hotbar[Number(e.code.slice(5)) - 1];
				if (b) setSelected(b);
			}
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
	}, [togglePause, use, phase, hotbar]);

	// A mouse: pointer lock while playing. Moving looks, holding the left button mines, the right button builds, the
	// wheel changes block. Escape gives the pointer back (the game carries on; P pauses), and a click takes it again.
	useEffect(() => {
		const el = sceneRef.current;
		if (!el || coarse) return;
		const locked = () => document.pointerLockElement === el;
		const move = (e: MouseEvent) => {
			if (locked()) turn(controls, e.movementX, e.movementY, MOUSE_TURN);
		};
		const down = (e: MouseEvent) => {
			if (!locked()) {
				if (e.button === 0) Promise.resolve(el.requestPointerLock?.()).catch(() => {});
				return;
			}
			if (e.button === 0) controls.mining = true;
			else if (e.button === 2) controls.place = true;
		};
		const up = (e: MouseEvent) => {
			if (e.button === 0) controls.mining = false;
		};
		const wheel = (e: WheelEvent) => {
			if (!locked() || !hotbar.length) return;
			const k = hotbar.indexOf(controls.selected);
			setSelected(hotbar[(k + (e.deltaY > 0 ? 1 : -1) + hotbar.length) % hotbar.length]!);
		};
		const change = () => {
			setCaptured(locked());
			if (!locked()) controls.mining = false;
		};
		const menu = (e: Event) => e.preventDefault();
		document.addEventListener("mousemove", move);
		el.addEventListener("mousedown", down);
		document.addEventListener("mouseup", up);
		el.addEventListener("wheel", wheel, { passive: true });
		el.addEventListener("contextmenu", menu);
		document.addEventListener("pointerlockchange", change);
		return () => {
			document.removeEventListener("mousemove", move);
			el.removeEventListener("mousedown", down);
			document.removeEventListener("mouseup", up);
			el.removeEventListener("wheel", wheel);
			el.removeEventListener("contextmenu", menu);
			document.removeEventListener("pointerlockchange", change);
			if (locked()) document.exitPointerLock();
		};
	}, [controls, coarse, hotbar]);

	// Fingers, with Touch Events (every iPad has them; ids can come through negative, so "on" is kept apart from the
	// id). A drag looks round; a finger held still mines what's under it; a quick tap builds there.
	useEffect(() => {
		const el = sceneRef.current;
		if (!el || phase !== "play") return;
		type Finger = { id: number; x: number; y: number; at: number; dragged: boolean; timer: ReturnType<typeof setTimeout> };
		let finger: Finger | null = null;
		const aimAt = (x: number, y: number): [number, number] => {
			const r = el.getBoundingClientRect();
			return [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
		};
		const find = (list: TouchList) => {
			if (!finger) return null;
			for (let i = 0; i < list.length; i++) if (list[i]!.identifier === finger.id) return list[i]!;
			return null;
		};
		const startTouch = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			if (finger) return;
			const t = e.changedTouches[0];
			if (!t) return;
			sound.unlock();
			const f: Finger = {
				id: t.identifier,
				x: t.clientX,
				y: t.clientY,
				at: performance.now(),
				dragged: false,
				timer: setTimeout(() => {}, 0),
			};
			f.timer = setTimeout(() => {
				if (finger === f && !f.dragged) {
					controls.aim = aimAt(f.x, f.y);
					controls.mining = true;
				}
			}, HOLD_MS);
			finger = f;
		};
		const moveTouch = (e: TouchEvent) => {
			if (e.cancelable) e.preventDefault();
			const t = find(e.changedTouches);
			if (!t || !finger) return;
			const dx = t.clientX - finger.x;
			const dy = t.clientY - finger.y;
			if (controls.mining) {
				controls.aim = aimAt(t.clientX, t.clientY);
				return;
			}
			if (!finger.dragged && Math.hypot(dx, dy) < 10) return;
			finger.dragged = true;
			turn(controls, dx, dy, TOUCH_TURN);
			finger.x = t.clientX;
			finger.y = t.clientY;
		};
		const endTouch = (e: TouchEvent) => {
			const t = find(e.changedTouches);
			if (!t || !finger) return;
			clearTimeout(finger.timer);
			if (!finger.dragged && !controls.mining && e.type === "touchend" && performance.now() - finger.at < HOLD_MS) {
				controls.aim = aimAt(t.clientX, t.clientY);
				controls.place = true;
				// Keep aiming there for the frame that builds.
				setTimeout(() => {
					if (!finger) controls.aim = null;
				}, 80);
			} else controls.aim = null;
			controls.mining = false;
			finger = null;
		};
		el.addEventListener("touchstart", startTouch, { passive: false });
		el.addEventListener("touchmove", moveTouch, { passive: false });
		el.addEventListener("touchend", endTouch);
		el.addEventListener("touchcancel", endTouch);
		return () => {
			el.removeEventListener("touchstart", startTouch);
			el.removeEventListener("touchmove", moveTouch);
			el.removeEventListener("touchend", endTouch);
			el.removeEventListener("touchcancel", endTouch);
			if (finger) clearTimeout(finger.timer);
			controls.mining = false;
			controls.aim = null;
		};
	}, [phase, controls]);

	// Dev and test only: peek at the island, and hold the scene still for a screenshot.
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		(window as { __THREE_GAME_TEST_HOOKS__?: unknown }).__THREE_GAME_TEST_HOOKS__ = {
			peek: () => ({
				status: world.status,
				seat: world.seat,
				inv: world.inv,
				stats: world.stats,
				others: [...world.others.values()].map((o) => ({ label: o.label, p: o.p })),
				body: controls.body?.p,
				look: { ...controls.look },
				target: controls.target,
				elapsed: world.elapsed(),
				fire: world.fire,
			}),
			block: (x: number, y: number, z: number) => world.volume?.get(x, y, z) ?? -1,
			/** Aim straight at a cell (for tests): face it from where the figure stands. */
			lookAt: (x: number, y: number, z: number) => {
				const p = controls.body?.p;
				if (!p) return false;
				const dx = x + 0.5 - p[0];
				const dy = y + 0.5 - (p[1] + 1.55);
				const dz = z + 0.5 - p[2];
				controls.look.yaw = Math.atan2(-dx, -dz);
				controls.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
				return true;
			},
			mine: (on: boolean) => {
				controls.mining = on;
			},
			place: () => {
				controls.place = true;
			},
			select: (b: number) => setSelected(b),
			setState: async (name: string) => {
				// The look of a time of day, on this screen only (the island's own clock carries on).
				const at = { day: 60, dusk: DAY_S - 10, night: DAY_S + 90 }[name];
				if (at === undefined) throw new Error(`Unknown state ${name}`);
				world.shift = at - world.elapsed() + world.shift;
				await new Promise((r) => setTimeout(r, 300));
				return { state: name };
			},
			setPausedForScreenshot: (paused: boolean) => {
				setFrozen(paused);
				return { paused };
			},
		};
	}, [world, controls]);

	// The islands this kid can go to, refreshed while they choose.
	const { data: islands } = useQuery({
		queryKey: ["woods-islands", child.id],
		queryFn: () => api<{ islands: Island[] }>(`/api/children/${child.id}/woods/islands`),
		refetchInterval: phase === "ready" ? 15_000 : false,
	});

	const ready = hud.status === "open";
	const running = phase === "play" && ready && !frozen;
	const playing = phase === "play";

	return (
		<GameScreen
			panelLabel="Your things"
			panelKey="woods"
			panelOpen={false}
			sceneDark={hud.dark}
			goInProgress={playing && hud.night}
			scene={
				<div
					ref={sceneRef}
					className="relative size-full select-none"
					style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
				>
					<NoWebGL>
						<Suspense fallback={<GameLoading label="Lighting the campfire…" />}>
							<WoodsScene world={world} controls={controls} running={running} label={sceneLabel(hud)} />
						</Suspense>
					</NoWebGL>
					{playing && !coarse && <Crosshair />}
					{playing && !coarse && !captured && ready && (
						<p className="glass glass-pill pointer-events-none absolute top-1/2 left-1/2 mt-10 -translate-x-1/2 text-sm font-medium">
							Click to look round
						</p>
					)}
					{playing && hotbar.length > 0 && <Hotbar items={hotbar} inv={hud.inv} selected={selected} onPick={setSelected} tiles={tiles} />}
					<div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,var(--safe-top))+4.2rem)] flex justify-center px-3">
						<p role="status" className={message && playing ? "glass glass-pill text-center text-sm font-medium" : "sr-only"}>
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
			title={accent("Campfire Woods")}
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
					{phase !== "ready" && (
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
				ready && (
					<GameStatus>
						<span className="inline-flex items-center gap-1.5">
							{hud.night ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
							{hud.night ? (
								<>
									Night {hud.nightNo}
									<span className="max-sm:hidden"> · dawn in {hud.minutes} min</span>
								</>
							) : (
								<>
									<span className="max-sm:hidden">Night {hud.nightNo} in </span>
									{hud.minutes} min
								</>
							)}
						</span>
						<FireMeter fuel={hud.fuel} />
						{hud.home > 0 && (
							<span className="inline-flex items-center gap-1" title="Animals brought home">
								<PawPrint className="size-4" aria-hidden />
								<span className="tabular-nums">{hud.home}</span>
							</span>
						)}
					</GameStatus>
				)
			}
			hints={
				<>
					<Hint keys={["W", "A", "S", "D"]}>walk</Hint>
					<Hint keys={["Space"]}>jump</Hint>
					<Hint keys={["Click"]}>hold to dig</Hint>
					<Hint keys={["Right click"]}>build</Hint>
					<Hint keys={["E"]}>use</Hint>
					<Hint keys={["1–9"]}>block</Hint>
				</>
			}
			touch={playing && <TouchControls drive={drive} />}
			panel={<Things inv={hud.inv} tiles={tiles} selected={selected} onPick={setSelected} onEmote={emote} />}
			prompt={
				<div aria-live="polite" className="flex flex-col items-center gap-2">
					{phase === "ready" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							{kicked ? (
								<p className="font-display text-xl font-semibold">{kicked}</p>
							) : (
								<>
									<p className="font-display text-2xl font-semibold">Your island in the woods</p>
									<p className="mt-2 text-sm text-page-muted">
										Dig blocks, build anything, and keep the campfire burning through the night. Lost animals wander the woods after dark:
										find them and bring them to the fire.
									</p>
								</>
							)}
							{islands && islands.islands.length > 1 && (
								<Islands
									islands={islands.islands}
									chosen={island}
									onChoose={(id) => {
										setKicked(null);
										setIsland(id);
									}}
								/>
							)}
							{hud.status === "offline" && <Offline />}
							{(hud.status === "connecting" || hud.status === "reconnecting") && <p className="mt-3 text-sm">Finding your island…</p>}
						</div>
					)}
					{phase === "paused" && <p className="glass glass-pill font-display font-semibold">Paused</p>}
					{playing && hud.status === "reconnecting" && (
						<p className="glass glass-pill font-display font-semibold">Finding your island again…</p>
					)}
					{playing && hud.status === "offline" && (
						<div className="glass rounded-[1.4rem] p-4 text-center">
							<Offline />
						</div>
					)}
				</div>
			}
			actions={
				phase === "ready" ? (
					<button type="button" className="key" data-variant="go" onClick={start} disabled={!ready && !kicked}>
						<Play className="size-5" aria-hidden /> {kicked ? "Try again" : "Start"}
					</button>
				) : phase === "paused" ? (
					<button type="button" className="key" onClick={start}>
						<Play className="size-5" aria-hidden /> Carry on
					</button>
				) : (
					running &&
					hud.use && (
						<button type="button" className="key" onClick={use}>
							{hud.use.kind === "feed" ? <Flame className="size-5" aria-hidden /> : <Hand className="size-5" aria-hidden />}
							{hud.use.kind === "feed" ? `Feed the fire (${blockInfo(hud.use.block).label.toLowerCase()})` : `Pick up the ${hud.use.label}`}
							{!coarse && <kbd className="ml-1 text-xs opacity-70">E</kbd>}
						</button>
					)
				)
			}
		/>
	);
}

type Island = { id: string; label: string; mine: boolean; online: number };

/** Whose island to play on: ours, or a friend family's, with how many are there now. */
function Islands({
	islands,
	chosen,
	onChoose,
}: {
	islands: Island[];
	chosen: string | undefined;
	onChoose: (id: string | undefined) => void;
}) {
	return (
		<fieldset className="mt-4 text-left">
			<legend className="text-sm font-semibold">Whose island?</legend>
			<div className="mt-2 space-y-1.5">
				{islands.map((i) => {
					const on = i.mine ? chosen === undefined : chosen === i.id;
					return (
						<label
							key={i.id}
							className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${on ? "bg-white/50 ring-2 ring-roxy" : ""}`}
						>
							<input type="radio" name="island" className="size-4" checked={on} onChange={() => onChoose(i.mine ? undefined : i.id)} />
							<span className="min-w-0 flex-1 font-medium">{i.label}</span>
							{i.online > 0 && <span className="text-sm text-page-muted">{i.online} playing</span>}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

function readHud(world: IslandState, controls: Controls | null): Hud {
	const p = phaseAt(world.elapsed());
	const body = controls?.body?.p;
	let use: Hud["use"] = null;
	if (body && world.volume) {
		const [fx, , fz] = world.fire;
		if (Math.hypot(body[0] - fx - 0.5, body[2] - fz - 0.5) <= REACH_FIRE) {
			const sel = controls?.selected ?? 0;
			const block = blockInfo(sel).fuel > 0 && (world.inv[sel] ?? 0) > 0 ? sel : FUEL_ORDER.find((b) => (world.inv[b] ?? 0) > 0);
			if (block) use = { kind: "feed", block };
		}
		if (!use) {
			const near = world.lost.find((a) => a.follows === null && Math.hypot(a.at[0] - body[0], a.at[2] - body[2]) <= REACH_ANIMAL);
			if (near) use = { kind: "pickup", id: near.id, label: ANIMAL_LABEL[near.animal] };
		}
	}
	return {
		status: world.status,
		night: p.phase === "night",
		dark: world.status === "open" && p.sun < 0.45,
		nightNo: p.night,
		minutes: Math.max(1, Math.ceil(p.left / 60)),
		fuel: world.clock.fuel,
		nights: world.clock.nights,
		home: world.home.length,
		inv: world.inv,
		others: world.others.size,
		use,
	};
}

const sceneLabel = (h: Hud) =>
	`Campfire Woods. ${h.night ? `Night ${h.nightNo}` : "Daytime"}. The fire is ${h.fuel <= 0 ? "out" : h.fuel < FUEL_MAX / 4 ? "low" : "burning"}.${h.others ? ` ${h.others} others here.` : ""}`;

function FireMeter({ fuel }: { fuel: number }) {
	const share = Math.min(1, fuel / FUEL_MAX);
	const low = share < 0.25;
	return (
		<span className="inline-flex items-center gap-1.5" title="The campfire">
			<Flame className={`size-4 ${low ? "text-roxy" : ""}`} aria-hidden />
			<meter className="sr-only" aria-label="Campfire" min={0} max={100} low={25} value={Math.round(share * 100)} />
			<span className="relative h-2 w-14 overflow-hidden rounded-full bg-[color-mix(in_oklab,currentColor_18%,transparent)]" aria-hidden>
				<span className="absolute inset-y-0 left-0 rounded-full bg-[#f08a24]" style={{ width: `${share * 100}%` }} />
			</span>
			{fuel <= 0 && <span>out!</span>}
		</span>
	);
}

function Crosshair() {
	return (
		<div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
			<div className="relative size-5">
				<span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 bg-white/90 shadow-[0_0_2px_rgb(0_0_0/0.6)]" />
				<span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_2px_rgb(0_0_0/0.6)]" />
			</div>
		</div>
	);
}

function Hotbar({
	items,
	inv,
	selected,
	onPick,
	tiles,
}: {
	items: number[];
	inv: Record<number, number>;
	selected: number;
	onPick: (b: number) => void;
	tiles: Map<number, string>;
}) {
	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.75rem,var(--safe-bottom))+6.75rem)] flex justify-center px-3 md:bottom-[calc(max(1.5rem,var(--safe-bottom))+4rem)]">
			<fieldset className="glass pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5">
				<legend className="sr-only">Block to build with</legend>
				{items.map((b, k) => (
					<button
						key={b}
						type="button"
						aria-pressed={b === selected}
						aria-label={`${blockInfo(b).label}, ${inv[b]}`}
						onClick={() => onPick(b)}
						className={`relative size-11 shrink-0 rounded-lg p-1 ${b === selected ? "bg-white/70 ring-2 ring-roxy" : ""}`}
						style={{ touchAction: "manipulation" }}
					>
						<img src={tiles.get(b)} alt="" className="size-full rounded-sm [image-rendering:pixelated]" draggable={false} />
						<span className="absolute right-0.5 bottom-0 text-[11px] font-semibold text-white tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
							{inv[b]}
						</span>
						{k < 9 && <span className="sr-only">Key {k + 1}</span>}
					</button>
				))}
			</fieldset>
		</div>
	);
}

const EMOTE_ICON: Record<Emote, { icon: ReactNode; label: string }> = {
	wave: { icon: <Hand className="size-5" aria-hidden />, label: "Wave" },
	heart: { icon: <Heart className="size-5" aria-hidden />, label: "Heart" },
	star: { icon: <Star className="size-5" aria-hidden />, label: "Star" },
	here: { icon: <ArrowLeft className="size-5 -rotate-90" aria-hidden />, label: "Over here!" },
};

/** The panel: everything carried, and the four ways to say something to whoever's on the island. */
function Things({
	inv,
	tiles,
	selected,
	onPick,
	onEmote,
}: {
	inv: Record<number, number>;
	tiles: Map<number, string>;
	selected: number;
	onPick: (b: number) => void;
	onEmote: (e: Emote) => void;
}) {
	const carried = BLOCKS.filter((b) => (inv[b.id] ?? 0) > 0);
	return (
		<div className="space-y-4">
			<section aria-label="Say hello">
				<h3 className="text-sm font-semibold">Say hello</h3>
				<div className="mt-2 flex flex-wrap gap-2">
					{EMOTES.map((e) => (
						<button key={e} type="button" className="key" data-variant="felt" onClick={() => onEmote(e)}>
							{EMOTE_ICON[e].icon} {EMOTE_ICON[e].label}
						</button>
					))}
				</div>
			</section>
			<section aria-label="What you’re carrying">
				<h3 className="text-sm font-semibold">What you’re carrying</h3>
				{carried.length === 0 ? (
					<p className="mt-1 text-sm text-page-muted">Nothing yet. Hold on a block to dig it up.</p>
				) : (
					<ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
						{carried.map((b) => (
							<li key={b.id}>
								<button
									type="button"
									disabled={!canPlace(b.id)}
									onClick={() => onPick(b.id)}
									aria-pressed={b.id === selected}
									className={`flex w-full flex-col items-center gap-1 rounded-xl p-2 text-xs ${b.id === selected ? "bg-white/60 ring-2 ring-roxy" : ""}`}
								>
									<img src={tiles.get(b.id)} alt="" className="size-8 [image-rendering:pixelated]" />
									<span>{b.label}</span>
									<span className="font-semibold tabular-nums">{inv[b.id]}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-label="How to play">
				<h3 className="text-sm font-semibold">How to play</h3>
				<ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-page-muted">
					<li>Hold on a block to dig it. It goes in your bag.</li>
					<li>Tap (or right click) to build with the block in your hand.</li>
					<li>Logs, planks and coal keep the campfire going. Stand by it and press Use.</li>
					<li>At night, find lost animals in the woods and lead them to the firelight.</li>
					<li>Wool and torches top up every morning.</li>
				</ul>
			</section>
		</div>
	);
}

function Offline() {
	return (
		<p className="mt-3 inline-flex items-center gap-2 text-sm">
			<WifiOff className="size-4" aria-hidden /> Campfire Woods needs the internet. It starts as soon as you’re back online.
		</p>
	);
}
