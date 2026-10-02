import { type Look, PLACE_INFO, type PlaceId } from "@jade/core/roxy";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, DoubleSide, type Group, type InstancedMesh, Matrix4, Object3D } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import type { DriveInput } from "./drive.ts";
import { B, Ball, Cyl, GOLD, LEAF, LEAF_DARK, LEAF_LIGHT, lighter, POT, Toon, toonGradient, WHITE, WOOD, WOOD_DARK } from "./Furniture.tsx";
import { Model } from "./Model.tsx";
import type { Target } from "./near.ts";
import { useWake } from "./pace.tsx";
import type { Block } from "./path.ts";
import { type Area, canvasTexture, Shadow, type Spot, Walkers, WorldCanvas } from "./stage.tsx";

/**
 * The places in Roxy's town. Each is built from the same soft toy shapes as the furniture, and hides five finds
 * that are drawn small and tucked under or behind things. Hotspots are things to tap that do something (the
 * school's chalkboard, the pet shop's adoption sign).
 */

type V3 = [number, number, number];
type FindSpot = { at: V3; node: ReactNode };
export type Hotspot = "chalkboard" | "adopt";
type Place = {
	ground: (area: Area) => ReturnType<typeof canvasTexture>;
	walls?: { colour: string };
	props: ReactNode;
	finds: Record<string, FindSpot>;
	hotspots?: { id: Hotspot; at: V3; node: ReactNode }[];
	start: Spot;
	/** What Roxy walks round: footprints of the props, matching where they're drawn. */
	blocks: Block[];
};

// ── Small shapes ──

const codeTree = (x: number, z: number, s = 1) => (
	<group key={`t${x}${z}`} position={[x, 0, z]} scale={s}>
		<Cyl r={0.16} r2={0.22} h={1.4} p={[0, 0.7, 0]} c={WOOD_DARK} seg={10} />
		{/* A canopy of overlapping balls: shady greens behind and below, sunny ones on top toward the light. */}
		<Ball r={0.62} p={[-0.45, 2.05, -0.25]} c={LEAF_DARK} />
		<Ball r={0.88} p={[0, 1.95, 0]} c={LEAF} />
		<Ball r={0.6} p={[0.5, 1.75, 0.35]} c={LEAF} />
		<Ball r={0.58} p={[0.3, 2.5, 0.15]} c={LEAF_LIGHT} />
		<Ball r={0.4} p={[-0.2, 2.65, 0.3]} c={LEAF_LIGHT} />
	</group>
);
const bush = (x: number, z: number) => (
	<group key={`b${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.6} />
		<Ball r={0.45} p={[0, 0.35, 0]} c={LEAF_DARK} s={[1.3, 0.8, 1]} />
		<Ball r={0.3} p={[0.3, 0.45, 0.15]} c={LEAF} />
		<Ball r={0.22} p={[-0.15, 0.55, 0.2]} c={LEAF_LIGHT} />
	</group>
);
// Generated models of the same things, the same size and on the same footprints; the code-built ones show until
// they load. Tripo faces a model down its x axis, so the bench and slide turn a quarter to put their backs to -z.
const tree = (x: number, z: number, s = 1) => (
	<group key={`t${x}${z}`}>
		<group position={[x, 0, z]}>
			<Shadow r={s} />
		</group>
		<Model id="park-tree" height={3.05 * s} at={[x, 0, z]} fallback={codeTree(x, z, s)} />
	</group>
);
const bench = (x: number, z: number) => (
	<group key={`be${x}${z}`}>
		<group position={[x, 0, z]}>
			<Shadow r={0.8} s={[1, 0.55, 1]} />
		</group>
		<Model id="park-bench" height={1.2} at={[x, 0, z]} rot={-Math.PI / 2} fallback={codeBench(x, z)} />
	</group>
);
const flowers = (x: number, z: number, c: string) => (
	<group key={`f${x}${z}`} position={[x, 0, z]}>
		{[
			[0, 0],
			[0.25, 0.15],
			[-0.2, 0.2],
		].map(([dx, dz]) => (
			<group key={`${dx}${dz}`}>
				<Cyl r={0.02} h={0.3} p={[dx!, 0.15, dz!]} c={LEAF} seg={6} />
				<Ball r={0.08} p={[dx!, 0.32, dz!]} c={c} />
			</group>
		))}
	</group>
);
const codeBench = (x: number, z: number, rot = 0) => (
	<group key={`be${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<B s={[1.6, 0.1, 0.5]} p={[0, 0.45, 0]} c={WOOD} />
		<B s={[1.6, 0.4, 0.08]} p={[0, 0.75, -0.22]} c={WOOD} />
		{[-0.65, 0.65].map((dx) => (
			<B key={dx} s={[0.08, 0.45, 0.45]} p={[dx, 0.22, 0]} c="#6b7a93" />
		))}
	</group>
);
const codeDesk = (x: number, z: number) => (
	<group key={`d${x}${z}`} position={[x, 0, z]}>
		<B s={[1.2, 0.07, 0.7]} p={[0, 0.7, 0]} c={WOOD} />
		{[-0.5, 0.5].map((dx) => (
			<B key={dx} s={[0.07, 0.68, 0.6]} p={[dx, 0.34, 0]} c="#6b7a93" />
		))}
		<B s={[0.5, 0.06, 0.5]} p={[0, 0.42, 0.65]} c="#3cb6c9" />
		<B s={[0.5, 0.45, 0.06]} p={[0, 0.65, 0.9]} c="#3cb6c9" />
	</group>
);
// The generated desk has its chair at -z, so it turns round to face the chalkboard; sized so its top is at 0.74,
// where the books and pencil pots sit, and set back so the top is centred on z.
const desk = (x: number, z: number) => (
	<group key={`d${x}${z}`}>
		<group position={[x, 0, z + 0.2]}>
			<Shadow r={0.6} s={[1, 0.9, 1]} />
		</group>
		<Model id="school-desk" height={0.83} at={[x, 0, z + 0.2]} rot={Math.PI} fallback={codeDesk(x, z)} />
	</group>
);
const shelf = (x: number, z: number, w: number, items: ReactNode, rot = 0) => (
	<group key={`s${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<Shadow r={w / 2 + 0.1} s={[1, 0.35, 1]} />
		<B s={[w, 1.6, 0.45]} p={[0, 0.8, 0]} c={WOOD} />
		{[0.55, 1.15].map((y) => (
			<B key={y} s={[w - 0.1, 0.05, 0.4]} p={[0, y, 0.03]} c={lighter(WOOD)} />
		))}
		{items}
	</group>
);
const books = (w: number, y: number) =>
	Array.from({ length: Math.floor(w / 0.22) }, (_, i) => (
		<B
			key={`${y}${i}`}
			s={[0.16, 0.36 - (i % 3) * 0.05, 0.3]}
			p={[-w / 2 + 0.2 + i * 0.22, y + 0.2, 0.05]}
			c={["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b", "#8a5bd1"][i % 5]!}
		/>
	));
const cage = (x: number, z: number, critter: ReactNode) => (
	<group key={`c${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.75} s={[1, 0.7, 1]} />
		<B s={[1.1, 0.7, 0.8]} p={[0, 0.85, 0]} c="#bfe3f0" o={0.35} />
		<B s={[1.2, 0.5, 0.9]} p={[0, 0.25, 0]} c={WOOD} />
		{critter}
	</group>
);

/** Gingham for the picnic blanket. */
const picnicCloth = canvasTexture(
	64,
	64,
	(ctx) => {
		ctx.fillStyle = "#fbeff0";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "rgba(232,93,117,0.55)";
		for (let i = 0; i < 4; i++) {
			ctx.fillRect(i * 16, 0, 8, 64);
			ctx.fillRect(0, i * 16, 64, 8);
		}
	},
	[2, 1.5],
);

/** A white picket fence along the back and left edges: all the pickets are one instanced mesh. */
function Fence({ area }: { area: Area }) {
	const ref = useRef<InstancedMesh>(null);
	const spots = useMemo(() => {
		const out: V3[] = [];
		for (let x = 0.25; x < area.w; x += 0.45) out.push([x, 0.3, 0.12]);
		for (let z = 0.6; z < area.d; z += 0.45) out.push([0.12, 0.3, z]);
		return out;
	}, [area]);
	useLayoutEffect(() => {
		const m = new Matrix4();
		for (const [i, p] of spots.entries()) ref.current?.setMatrixAt(i, m.makeTranslation(...p));
		if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
	}, [spots]);
	return (
		<>
			<instancedMesh ref={ref} args={[undefined, undefined, spots.length]}>
				<boxGeometry args={[0.12, 0.6, 0.06]} />
				<Toon color={WHITE} />
			</instancedMesh>
			<B s={[area.w, 0.07, 0.05]} p={[area.w / 2, 0.42, 0.15]} c={WHITE} />
			<B s={[0.05, 0.07, area.d]} p={[0.15, 0.42, area.d / 2]} c={WHITE} />
		</>
	);
}

/** A butterfly drifting in a lazy loop, wings flapping. Still when motion is reduced. */
function Butterfly({ at, c, phase = 0 }: { at: V3; c: string; phase?: number }) {
	const body = useRef<Group>(null);
	const left = useRef<Group>(null);
	const right = useRef<Group>(null);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame(({ clock }) => {
		if (reduced || !body.current) return;
		wake("ambient");
		const t = clock.elapsedTime * 0.6 + phase;
		body.current.position.set(at[0] + Math.sin(t) * 0.9, at[1] + Math.sin(t * 2.3) * 0.2, at[2] + Math.cos(t) * 0.6);
		body.current.rotation.y = Math.atan2(Math.cos(t) * 0.9, -Math.sin(t) * 0.6);
		const flap = Math.sin(clock.elapsedTime * 14 + phase) * 0.9;
		left.current?.rotation.set(0, 0, flap);
		right.current?.rotation.set(0, 0, -flap);
	});
	return (
		<group ref={body} position={at}>
			{[left, right].map((ref, i) => (
				<group key={i} ref={ref}>
					<mesh position={[i ? -0.09 : 0.09, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
						<circleGeometry args={[0.09, 10]} />
						<meshToonMaterial color={c} side={DoubleSide} gradientMap={toonGradient()} />
					</mesh>
				</group>
			))}
		</group>
	);
}

/** A leafy plant in a pot: long leaves fanned out from the middle. */
const pottedPlant = (x: number, z: number, s = 1) => (
	<group key={`pl${x}${z}`} position={[x, 0, z]} scale={s}>
		<Shadow r={0.4} />
		<Cyl r={0.26} r2={0.2} h={0.45} p={[0, 0.23, 0]} c={POT} />
		{[0, 1.25, 2.5, 3.75, 5].map((a, i) => (
			<Ball
				key={a}
				r={0.13}
				p={[Math.sin(a) * 0.16, 0.85 + (i % 2) * 0.15, Math.cos(a) * 0.16]}
				s={[1, 3.2, 0.5]}
				c={i % 2 ? LEAF_LIGHT : LEAF}
			/>
		))}
	</group>
);

/** A child's painting pinned to the left wall: a sun, a hill and a flower or two, drawn once and shared. */
const painting = (draw: (ctx: CanvasRenderingContext2D) => void) =>
	canvasTexture(
		48,
		64,
		(ctx) => {
			ctx.fillStyle = "#fffdf6";
			ctx.fillRect(0, 0, 48, 64);
			draw(ctx);
		},
		[1, 1],
	);
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
	ctx.fillStyle = c;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
};
const PAINTINGS = [
	painting((ctx) => {
		dot(ctx, 36, 12, 7, "#f2c94c");
		dot(ctx, 16, 60, 26, "#7dbf52");
		dot(ctx, 22, 30, 5, "#e85d75");
	}),
	painting((ctx) => {
		dot(ctx, 24, 18, 8, "#d9a066");
		ctx.fillStyle = "#3d74c9";
		ctx.fillRect(16, 27, 16, 22);
		dot(ctx, 10, 56, 4, "#8a5bd1");
		dot(ctx, 38, 56, 4, "#8a5bd1");
	}),
	painting((ctx) => {
		dot(ctx, 24, 30, 14, "#8ec5f2");
		dot(ctx, 20, 26, 3, "#2b2b33");
		dot(ctx, 30, 26, 3, "#2b2b33");
		dot(ctx, 10, 10, 6, "#f2c94c");
	}),
];

/** Triangle flags in rainbow order along the back wall: one instanced mesh, coloured per flag. */
const BUNTING = ["#e85d75", "#f08a3c", "#f2c94c", "#7dbf52", "#3d74c9", "#8a5bd1"];
function Bunting({ x0, x1, y }: { x0: number; x1: number; y: number }) {
	const ref = useRef<InstancedMesh>(null);
	const count = Math.floor((x1 - x0) / 0.42) + 1;
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const t = new Object3D();
		const c = new Color();
		for (let i = 0; i < count; i++) {
			t.position.set(x0 + i * 0.42, y - 0.17, 0.08);
			t.rotation.set(Math.PI, 0, 0);
			t.scale.set(1, 1, 0.15);
			t.updateMatrix();
			m.setMatrixAt(i, t.matrix);
			m.setColorAt(i, c.set(BUNTING[i % BUNTING.length]!));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [count, x0, y]);
	return (
		<>
			<B s={[x1 - x0 + 0.3, 0.025, 0.025]} p={[(x0 + x1) / 2, y, 0.08]} c="#6b5a4a" />
			<instancedMesh ref={ref} args={[undefined, undefined, count]}>
				<coneGeometry args={[0.16, 0.34, 3]} />
				<Toon color="#ffffff" />
			</instancedMesh>
		</>
	);
}

/** Bubbles rising through a fish tank, round and round. Still when motion is reduced. */
function Bubbles({ at, h }: { at: V3; h: number }) {
	const g = useRef<Group>(null);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame(({ clock }) => {
		if (reduced || !g.current) return;
		wake("ambient");
		g.current.children.forEach((b, i) => {
			const t = (clock.elapsedTime * 0.35 + i / 4) % 1;
			b.position.y = t * h;
			b.position.x = Math.sin(t * 9 + i) * 0.04;
			b.scale.setScalar(0.6 + t * 0.6);
		});
	});
	return (
		<group ref={g} position={at}>
			{[0, 1, 2, 3].map((i) => (
				<mesh key={i} position={[0, (i / 4) * h, (i % 2) * 0.3 - 0.15]}>
					<sphereGeometry args={[0.04, 8, 6]} />
					<meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
				</mesh>
			))}
		</group>
	);
}

/** A sleepy puppy curled on a cushion. */
const puppy = (x: number, z: number, rot: number, coat: string, ear: string) => (
	<group key={`pup${x}${z}`} position={[x, 0.16, z]} rotation={[0, rot, 0]}>
		<Ball r={0.2} p={[0, 0.1, 0]} c={coat} s={[1.4, 0.75, 1]} />
		<Ball r={0.13} p={[0.26, 0.17, 0.04]} c={coat} />
		<Ball r={0.06} p={[0.25, 0.17, 0.16]} c={ear} s={[0.7, 1.6, 0.6]} />
		<Ball r={0.035} p={[0.38, 0.15, 0.06]} c="#2b2b33" />
	</group>
);

/**
 * A find being picked up: it floats up over Roxy's head (she's standing in front of it), spins, and pops in a shower
 * of sparkles, so a find feels like a prize.
 * With reduced motion there's no show; the message under the scene says what was found.
 */
/** Above Roxy's head, so she doesn't hide it. */
const POP_HEIGHT = 2.7;
const SPARKLE_COLOURS = [GOLD, "#fff6cf", "#f6b6c8", "#9fd8f0"];
function FindBurst({ at, node, onDone }: { at: V3; node: ReactNode; onDone: () => void }) {
	const item = useRef<Group>(null);
	const sparks = useRef<Group>(null);
	const start = useRef<number | null>(null);
	const done = useRef(onDone);
	done.current = onDone;
	const dirs = useMemo(
		() =>
			Array.from({ length: 12 }, (_, i) => {
				const a = (i / 12) * Math.PI * 2;
				return { x: Math.cos(a) * (1.1 + (i % 3) * 0.3), y: 2.4 + (i % 4) * 0.5, z: Math.sin(a) * (1.1 + (i % 2) * 0.4) };
			}),
		[],
	);
	const wake = useWake();
	useFrame(({ clock }) => {
		wake();
		start.current ??= clock.elapsedTime;
		const t = clock.elapsedTime - start.current;
		if (t > 1.6) {
			done.current();
			return;
		}
		if (item.current) {
			const k = Math.min(1, t / 0.55);
			item.current.position.y = Math.sin(k * Math.PI * 0.5) * (POP_HEIGHT - at[1]);
			item.current.rotation.y = t * 7;
			item.current.scale.setScalar(t < 0.85 ? 1 + k * 1.6 : Math.max(0, 2.6 * (1 - (t - 0.85) / 0.2)));
		}
		sparks.current?.children.forEach((c, i) => {
			const d = dirs[i]!;
			const st = Math.max(0, t - 0.85);
			c.visible = t > 0.85;
			c.position.set(d.x * st, POP_HEIGHT - at[1] + d.y * st - 4.5 * st * st, d.z * st);
			c.scale.setScalar(Math.max(0, 1 - st / 0.7));
			c.rotation.y = st * 8;
		});
	});
	return (
		<group position={at}>
			<group ref={item}>{node}</group>
			<group ref={sparks}>
				{dirs.map((_, i) => (
					<mesh key={i} visible={false}>
						<octahedronGeometry args={[0.16]} />
						<meshBasicMaterial color={SPARKLE_COLOURS[i % SPARKLE_COLOURS.length]} />
					</mesh>
				))}
			</group>
		</group>
	);
}

// ── The places ──

const grass = (area: Area) =>
	canvasTexture(
		256,
		256,
		(ctx) => {
			ctx.fillStyle = "#9fd27a";
			ctx.fillRect(0, 0, 256, 256);
			ctx.fillStyle = "rgba(60,120,40,0.18)";
			for (let i = 0; i < 220; i++) ctx.fillRect((i * 67) % 256, (i * 139) % 256, 3, 6);
		},
		[area.w / 3, area.d / 3],
	);
const tiles = (a: string, b: string) => (area: Area) =>
	canvasTexture(
		128,
		128,
		(ctx) => {
			for (let y = 0; y < 2; y++)
				for (let x = 0; x < 2; x++) {
					ctx.fillStyle = (x + y) % 2 ? a : b;
					ctx.fillRect(x * 64, y * 64, 64, 64);
				}
		},
		[area.w / 2, area.d / 2],
	);

const PLACES: Record<PlaceId, Place> = {
	park: {
		ground: grass,
		// On the path, clear of the slide.
		start: { x: 6, z: 5.2 },
		blocks: [
			...[
				[2, 2, 1],
				[6, 1.4, 0.9],
				[12.5, 1.5, 1.1],
				[1.4, 8.4, 0.8],
			].map(([cx, cz, s]) => ({ cx: cx!, cz: cz!, r: 0.25 * s! })),
			...[
				[3.6, 2.6],
				[9, 1.2],
				[4.5, 8.8],
			].map(([cx, cz]) => ({ cx: cx!, cz: cz!, r: 0.5 })),
			{ x0: 8.25, z0: 3.35, x1: 9.75, z1: 4.25 },
			{ cx: 11, cz: 7.6, r: 2 },
			{ cx: 10.4, cz: 4.1, r: 0.12 },
			{ x0: 6.1, z0: 7.4, x1: 6.9, z1: 9.4 },
		],
		props: (
			<>
				{/* A path across, and the pond. */}
				<B s={[14, 0.02, 1.4]} p={[7, 0.01, 5.2]} c="#e8d9b0" />
				<Cyl r={2} h={0.05} p={[11, 0.02, 7.6]} c="#5fa3e0" seg={40} />
				<Cyl r={2.2} h={0.04} p={[11, 0.01, 7.6]} c="#c9b28c" seg={40} />
				{tree(2, 2)}
				{tree(6, 1.4, 0.9)}
				{tree(12.5, 1.5, 1.1)}
				{tree(1.4, 8.4, 0.8)}
				{bush(3.6, 2.6)}
				{bush(9, 1.2)}
				{bush(4.5, 8.8)}
				{bench(9, 3.8)}
				{/* On the pond: lily pads, a ripple, and a duck. */}
				{[
					[10, 8.3, 0.32],
					[12, 8.5, 0.26],
					[10.5, 6.6, 0.22],
				].map(([x, z, r]) => (
					<Cyl key={`${x}${z}`} r={r!} h={0.02} p={[x!, 0.06, z!]} c={LEAF} seg={16} />
				))}
				<mesh position={[11.7, 0.055, 7.2]} rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[0.42, 0.5, 28]} />
					<meshBasicMaterial color="#d6ecfa" transparent opacity={0.7} />
				</mesh>
				<group position={[11.7, 0.05, 7.2]} rotation={[0, -0.6, 0]}>
					<Ball r={0.22} p={[0, 0.12, 0]} c={WHITE} s={[1.3, 0.8, 1]} />
					<Ball r={0.12} p={[0.22, 0.3, 0]} c={WHITE} />
					<Cyl r={0.02} r2={0.05} h={0.1} p={[0.35, 0.29, 0]} rot={[0, 0, Math.PI / 2]} c="#f08a3c" seg={8} />
				</group>
				{/* A picnic: a checked blanket and a basket. */}
				<group position={[3, 0, 6.3]} rotation={[0, 0.2, 0]}>
					<mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[1.5, 1.1]} />
						<meshToonMaterial map={picnicCloth} />
					</mesh>
					<B s={[0.4, 0.26, 0.28]} p={[0.35, 0.14, -0.2]} c={WOOD} />
					<mesh position={[0.35, 0.3, -0.2]} rotation={[0, 0, 0]}>
						<torusGeometry args={[0.14, 0.02, 6, 16, Math.PI]} />
						<Toon color={WOOD_DARK} />
					</mesh>
				</group>
				{/* A lamp post by the bench. */}
				<group position={[10.4, 0, 4.1]}>
					<Shadow r={0.3} />
					<Cyl r={0.05} h={1.9} p={[0, 0.95, 0]} c="#3f4a5c" seg={8} />
					<Ball r={0.17} p={[0, 2, 0]} c="#fff2b8" e={0.6} />
					<Cyl r={0.2} r2={0.05} h={0.12} p={[0, 2.17, 0]} c="#3f4a5c" seg={8} />
				</group>
				<Fence area={PLACE_INFO.park.area} />
				<Butterfly at={[4.4, 1, 7.2]} c="#f2a7c3" />
				<Butterfly at={[9.6, 1.3, 2.4]} c="#8ec5f2" phase={1.7} />
				{flowers(3.8, 7.6, "#e85d75")}
				{flowers(7.5, 8.6, "#f2c94c")}
				{flowers(13, 4.2, "#8a5bd1")}
				{/* The slide, its ladder at the back and the chute running toward the front. */}
				<group position={[6.5, 0, 8.4]}>
					<Shadow r={1} s={[0.6, 1.1, 1]} />
				</group>
				<Model
					id="park-slide"
					height={1.55}
					at={[6.5, 0, 8.4]}
					rot={-Math.PI / 2}
					fallback={
						<group position={[6.5, 0, 8]}>
							<B s={[0.1, 1.6, 0.1]} p={[-0.4, 0.8, -0.3]} c="#e85d75" />
							<B s={[0.1, 1.6, 0.1]} p={[0.4, 0.8, -0.3]} c="#e85d75" />
							<B s={[0.9, 0.08, 0.6]} p={[0, 1.6, -0.3]} c="#f2c94c" />
							<mesh position={[0, 0.85, 0.55]} rotation={[0.85, 0, 0]}>
								<boxGeometry args={[0.8, 0.06, 2]} />
								<Toon color="#3cb6c9" />
							</mesh>
						</group>
					}
				/>
			</>
		),
		finds: {
			"park-acorn": { at: [3.9, 0, 3.05], node: <Ball r={0.13} p={[0, 0.13, 0]} c={GOLD} s={[1, 1.2, 1]} e={0.3} /> },
			"park-shell": { at: [12.9, 0, 8.6], node: <Ball r={0.14} p={[0, 0.07, 0]} c="#f6b6c8" s={[1.2, 0.5, 1]} /> },
			"park-kite": {
				at: [12.2, 2.7, 2],
				node: (
					<mesh rotation={[0, 0.6, Math.PI / 4]}>
						<boxGeometry args={[0.5, 0.5, 0.03]} />
						<Toon color="#e85d75" />
					</mesh>
				),
			},
			"park-ladybug": { at: [7.7, 0.34, 8.75], node: <Ball r={0.08} p={[0, 0, 0]} c="#d8413c" s={[1, 0.6, 1.2]} /> },
			"park-feather": { at: [9.6, 0.5, 3.9], node: <B s={[0.08, 0.03, 0.4]} p={[0, 0, 0]} c="#3d74c9" /> },
		},
	},
	petshop: {
		ground: tiles("#f6f1e7", "#bfe3f0"),
		walls: { colour: "#f6d7a8" },
		start: { x: 5, z: 6 },
		blocks: [
			{ x0: 0.5, z0: 0, x1: 3.5, z1: 0.65 },
			{ x0: 5.9, z0: 0.45, x1: 9, z1: 1.35 },
			{ x0: 0.15, z0: 2.9, x1: 1.05, z1: 5.1 },
			{ x0: 5.85, z0: 5.85, x1: 8.15, z1: 6.95 },
			{ x0: 2.8, z0: 6.4, x1: 3.6, z1: 7.2 },
			{ cx: 4.6, cz: 2.6, r: 0.4 },
			{ x0: 2.6, z0: 1.2, x1: 4.2, z1: 2.3 },
			{ cx: 1.7, cz: 6.3, r: 0.25 },
			{ cx: 0.6, cz: 7.3, r: 0.4 },
			{ x0: 8.55, z0: 6.75, x1: 9.25, z1: 7.85 },
		],
		props: (
			<>
				{shelf(
					2,
					0.4,
					3,
					[0.6, 1.2].map((y) =>
						[-1, 0, 1].map((i) => (
							<B key={`${y}${i}`} s={[0.5, 0.35, 0.3]} p={[i * 0.9, y + 0.2, 0.05]} c={["#f08a3c", "#5fc9a3", "#e85d75"][(i + 1) % 3]!} />
						)),
					),
				)}
				{cage(
					6.5,
					0.9,
					<>
						<Ball r={0.22} p={[0, 0.72, 0]} c="#f7f4ee" s={[1.2, 0.9, 1]} />
						<Ball r={0.06} p={[-0.1, 1.05, 0]} c="#f7f4ee" s={[0.7, 2, 0.7]} />
					</>,
				)}
				{cage(8.4, 0.9, <Ball r={0.2} p={[0, 0.7, 0]} c="#d9a066" s={[1.3, 0.9, 1]} />)}
				{/* Fish tanks along the left wall. */}
				<group position={[0.6, 0, 4]}>
					<Shadow r={1.2} s={[0.45, 1, 1]} />
					<B s={[0.9, 0.7, 2.2]} p={[0, 0.35, 0]} c={WOOD} />
					<B s={[0.85, 0.8, 2.1]} p={[0, 1.1, 0]} c="#7cc8e8" o={0.5} />
					{[
						[0.2, 1.0, -0.5, "#e8822e"],
						[-0.1, 1.2, 0.4, "#f2c94c"],
					].map(([x, y, z, c]) => (
						<Ball key={c as string} r={0.08} p={[x as number, y as number, z as number]} c={c as string} s={[0.6, 1, 1.5]} />
					))}
				</group>
				{/* The counter, and the cat's scratching post. */}
				<group position={[7, 0, 6.4]}>
					<Shadow r={1.5} s={[1, 0.35, 1]} />
				</group>
				<Model
					id="petshop-counter"
					height={2}
					at={[7, 0, 6.4]}
					rot={Math.PI / 2}
					fallback={
						<>
							<B s={[2.6, 1, 0.8]} p={[7, 0.5, 6.4]} c="#3cb6c9" />
							<B s={[2.7, 0.08, 0.9]} p={[7, 1.04, 6.4]} c={WHITE} />
						</>
					}
				/>
				<group position={[3.2, 0, 6.8]}>
					<B s={[0.8, 0.08, 0.8]} p={[0, 0.04, 0]} c="#c9b28c" />
					<Cyl r={0.1} h={1.3} p={[0, 0.65, 0]} c="#e8d9b0" seg={10} />
					<Ball r={0.22} p={[0, 1.4, 0]} c="#f08a3c" s={[1.2, 0.8, 1]} />
				</group>
				<Cyl r={0.4} h={0.18} p={[4.6, 0.09, 2.6]} c="#e85d75" />
				{/* Bubbles in the tanks. */}
				<Bubbles at={[0.65, 0.78, 3.4]} h={0.62} />
				<Bubbles at={[0.55, 0.78, 4.6]} h={0.62} />
				{/* A paw-print sign on the left wall. */}
				<group position={[0.07, 2.2, 2]} rotation={[0, Math.PI / 2, 0]}>
					<Cyl r={0.42} h={0.06} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c={WOOD} seg={28} />
					<Ball r={0.15} p={[0, -0.08, 0.05]} c={WOOD_DARK} s={[1.2, 1, 0.4]} />
					{[-0.17, -0.06, 0.06, 0.17].map((dx, i) => (
						<Ball key={dx} r={0.06} p={[dx, 0.12 + (i === 1 || i === 2 ? 0.06 : 0), 0.05]} c={WOOD_DARK} s={[1, 1.2, 0.4]} />
					))}
				</group>
				{/* The puppy pen: a low wooden fence round a cushion, two puppies asleep on it. */}
				<group position={[3.4, 0, 1.75]}>
					<Shadow r={0.9} s={[1, 0.75, 1]} />
					<B s={[1.45, 0.14, 1]} p={[0, 0.07, 0]} c="#f6e7c4" />
					{[
						[-0.8, -0.55],
						[0.8, -0.55],
						[-0.8, 0.55],
						[0.8, 0.55],
					].map(([x, z]) => (
						<B key={`${x}${z}`} s={[0.08, 0.5, 0.08]} p={[x!, 0.25, z!]} c={WOOD} />
					))}
					<B s={[1.68, 0.06, 0.05]} p={[0, 0.45, -0.55]} c={WOOD} />
					<B s={[1.68, 0.06, 0.05]} p={[0, 0.45, 0.55]} c={WOOD} />
					<B s={[0.05, 0.06, 1.18]} p={[-0.8, 0.45, 0]} c={WOOD} />
					<B s={[0.05, 0.06, 1.18]} p={[0.8, 0.45, 0]} c={WOOD} />
					{puppy(-0.22, 0, 0.3, "#d9a066", "#9c6b3f")}
					{puppy(0.25, 0.08, 2.6, "#f7f4ee", "#6b4a33")}
				</group>
				{/* A parrot on its perch. */}
				<group position={[1.7, 0, 6.3]}>
					<Shadow r={0.35} />
					<Cyl r={0.25} h={0.06} p={[0, 0.03, 0]} c={WOOD} seg={16} />
					<Cyl r={0.04} h={1.3} p={[0, 0.65, 0]} c={WOOD} seg={8} />
					<Cyl r={0.035} h={0.7} p={[0, 1.3, 0]} rot={[0, 0, Math.PI / 2]} c={WOOD} seg={8} />
					<group position={[0.15, 1.47, 0]}>
						<Ball r={0.11} p={[0, 0, 0]} c="#d8413c" s={[1, 1.4, 1]} />
						<Ball r={0.08} p={[0, 0.17, 0.02]} c="#d8413c" />
						<Ball r={0.07} p={[0.02, 0, 0.09]} c="#2f9e6b" s={[0.6, 1.3, 0.6]} />
						<Ball r={0.03} p={[0, 0.16, 0.09]} c="#f2c94c" />
					</group>
				</group>
				{pottedPlant(0.6, 7.3, 1.4)}
				{/* Food bags and a basket of toys beside the counter. */}
				<group position={[9, 0, 6.9]}>
					<Shadow r={0.6} s={[1, 0.6, 1]} />
					<B s={[0.36, 0.55, 0.2]} p={[-0.2, 0.28, 0]} c="#f6b6c8" />
					<Ball r={0.06} p={[-0.2, 0.3, 0.1]} c={WOOD_DARK} s={[1, 1, 0.3]} />
					<B s={[0.36, 0.48, 0.2]} p={[0.2, 0.24, 0.1]} c="#7cc8e8" />
					<Ball r={0.06} p={[0.2, 0.26, 0.2]} c={WOOD_DARK} s={[1, 1, 0.3]} />
				</group>
				<group position={[8.95, 0, 7.55]}>
					<Shadow r={0.32} />
					<Cyl r={0.26} r2={0.21} h={0.26} p={[0, 0.13, 0]} c="#c9965f" seg={16} />
					<Ball r={0.09} p={[-0.08, 0.28, 0]} c="#5fc9a3" />
					<Ball r={0.08} p={[0.09, 0.29, 0.04]} c="#e85d75" />
					<Ball r={0.08} p={[0.02, 0.3, -0.09]} c="#f2c94c" />
				</group>
			</>
		),
		hotspots: [
			{
				id: "adopt",
				at: [4.6, 1.9, 0.12],
				node: (
					<>
						<B s={[1.6, 0.8, 0.06]} p={[0, 0, 0]} c="#f2c94c" />
						<Ball r={0.16} p={[0, 0, 0.05]} c="#e85d75" s={[1, 1, 0.3]} />
					</>
				),
			},
		],
		finds: {
			"petshop-bone": { at: [6.2, 0, 7.05], node: <B s={[0.4, 0.08, 0.12]} p={[0, 0.06, 0]} c={WHITE} /> },
			"petshop-yarn": { at: [3.55, 0, 7.25], node: <Ball r={0.15} p={[0, 0.15, 0]} c="#8a5bd1" /> },
			"petshop-carrot": {
				at: [6.9, 0, 1.55],
				node: <Cyl r={0.01} r2={0.07} h={0.35} p={[0, 0.06, 0]} rot={[0, 0, Math.PI / 2]} c="#f08a3c" />,
			},
			"petshop-fishfood": { at: [0.75, 0.75, 5.3], node: <Cyl r={0.1} h={0.2} p={[0, 0, 0]} c="#2f9e6b" /> },
			"petshop-collar": { at: [4.6, 0.2, 2.6], node: <Cyl r={0.15} h={0.05} p={[0, 0, 0]} c={GOLD} e={0.3} /> },
		},
	},
	school: {
		ground: tiles("#e2b27a", "#d6a46c"),
		walls: { colour: "#d9f0c8" },
		start: { x: 6, z: 7.5 },
		blocks: [
			...[2.5, 5.5, 8.5].flatMap((x) => [3.2, 5.6].map((z) => ({ x0: x - 0.6, z0: z - 0.35, x1: x + 0.6, z1: z + 0.95 }))),
			{ x0: 9.1, z0: 0.9, x1: 10.5, z1: 1.9 },
			{ x0: 0.1, z0: 6, x1: 0.95, z1: 8 },
			{ x0: 0.8, z0: 0.15, x1: 2.4, z1: 0.65 },
			{ x0: 2.6, z0: 0.15, x1: 3.9, z1: 0.75 },
			{ cx: 1.1, cz: 4.4, r: 0.35 },
		],
		props: (
			<>
				{[2.5, 5.5, 8.5].flatMap((x) => [3.2, 5.6].map((z) => desk(x, z)))}
				{/* The teacher's desk, its drawers to the class. */}
				<group position={[9.8, 0, 1.4]}>
					<Shadow r={0.8} s={[1, 0.7, 1]} />
				</group>
				<Model
					id="school-teacher-desk"
					height={0.8}
					at={[9.8, 0, 1.4]}
					fallback={<B s={[2, 0.8, 0.9]} p={[9.8, 0.4, 1.4]} c={WOOD_DARK} />}
				/>
				{/* A pile of books on the teacher's desk. */}
				<B s={[0.4, 0.08, 0.3]} p={[10.15, 0.84, 1.4]} c="#3d74c9" />
				<B s={[0.36, 0.08, 0.28]} p={[10.17, 0.92, 1.38]} c="#f2c94c" />
				{/* Books and pencil pots on some desks. */}
				{[
					[2.5, 3.2],
					[8.5, 3.2],
					[5.5, 5.6],
				].map(([x, z], i) => (
					<group key={`dk${x}${z}`} position={[x!, 0.74, z!]}>
						<B s={[0.32, 0.07, 0.24]} p={[-0.25, 0.04, 0]} c={["#e85d75", "#2f9e6b", "#8a5bd1"][i]!} />
						<Cyl r={0.06} h={0.14} p={[0.3, 0.07, -0.05]} c={["#f2c94c", "#e85d75", "#3d74c9"][i]!} seg={10} />
					</group>
				))}
				{/* The reading corner: a round rug and two floor cushions by the bookshelf. */}
				<Cyl r={1.25} h={0.02} p={[1.9, 0.01, 7.1]} c="#f6e7c4" seg={36} />
				<Cyl r={1.05} h={0.022} p={[1.9, 0.012, 7.1]} c="#f2d3a0" seg={36} />
				<Ball r={0.32} p={[1.5, 0.1, 6.6]} c="#3d74c9" s={[1, 0.35, 1]} />
				<Ball r={0.32} p={[2.35, 0.1, 7.6]} c="#e85d75" s={[1, 0.35, 1]} />
				<B s={[0.36, 0.05, 0.26]} p={[2.1, 0.03, 6.75]} c="#f7f4ee" />
				{pottedPlant(1.1, 4.4, 1.2)}
				{/* The class hamster, in its cage on a low cabinet. */}
				<group position={[3.25, 0, 0.45]}>
					<Shadow r={0.8} s={[1, 0.45, 1]} />
					<B s={[1.3, 0.7, 0.55]} p={[0, 0.35, 0]} c={WOOD} />
					<B s={[0.9, 0.42, 0.45]} p={[0, 0.92, 0]} c="#bfe3f0" o={0.35} />
					<B s={[0.86, 0.06, 0.42]} p={[0, 0.74, 0]} c="#f2d3a0" />
					<Ball r={0.1} p={[-0.15, 0.82, 0.02]} c="#d9a066" s={[1.3, 0.9, 1]} />
					<Ball r={0.035} p={[-0.03, 0.85, 0.08]} c="#f6b6c8" />
				</group>
				{/* A wall clock, bunting over the chalkboard, and paintings on the left wall. */}
				<group position={[3.25, 2.25, 0.08]}>
					<Cyl r={0.32} h={0.05} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c="#3d74c9" seg={28} />
					<Cyl r={0.27} h={0.06} p={[0, 0, 0.01]} rot={[Math.PI / 2, 0, 0]} c={WHITE} seg={28} />
					<B s={[0.03, 0.18, 0.02]} p={[0, 0.08, 0.05]} c="#2b2b33" />
					<B s={[0.14, 0.03, 0.02]} p={[0.06, 0, 0.05]} c="#2b2b33" />
				</group>
				<Bunting x0={4.2} x1={7.9} y={2.85} />
				{PAINTINGS.map((map, i) => (
					<mesh key={map.uuid} position={[0.06, 1.95 + (i % 2) * 0.15, 2.3 + i * 0.85]} rotation={[0, Math.PI / 2, 0]}>
						<planeGeometry args={[0.5, 0.66]} />
						<meshBasicMaterial map={map} />
					</mesh>
				))}
				{/* The bookshelf against the left wall, its open side to the room. */}
				<group position={[0.52, 0, 7]}>
					<Shadow r={1.1} s={[0.4, 1, 1]} />
				</group>
				<Model
					id="school-bookshelf"
					height={1.08}
					at={[0.52, 0, 7]}
					fallback={shelf(
						0.4,
						7,
						2.4,
						[0.55, 1.15].map((y) => books(2.2, y)),
						Math.PI / 2,
					)}
				/>
				{/* A globe on the shelf by the window. */}
				<B s={[1.6, 1, 0.5]} p={[1.6, 0.5, 0.4]} c={WOOD} />
				<Cyl r={0.25} h={0.06} p={[1.2, 1.03, 0.4]} c={POT} />
			</>
		),
		hotspots: [
			{
				id: "chalkboard",
				at: [6, 1.7, 0.08],
				node: (
					<>
						<B s={[4.2, 1.6, 0.08]} p={[0, 0, 0]} c={WOOD} />
						<B s={[3.9, 1.35, 0.04]} p={[0, 0, 0.04]} c="#2f5d4f" />
						{[-1.2, -0.3, 0.6].map((x, i) => (
							<B key={x} s={[0.6 - i * 0.1, 0.06, 0.02]} p={[x, 0.3 - i * 0.3, 0.07]} c={WHITE} />
						))}
					</>
				),
			},
		],
		finds: {
			"school-pencil": { at: [5.8, 0, 6.05], node: <B s={[0.35, 0.05, 0.05]} p={[0, 0.04, 0]} c="#f2c94c" /> },
			"school-star": {
				at: [10.5, 2.3, 0.1],
				node: (
					<mesh rotation={[0, 0, 0.3]}>
						<circleGeometry args={[0.18, 5]} />
						<Toon color={GOLD} emissive={0.4} />
					</mesh>
				),
			},
			"school-apple": { at: [9.5, 0.92, 1.3], node: <Ball r={0.13} p={[0, 0, 0]} c="#d8413c" /> },
			"school-book": { at: [0.75, 1.12, 7.7], node: <B s={[0.3, 0.06, 0.24]} p={[0, 0, 0]} c="#8a5bd1" e={0.2} /> },
			"school-globe": { at: [2.1, 1.25, 0.4], node: <Ball r={0.2} p={[0, 0, 0]} c="#3d74c9" /> },
		},
	},
};

/** Where Roxy stands to pick up each find: on the ground in front of it. */
export function findSpot(place: PlaceId, findId: string): Spot | null {
	const f = PLACES[place].finds[findId];
	return f ? { x: f.at[0], z: f.at[2] + 0.6 } : null;
}
/** Where Roxy starts and what she walks round, for checking every find can be reached. */
export const placeLayout = (place: PlaceId) => ({ area: PLACE_INFO[place].area, start: PLACES[place].start, blocks: PLACES[place].blocks });
export const FIND_SPOTS_FOR = (place: PlaceId) => Object.keys(PLACES[place].finds);
/** What Roxy can walk up to and use here: the finds still hidden, and the hotspots (stand in front of them). */
export function placeTargets(place: PlaceId, found: ReadonlySet<string>): Target[] {
	const def = PLACES[place];
	return [
		...Object.entries(def.finds)
			.filter(([id]) => !found.has(id))
			.map(([id, f]) => ({ kind: "find" as const, id, stand: { x: f.at[0], z: f.at[2] + 0.6 } })),
		...(def.hotspots ?? []).map((h) => ({ kind: "hotspot" as const, id: h.id, stand: { x: h.at[0], z: h.at[2] + 0.6 } })),
	];
}

type Props = {
	place: PlaceId;
	look: Look;
	found: ReadonlySet<string>;
	walkTo: Spot | null;
	onGround: (spot: Spot) => void;
	onFind: (findId: string) => void;
	onHotspot: (id: Hotspot) => void;
	onArrive: (spot: Spot) => void;
	/** Walks Roxy directly (keys or the touch stick). */
	drive?: RefObject<DriveInput>;
	/** Where Roxy is, a few times a second while she moves. */
	onMove?: (spot: Spot) => void;
	label: string;
};

export function PlaceScene({ place, look, found, walkTo, onGround, onFind, onHotspot, onArrive, drive, onMove, label }: Props) {
	const def = PLACES[place];
	const area = PLACE_INFO[place].area;
	const ground = useMemo(() => def.ground(area), [def, area]);
	useEffect(() => () => ground.dispose(), [ground]);
	// Finds picked up while we're here get a moment; the ones found on earlier visits just aren't there.
	const seen = useRef(found);
	const [bursts, setBursts] = useState<string[]>([]);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	useEffect(() => {
		const fresh = [...found].filter((id) => !seen.current.has(id) && def.finds[id]);
		seen.current = found;
		if (fresh.length && !reduced) setBursts((b) => [...b, ...fresh]);
	}, [found, def, reduced]);
	const tap = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		fn();
	};
	return (
		<WorldCanvas area={area} label={label} orbit>
			<mesh position={[area.w / 2, -0.15, area.d / 2]} onClick={(e) => tap(() => onGround({ x: e.point.x, z: e.point.z }))(e)}>
				<boxGeometry args={[area.w, 0.3, area.d]} />
				<meshToonMaterial map={ground} />
			</mesh>
			{def.walls && (
				<>
					<mesh position={[area.w / 2, 1.5, -0.1]}>
						<boxGeometry args={[area.w, 3, 0.2]} />
						<Toon color={def.walls.colour} />
					</mesh>
					<mesh position={[-0.1, 1.5, area.d / 2]}>
						<boxGeometry args={[0.2, 3, area.d]} />
						<Toon color={lighter(def.walls.colour, 0.15)} />
					</mesh>
				</>
			)}
			{def.props}
			{def.hotspots?.map((h) => (
				<group key={h.id} position={h.at} onClick={tap(() => onHotspot(h.id))}>
					{h.node}
				</group>
			))}
			{Object.entries(def.finds)
				.filter(([id]) => !found.has(id))
				.map(([id, f]) => (
					<group key={id} position={f.at} onClick={tap(() => onFind(id))}>
						{f.node}
					</group>
				))}
			{bursts.map((id) => (
				<FindBurst key={id} at={def.finds[id]!.at} node={def.finds[id]!.node} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
			))}
			<Walkers
				look={look}
				walkTo={walkTo}
				area={area}
				start={def.start}
				blocks={def.blocks}
				onArrive={onArrive}
				drive={drive}
				onMove={onMove}
			/>
		</WorldCanvas>
	);
}
