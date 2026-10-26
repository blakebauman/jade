import { at, type Board, type Cell, cellKey, sizeOf } from "@jade/core/code";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
	type BufferGeometry,
	Color,
	type Group,
	InstancedMesh,
	type Mesh,
	MeshBasicMaterial,
	Object3D,
	type OrthographicCamera,
	RingGeometry,
	SphereGeometry,
} from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { Static } from "../roxy/world/batch.tsx";
import { Diagnostics } from "../roxy/world/diagnostics.tsx";
import { TownLights } from "../roxy/world/light.tsx";
import { Pace, useContextLoss, useWake } from "../roxy/world/pace.tsx";
import {
	bakedToon,
	buildScenery,
	buildTuck,
	C,
	CAMERA_OFFSET,
	chalkOutlines,
	chalkPatches,
	FEET,
	headingY,
	hedgeShape,
	livePieceFor,
	PEN_DROP,
	viewBounds,
} from "./three/pieces.ts";
import { type BoardViewProps, tuckAt } from "./view.ts";

/**
 * The garden as a toy tabletop diorama: a wooden tray of grass squares with hedges, a pond, seeds, lanterns, flower
 * beds and the flag, and Tuck walking it. Same props as the flat board, which stands in while this loads and for good
 * if WebGL can't start or is lost (`onLost`). Predict puzzles use the flat board, so taps (`onCell`) aren't handled
 * here, and the parent draws speech bubbles.
 *
 * Drawing: the fixed scenery is baked by `Static` into one mesh (rebuilt when the board changes); seeds, flowers and
 * lantern glass are one instanced mesh each, chalk one or two flat meshes, Tuck seven. About 20 draw calls at 9×9.
 */
export default function CodeBoard3D(props: BoardViewProps & { onLost?: () => void }) {
	const { w, h } = sizeOf(props.board);
	const bounds = useMemo(() => viewBounds(w, h), [w, h]);
	return (
		<div
			role="img"
			aria-label={props.label}
			className="relative h-full w-full"
			style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}
		>
			<WhenLost onLost={props.onLost}>
				<GardenCanvas {...props} />
			</WhenLost>
		</div>
	);
}

/** If the canvas can't start, or loses its context for good, tell the parent (it swaps in the flat board). */
class WhenLost extends Component<{ onLost?: () => void; children: ReactNode }, { lost: boolean }> {
	override state = { lost: false };
	static getDerivedStateFromError() {
		return { lost: true };
	}
	override componentDidCatch() {
		this.props.onLost?.();
	}
	override render() {
		return this.state.lost ? null : this.props.children;
	}
}

type Live = RefObject<BoardViewProps>;

function GardenCanvas(props: BoardViewProps) {
	const onCreated = useContextLoss();
	const software = useMemo(softwareGl, []);
	const { w, h } = sizeOf(props.board);
	const area = useMemo(() => ({ w, d: h }), [w, h]);
	// The frame loop reads the newest props through this, so nothing in the scene rebuilds as a run plays.
	const live = useRef(props);
	live.current = props;
	return (
		<Canvas
			orthographic
			flat
			shadows={software ? false : "percentage"}
			frameloop="demand"
			onCreated={onCreated}
			dpr={software ? 1 : [1, 2]}
			camera={{ position: CAMERA_OFFSET.toArray(), near: 0.1, far: 100, zoom: 40 }}
			gl={{ alpha: true, antialias: true }}
			aria-hidden
		>
			<Pace>
				<Fit w={w} h={h} />
				<Kick garden={props.garden} playing={props.playing} />
				{import.meta.env.DEV && <Diagnostics />}
				<TownLights area={area} />
				<Scenery board={props.board} />
				<group userData={{ noCast: true }}>
					<Seeds board={props.board} live={live} />
					<Lanterns board={props.board} live={live} />
					<Flowers board={props.board} live={live} />
					<Chalk board={props.board} painted={props.garden.painted} />
					<Bumps live={live} />
					<Tuck live={live} />
				</group>
			</Pace>
		</Canvas>
	);
}

/** Whether WebGL runs without a graphics chip (then no sun shadow and no high-density drawing). Asked once. */
let software: boolean | undefined;
function softwareGl() {
	if (software !== undefined) return software;
	software = false;
	try {
		const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
		const info = gl?.getExtension("WEBGL_debug_renderer_info");
		const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
		software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
		gl?.getExtension("WEBGL_lose_context")?.loseContext();
	} catch {}
	return software;
}

/** Frames the whole board with a small margin, from the one fixed angle, whenever the box or the board size changes. */
function Fit({ w, h }: { w: number; h: number }) {
	const camera = useThree((s) => s.camera) as OrthographicCamera;
	const size = useThree((s) => s.size);
	const invalidate = useThree((s) => s.invalidate);
	useLayoutEffect(() => {
		const b = viewBounds(w, h);
		camera.position.copy(b.look).add(CAMERA_OFFSET.clone().normalize().multiplyScalar(40));
		camera.lookAt(b.look);
		camera.zoom = Math.min(size.width / (b.width * 1.06), size.height / (b.height * 1.06));
		camera.updateProjectionMatrix();
		invalidate();
	}, [camera, size.width, size.height, w, h, invalidate]);
	return null;
}

/** Draws a frame as soon as the garden or the playing event changes (the loop then keeps itself awake while playing). */
function Kick({ garden, playing }: Pick<BoardViewProps, "garden" | "playing">) {
	const invalidate = useThree((s) => s.invalidate);
	useEffect(() => {
		// A new garden or event is the reason to draw.
		void garden;
		void playing;
		invalidate();
	}, [garden, playing, invalidate]);
	return null;
}

const rowsKey = (b: Board) => b.rows.join("\n");

/** The board's fixed scenery, baked into one mesh. A new board (by its rows) bakes again. */
function Scenery({ board }: { board: Board }) {
	const key = rowsKey(board);
	const scenery = useMemo(() => <primitive object={buildScenery(key.split("\n"))} />, [key]);
	return <Static key={key}>{scenery}</Static>;
}

/** Squares holding `ch`, in reading order. */
function cellsOf(board: Board, ch: string): Cell[] {
	const out: Cell[] = [];
	board.rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push({ x, y });
	});
	return out;
}

const dummy = new Object3D();
const ease = (t: number) => 1 - (1 - t) ** 3;
/** Ease out with a little overshoot, for a flower popping up. */
const pop = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** One instanced mesh for every square holding `ch`, its geometry from `livePieceFor`, built once per board. */
function useInstances(
	board: Board,
	ch: string,
	material: () => MeshBasicMaterial | ReturnType<typeof bakedToon>,
	geometry?: BufferGeometry,
) {
	const key = rowsKey(board);
	const cells = useMemo(() => cellsOf({ rows: key.split("\n"), start: { x: 0, y: 0, dir: 0 } }, ch), [key, ch]);
	const mesh = useMemo(() => {
		if (!cells.length) return null;
		const m = new InstancedMesh(geometry ?? livePieceFor(ch)!, material(), cells.length);
		// Copies are spread over the board, beyond the shared shape's own bounds.
		m.frustumCulled = false;
		return m;
	}, [cells, ch, geometry, material]);
	useEffect(() => () => mesh?.dispose(), [mesh]);
	return { cells, mesh };
}

function place(mesh: InstancedMesh, i: number, x: number, y: number, z: number, s: number) {
	dummy.position.set(x, y, z);
	dummy.rotation.set(0, 0, 0);
	dummy.scale.setScalar(Math.max(s, 1e-4));
	dummy.updateMatrix();
	mesh.setMatrixAt(i, dummy.matrix);
}

/** Seeds on their mounds; a seed being picked shrinks into Tuck. */
function Seeds({ board, live }: { board: Board; live: Live }) {
	const { cells, mesh } = useInstances(board, "s", bakedToon);
	useFrame(() => {
		if (!mesh) return;
		const { garden, playing } = live.current;
		const tuck = tuckAt(garden, playing);
		cells.forEach((c, i) => {
			const k = cellKey(c);
			const picking = playing?.ev.t === "pick" && cellKey(playing.ev.at) === k ? ease(playing.t) : 0;
			const gone = garden.picked.includes(k);
			const x = c.x + 0.5 + (tuck.x - c.x) * picking;
			const z = c.y + 0.5 + (tuck.y - c.y) * picking;
			place(mesh, i, x, Math.sin(Math.PI * picking) * 0.25, z, gone ? 0 : 1 - picking);
		});
		mesh.instanceMatrix.needsUpdate = true;
	});
	return mesh ? <primitive object={mesh} /> : null;
}

// Shared and never disposed, like the toon materials.
const glassMat = new MeshBasicMaterial({ color: "#ffffff" });
const glowMat = new MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.35, depthWrite: false });
const glassMaterial = () => glassMat;
const haloMaterial = () => glowMat;
const GLASS = new Color(C.glass);
const GLOW = new Color(C.glow);
const mixed = new Color();

/** Lantern glass, pale until lit, then warm cream with a soft halo (no real lights: they'd cost a shader each). */
function Lanterns({ board, live }: { board: Board; live: Live }) {
	const { cells, mesh } = useInstances(board, "L", glassMaterial);
	const halo = useInstances(board, "L", haloMaterial, haloShape()).mesh;
	useFrame(() => {
		if (!mesh || !halo) return;
		const { garden, playing } = live.current;
		cells.forEach((c, i) => {
			const k = cellKey(c);
			const lighting = playing?.ev.t === "light" && cellKey(playing.ev.at) === k;
			const glow = garden.lit.includes(k) ? 1 : lighting ? ease(playing.t) : 0;
			place(mesh, i, c.x + 0.5, 0.54, c.y + 0.5, 1);
			mesh.setColorAt(i, mixed.copy(GLASS).lerp(GLOW, glow));
			place(halo, i, c.x + 0.5, 0.54, c.y + 0.5, glow);
		});
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		halo.instanceMatrix.needsUpdate = true;
	});
	if (!mesh || !halo) return null;
	return (
		<>
			<primitive object={mesh} />
			<primitive object={halo} userData={{ noShadow: true }} />
		</>
	);
}

let haloGeometry: BufferGeometry | undefined;
/** A low round glow round the glass. */
function haloShape() {
	haloGeometry ??= new SphereGeometry(0.26, 10, 8);
	return haloGeometry;
}

/** A flower in each planted bed; one being planted pops up. */
function Flowers({ board, live }: { board: Board; live: Live }) {
	const { cells, mesh } = useInstances(board, "b", bakedToon);
	useFrame(() => {
		if (!mesh) return;
		const { garden, playing } = live.current;
		cells.forEach((c, i) => {
			const k = cellKey(c);
			const planting = playing?.ev.t === "plant" && cellKey(playing.ev.at) === k;
			const s = garden.planted.includes(k) ? 1 : planting ? pop(playing.t) : 0;
			place(mesh, i, c.x + 0.5, 0.08, c.y + 0.5, s);
		});
		mesh.instanceMatrix.needsUpdate = true;
	});
	return mesh ? <primitive object={mesh} /> : null;
}

/** Chalk: dashed outlines still to draw over, and painted squares (brighter where they fill an outline). */
function Chalk({ board, painted }: { board: Board; painted: string[] }) {
	const key = rowsKey(board);
	const paintedKey = painted.join(" ");
	const shapes = useMemo(() => {
		const b: Board = { rows: key.split("\n"), start: { x: 0, y: 0, dir: 0 } };
		const done = new Set(paintedKey ? paintedKey.split(" ") : []);
		const cells = [...done].map((k) => {
			const [x, y] = k.split(",").map(Number);
			return { x: x!, y: y! };
		});
		return {
			outlines: chalkOutlines(cellsOf(b, "o").filter((c) => !done.has(cellKey(c)))),
			filled: chalkPatches(cells.filter((c) => at(b, c) === "o")),
			trail: chalkPatches(cells.filter((c) => at(b, c) !== "o")),
		};
	}, [key, paintedKey]);
	useEffect(
		() => () => {
			shapes.outlines?.dispose();
			shapes.filled?.dispose();
			shapes.trail?.dispose();
		},
		[shapes],
	);
	return (
		<group userData={{ noShadow: true }}>
			{shapes.outlines && <mesh geometry={shapes.outlines} material={chalk(0.9)} userData={{ noShadow: true }} />}
			{shapes.filled && <mesh geometry={shapes.filled} material={chalk(0.92)} userData={{ noShadow: true }} />}
			{shapes.trail && <mesh geometry={shapes.trail} material={chalk(0.6)} userData={{ noShadow: true }} />}
		</group>
	);
}

const chalks = new Map<number, MeshBasicMaterial>();
function chalk(opacity: number) {
	let m = chalks.get(opacity);
	if (!m) {
		m = new MeshBasicMaterial({
			color: C.chalk,
			transparent: true,
			opacity,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		chalks.set(opacity, m);
	}
	return m;
}

const ripple = new MeshBasicMaterial({ color: C.pondHi, transparent: true, opacity: 0.8, depthWrite: false });

/** A bump: the hedge shivers (a copy over the baked one), or a ring spreads on the pond. Not with reduced motion. */
function Bumps({ live }: { live: Live }) {
	const hedge = useRef<Mesh>(null);
	const ring = useRef<Mesh>(null);
	const reduced = useMemo(prefersReducedMotion, []);
	const ringShape = useMemo(() => new RingGeometry(0.1, 0.14, 24).rotateX(-Math.PI / 2), []);
	useEffect(() => () => ringShape.dispose(), [ringShape]);
	useFrame(() => {
		const playing = live.current.playing;
		const ev = playing?.ev.t === "bump" && !reduced ? playing.ev : null;
		const t = playing?.t ?? 0;
		const h = hedge.current;
		const r = ring.current;
		if (h) {
			h.visible = ev?.what === "hedge";
			if (ev && h.visible) {
				const k = Math.sin(t * Math.PI * 8) * (1 - t);
				h.position.set(ev.at.x + 0.5 + k * 0.04, 0, ev.at.y + 0.5);
				h.rotation.z = k * 0.06;
			}
		}
		if (r) {
			r.visible = ev?.what === "pond";
			if (ev && r.visible) {
				r.position.set(ev.at.x + 0.5, -0.045, ev.at.y + 0.5);
				r.scale.setScalar(1 + t * 2.4);
				ripple.opacity = 0.8 * (1 - t);
			}
		}
	});
	return (
		<>
			<mesh ref={hedge} geometry={hedgeShape()} material={bakedToon()} scale={1.03} visible={false} />
			<mesh ref={ring} geometry={ringShape} material={ripple} visible={false} userData={{ noShadow: true }} />
		</>
	);
}

const FOOT_KEYS = ["front-left", "front-right", "back-left", "back-right"];
const blobMaterial = new MeshBasicMaterial({ color: "#2b1d14", transparent: true, opacity: 0.2, depthWrite: false });

/**
 * Tuck, where `tuckAt` says. Between runs (a reset, a jump to the end) Tuck glides to the new square rather than
 * blinking there. Feet waddle on a move or a turn, a step bobs, and the pen slides down to draw. Reduced motion: no
 * bob, no waddle and no glide.
 */
function Tuck({ live }: { live: Live }) {
	const parts = useMemo(buildTuck, []);
	const root = useRef<Group>(null);
	const body = useRef<Group>(null);
	const pen = useRef<Mesh>(null);
	const blob = useRef<Mesh>(null);
	const feet = useRef<(Mesh | null)[]>([]);
	const shown = useRef<{ x: number; y: number; angle: number } | null>(null);
	const reduced = useMemo(prefersReducedMotion, []);
	const wake = useWake();
	useFrame((_, dt) => {
		const { garden, playing } = live.current;
		const want = tuckAt(garden, playing);
		let s = shown.current;
		if (!s || playing || reduced) s = { x: want.x, y: want.y, angle: want.angle };
		else {
			const k = 1 - Math.exp(-dt * 10);
			const turn = ((((want.angle - s.angle) % 360) + 540) % 360) - 180;
			const far = Math.abs(want.x - s.x) + Math.abs(want.y - s.y) + Math.abs(turn) / 90;
			if (far < 0.002) s = { x: want.x, y: want.y, angle: want.angle };
			else {
				s = { x: s.x + (want.x - s.x) * k, y: s.y + (want.y - s.y) * k, angle: s.angle + turn * k };
				wake();
			}
		}
		shown.current = s;
		if (playing) wake();
		const hop = reduced ? 0 : want.hop;
		root.current?.position.set(s.x + 0.5, 0, s.y + 0.5);
		if (body.current) {
			body.current.position.y = hop * 0.07;
			body.current.rotation.y = headingY(s.angle);
		}
		blob.current?.scale.setScalar(1 - hop * 0.15);
		const walking = !reduced && playing && (playing.ev.t === "move" || playing.ev.t === "turn");
		const phase = walking ? playing.t * Math.PI * 4 : 0;
		feet.current.forEach((f, i) => {
			if (!f) return;
			const swing = walking ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) : 0;
			f.rotation.x = swing * 0.5;
			f.position.y = FEET[i]![1] + Math.max(0, swing) * 0.03;
		});
		if (pen.current) {
			const ev = playing?.ev.t === "pen" ? playing.ev : null;
			const from = garden.pen ? 1 : 0;
			const down = ev ? from + ((ev.down ? 1 : 0) - from) * ease(playing!.t) : from;
			pen.current.position.y = -down * PEN_DROP;
		}
	});
	return (
		<group ref={root}>
			<mesh ref={blob} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={blobMaterial} userData={{ noShadow: true }}>
				<circleGeometry args={[0.36, 24]} />
			</mesh>
			<group ref={body}>
				<mesh geometry={parts.shell} material={bakedToon()} />
				<mesh geometry={parts.head} material={bakedToon()} />
				<mesh ref={pen} geometry={parts.pen} material={bakedToon()} />
				{FEET.map((p, i) => (
					<mesh
						key={FOOT_KEYS[i]}
						ref={(m) => {
							feet.current[i] = m;
						}}
						geometry={parts.foot}
						material={bakedToon()}
						position={p}
					/>
				))}
			</group>
		</group>
	);
}
