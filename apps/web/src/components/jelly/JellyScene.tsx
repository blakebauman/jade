import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
	float,
	instancedDynamicBufferAttribute,
	length,
	mix,
	normalView,
	PI,
	positionLocal,
	positionView,
	positionWorld,
	smoothstep,
	uniform,
	vec2,
	vec3,
} from "three/tsl";
import {
	CanvasTexture,
	Color,
	IcosahedronGeometry,
	InstancedBufferAttribute,
	InstancedMesh,
	type Mesh,
	MeshBasicNodeMaterial,
	MeshStandardNodeMaterial,
	type Node,
	Object3D,
	type PerspectiveCamera,
	PMREMGenerator,
	type Scene,
	type Texture,
	WebGPURenderer,
} from "three/webgpu";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { useNight } from "../roxy/world/light.tsx";
import { FLAVOURS, JAR_H, JAR_W } from "./look.ts";
import { activeCells, COLS, type Game, type GameEvent, ghostY, type Input, type PieceType, ROWS, settled, shape, step } from "./sim.ts";

/**
 * Jelly Blocks' jar, drawn with three.js's WebGPU renderer (WebGL 2 where a device has no WebGPU: the renderer picks).
 *
 * Every cube is one copy of a rounded jelly cube in a single instanced mesh. Each copy carries a little spring state:
 * how squashed it is and how far its top has slid sideways. The squish happens on the GPU, per vertex, in the node
 * material (TSL): the cube's top sinks and its middle bulges out, its top lags behind a sideways move, so pieces wobble
 * like jelly when they land, step and turn, and a landing sends a ripple through the stack. A cleared row swells and
 * pops into a few droplets; the rows above fall and squash where they land. Reduced motion: no wobble, no droplets,
 * pieces simply move.
 */

const CUBE = 0.94;
const HALF = CUBE / 2;
/** Most cubes ever on screen: the jar, two rows above it and the falling piece. */
const MAX_CUBES = COLS * (ROWS + 2) + 4;
const MAX_DROPS = 160;
const STEP = 1 / 60;

/** The board's square (x, y) to world: x across, y up, the jar's floor at y = 0, its middle at x = 0. */
const wx = (x: number) => x - COLS / 2 + 0.5;
const wy = (y: number) => y;

export type Slot = { x: number; y: number; w: number; h: number };
export type Backend = "webgpu" | "webgl2";

/** Memoised: the screen's HUD re-renders a few times a second, and the scene needn't with it. */
export const JellyScene = memo(function JellyScene({
	game,
	input,
	running,
	slot,
	onEvents,
	onTick,
	onBackend,
	label,
}: {
	game: Game;
	input: RefObject<() => Input>;
	running: boolean;
	/** Where on the canvas the jar goes (laid out by the page around its trays and keys). */
	slot: Slot | null;
	onEvents: (events: GameEvent[]) => void;
	onTick: (game: Game) => void;
	onBackend?: (backend: Backend) => void;
	label: string;
}) {
	// Each lost GPU device builds the canvas again on WebGL 2; after a few, the screen says 3D can't be shown here.
	const [lost, setLost] = useState(0);
	const onLost = useCallback(() => setLost((n) => n + 1), []);
	if (lost > 3) throw new Error("The 3D view stopped working");
	return (
		<Canvas
			flat
			frameloop={running ? "always" : "demand"}
			dpr={[1, 1.75]}
			camera={{ fov: 30, near: 1, far: 300, position: [0, 13, 50] }}
			key={lost}
			gl={(props) => makeRenderer(props.canvas as HTMLCanvasElement, lost > 0, onBackend, onLost) as never}
			// The renderer arrives asynchronously, after the first frame was asked for: ask again.
			onCreated={({ invalidate }) => invalidate()}
			aria-label={label}
			role="img"
		>
			{import.meta.env.DEV && <Diagnostics />}
			<Fit slot={slot} />
			<Lights />
			<Jar />
			<Jelly game={game} input={input} running={running} onEvents={onEvents} onTick={onTick} />
		</Canvas>
	);
});

/**
 * The renderer: WebGPU where the device has it, else three's WebGL 2 backend (it picks). If the GPU device is lost
 * (a driver reset, memory pressure, a browser that gives the GPU up), the scene is built again on WebGL 2.
 */
async function makeRenderer(
	canvas: HTMLCanvasElement,
	forceWebGL: boolean,
	onBackend: ((b: Backend) => void) | undefined,
	onLost: () => void,
) {
	const r = new WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL });
	r.onDeviceLost = (info) => {
		// A deliberate dispose (leaving the screen) isn't a loss.
		if (info.reason !== "destroyed") onLost();
	};
	await r.init();
	onBackend?.((r.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "webgpu" : "webgl2");
	return r;
}

/** Rounds moved on outside the frame loop (the test hooks); the scene catches up next frame. */
const jumped = new WeakSet<Game>();
export const redrawAll = (g: Game) => {
	jumped.add(g);
};

/** A new game remounts the world (the canvas and its GPU state stay). */
const keys = new WeakMap<Game, number>();
let nextKey = 0;
const gameKey = (g: Game) => {
	let k = keys.get(g);
	if (k === undefined) {
		k = nextKey++;
		keys.set(g, k);
	}
	return k;
};

/**
 * Points the camera so the jar fills the slot the page left for it: far enough back that it fits both ways, the view
 * shifted so the jar's middle sits on the slot's middle. A touch from above, so the cubes show their tops.
 */
function Fit({ slot }: { slot: Slot | null }) {
	const camera = useThree((s) => s.camera) as PerspectiveCamera;
	const size = useThree((s) => s.size);
	const invalidate = useThree((s) => s.invalidate);
	useLayoutEffect(() => {
		const { width: W, height: H } = size;
		if (!W || !H) return;
		const r = slot && slot.w > 0 && slot.h > 0 ? slot : { x: 0, y: 0, w: W, h: H };
		const view = Math.max((JAR_H * H) / r.h, (JAR_W * H) / r.w);
		const dist = view / 2 / Math.tan((camera.fov * Math.PI) / 360);
		const look = 0.12;
		camera.position.set(0, 10 + Math.sin(look) * dist, Math.cos(look) * dist);
		camera.lookAt(0, 10, 0);
		camera.near = dist * 0.5;
		camera.far = dist * 2;
		camera.setViewOffset(W, H, W / 2 - (r.x + r.w / 2), H / 2 - (r.y + r.h / 2), W, H);
		camera.updateProjectionMatrix();
		invalidate();
	}, [slot, size, camera, invalidate]);
	return null;
}

function Lights() {
	const night = useNight();
	const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
	const scene = useThree((s) => s.scene) as unknown as Scene;
	// A soft room to reflect, for the jelly's glossy highlights.
	useEffect(() => {
		const pmrem = new PMREMGenerator(gl);
		const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		scene.environment = env;
		return () => {
			scene.environment = null;
			env.dispose();
			pmrem.dispose();
		};
	}, [gl, scene]);
	useEffect(() => {
		(scene as { environmentIntensity?: number }).environmentIntensity = night ? 0.35 : 0.3;
	}, [scene, night]);
	return night ? (
		<>
			<hemisphereLight args={["#7f8fe0", "#243049", 1.3]} />
			<directionalLight position={[6, 18, 14]} color="#c4d0ff" intensity={1.1} />
		</>
	) : (
		<>
			<hemisphereLight args={["#fffaf0", "#cdbf9f", 0.9]} />
			<directionalLight position={[6, 18, 14]} color="#fff3dc" intensity={1.25} />
		</>
	);
}

// ── The jar ──

const JAR = {
	day: { back: "#cfe6dc", dot: "#9fc8b8", frame: "#e58ab0", floor: "#d877a0" },
	night: { back: "#18463c", dot: "#2b6255", frame: "#a8336a", floor: "#922c5d" },
};

/** The jar: a pale back with a dot at every square's corner, a berry toy frame, and a soft shadow on the table. */
function Jar() {
	const night = useNight();
	const tone = night ? JAR.night : JAR.day;
	const back = useMemo(() => uniform(new Color()), []);
	const dot = useMemo(() => uniform(new Color()), []);
	const backMat = useMemo(() => {
		const m = new MeshStandardNodeMaterial({ roughness: 0.9 });
		// A dot at each corner of the grid, so a kid can count squares.
		const f = positionWorld.xy.add(vec2(0.5, 0.5)).fract().sub(0.5);
		const d = length(f);
		m.colorNode = mix(back, dot, smoothstep(0.09, 0.055, d));
		return m;
	}, [back, dot]);
	const frameMat = useMemo(() => new MeshStandardNodeMaterial({ roughness: 0.35 }), []);
	const floorMat = useMemo(() => new MeshStandardNodeMaterial({ roughness: 0.4 }), []);
	useEffect(() => {
		back.value.set(tone.back);
		dot.value.set(tone.dot);
		frameMat.color.set(tone.frame);
		floorMat.color.set(tone.floor);
	}, [tone, back, dot, frameMat, floorMat]);
	const geo = useMemo(
		() => ({
			back: new RoundedBoxGeometry(COLS + 0.2, ROWS + 0.4, 0.4, 3, 0.15),
			side: new RoundedBoxGeometry(0.55, ROWS + 1.2, 1.7, 3, 0.25),
			floor: new RoundedBoxGeometry(COLS + 1.5, 0.6, 1.7, 3, 0.25),
		}),
		[],
	);
	const shadow = useMemo(blobTexture, []);
	return (
		<group>
			<mesh geometry={geo.back} material={backMat} position={[0, ROWS / 2, -0.75]} />
			<mesh geometry={geo.side} material={frameMat} position={[-(COLS / 2 + 0.3), ROWS / 2 - 0.15, -0.1]} />
			<mesh geometry={geo.side} material={frameMat} position={[COLS / 2 + 0.3, ROWS / 2 - 0.15, -0.1]} />
			<mesh geometry={geo.floor} material={floorMat} position={[0, -0.33, -0.1]} />
			<mesh position={[0, -0.64, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[COLS + 6, 5]} />
				<meshBasicMaterial map={shadow} transparent depthWrite={false} opacity={night ? 0.5 : 0.28} color="#000" />
			</mesh>
		</group>
	);
}

/** A soft dark ellipse, for the jar's shadow on the table. */
function blobTexture(): Texture {
	const c = document.createElement("canvas");
	c.width = 128;
	c.height = 64;
	const x = c.getContext("2d")!;
	const g = x.createRadialGradient(64, 32, 4, 64, 32, 62);
	g.addColorStop(0, "rgba(255,255,255,1)");
	g.addColorStop(1, "rgba(255,255,255,0)");
	x.setTransform(1, 0, 0, 0.5, 0, 16);
	x.fillStyle = g;
	x.fillRect(0, 0, 128, 64);
	const t = new CanvasTexture(c);
	// The texture's white is the shape; the material's black is the colour.
	return t;
}

// ── Jelly ──

/** One cube's look over time, kept by its id. */
type Cube = {
	type: PieceType;
	x: number;
	y: number;
	vy: number;
	falling: boolean;
	/** Squash (+ squashed, − stretched) and its speed. */
	sq: number;
	sqv: number;
	/** How far its top has slid sideways, and its speed. */
	sh: number;
	shv: number;
	/** Size (pops in from small) and its speed. */
	s: number;
	sv: number;
	/** Seconds since it started popping, or −1. */
	pop: number;
	seen: number;
};

type Drop = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; c: Color };

/**
 * The jelly material: glossy, lit a little from inside (brighter where the cube is seen face-on, so edges read as
 * thinner jelly), and squished on the GPU from each copy's spring state.
 */
function jellyMaterial(state: InstancedBufferAttribute, tint: InstancedBufferAttribute) {
	const m = new MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0 });
	const jelly = instancedDynamicBufferAttribute(state, "vec3") as unknown as Node<"vec3">;
	const col = instancedDynamicBufferAttribute(tint, "vec3") as unknown as Node<"vec3">;
	const p = positionLocal;
	// 0 at the cube's bottom, 1 at its top.
	const h = p.y.add(HALF).div(CUBE).clamp(0, 1);
	const squash = jelly.z;
	// Squashed: the top sinks toward the bottom and the middle bulges out (stretched: the reverse).
	const bulge = h.mul(PI).sin().mul(squash).mul(0.55).add(1);
	const y = p.y.add(HALF).mul(float(1).sub(squash)).sub(HALF);
	// The top slides furthest (a sideways lag that eases toward the bottom).
	const lean = h.mul(h);
	m.positionNode = vec3(p.x.mul(bulge).add(jelly.x.mul(lean)), y, p.z.mul(bulge).add(jelly.y.mul(lean)));
	m.colorNode = col;
	const facing = normalView.dot(positionView.normalize().negate()).clamp(0, 1);
	m.emissiveNode = col.mul(facing.mul(0.22).add(0.08));
	return m;
}

type Parts = ReturnType<typeof makeParts>;

/** The cubes, ghost and droplets: made once per canvas, so a new game doesn't build (or compile) them again. */
function makeParts() {
	const state = new InstancedBufferAttribute(new Float32Array(MAX_CUBES * 3), 3);
	const tint = new InstancedBufferAttribute(new Float32Array(MAX_CUBES * 3), 3);
	const geo = new RoundedBoxGeometry(CUBE, CUBE, CUBE, 3, 0.2);
	const cubes = new InstancedMesh(geo, jellyMaterial(state, tint), MAX_CUBES);
	cubes.count = 0;
	cubes.frustumCulled = false;

	// Where the piece will land: the same cube, see-through.
	const ghostTint = uniform(new Color("#ffffff"));
	const ghostMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
	ghostMat.colorNode = ghostTint;
	ghostMat.opacityNode = float(0.38);
	const ghost = new InstancedMesh(new RoundedBoxGeometry(0.86, 0.86, 0.86, 2, 0.18), ghostMat, 4);
	ghost.count = 0;
	ghost.frustumCulled = false;

	// Droplets of the popped jelly, each in its cube's flavour.
	const dropTint = new InstancedBufferAttribute(new Float32Array(MAX_DROPS * 3), 3);
	const dropMat = new MeshStandardNodeMaterial({ roughness: 0.2 });
	const dropCol = instancedDynamicBufferAttribute(dropTint, "vec3") as unknown as Node<"vec3">;
	dropMat.colorNode = dropCol;
	dropMat.emissiveNode = dropCol.mul(0.2);
	const drops = new InstancedMesh(new IcosahedronGeometry(0.17, 1), dropMat, MAX_DROPS);
	drops.count = 0;
	drops.frustumCulled = false;
	return { cubes, state, tint, ghost, ghostTint, drops, dropTint };
}

function Jelly(props: Omit<Parameters<typeof World>[0], "parts">) {
	const parts = useMemo(makeParts, []);
	useEffect(
		() => () => {
			for (const m of [parts.cubes, parts.ghost, parts.drops]) {
				m.geometry.dispose();
				(m.material as MeshStandardNodeMaterial).dispose();
				m.dispose();
			}
		},
		[parts],
	);
	return (
		<group>
			{/* The cubes' squish pivots on their bottoms, so they're drawn from y = cube bottom. */}
			<group position={[0, HALF + 0.03, 0]}>
				<primitive object={parts.cubes} />
				<primitive object={parts.ghost} />
			</group>
			<primitive object={parts.drops} />
			<World key={gameKey(props.game)} {...props} parts={parts} />
		</group>
	);
}

function World({
	game,
	input,
	running,
	onEvents,
	onTick,
	parts,
}: {
	parts: Parts;
	game: Game;
	input: RefObject<() => Input>;
	running: boolean;
	onEvents: (events: GameEvent[]) => void;
	onTick: (game: Game) => void;
}) {
	const reduced = useMemo(prefersReducedMotion, []);
	const invalidate = useThree((s) => s.invalidate);

	// A new game changes nothing in the scene graph (the meshes stay): ask for its first frame.
	useEffect(() => invalidate(), [invalidate]);
	const cubes = useRef(new Map<number, Cube>());
	const drops = useRef<Drop[]>([]);
	/** Squash nudges arriving a moment later: the ripple through the stack. */
	const ripples = useRef<{ id: number; at: number; amount: number }[]>([]);
	const acc = useRef(0);
	const clock = useRef(0);
	const lastTick = useRef(0);
	const lastX = useRef<number | null>(null);
	const frame = useRef(0);
	const dummy = useMemo(() => new Object3D(), []);
	const colours = useMemo(
		() => Object.fromEntries(Object.entries(FLAVOURS).map(([k, v]) => [k, new Color(v)])) as Record<string, Color>,
		[],
	);

	/** Every cube now on the board: where it belongs, and whether it's the falling piece. */
	function targets(g: Game) {
		const list: { x: number; y: number; id: number; type: PieceType; live: boolean }[] = [];
		for (const [x, y, id, type] of settled(g)) list.push({ x, y, id, type, live: false });
		if (g.active) for (const [x, y, id] of activeCells(g)) list.push({ x, y, id, type: g.active.type, live: true });
		return list;
	}

	function nudge(id: number, amount: number) {
		const c = cubes.current.get(id);
		if (c) c.sqv += amount;
	}

	/** What the game just did, as jelly. */
	function react(g: Game, events: GameEvent[]) {
		if (reduced) return;
		for (const e of events) {
			if (e.type === "rotate" && g.active) for (const id of g.active.ids) nudge(id, -2.2);
			else if (e.type === "touch" && g.active) for (const id of g.active.ids) nudge(id, 1.6);
			else if (e.type === "lock") {
				// A hard drop falls fast and squashes on arrival; a gentle landing squishes a little now.
				for (const id of e.ids) {
					const c = cubes.current.get(id);
					if (!c) continue;
					if (e.hard && e.fell > 0) {
						c.falling = true;
						c.vy = -34;
					} else c.sqv += 2.4;
				}
				ripple(g, e.ids, e.hard ? Math.min(2.2, 1 + e.fell * 0.06) : 1, e.hard ? 0.06 : 0);
			} else if (e.type === "clear")
				for (const id of e.ids) {
					const c = cubes.current.get(id);
					if (c) c.pop = 0;
				}
			else if (e.type === "over") for (const c of cubes.current.values()) c.sqv += 2 + Math.random() * 3;
		}
	}

	/** A landing wobbles the cubes nearby, a moment later the further away they are. */
	function ripple(g: Game, ids: number[], strength: number, delay: number) {
		const own = new Set(ids);
		const at = targets(g);
		const from = at.filter((t) => own.has(t.id));
		for (const t of at) {
			if (own.has(t.id) || t.live) continue;
			let d = Infinity;
			for (const f of from) d = Math.min(d, Math.abs(f.x - t.x) + Math.abs(f.y - t.y));
			if (d > 4) continue;
			ripples.current.push({ id: t.id, at: clock.current + delay + d * 0.045, amount: strength * 2.2 * 0.62 ** d });
		}
	}

	useFrame((_, rawDt) => {
		const dt = Math.min(rawDt, 0.1);
		clock.current += dt;
		const g = game;

		// The rules, at a fixed 60 steps a second.
		if (running && g.phase === "play") {
			acc.current += dt;
			const events: GameEvent[] = [];
			while (acc.current >= STEP) {
				acc.current -= STEP;
				step(g, STEP, input.current());
				if (g.events.length) events.push(...g.events.splice(0));
				if (g.phase !== "play") break;
			}
			if (events.length) {
				react(g, events);
				onEvents(events);
			}
			if (clock.current - lastTick.current > 0.12) {
				lastTick.current = clock.current;
				onTick(g);
			}
		}
		const jump = jumped.has(g);
		if (jump) jumped.delete(g);

		// A sideways step: the falling piece's tops lag behind.
		const ax = g.active?.x ?? null;
		if (!reduced && g.active && lastX.current !== null && ax !== null && ax !== lastX.current)
			for (const id of g.active.ids) {
				const c = cubes.current.get(id);
				if (c) c.shv += -(ax - lastX.current) * 5.5;
			}
		lastX.current = ax;

		// Ripples whose moment has come.
		if (ripples.current.length) {
			const now = clock.current;
			ripples.current = ripples.current.filter((r) => {
				if (r.at > now) return true;
				nudge(r.id, r.amount);
				return false;
			});
		}

		let moving = ripples.current.length > 0 || drops.current.length > 0;
		const f = ++frame.current;
		const follow = reduced || jump ? 1 : 1 - Math.exp(-dt * 30);
		let n = 0;
		for (const t of targets(g)) {
			let c = cubes.current.get(t.id);
			if (!c) {
				c = {
					type: t.type,
					x: t.x,
					y: t.y,
					vy: 0,
					falling: false,
					sq: 0,
					sqv: 0,
					sh: 0,
					shv: 0,
					s: t.live && !reduced && !jump ? 0.3 : 1,
					sv: 0,
					pop: -1,
					seen: f,
				};
				cubes.current.set(t.id, c);
			}
			c.seen = f;
			c.type = t.type;
			c.x += (t.x - c.x) * follow;
			if (reduced || jump) {
				c.y = t.y;
				c.falling = false;
			} else {
				// A settled cube more than a little above its place falls there (after a clear, or a hard drop).
				if (!t.live && c.y - t.y > 0.3) c.falling = true;
				if (c.falling) {
					c.vy -= 95 * dt;
					c.y += c.vy * dt;
					if (c.y <= t.y) {
						c.sqv += Math.min(7, -c.vy * 0.2);
						c.y = t.y;
						c.vy = 0;
						c.falling = false;
					}
				} else c.y += (t.y - c.y) * follow;
			}
			if (!reduced) {
				// Springs: squash and lean wobble back to rest; size springs to full (an overshoot as a piece appears).
				c.sqv += (-190 * c.sq - 8 * c.sqv) * dt;
				c.sq = Math.max(-0.28, Math.min(0.34, c.sq + c.sqv * dt));
				c.shv += (-230 * c.sh - 9 * c.shv) * dt;
				c.sh = Math.max(-0.45, Math.min(0.45, c.sh + c.shv * dt));
				c.sv += (-320 * (c.s - 1) - 16 * c.sv) * dt;
				c.s += c.sv * dt;
			} else {
				c.sq = c.sh = 0;
				c.s = 1;
			}
			let scale = c.s;
			if (c.pop >= 0) {
				c.pop += dt;
				// Swell, then pop into droplets.
				if (c.pop < 0.12) scale = 1 + c.pop * 2.6;
				else {
					if (c.pop - dt < 0.12 && !reduced) splash(c);
					scale = Math.max(0, 1.3 * (1 - (c.pop - 0.12) / 0.14));
				}
			}
			if (
				c.falling ||
				c.pop >= 0 ||
				Math.abs(c.sq) + Math.abs(c.sqv) * 0.05 > 0.002 ||
				Math.abs(c.sh) + Math.abs(c.shv) * 0.05 > 0.002 ||
				Math.abs(c.s - 1) > 0.002 ||
				Math.abs(t.x - c.x) + Math.abs(t.y - c.y) > 0.002
			)
				moving = true;
			if (n >= MAX_CUBES) continue;
			dummy.position.set(wx(c.x), wy(c.y), 0);
			dummy.scale.setScalar(Math.max(0.0001, scale));
			dummy.updateMatrix();
			parts.cubes.setMatrixAt(n, dummy.matrix);
			parts.state.setXYZ(n, c.sh, 0, c.sq);
			const col = colours[c.type]!;
			parts.tint.setXYZ(n, col.r, col.g, col.b);
			n++;
		}
		for (const [id, c] of cubes.current) if (c.seen !== f) cubes.current.delete(id);
		parts.cubes.count = n;
		parts.cubes.instanceMatrix.needsUpdate = true;
		parts.state.needsUpdate = true;
		parts.tint.needsUpdate = true;

		// The ghost: where the piece lands, if it isn't already there.
		const a = g.active;
		let gn = 0;
		if (a && g.phase === "play") {
			const gy = ghostY(g);
			parts.ghostTint.value.copy(colours[a.type]!);
			if (gy !== a.y)
				for (const [cx, cy] of shape(a.type, a.rot)) {
					dummy.position.set(wx(a.x + cx), wy(gy + cy), 0);
					dummy.scale.setScalar(1);
					dummy.updateMatrix();
					parts.ghost.setMatrixAt(gn++, dummy.matrix);
				}
		}
		parts.ghost.count = gn;
		parts.ghost.instanceMatrix.needsUpdate = true;

		// Droplets: flung out, falling, shrinking away.
		let dn = 0;
		drops.current = drops.current.filter((d) => {
			d.life -= dt;
			if (d.life <= 0) return false;
			d.vy -= 26 * dt;
			d.x += d.vx * dt;
			d.y += d.vy * dt;
			d.z += d.vz * dt;
			if (dn < MAX_DROPS) {
				dummy.position.set(d.x, d.y, d.z);
				dummy.scale.setScalar(Math.min(1, d.life * 2.5));
				dummy.updateMatrix();
				parts.drops.setMatrixAt(dn, dummy.matrix);
				parts.dropTint.setXYZ(dn, d.c.r, d.c.g, d.c.b);
				dn++;
			}
			return true;
		});
		parts.drops.count = dn;
		parts.drops.instanceMatrix.needsUpdate = true;
		parts.dropTint.needsUpdate = true;

		// Paused, over or not started: keep drawing only while something's still settling, and for the first moments
		// (the canvas may be sized again after the first frame, which clears it).
		if (!running && (moving || clock.current < 1.5)) invalidate();
	});

	function splash(c: Cube) {
		const col = colours[c.type]!;
		for (let i = 0; i < 2; i++) {
			const a = Math.random() * Math.PI * 2;
			const sp = 3 + Math.random() * 4;
			drops.current.push({
				x: wx(c.x) + (Math.random() - 0.5) * 0.5,
				y: wy(c.y) + 0.5,
				z: 0.3,
				vx: Math.cos(a) * sp,
				vy: 5 + Math.random() * 5,
				vz: 1 + Math.random() * 3,
				life: 0.45 + Math.random() * 0.25,
				c: col,
			});
		}
	}

	return null;
}

/**
 * Dev only: what a frame costs and which renderer drew it, on `window.__THREE_GAME_DIAGNOSTICS__` for the canvas
 * inspector and the e2e tests. WebGPU's counts are reset every animation frame, so this draws the frame itself (a
 * positive priority takes over three's render) and reads them straight after.
 */
function Diagnostics() {
	useFrame(({ gl, scene, camera }) => {
		const r = gl as unknown as WebGPURenderer;
		r.render(scene as unknown as Scene, camera);
		const { render, memory } = r.info;
		let meshes = 0;
		let instanced = 0;
		scene.traverseVisible((o) => {
			const m = o as Mesh;
			if (!m.isMesh) return;
			meshes++;
			if ((m as { isInstancedMesh?: boolean }).isInstancedMesh) instanced++;
		});
		(window as { __THREE_GAME_DIAGNOSTICS__?: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
			renderer: {
				calls: render.drawCalls,
				triangles: Math.round(render.triangles),
				geometries: memory.geometries,
				textures: memory.textures,
			},
			backend: (r.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "webgpu" : "webgl2",
			scene: { meshes, instanced },
			dpr: r.getPixelRatio(),
		};
	}, 1);
	return null;
}
