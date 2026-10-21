import {
	ANIMAL_LABEL,
	ANIMALS,
	type Animal,
	B,
	BLOCKS,
	blockInfo,
	CYCLE_S,
	canPlace,
	craftUses,
	DAY_S,
	deerAt,
	EMOTES,
	type Emote,
	FUEL_LOW,
	FUEL_MAX,
	indexOf,
	phaseAt,
	REACH_ANIMAL,
	REACH_FIRE,
	RECIPE_BY_ID,
	RECIPES,
	rainAt,
} from "@jade/core/woods";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Flame, Hand, Heart, Pause, PawPrint, Play, Star, Volume2, VolumeX, WifiOff } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tickets } from "#/components/play/PlayBits.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { GameScreen, GameStatus, Hint } from "#/components/roxy/GameScreen.tsx";
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
import { questEvent } from "#/lib/quests.ts";

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
	/** 0–1 through this day or night: where the sun or moon is on its arc. */
	progress: number;
	/** The sky is dark enough that words on it need light ink. */
	dark: boolean;
	nightNo: number;
	/** Minutes until the change (dawn or nightfall), rounded up. */
	minutes: number;
	fuel: number;
	nights: number;
	inv: Record<number, number>;
	others: number;
	/** Standing by the lit fire: recipes that need its heat can be made. */
	byFire: boolean;
	/** At night: the nearest lost animal nobody's found yet, and which way it is from where the kid is looking. */
	lostNear: { animal: Animal; label: string; blocks: number; turn: number } | null;
	/** What E (or the Use button) would do here. */
	use:
		| { kind: "feed"; block: number }
		| { kind: "pickup"; id: string; label: string }
		| { kind: "pat"; index: number; animal: Animal; label: string }
		| null;
	/** The kid's eyes are under water. */
	underwater: boolean;
	/** The animals living at camp. */
	home: Animal[];
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
	const phaseRef = useRef(phase);
	phaseRef.current = phase;
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
			look: { yaw: 0, pitch: -0.12 },
			mining: false,
			place: null,
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

	/** Counts something done toward today's quests (and says when one's finished). */
	const report = useCallback(
		(did: "dug" | "built" | "fed" | "rescued" | "crafted") => {
			const done = questEvent(child.id, { game: "woods", did, n: 1 }, free.current);
			for (const q of done) say(`Quest done: ${q.label}!`, 4000);
		},
		[child.id, free, say],
	);

	/** Once per go, on a friend's island: whose it is, and whether visitors can build. */
	const greeted = useRef(false);
	const greet = useCallback(() => {
		if (greeted.current || world.island.mine) return;
		greeted.current = true;
		say(
			world.island.build
				? `You’re visiting ${world.island.label}!`
				: `You’re visiting ${world.island.label}. You can look round, but not build here.`,
			4500,
		);
	}, [world, say]);

	// The island: connect while this screen is open.
	useEffect(() => {
		world.connect();
		return () => world.close();
	}, [world]);

	useEffect(
		() =>
			world.listen((e: WorldEvent) => {
				if (e.t === "did") report(e.what);
				else if (e.t === "home" && e.mine) report("rescued");
				else if (e.t === "crafted") {
					if (e.ok) {
						sound.chime();
						report("crafted");
						const r = RECIPE_BY_ID[e.recipe];
						if (r)
							say(
								`You made ${r.gives.n} ${blockInfo(r.gives.b).label.toLowerCase()}${r.gives.n > 1 && !/s$/.test(blockInfo(r.gives.b).label) ? "s" : ""}!`,
							);
					} else say(e.why === "fire" ? "That needs the fire’s heat: stand by the lit campfire." : "You haven’t got enough for that yet.");
				}
				// A friend's island that finished loading after Start: say whose it is now.
				else if (e.t === "ready" && phaseRef.current === "play") greet();
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
					sound.home(e.animal);
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
		[world, say, free, child.id, greet, report],
	);

	// The HUD and the island's sounds, a few times a second.
	const lowWarned = useRef(false);
	const raining = useRef(false);
	useEffect(() => {
		const timer = setInterval(() => {
			const p = phaseAt(world.elapsed());
			const body = controls.body?.p;
			const [fx, , fz] = world.fire;
			const fuel = world.clock.fuel;
			const wet = rainAt(world.seed, world.elapsed());
			if (wet > 0 && !raining.current && phaseRef.current === "play") say("A rain shower! It won’t last long.", 3500);
			raining.current = wet > 0;
			const next = readHud(world, controls);
			sound.ambience({
				lost: next.lostNear,
				rain: wet,
				underwater:
					!!controls.body &&
					world.volume?.get(Math.floor(controls.body.p[0]), Math.floor(controls.body.p[1] + 1.55), Math.floor(controls.body.p[2])) ===
						B.water,
				sun: p.sun,
				fireDistance: body ? Math.hypot(body[0] - fx - 0.5, body[2] - fz - 0.5) : 30,
				fireStrength: fuel <= 0 ? 0 : 0.3 + 0.7 * Math.min(1, fuel / (FUEL_MAX * 0.6)),
				running: phaseRef.current === "play" && world.status === "open" && !document.hidden,
			});
			// A gentle nudge, once, when the fire runs low at night.
			const low = p.phase === "night" && fuel > 0 && fuel < FUEL_MAX * FUEL_LOW;
			if (low && !lowWarned.current && phaseRef.current === "play") {
				sound.lowFire();
				say("The fire’s getting low! Feed it a log.", 4000);
			}
			lowWarned.current = low;
			// The Play home shows how many nights this kid has kept the fire going.
			if (world.stats.nights > 0)
				try {
					localStorage.setItem(`jade.woods.nights.${child.id}`, String(world.stats.nights));
				} catch {}
			setHud((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
		}, 250);
		return () => {
			clearInterval(timer);
			sound.stopAmbience();
		};
	}, [world, controls, child.id, say]);

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
		} else if (u.kind === "pat") {
			world.pat(u.index);
			sound.pat(u.animal);
		} else world.send({ t: "pickup", id: u.id });
	}, [world, controls, report]);

	const emote = useCallback((e: Emote) => world.send({ t: "emote", e }), [world]);

	function start() {
		sound.unlock();
		setKicked(null);
		if (world.status === "kicked") world.connect();
		setPhase("play");
		greeted.current = false;
		if (world.status === "open") greet();
		// A mouse looks round with the pointer held; a touch screen (even a laptop's) looks by dragging instead.
		if (!coarse && navigator.maxTouchPoints === 0) Promise.resolve(sceneRef.current?.requestPointerLock?.()).catch(() => {});
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
			else if (e.button === 2) controls.place = { aim: null };
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
		/** `at` is the event's own time: a busy page can handle a quick tap's release late, and it's still a tap. */
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
			// A finger on the scene: this is a touch screen now, so let go of the mouse pointer.
			if (document.pointerLockElement) document.exitPointerLock();
			if (finger) return;
			const t = e.changedTouches[0];
			if (!t) return;
			sound.unlock();
			const f: Finger = {
				id: t.identifier,
				x: t.clientX,
				y: t.clientY,
				at: e.timeStamp,
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
			if (!finger.dragged && e.type === "touchend" && e.timeStamp - finger.at < HOLD_MS) {
				// Built where the finger tapped, whenever the next frame comes.
				controls.place = { aim: aimAt(t.clientX, t.clientY) };
			}
			controls.aim = null;
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
				lastBuilt: world.lastBuilt,
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
				controls.place = { aim: null };
			},
			select: (b: number) => setSelected(b),
			/**
			 * Into play at a time of day, on this screen only (the island's own clock carries on): `active-play` (morning),
			 * `dusk`, `night`, `low-fire` (night, the fire nearly out, the deer close) and `lost-animal` (night, one waiting
			 * just ahead).
			 */
			setState: async (name: string) => {
				if (name === "rain") {
					// Jump to the middle of the next shower on this island.
					for (let t = 0; t < CYCLE_S * 30; t += 5)
						if (rainAt(world.seed, t) >= 1) {
							await new Promise((r) => setTimeout(r, 0));
							for (let k = 0; k < 100 && world.status !== "open"; k++) await new Promise((r) => setTimeout(r, 100));
							setKicked(null);
							setPhase("play");
							world.shift = t + 20 - world.elapsed() + world.shift;
							for (let k = 0; k < 60 && !controls.body; k++) await new Promise((r) => setTimeout(r, 50));
							await new Promise((r) => setTimeout(r, 600));
							return { state: name };
						}
				}
				const at = {
					"active-play": 60,
					day: 60,
					dusk: DAY_S - 12,
					night: DAY_S + 90,
					"low-fire": DAY_S + 90,
					deer: DAY_S + 90,
					"lost-animal": DAY_S + 90,
					torches: DAY_S + 90,
					"camp-animals": 90,
				}[name];
				if (at === undefined) throw new Error(`Unknown state ${name}`);
				for (let k = 0; k < 100 && world.status !== "open"; k++) await new Promise((r) => setTimeout(r, 100));
				setKicked(null);
				setPhase("play");
				world.shift = at - world.elapsed() + world.shift;
				world.fuelShown = name === "low-fire" || name === "deer" ? 30 : name === "day" || name === "active-play" ? null : 220;
				world.clock = { ...world.clock, fuel: world.fuelShown ?? world.clock.fuel };
				// The kid's body appears on the first frame of play.
				for (let k = 0; k < 60 && !controls.body; k++) await new Promise((r) => setTimeout(r, 50));
				if (name === "lost-animal" && controls.body) {
					const [x, y, z] = controls.body.p;
					world.lost = [{ id: "dev-0", animal: "fox", at: [x - 1.5, y, z - 3], follows: null }];
				}
				if (name === "torches" && world.volume) {
					// A ring of torches round the camp, real ones (they go to the island like any build).
					const [fx, fy, fz] = world.fire;
					for (let k = 0; k < 8; k++) {
						const a = (k / 8) * Math.PI * 2;
						const x = Math.round(fx + Math.cos(a) * 6.5);
						const z = Math.round(fz + Math.sin(a) * 6.5);
						if (world.volume.get(x, fy, z) === B.air) world.edit(indexOf(x, fy, z), B.torch);
						// Under the island's limit on edits a second.
						await new Promise((r) => setTimeout(r, 120));
					}
				}
				if (name === "camp-animals") {
					// Animals living at camp, on this screen only; then pat the nearest so it hops.
					world.home = ["bunny", "fox", "lamb", "owl", "hedgehog", "duckling"];
					await new Promise((r) => setTimeout(r, 300));
					world.pat(0);
				}
				if (name === "deer" && controls.body) {
					// Face the Night Deer where she is right now.
					const p = phaseAt(world.elapsed());
					const t = Math.max(0, (world.elapsed() % CYCLE_S) - DAY_S);
					const d = deerAt(world.seed, p.night, t, 1);
					const [x, , z] = controls.body.p;
					controls.look.yaw = Math.atan2(-(d.x - x), -(d.z - z));
					controls.look.pitch = 0.05;
				}
				await new Promise((r) => setTimeout(r, 600));
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
			goInProgress={playing && hud.night}
			scene={
				<div
					ref={sceneRef}
					className="relative size-full select-none"
					style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
				>
					<NoWebGL>
						<Suspense fallback={<GameLoading label="Lighting the campfire…" />}>
							<WoodsScene world={world} controls={controls} running={running} playing={playing && ready} label={sceneLabel(hud)} />
						</Suspense>
					</NoWebGL>
					{playing && hud.underwater && (
						<div className="pointer-events-none absolute inset-0 bg-[#1f6f8f]/25 mix-blend-multiply" aria-hidden />
					)}
					{playing && !coarse && <Crosshair />}
					{playing && !coarse && !captured && ready && !message && (
						<p className="glass glass-pill pointer-events-none absolute top-[calc(max(1.5rem,var(--safe-top))+4.2rem)] left-1/2 -translate-x-1/2 text-sm font-medium">
							Click to look round
						</p>
					)}
					{/* On a phone the corners are full: the island's status sits under the title instead. */}
					{ready && phase !== "ready" && (
						<div className="pointer-events-none absolute top-[calc(max(0.75rem,var(--safe-top))+5.9rem)] left-[max(0.75rem,var(--safe-left))] md:hidden">
							<IslandStatus hud={hud} />
						</div>
					)}
					{playing && hud.lostNear && <LostHint hint={hud.lostNear} />}
					{playing && hotbar.length > 0 && <Hotbar items={hotbar} inv={hud.inv} selected={selected} onPick={setSelected} tiles={tiles} />}
					<div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,var(--safe-top))+4.2rem)] flex justify-center px-3 max-md:top-[calc(max(0.75rem,var(--safe-top))+8.6rem)]">
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
			title={
				// On the masthead's glass, so it reads by day and by night ("Woods" stays berry).
				<b className="font-[inherit] [&>span]:text-roxy">
					Campfire <span>Woods</span>
				</b>
			}
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
					<div className="max-md:hidden">
						<IslandStatus hud={hud} />
					</div>
				)
			}
			hints={
				<span className="contents">
					<Hint keys={["W", "A", "S", "D"]}>walk</Hint>
					<Hint keys={["Space"]}>jump</Hint>
					<Hint keys={["Click"]}>hold to dig</Hint>
					<Hint keys={["Right click"]}>build</Hint>
					<Hint keys={["E"]}>use</Hint>
					<Hint keys={["1–9"]}>block</Hint>
				</span>
			}
			touch={playing && <TouchControls drive={drive} />}
			panel={
				<Things
					inv={hud.inv}
					tiles={tiles}
					selected={selected}
					onPick={setSelected}
					onEmote={emote}
					byFire={hud.byFire}
					home={hud.home}
					onCraft={(recipe) => world.send({ t: "craft", recipe })}
				/>
			}
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
							{hud.use.kind === "feed" ? (
								<Flame className="size-5" aria-hidden />
							) : hud.use.kind === "pat" ? (
								<Heart className="size-5" aria-hidden />
							) : (
								<Hand className="size-5" aria-hidden />
							)}
							{hud.use.kind === "feed"
								? `Feed the fire (${blockInfo(hud.use.block).label.toLowerCase()})`
								: hud.use.kind === "pat"
									? `Pat the ${hud.use.label}`
									: `Pick up the ${hud.use.label}`}
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
		if (!use) {
			// An animal living at camp, close enough to pat.
			const k = world.homeSpots.findIndex((a) => Math.hypot(a.x - body[0], a.z - body[2]) <= 1.8);
			const kind = world.home[k];
			if (k >= 0 && kind) use = { kind: "pat", index: k, animal: kind, label: ANIMAL_LABEL[kind] };
		}
	}
	let lostNear: Hud["lostNear"] = null;
	if (body && p.phase === "night") {
		let best: { a: (typeof world.lost)[number]; d: number } | null = null;
		for (const a of world.lost) {
			if (a.follows !== null) continue;
			const d = Math.hypot(a.at[0] - body[0], a.at[2] - body[2]);
			if (!best || d < best.d) best = { a, d };
		}
		if (best && best.d > REACH_ANIMAL) {
			const yaw = controls?.look.yaw ?? 0;
			// Angle to the animal, measured like the camera's yaw (0 looks along -z), relative to the view.
			const want = Math.atan2(-(best.a.at[0] - body[0]), -(best.a.at[2] - body[2]));
			let turn = want - yaw;
			turn = Math.atan2(Math.sin(turn), Math.cos(turn));
			lostNear = {
				animal: best.a.animal,
				label: ANIMAL_LABEL[best.a.animal],
				blocks: Math.round(best.d),
				turn: Math.round(turn * 10) / 10,
			};
		}
	}
	const byFire = !!body && world.clock.fuel > 0 && Math.hypot(body[0] - world.fire[0] - 0.5, body[2] - world.fire[2] - 0.5) <= REACH_FIRE;
	return {
		byFire,
		lostNear,
		status: world.status,
		night: p.phase === "night",
		progress: Math.round(p.progress * 40) / 40,
		dark: world.status === "open" && p.sun < 0.45,
		nightNo: p.night,
		minutes: Math.max(1, Math.ceil(p.left / 60)),
		fuel: world.clock.fuel,
		nights: world.clock.nights,
		home: world.home,
		underwater: !!body && world.volume?.get(Math.floor(body[0]), Math.floor(body[1] + 1.55), Math.floor(body[2])) === B.water,
		inv: world.inv,
		others: world.others.size,
		use,
	};
}

/** "fox cub" → "fox cubs", "bunny" → "bunnies". */
const animalPlural = (label: string) => (label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`);

const sceneLabel = (h: Hud) =>
	`Campfire Woods. ${h.night ? `Night ${h.nightNo}` : "Daytime"}. The fire is ${h.fuel <= 0 ? "out" : h.fuel < FUEL_MAX / 4 ? "low" : "burning"}.${h.others ? ` ${h.others} others here.` : ""}`;

/** Day or night and how long till it changes, the fire, and the animals brought home. */
function IslandStatus({ hud }: { hud: Hud }) {
	return (
		<GameStatus>
			<span className="inline-flex items-center gap-1.5">
				<DayDial night={hud.night} progress={hud.progress} />
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
			{hud.home.length > 0 && (
				<span className="inline-flex items-center gap-1" title="Animals brought home">
					<PawPrint className="size-4" aria-hidden />
					<span className="tabular-nums">{hud.home.length}</span>
				</span>
			)}
		</GameStatus>
	);
}

/**
 * At night, which way the nearest lost animal is: an arrow that turns as the kid does, and how far. Points ahead
 * when it's in front, to the side when it's beside or behind.
 */
function LostHint({ hint }: { hint: NonNullable<Hud["lostNear"]> }) {
	return (
		<p
			className="glass glass-pill pointer-events-none absolute top-[calc(max(0.75rem,var(--safe-top))+7.6rem)] left-1/2 -translate-x-1/2 text-sm font-medium max-md:top-[calc(max(0.75rem,var(--safe-top))+11.6rem)]"
			aria-live="off"
		>
			<span className="inline-block transition-transform duration-200" style={{ transform: `rotate(${-hint.turn}rad)` }} aria-hidden>
				<ArrowLeft className="size-4 rotate-90" />
			</span>
			Lost {hint.label} · {hint.blocks} steps
		</p>
	);
}

/** The sun (or moon) on its way across a little arc of sky: how far through the day or night it is. */
function DayDial({ night, progress }: { night: boolean; progress: number }) {
	const a = Math.PI * (1 - progress);
	const x = 14 + Math.cos(a) * 10;
	const y = 14 - Math.sin(a) * 10;
	return (
		<svg viewBox="0 0 28 16" className="h-4 w-7 shrink-0" aria-hidden>
			<path d="M4 14 A10 10 0 0 1 24 14" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="2 2" />
			<line x1="2" y1="14.5" x2="26" y2="14.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
			{night ? (
				<g>
					<circle cx={x} cy={y} r="3.6" fill="#e8eef8" />
					<circle cx={x + 1.6} cy={y - 1} r="3" fill="#1b2a4e" />
				</g>
			) : (
				<circle cx={x} cy={y} r="3.6" fill="#f6c43c" stroke="#e08a24" strokeWidth="1" />
			)}
		</svg>
	);
}

function FireMeter({ fuel }: { fuel: number }) {
	const share = Math.min(1, fuel / FUEL_MAX);
	const low = share < 0.25;
	return (
		<span className="inline-flex items-center gap-1.5" title="The campfire">
			<Flame className={`size-4 ${low ? "text-roxy motion-safe:animate-pulse" : "text-[#e9761f]"}`} aria-hidden />
			<meter className="sr-only" aria-label="Campfire" min={0} max={100} low={25} value={Math.round(share * 100)} />
			<span className="relative h-2 w-14 overflow-hidden rounded-full bg-[color-mix(in_oklab,currentColor_18%,transparent)]" aria-hidden>
				<span
					className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-[#e0441f] via-[#f08a24] to-[#ffd04a] transition-[width] duration-700"
					style={{ width: `${share * 100}%` }}
				/>
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
	byFire,
	onCraft,
	home,
}: {
	inv: Record<number, number>;
	tiles: Map<number, string>;
	selected: number;
	onPick: (b: number) => void;
	onEmote: (e: Emote) => void;
	byFire: boolean;
	onCraft: (recipe: string) => void;
	home: Animal[];
}) {
	const living = ANIMALS.map((a) => ({ a, n: home.filter((h) => h === a).length })).filter((x) => x.n > 0);
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
			<section aria-label="Living at camp">
				<h3 className="text-sm font-semibold">Living at camp</h3>
				{living.length === 0 ? (
					<p className="mt-1 text-sm text-page-muted">Nobody yet. At night, find lost animals in the woods and lead them to the fire.</p>
				) : (
					<p className="mt-1 text-sm">
						{living.map((x, k) => (
							<span key={x.a}>
								{k > 0 && ", "}
								<span className="font-semibold tabular-nums">{x.n}</span> {x.n === 1 ? ANIMAL_LABEL[x.a] : animalPlural(ANIMAL_LABEL[x.a])}
							</span>
						))}
					</p>
				)}
			</section>
			<section aria-label="Make things">
				<h3 className="text-sm font-semibold">Make things</h3>
				<ul className="mt-2 space-y-1.5">
					{RECIPES.map((r) => {
						const uses = craftUses(r, inv);
						const blocked = !uses ? "Not enough yet" : r.fire && !byFire ? "Stand by the lit fire" : null;
						return (
							<li key={r.id} className="flex items-center gap-2">
								<span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
									{r.takes.map((t) => (
										<span key={t.b} className="inline-flex items-center gap-0.5">
											<img src={tiles.get(t.b)} alt="" className="size-5 [image-rendering:pixelated]" />
											<span className="tabular-nums">×{t.n}</span>
										</span>
									))}
									<span aria-hidden>→</span>
									<img src={tiles.get(r.gives.b)} alt="" className="size-5 [image-rendering:pixelated]" />
									<span className="tabular-nums">×{r.gives.n}</span>
									<span className="sr-only">
										{r.label}: uses {r.takes.map((t) => `${t.n} ${blockInfo(t.b).label}`).join(" and ")}, makes {r.gives.n}
									</span>
								</span>
								<button
									type="button"
									className="key"
									data-variant="felt"
									disabled={!!blocked}
									title={blocked ?? undefined}
									onClick={() => onCraft(r.id)}
								>
									{r.fire && <Flame className="size-4" aria-hidden />} Make {r.label.toLowerCase()}
								</button>
							</li>
						);
					})}
				</ul>
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
					<li>
						Split logs into planks, and make torches from coal and planks. By the fire, sand melts into glass and stone bakes into brick.
					</li>
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
