import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
	AlwaysStencilFunc,
	BackSide,
	type BufferGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	EqualStencilFunc,
	Float32BufferAttribute,
	type Group,
	IcosahedronGeometry,
	InstancedMesh,
	type Material,
	Matrix4,
	type Mesh,
	MeshBasicMaterial,
	MeshToonMaterial,
	NotEqualStencilFunc,
	type PerspectiveCamera,
	Quaternion,
	ReplaceStencilOp,
	RingGeometry,
	ShaderChunk,
	type Sprite,
	SRGBColorSpace,
	Vector3,
} from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { toonGradient } from "../roxy/world/Furniture.tsx";
import { useNight } from "../roxy/world/light.tsx";
import { useContextLoss } from "../roxy/world/pace.tsx";
import { Diagnostics, softwareGl, Thrift } from "../roxy/world/stage.tsx";
import { groundTexture } from "./ground.ts";
import { KIND_IDS, KINDS, type KindId } from "./kinds.ts";
import { propGeometry } from "./props.ts";
import { type Game, type GameEvent, isIn, type Obj, PLAYER, step } from "./sim.ts";
import { SIZE } from "./town.ts";

/**
 * Gobble Town drawn: the town board, every thing in it (one instanced mesh per kind, so a thousand things are a few
 * dozen draws), and the holes. A hole is real: its disc marks the stencil, the ground isn't drawn there, and inside
 * is a dark shaft, so things visibly drop into it. The camera follows the player's hole from a raised angle and pulls
 * back as it grows. The scene also runs the round: it steps the rules at a steady 60 a second while `running`, and
 * passes what happened (`onEvents`) and a few snapshots a second (`onTick`) up to the screen's HUD.
 */

/** The player's steering in screen terms: x right, y up the screen, no longer than 1. */
export type Steer = { x: number; y: number };

const STEP = 1 / 60;
/** The hole's shaft: how deep it's drawn. */
const SHAFT = 9;
const UP = new Vector3(0, 1, 0);

/** Which way each kind's model faces: props face +x or +z; the rules turn +x toward where a thing looks. */
const FRONT_Z = new Set<KindId>(["bench", "kiosk", "sign", "cottage", "petshop", "school", "tower"]);

/** Memoised: the screen's HUD re-renders a few times a second, and the scene needn't with it. */
export const GobbleScene = memo(function GobbleScene({
	game,
	steer,
	running,
	onEvents,
	onTick,
	label,
}: {
	game: Game;
	steer: RefObject<Steer>;
	running: boolean;
	onEvents: (events: GameEvent[]) => void;
	onTick: (game: Game) => void;
	label: string;
}) {
	const onCreated = useContextLoss();
	const software = useMemo(softwareGl, []);
	return (
		<Canvas
			flat
			frameloop={running ? "always" : "demand"}
			onCreated={onCreated}
			dpr={software ? 1 : [1, 1.75]}
			camera={{ fov: 40, near: 0.5, far: 260, position: [8, 14, 24] }}
			gl={{ alpha: true, antialias: true, stencil: true }}
			aria-label={label}
			role="img"
		>
			<Thrift />
			{import.meta.env.DEV && <Diagnostics />}
			<Lights />
			<World key={gameKey(game)} game={game} steer={steer} running={running} onEvents={onEvents} onTick={onTick} />
		</Canvas>
	);
});

/** Rounds moved on outside the frame loop; the scene redraws everything in them next frame. */
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

function Lights() {
	const night = useNight();
	return night ? (
		<>
			<hemisphereLight args={["#6a7ccc", "#2a2546", 1.05]} />
			<directionalLight position={[20, 40, 18]} color="#b8c6ff" intensity={0.75} />
		</>
	) : (
		<>
			<hemisphereLight args={["#fff7ea", "#cdbf9f", 1.55]} />
			<directionalLight position={[20, 40, 18]} color="#fff0d2" intensity={1.9} />
		</>
	);
}

// ── Materials, shared by every round ──

let bodyMat: MeshToonMaterial | undefined;
/** Toon, coloured by its vertices; parts marked `tint` take each copy's paint colour. */
function bodyMaterial() {
	if (bodyMat) return bodyMat;
	bodyMat = new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
	bodyMat.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nattribute float tint;")
			.replace(
				"#include <color_vertex>",
				ShaderChunk.color_vertex.replace("vColor.rgb *= instanceColor.rgb;", "vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, tint );"),
			);
	};
	bodyMat.customProgramCacheKey = () => "gobble-tint";
	return bodyMat;
}

let glowDay: MeshToonMaterial | undefined;
let glowNight: MeshBasicMaterial | undefined;
/** Windows and lamp glass: painted by day, lit at Night. */
function glowMaterial(night: boolean) {
	glowDay ??= new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), polygonOffset: true, polygonOffsetFactor: -1 });
	glowNight ??= new MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 });
	return night ? glowNight : glowDay;
}

/** Drawn only where no hole is (the stencil isn't 1). */
const notInHole = { stencilWrite: true, stencilRef: 1, stencilFunc: NotEqualStencilFunc } as const;

// ── The world for one round ──

/**
 * The town's things in groups: one per kind per quarter of the town, each its own instanced mesh, so the quarters
 * off screen aren't drawn (an instanced mesh is culled whole or not at all).
 */
type Group_ = {
	kind: KindId;
	list: number[];
	/** Which object each instance slot draws. Gobbled things are swapped to the end and dropped from `live`. */
	owner: Int32Array;
	/** How many slots are still drawn (each mesh's `count`). */
	live: number;
	/** Each object's slot (shared by the round's groups, indexed by object). */
	slot: Int32Array;
};
type Registry = Map<number, InstancedMesh[]>;
const quarter = (o: { x: number; z: number }) => (o.x < SIZE / 2 ? 0 : 1) + (o.z < SIZE / 2 ? 0 : 2);

function World({
	game,
	steer,
	running,
	onEvents,
	onTick,
}: {
	game: Game;
	steer: RefObject<Steer>;
	running: boolean;
	onEvents: (events: GameEvent[]) => void;
	onTick: (game: Game) => void;
}) {
	const registry = useMemo<Registry>(() => new Map(), []);
	/** The groups (indexes into game.objs), and each object's group and place in it. */
	const { groups, group, slot } = useMemo(() => {
		const at = new Map<string, number>();
		const groups: Group_[] = [];
		const group = new Int32Array(game.objs.length);
		const slot = new Int32Array(game.objs.length);
		for (const kind of KIND_IDS)
			for (let q = 0; q < 4; q++) {
				at.set(`${kind}${q}`, groups.length);
				groups.push({ kind, list: [], owner: new Int32Array(0), live: 0, slot });
			}
		game.objs.forEach((o, i) => {
			const g = at.get(`${o.kind}${quarter(o)}`)!;
			group[i] = g;
			slot[i] = groups[g]!.list.length;
			groups[g]!.list.push(i);
		});
		for (const g of groups) {
			g.owner = Int32Array.from(g.list);
			g.live = g.list.length;
		}
		return { groups, group, slot };
	}, [game]);
	const blobs = useRef<InstancedMesh>(null);
	const holes = useRef<(HoleParts | null)[]>([]);
	const fx = useRef<Effects>(null);
	const acc = useRef(0);
	const lastMoving = useRef<number[]>([]);
	const tickAt = useRef(0);
	const events = useRef(onEvents);
	events.current = onEvents;
	const tick = useRef(onTick);
	tick.current = onTick;
	const reduced = useMemo(prefersReducedMotion, []);
	const shake = useRef(0);
	/** One stable ref callback per hole, so its parts aren't re-registered on every render. */
	const holeRefs = useMemo(
		() =>
			game.holes.map((_, i) => (parts: HoleParts | null) => {
				holes.current[i] = parts;
			}),
		[game],
	);

	/** A gobbled thing leaves its group: the last drawn copy moves into its slot and one fewer is drawn. */
	const drop = (i: number) => {
		const gr = groups[group[i]!]!;
		const s = slot[i]!;
		const last = gr.live - 1;
		if (s > last) return;
		const j = gr.owner[last]!;
		for (const mesh of registry.get(group[i]!) ?? []) {
			mesh.getMatrixAt(last, m4b);
			mesh.setMatrixAt(s, m4b);
			if (mesh.instanceColor) {
				mesh.getColorAt(last, cTmp);
				mesh.setColorAt(s, cTmp);
				mesh.instanceColor.needsUpdate = true;
			}
			mesh.count = last;
		}
		gr.owner[s] = j;
		gr.owner[last] = i;
		slot[j] = s;
		slot[i] = last;
		gr.live = last;
	};

	useFrame((state, dt) => {
		// The rules, at a steady rate whatever the screen's.
		if (running) {
			acc.current = Math.min(acc.current + dt, STEP * 6);
			const s = steer.current;
			// The camera looks north: up the screen is -z.
			const dir = { x: s?.x ?? 0, z: -(s?.y ?? 0) };
			while (acc.current >= STEP) {
				step(game, STEP, dir);
				acc.current -= STEP;
			}
		}
		if (game.events.length) {
			const happened = game.events.splice(0);
			for (const e of happened) {
				if (e.type === "gulp") {
					fx.current?.burst(e.x, e.z, game.holes[e.hole]!.colour, Math.min(10, 2 + e.value / 3));
					if (e.hole === PLAYER) {
						fx.current?.score(e.value);
						if (e.value >= 15 && !reduced) shake.current = Math.min(1, shake.current + e.value / 60);
					}
				} else if (e.type === "gobbled") {
					fx.current?.burst(e.x, e.z, game.holes[e.eaten]!.colour, 24);
					if (e.eater === PLAYER) fx.current?.score(0, game.holes[e.eaten]!.name);
					if (!reduced && (e.eater === PLAYER || e.eaten === PLAYER)) shake.current = 0.7;
				}
			}
			events.current(happened);
		}
		if (state.clock.elapsedTime - tickAt.current > 0.15) {
			tickAt.current = state.clock.elapsedTime;
			tick.current(game);
		}

		// The round was moved on outside the frame loop (a test jumping ahead): put everything where it now is.
		if (jumped.delete(game)) {
			game.objs.forEach((o, i) => {
				if (o.state === "gone") drop(i);
			});
			groups.forEach((gr, k) => {
				for (const mesh of registry.get(k) ?? []) {
					for (let s = 0; s < gr.live; s++) mesh.setMatrixAt(s, objMatrix(game.objs[gr.owner[s]!]!, m4));
					mesh.instanceMatrix.needsUpdate = true;
				}
			});
			if (blobs.current) {
				game.objs.forEach((o, i) => {
					blobs.current!.setMatrixAt(i, blobMatrix(o, m4));
				});
				blobs.current.instanceMatrix.needsUpdate = true;
			}
		}
		// Things that moved since last frame (and those that just stopped, or vanished).
		const moving = [...game.moving];
		const dirty = new Set<number>();
		const touch = (i: number) => {
			const o = game.objs[i]!;
			const g = group[i]!;
			dirty.add(g);
			if (o.state === "gone") drop(i);
			else {
				objMatrix(o, m4);
				for (const mesh of registry.get(g) ?? []) mesh.setMatrixAt(slot[i]!, m4);
			}
			const b = blobs.current;
			if (b) {
				blobMatrix(o, m4);
				b.setMatrixAt(i, m4);
			}
		};
		for (const i of lastMoving.current) touch(i);
		for (const i of moving) touch(i);
		lastMoving.current = moving;
		for (const k of dirty) for (const mesh of registry.get(k) ?? []) mesh.instanceMatrix.needsUpdate = true;
		if (dirty.size && blobs.current) blobs.current.instanceMatrix.needsUpdate = true;

		// The holes.
		const t = state.clock.elapsedTime;
		game.holes.forEach((h, i) => {
			const parts = holes.current[i];
			if (!parts) return;
			parts.group.visible = isIn(h);
			parts.group.position.set(h.x, 0, h.z);
			parts.disc.scale.setScalar(h.r);
			parts.shaft.scale.set(h.r, SHAFT, h.r);
			parts.rim.scale.setScalar(h.r);
			// Just back: the rim shimmers while it can't be gobbled.
			const safe = game.time < h.safeUntil && game.phase === "play";
			(parts.rim.material as MeshBasicMaterial).opacity = safe && !reduced ? 0.45 + 0.4 * Math.sin(t * 12) : 1;
			parts.label.position.set(0, 0.4, -h.r - 0.5);
		});

		fx.current?.update(Math.min(dt, 0.1));

		// The camera follows the player's hole, pulling back as it grows.
		const p = game.holes[PLAYER]!;
		const cam = state.camera as PerspectiveCamera;
		const dist = viewDistance(p.r, state.size);
		want.set(p.x, 0, p.z - p.r * 0.2);
		const ease = reduced ? 1 : Math.min(1, dt * 4);
		look.lerp(want, isIn(p) ? ease : 0);
		eye.copy(look).addScaledVector(VIEW, dist);
		cam.position.lerp(eye, ease);
		if (shake.current > 0) {
			const k = shake.current * shake.current * 0.35;
			cam.position.x += Math.sin(t * 61) * k;
			cam.position.y += Math.sin(t * 47 + 1) * k;
			shake.current = Math.max(0, shake.current - dt * 1.8);
		}
		cam.lookAt(look);
	});

	// Start where the player is, not gliding in from across town.
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	useLayoutEffect(() => {
		const p = game.holes[PLAYER]!;
		look.set(p.x, 0, p.z);
		camera.position.copy(look).addScaledVector(VIEW, viewDistance(p.r, size));
		camera.lookAt(look);
	}, [camera, game]);

	return (
		<>
			<Board />
			{groups.map((g, k) =>
				g.list.length ? <Kind key={`${g.kind}${k}`} id={k} kind={g.kind} game={game} group={g} registry={registry} /> : null,
			)}
			<Blobs game={game} ref={blobs} />
			{game.holes.map((h, i) => (
				<HoleView key={i} colour={h.colour} name={h.player ? "You" : h.name} player={h.player} ref={holeRefs[i]!} />
			))}
			<EffectsView ref={fx} />
		</>
	);
}

/** How far back the camera sits: further as the hole grows, and further on a tall narrow screen (a phone held upright). */
const viewDistance = (r: number, size: { width: number; height: number }) =>
	(10 + r * 4.4) * Math.max(1, (size.height / size.width) ** 0.55);

const look = new Vector3();
const eye = new Vector3();
const want = new Vector3();
/** From what the camera looks at toward the camera: up and to the south, about 52° down. */
const VIEW = new Vector3(0, Math.sin((52 * Math.PI) / 180), Math.cos((52 * Math.PI) / 180));

// ── Placing things ──

const m4 = new Matrix4();
const m4b = new Matrix4();
const cTmp = new Color();
const q = new Quaternion();
const qTilt = new Quaternion();
const axis = new Vector3();
const pos = new Vector3();
const one = new Vector3(1, 1, 1);
const zero = new Vector3(0, 0, 0);

function objMatrix(o: Obj, out: Matrix4) {
	if (o.state === "gone") return out.compose(zero, q.identity(), zero);
	q.setFromAxisAngle(UP, o.rot + (FRONT_Z.has(o.kind) ? Math.PI / 2 : 0));
	if (o.tilt) {
		// Tips its top toward (tx, tz).
		axis.set(o.tz, 0, -o.tx).normalize();
		qTilt.setFromAxisAngle(axis, o.tilt);
		q.premultiply(qTilt);
	}
	return out.compose(pos.set(o.x, o.y, o.z), q, one);
}

function blobMatrix(o: Obj, out: Matrix4) {
	if (o.state !== "stand") return out.compose(zero, q.identity(), zero);
	const r = KINDS[o.kind].r * 0.95;
	return out.compose(pos.set(o.x, 0.02, o.z), q.identity(), axis.set(r, r, r));
}

/** One group of things: the code-built shape, instanced. */
function Kind(props: InstanceProps) {
	return <Instances {...props} geo={propGeometry(props.kind)} />;
}

type InstanceProps = { id: number; kind: KindId; game: Game; group: Group_; registry: Registry };

function Instances({ id, kind, game, group, registry, geo }: InstanceProps & { geo: { body: BufferGeometry; glow?: BufferGeometry } }) {
	const night = useNight();
	const body = useMemo(() => new InstancedMesh(geo.body, bodyMaterial(), group.list.length), [geo, group]);
	const glow = useMemo(() => (geo.glow ? new InstancedMesh(geo.glow, glowMaterial(false), group.list.length) : null), [geo, group]);
	if (glow) glow.material = glowMaterial(night);
	useRegister(id, game, group, registry, [body, glow], KINDS[kind].tint);
	return (
		<>
			<primitive object={body} />
			{glow && <primitive object={glow} />}
		</>
	);
}

/** Puts a kind's meshes in the registry (the frame loop moves them) with every copy where it is now. */
function useRegister(
	id: number,
	game: Game,
	group: Group_,
	registry: Registry,
	meshes: (InstancedMesh | null)[],
	tint?: readonly string[],
) {
	useLayoutEffect(() => {
		const live = meshes.filter((m): m is InstancedMesh => !!m);
		const c = new Color();
		for (const mesh of live) {
			for (let s = 0; s < group.list.length; s++) {
				const o = game.objs[group.owner[s]!]!;
				mesh.setMatrixAt(s, objMatrix(o, m4));
				// Only the body takes the paint: lit windows and headlights keep their own colour.
				if (tint && mesh === live[0]) mesh.setColorAt(s, c.set(tint[o.tint % tint.length]!));
			}
			mesh.count = group.live;
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			// Culled by where its copies stand, with room for one tipping into a hole across the quarter's edge.
			mesh.computeBoundingSphere();
			if (mesh.boundingSphere) mesh.boundingSphere.radius += 6;
		}
		registry.set(id, live);
		return () => {
			if (registry.get(id) === live) registry.delete(id);
			for (const mesh of live) mesh.dispose();
		};
	}, [id, game, group, registry, ...meshes]);
}

// ── Ground and shadows ──

/** The painted ground, kept for every round (it's the same town shape each time). */
let ground: ReturnType<typeof groundTexture> | undefined;

function Board() {
	ground ??= groundTexture();
	const map = ground;
	return (
		<>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[SIZE / 2, 0, SIZE / 2]}>
				<planeGeometry args={[SIZE, SIZE]} />
				<meshToonMaterial map={map} gradientMap={toonGradient()} {...notInHole} />
			</mesh>
			{/* The board's sides: turf over soil, so the town is a toy on a table. Its top is never drawn in a hole. */}
			<mesh position={[SIZE / 2, -0.95, SIZE / 2]}>
				<boxGeometry args={[SIZE + 0.6, 1.6, SIZE + 0.6]} />
				<meshToonMaterial color="#9a6b48" gradientMap={toonGradient()} {...notInHole} />
			</mesh>
			{/* Its top stays just under the painted ground, or the two would flicker through each other. */}
			<mesh position={[SIZE / 2, -0.22, SIZE / 2]}>
				<boxGeometry args={[SIZE + 0.62, 0.4, SIZE + 0.62]} />
				<meshToonMaterial color="#7fb35f" gradientMap={toonGradient()} {...notInHole} />
			</mesh>
		</>
	);
}

function Blobs({ game, ref }: { game: Game; ref: RefObject<InstancedMesh | null> }) {
	const mesh = useMemo(() => {
		const geo = new CircleGeometry(1, 18).rotateX(-Math.PI / 2);
		const mat = new MeshBasicMaterial({ color: "#2b1d14", transparent: true, opacity: 0.16, depthWrite: false, ...notInHole });
		const m = new InstancedMesh(geo, mat, game.objs.length);
		m.frustumCulled = false;
		game.objs.forEach((o, i) => {
			m.setMatrixAt(i, blobMatrix(o, m4));
		});
		return m;
	}, [game]);
	useEffect(() => {
		ref.current = mesh;
		return () => {
			mesh.geometry.dispose();
			(mesh.material as Material).dispose();
			mesh.dispose();
		};
	}, [mesh, ref]);
	return <primitive object={mesh} />;
}

// ── Holes ──

type HoleParts = { group: Group; disc: Mesh; shaft: Mesh; rim: Mesh; label: Sprite };

const discGeo = new CircleGeometry(1, 56).rotateX(-Math.PI / 2);
const rimGeo = new RingGeometry(1, 1.075, 56, 1).rotateX(-Math.PI / 2);
/** The shaft: a closed cylinder seen from inside, its top at the ground; light at the top fading to black. */
const shaftGeo = (() => {
	const g = new CylinderGeometry(1, 0.86, 1, 56, 4, false).translate(0, -0.5, 0);
	const p = g.attributes.position!;
	const c = new Float32Array(p.count * 3);
	for (let i = 0; i < p.count; i++) {
		const y = -p.getY(i);
		const v = Math.max(0, 1 - y * 2.2) ** 1.5;
		c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
	}
	g.setAttribute("color", new Float32BufferAttribute(c, 3));
	return g;
})();
/** Writes 1 into the stencil where the hole is. Drawn before anything else. */
const maskMat = new MeshBasicMaterial({
	colorWrite: false,
	depthWrite: false,
	stencilWrite: true,
	stencilRef: 1,
	stencilFunc: AlwaysStencilFunc,
	stencilZPass: ReplaceStencilOp,
});

function HoleView({ colour, name, player, ref }: { colour: string; name: string; player: boolean; ref: (p: HoleParts | null) => void }) {
	const group = useRef<Group>(null);
	const disc = useRef<Mesh>(null);
	const shaft = useRef<Mesh>(null);
	const rim = useRef<Mesh>(null);
	const label = useRef<Sprite>(null);
	const shaftMat = useMemo(
		() =>
			new MeshBasicMaterial({
				vertexColors: true,
				color: new Color(colour).lerp(new Color("#120a1c"), 0.72),
				side: BackSide,
				stencilWrite: true,
				stencilRef: 1,
				stencilFunc: EqualStencilFunc,
			}),
		[colour],
	);
	const rimMat = useMemo(() => new MeshBasicMaterial({ color: colour, transparent: true, side: DoubleSide }), [colour]);
	const tag = useMemo(() => labelTexture(name, colour, player), [name, colour, player]);
	useEffect(
		() => () => {
			shaftMat.dispose();
			rimMat.dispose();
			tag.dispose();
		},
		[shaftMat, rimMat, tag],
	);
	useLayoutEffect(() => {
		if (group.current && disc.current && shaft.current && rim.current && label.current)
			ref({ group: group.current, disc: disc.current, shaft: shaft.current, rim: rim.current, label: label.current });
		return () => ref(null);
	}, [ref]);
	return (
		<group ref={group}>
			<mesh ref={disc} geometry={discGeo} material={maskMat} position={[0, 0.003, 0]} renderOrder={-10} />
			<mesh ref={shaft} geometry={shaftGeo} material={shaftMat} />
			<mesh ref={rim} geometry={rimGeo} material={rimMat} position={[0, 0.03, 0]} />
			<sprite ref={label} scale={[0.05 * TAG_ASPECT, 0.05, 1]} renderOrder={10}>
				<spriteMaterial map={tag} sizeAttenuation={false} depthTest={false} transparent />
			</sprite>
		</group>
	);
}

const TAG_W = 256;
const TAG_H = 64;
const TAG_ASPECT = TAG_W / TAG_H;

/**
 * A name tag: the hole's colour behind its name in the round display face, centred on a fixed-size canvas (its size
 * can't change once uploaded). Long names shrink to fit.
 */
function labelTexture(name: string, colour: string, player: boolean) {
	const canvas = document.createElement("canvas");
	canvas.width = TAG_W;
	canvas.height = TAG_H;
	const h = TAG_H;
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	const draw = () => {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let size = player ? 38 : 34;
		const font = () => `600 ${size}px "Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif`;
		ctx.font = font();
		while (size > 18 && ctx.measureText(name).width + 40 > TAG_W) {
			size -= 2;
			ctx.font = font();
		}
		const w = Math.min(TAG_W, Math.ceil(ctx.measureText(name).width) + 40);
		const x0 = (TAG_W - w) / 2;
		ctx.clearRect(0, 0, TAG_W, TAG_H);
		ctx.fillStyle = colour;
		ctx.beginPath();
		ctx.roundRect(x0 + 2, 6, w - 4, h - 12, (h - 12) / 2);
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "rgba(255,255,255,0.85)";
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(name, TAG_W / 2, h / 2 + 2);
		t.needsUpdate = true;
	};
	draw();
	// The display face may still be loading: draw again once it's here.
	void document.fonts?.load('600 34px "Fredoka Variable"').then(draw, () => {});
	return t;
}

// ── Effects: confetti when something drops in, "+12" over the player ──

type Effects = {
	burst: (x: number, z: number, colour: string, n: number) => void;
	score: (value: number, gobbled?: string) => void;
	update: (dt: number) => void;
};

const BITS = 220;
const POPS = 5;

function EffectsView({ ref }: { ref: RefObject<Effects | null> }) {
	const reduced = useMemo(prefersReducedMotion, []);
	const bits = useMemo(() => {
		const m = new InstancedMesh(new IcosahedronGeometry(0.09, 0), new MeshBasicMaterial(), BITS);
		m.frustumCulled = false;
		for (let i = 0; i < BITS; i++) {
			m.setMatrixAt(i, m4.compose(zero, q.identity(), zero));
			m.setColorAt(i, new Color("#ffffff"));
		}
		return m;
	}, []);
	const pops = useRef<(Sprite | null)[]>([]);
	const popTex = useMemo(() => Array.from({ length: POPS }, () => popTexture()), []);
	const state = useMemo(
		() => ({
			p: new Float32Array(BITS * 3),
			v: new Float32Array(BITS * 3),
			life: new Float32Array(BITS),
			next: 0,
			pop: Array.from({ length: POPS }, () => ({ t: -1 })),
			popNext: 0,
		}),
		[],
	);
	const camera = useThree((s) => s.camera);
	useEffect(
		() => () => {
			bits.geometry.dispose();
			(bits.material as Material).dispose();
			for (const t of popTex) t.texture.dispose();
		},
		[bits, popTex],
	);
	useLayoutEffect(() => {
		const c = new Color();
		const white = new Color("#ffffff");
		ref.current = {
			burst(x, z, colour, n) {
				if (reduced) return;
				for (let k = 0; k < n; k++) {
					const i = state.next;
					state.next = (state.next + 1) % BITS;
					const a = Math.random() * Math.PI * 2;
					const s = 1.5 + Math.random() * 2;
					state.p.set([x + Math.cos(a) * 0.2, 0.1, z + Math.sin(a) * 0.2], i * 3);
					state.v.set([Math.cos(a) * s, 4 + Math.random() * 3, Math.sin(a) * s], i * 3);
					state.life[i] = 0.9;
					bits.setColorAt(i, k % 3 === 0 ? white : c.set(colour));
				}
				if (bits.instanceColor) bits.instanceColor.needsUpdate = true;
			},
			score(value, gobbled) {
				const i = state.popNext;
				state.popNext = (state.popNext + 1) % POPS;
				popTex[i]!.draw(gobbled ? `Gobbled ${gobbled}!` : `+${value}`);
				state.pop[i]!.t = 0;
			},
			update(dt) {
				let any = false;
				for (let i = 0; i < BITS; i++) {
					if (state.life[i]! <= 0) continue;
					any = true;
					state.life[i]! -= dt;
					const j = i * 3;
					state.v[j + 1]! -= 14 * dt;
					state.p[j]! += state.v[j]! * dt;
					state.p[j + 1]! += state.v[j + 1]! * dt;
					state.p[j + 2]! += state.v[j + 2]! * dt;
					const s = Math.max(0, state.life[i]! / 0.9);
					q.setFromAxisAngle(UP, state.life[i]! * 9);
					bits.setMatrixAt(i, m4.compose(pos.set(state.p[j]!, state.p[j + 1]!, state.p[j + 2]!), q, axis.set(s, s, s)));
					if (state.life[i]! <= 0) bits.setMatrixAt(i, m4.compose(zero, q.identity(), zero));
				}
				if (any) bits.instanceMatrix.needsUpdate = true;
				// Score pops rise from just above the middle of the screen (over the player's hole) and fade.
				state.pop.forEach((p, i) => {
					const s = pops.current[i];
					if (!s) return;
					if (p.t < 0) {
						s.visible = false;
						return;
					}
					p.t += dt;
					const k = p.t / 0.9;
					s.visible = k < 1;
					if (k >= 1) p.t = -1;
					// Placed in front of the camera, so it's the same size and place whatever the zoom.
					s.position.set(0, 0.12 + (reduced ? 0 : k * 0.12), -1).applyMatrix4(camera.matrixWorld);
					(s.material as { opacity: number }).opacity = 1 - k * k;
				});
			},
		};
		return () => {
			ref.current = null;
		};
	}, [ref, bits, state, popTex, reduced, camera]);
	return (
		<>
			<primitive object={bits} />
			{popTex.map((t, i) => (
				<sprite
					key={i}
					ref={(s) => {
						pops.current[i] = s;
					}}
					visible={false}
					renderOrder={20}
					scale={[0.32, 0.08, 1]}
				>
					<spriteMaterial map={t.texture} depthTest={false} transparent />
				</sprite>
			))}
		</>
	);
}

function popTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 128;
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return {
		texture,
		draw(text: string) {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.clearRect(0, 0, 512, 128);
			ctx.font = '700 72px "Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			ctx.lineWidth = 14;
			ctx.strokeStyle = "#5b1638";
			ctx.strokeText(text, 256, 66);
			ctx.fillStyle = "#ffe08a";
			ctx.fillText(text, 256, 66);
			texture.needsUpdate = true;
		},
	};
}
