import type { Look } from "@jade/core/roxy";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createContext, type ReactNode, type Ref, type RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, type Group, type Mesh, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { PetModel, RoxyModel } from "../three/RoxyModel.tsx";
import { type DriveInput, stepFree, toWorld } from "./drive.ts";
import { Pace, useContextLoss, useWake } from "./pace.tsx";
import { type Block, findPath, type Grid, makeGrid, nearestFree } from "./path.ts";

/**
 * What every place in Roxy's world shares: a slightly-raised corner camera (picture-book, not a flight simulator)
 * that a drag can turn a little in town, soft light, and Roxy and her pet walking round whatever is in the way.
 * An area is measured in grid squares, from (0, 0) at the back-left corner.
 */

export type Area = { w: number; d: number };
export type Spot = { x: number; z: number };

const CAMERA_OFFSET = new Vector3(8, 9, 10.5);

const centre = (area: Area) => new Vector3(area.w / 2, 0.6, area.d / 2);

/** How far a drag can turn the view either way, and how long it stays turned once let go. */
const ORBIT_MAX = Math.PI / 6;
const ORBIT_HOLD_MS = 3000;
/** How far the pointer moves before a press is a drag (turning the view) rather than a tap (walking there). */
const DRAG_PX = 6;

/** The view's turn: the corner camera's own angle plus however far a drag has turned it. */
type View = { turn: number; yaw: number; drag: { id: number; x: number; moved: boolean } | null; idleAt: number };

/**
 * The canvas for one place: camera, light and whatever the place puts in it. With `orbit`, dragging sideways turns
 * the view up to 30° either way (the home has no front walls, so it stays put); a drag never counts as a tap.
 */
export function WorldCanvas({ area, label, orbit = false, children }: { area: Area; label: string; orbit?: boolean; children: ReactNode }) {
	const focus = useRef(centre(area));
	const view = useRef<View>({ turn: 0, yaw, drag: null, idleAt: 0 });
	const dragged = useRef(false);
	const onCreated = useContextLoss();
	const end = (id: number) => {
		const v = view.current;
		if (v.drag?.id !== id) return;
		dragged.current = v.drag.moved;
		v.drag = null;
		v.idleAt = performance.now();
	};
	return (
		<div
			className="h-full w-full"
			style={orbit ? { touchAction: "none" } : undefined}
			// A drag that turned the view ends in a click; swallow it before the scene sees it as a tap on the ground.
			onClickCapture={(e) => {
				if (!dragged.current) return;
				dragged.current = false;
				e.stopPropagation();
			}}
			onPointerDown={(e) => {
				if (!orbit || view.current.drag) return;
				dragged.current = false;
				view.current.drag = { id: e.pointerId, x: e.clientX, moved: false };
			}}
			onPointerMove={(e) => {
				const d = view.current.drag;
				if (!d || d.id !== e.pointerId) return;
				const dx = e.clientX - d.x;
				if (!d.moved && Math.abs(dx) < DRAG_PX) return;
				if (!d.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
				d.moved = true;
				d.x = e.clientX;
				const v = view.current;
				v.turn = Math.max(-ORBIT_MAX, Math.min(ORBIT_MAX, v.turn - dx * 0.006));
				v.idleAt = performance.now();
			}}
			onPointerUp={(e) => end(e.pointerId)}
			onPointerCancel={(e) => end(e.pointerId)}
		>
			<Canvas
				orthographic
				flat
				frameloop="demand"
				onCreated={onCreated}
				dpr={[1, 2]}
				camera={{ position: centre(area).add(CAMERA_OFFSET).toArray(), near: 0.1, far: 200, zoom: 50 }}
				gl={{ alpha: true, antialias: true }}
				aria-label={label}
				role="img"
			>
				<Pace>
					<Focus.Provider value={focus}>
						<ViewContext.Provider value={view}>
							<CameraRig area={area} />
							<hemisphereLight args={["#fffaf0", "#d8cbb8", 2.1]} />
							<directionalLight position={[12, 16, 10]} intensity={1.2} />
							{children}
						</ViewContext.Provider>
					</Focus.Provider>
				</Pace>
			</Canvas>
		</div>
	);
}

const ViewContext = createContext<RefObject<View> | null>(null);

/** Where Roxy is, for a camera that follows her round places bigger than the screen. */
const Focus = createContext<{ current: Vector3 } | null>(null);

/** Places up to the home room's size fit on screen whole; bigger ones are framed at room size and follow Roxy. */
const ROOM_FRAME = { w: 10, d: 8 };
const fitsWhole = (area: Area) => area.w <= ROOM_FRAME.w + 0.5 && area.d <= ROOM_FRAME.d + 0.5;

/**
 * Keeps the camera on the area. A small area is framed whole; a bigger one at room size, gliding after Roxy and
 * stopping at the edges so the view never runs off the ground.
 */
function CameraRig({ area }: { area: Area }) {
	const { camera, size } = useThree();
	const focus = useContext(Focus);
	const whole = fitsWhole(area);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const look = useRef(centre(area));
	const view = useContext(ViewContext);
	const wake = useWake();
	useEffect(() => {
		const scale = whole ? Math.max(area.w / ROOM_FRAME.w, area.d / ROOM_FRAME.d) : 1.1;
		camera.zoom = Math.min(size.width / (13.6 * scale), size.height / (10.4 * scale));
		camera.updateProjectionMatrix();
		if (whole) {
			look.current = centre(area);
			camera.position.copy(look.current.clone().add(CAMERA_OFFSET));
			camera.lookAt(look.current);
		}
	}, [camera, size, area, whole]);
	useFrame((_, dt) => {
		const v = view?.current;
		// A turned view eases back to the corner once it's been left alone (snaps back with reduced motion).
		let turned = false;
		if (v && !v.drag && v.turn !== 0 && performance.now() - v.idleAt > ORBIT_HOLD_MS) {
			v.turn = reduced || Math.abs(v.turn) < 0.002 ? 0 : v.turn * (1 - Math.min(1, dt * 3));
		}
		if (v) {
			turned = v.yaw !== yaw + v.turn;
			v.yaw = yaw + v.turn;
		}
		offset.copy(CAMERA_OFFSET).applyAxisAngle(UP, v?.turn ?? 0);
		if (turned) wake();
		if (whole || !focus) {
			if (turned) {
				camera.position.copy(look.current).add(offset);
				camera.lookAt(look.current);
			}
			return;
		}
		// Keep the view's centre far enough in from the edges that the ground fills the screen.
		const mx = Math.min(area.w / 2, 3.5);
		const mz = Math.min(area.d / 2, 2.5);
		want.set(Math.min(area.w - mx, Math.max(mx, focus.current.x)), 0.6, Math.min(area.d - mz, Math.max(mz, focus.current.z)));
		if (look.current.distanceToSquared(want) > 1e-5) wake();
		look.current.lerp(want, reduced ? 1 : Math.min(1, dt * 3));
		camera.position.copy(look.current).add(offset);
		camera.lookAt(look.current);
	});
	return null;
}

const want = new Vector3();
const offset = new Vector3();
const UP = new Vector3(0, 1, 0);

/** A canvas texture drawn in code, repeated across a surface. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number]) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (ctx) draw(ctx);
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	t.wrapS = RepeatWrapping;
	t.wrapT = RepeatWrapping;
	t.repeat.set(...repeat);
	return t;
}

/** A hex colour mixed toward white, as a CSS colour. */
export const tint = (hexColour: string, amount: number) => {
	const n = Number.parseInt(hexColour.slice(1), 16);
	const mix = (c: number) => Math.round(c + (255 - c) * amount);
	return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
};

// ── Roxy and the pet ──

const yaw = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
/** The camera's right, along the floor: which way "left" and "right" are on screen. */
export const RIGHT = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

/** A soft round shadow on the ground under something, squashed with `s` for long things. */
export function Shadow({ r, s, ref }: { r: number; s?: [number, number, number]; ref?: Ref<Mesh> }) {
	return (
		<mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={s}>
			<circleGeometry args={[r, 24]} />
			<meshBasicMaterial color="#2b1d14" transparent opacity={0.18} />
		</mesh>
	);
}

/**
 * Roxy walks to `walkTo`, round anything in `blocks`, her pet trotting after. Both are the 3D toys: they turn to
 * face the way they're going and turn back to face you when they stop. `onArrive` fires once each time she gets
 * where she was going, so a place can hand her what she walked over to pick up. `blocks` should keep its identity
 * between renders (memoise it); the route grid is rebuilt when it changes.
 * `drive` walks her directly (the keys or the touch stick), sliding along whatever's in the way, and hops her;
 * `onMove` hears where she is a few times a second while she moves, for "Press E" when she's beside something.
 */
export function Walkers({
	look,
	walkTo,
	area,
	start,
	blocks = NO_BLOCKS,
	onArrive,
	drive,
	onMove,
}: {
	look: Look;
	walkTo: Spot | null;
	area: Area;
	start?: Spot;
	blocks?: readonly Block[];
	onArrive?: (spot: Spot) => void;
	drive?: RefObject<DriveInput>;
	onMove?: (spot: Spot) => void;
}) {
	const roxy = useRef<Group>(null);
	const roxyTurn = useRef<Group>(null);
	const petRef = useRef<Group>(null);
	const petTurn = useRef<Group>(null);
	const walking = useRef(0);
	const grid = useMemo(() => makeGrid(area, blocks), [area, blocks]);
	// Where they first stand. Set once: after that only the frame loop moves them, so a re-render mid-walk can't
	// put her back anywhere.
	const [first] = useState(() => {
		const s = nearestFree(grid, start ?? { x: area.w / 2 + 0.5, z: area.d / 2 + 1.5 });
		const pet = petSpot(grid, new Vector3(s.x, 0, s.z), new Vector3());
		return { roxy: [s.x, 0, s.z] as V3, pet: pet.toArray() as V3 };
	});
	/** The waypoints still ahead; she heads for the first. */
	const route = useRef<Vector3[]>([]);
	const arriving = useRef<Spot | null>(null);
	const arrive = useRef(onArrive);
	arrive.current = onArrive;
	const moved = useRef(onMove);
	moved.current = onMove;
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const focus = useContext(Focus);
	const view = useContext(ViewContext);
	const wake = useWake();
	const shadow = useRef<Mesh>(null);
	/** How far into a hop she is (s), or -1 on the ground; and whether Hop was already held (one hop per press). */
	const hop = useRef({ t: -1, held: false });
	const told = useRef({ at: 0, x: Number.NaN, z: Number.NaN });

	useEffect(() => {
		const r = roxy.current;
		if (!walkTo || !r) return;
		const path = findPath(grid, { x: r.position.x, z: r.position.z }, walkTo);
		route.current = path.map((p) => new Vector3(p.x, 0, p.z));
		arriving.current = walkTo;
		const last = route.current.at(-1);
		if (reduced && last) r.position.copy(last);
	}, [walkTo, reduced, grid]);

	// Furniture moved under her (the home): step off it.
	useEffect(() => {
		const r = roxy.current;
		if (!r || route.current.length) return;
		const s = nearestFree(grid, { x: r.position.x, z: r.position.z });
		if (s.x !== r.position.x || s.z !== r.position.z) route.current = [new Vector3(s.x, 0, s.z)];
	}, [grid]);

	/** Turn smoothly toward an angle (the short way round). */
	const turnTo = (g: Group | null, angle: number, dt: number) => {
		if (!g) return;
		let diff = angle - g.rotation.y;
		diff = Math.atan2(Math.sin(diff), Math.cos(diff));
		if (Math.abs(diff) > 0.01) wake();
		g.rotation.y += diff * Math.min(1, dt * 8);
	};

	useFrame((state, dt) => {
		const r = roxy.current;
		const p = petRef.current;
		if (!r || !p) return;
		const step = Math.min(dt, 0.05);
		const t = state.clock.elapsedTime;
		const facing = view?.current.yaw ?? yaw;
		const d = drive?.current;
		// Walked directly: the keys or the stick take over from any walk to a tapped spot.
		let driven = false;
		if (d && (d.x !== 0 || d.y !== 0)) {
			route.current = [];
			arriving.current = null;
			const dir = toWorld(d, facing);
			const speed = 2.6 * step;
			const to = stepFree(grid, { x: r.position.x, z: r.position.z }, { x: dir.x * speed, z: dir.z * speed });
			driven = to.x !== r.position.x || to.z !== r.position.z;
			r.position.set(to.x, 0, to.z);
			turnTo(roxyTurn.current, Math.atan2(dir.x, dir.z), step);
			wake();
		}
		// One hop per press of Space or Hop: a short arc up and down (none with reduced motion).
		const h = hop.current;
		if (d?.hop && !h.held && h.t < 0 && !reduced) h.t = 0;
		h.held = !!d?.hop;
		let lift = 0;
		if (h.t >= 0) {
			h.t += step;
			lift = h.t >= HOP_S ? 0 : Math.sin((Math.PI * h.t) / HOP_S) * HOP_H;
			if (h.t >= HOP_S) h.t = -1;
			wake();
		}
		if (shadow.current) shadow.current.scale.setScalar(1 - lift);
		let next = route.current[0];
		// Close enough to a waypoint on the way: on to the next, without stopping.
		while (next && route.current.length > 1 && r.position.distanceTo(next) < 0.08) {
			route.current.shift();
			next = route.current[0];
		}
		const dist = next ? toTarget.subVectors(next, r.position).length() : 0;
		const routed = dist > 0.05 && !reduced;
		const moving = routed || (driven && !reduced);
		walking.current += ((moving ? 1 : 0) - walking.current) * Math.min(1, step * 10);
		if (moving || walking.current > 0.01 || arriving.current) wake();
		if (routed) {
			r.position.addScaledVector(toTarget, Math.min(dist, 2.6 * step) / dist);
			turnTo(roxyTurn.current, Math.atan2(toTarget.x, toTarget.z), step);
		} else if (!driven) {
			if (next) r.position.copy(next);
			route.current = [];
			turnTo(roxyTurn.current, facing, step);
			if (arriving.current) {
				const spot = arriving.current;
				arriving.current = null;
				arrive.current?.(spot);
			}
		}
		focus?.current.copy(r.position);
		if (roxyTurn.current) roxyTurn.current.position.y = lift || (moving ? Math.abs(Math.sin(t * 9)) * 0.04 : 0);
		// Tell the place where she is, a few times a second while she's moving.
		const k = told.current;
		const now = state.clock.elapsedTime;
		if (moved.current && now - k.at > 0.1 && (k.x !== r.position.x || k.z !== r.position.z)) {
			k.at = now;
			k.x = r.position.x;
			k.z = r.position.z;
			moved.current({ x: k.x, z: k.z });
		}
		// The pet trots to a clear spot beside Roxy, a little behind.
		const spot = petSpot(grid, r.position, petWant);
		const toSpot = spot.sub(p.position);
		const petDist = toSpot.length();
		const petMoving = petDist > 0.08 && !reduced;
		if (petMoving) wake();
		if (petMoving) {
			p.position.addScaledVector(toSpot, Math.min(petDist, 2.4 * step) / petDist);
			turnTo(petTurn.current, Math.atan2(toSpot.x, toSpot.z), step);
		} else {
			if (reduced) p.position.add(toSpot);
			turnTo(petTurn.current, facing, step);
		}
		if (petTurn.current) petTurn.current.position.y = petMoving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
	});

	return (
		<>
			<group ref={roxy} position={first.roxy}>
				<Shadow r={0.45} ref={shadow} />
				<group ref={roxyTurn} rotation={[0, yaw, 0]}>
					<RoxyModel look={look} walking={walking} />
				</group>
			</group>
			<group ref={petRef} position={first.pet}>
				{look.slots.pet && (
					<>
						<Shadow r={0.32} />
						<group ref={petTurn} rotation={[0, yaw, 0]}>
							<PetModel look={look} />
						</group>
					</>
				)}
			</group>
		</>
	);
}

type V3 = [number, number, number];
/** A hop: how long it takes (s) and how high it goes. */
const HOP_S = 0.4;
const HOP_H = 0.45;
const NO_BLOCKS: readonly Block[] = [];
// Scratch vectors for the frame loop, so walking doesn't allocate every frame.
const toTarget = new Vector3();
const petWant = new Vector3();
const PET_SIDE = RIGHT.clone()
	.multiplyScalar(1.1)
	.add(new Vector3(0, 0, -0.25));

/** Where the pet wants to be: beside Roxy, or the nearest clear spot to that (never in a wall or a bed). */
function petSpot(grid: Grid, at: Vector3, out: Vector3) {
	out.copy(at).add(PET_SIDE);
	const s = nearestFree(grid, { x: out.x, z: out.z });
	return out.set(s.x, 0, s.z);
}
