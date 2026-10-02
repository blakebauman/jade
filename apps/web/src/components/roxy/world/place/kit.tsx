import { useFrame } from "@react-three/fiber";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, DoubleSide, type Group, type InstancedMesh, Matrix4, Object3D } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { B, Ball, Cyl, LEAF, LEAF_DARK, LEAF_LIGHT, lighter, POT, Toon, toonGradient, WHITE, WOOD, WOOD_DARK } from "../Furniture.tsx";
import { Model } from "../Model.tsx";
import { useWake } from "../pace.tsx";
import type { Block } from "../path.ts";
import { type Area, canvasTexture, Shadow, type Spot } from "../stage.tsx";
import type { Extend } from "./board.tsx";

/**
 * What the places in Roxy's town are made of: the shape of a place, and the small toy shapes they share.
 */

export type V3 = [number, number, number];
export type FindSpot = { at: V3; node: ReactNode };
export type Hotspot = "chalkboard" | "adopt";
export type Place = {
	ground: (area: Area) => ReturnType<typeof canvasTexture>;
	walls?: { colour: string };
	props: ReactNode;
	finds: Record<string, FindSpot>;
	hotspots?: { id: Hotspot; at: V3; node: ReactNode }[];
	start: Spot;
	/** What Roxy walks round: footprints of the props, matching where they're drawn. */
	blocks: Block[];
	/** Indoors (a timber plinth under the floor) or outdoors (turf and soil). */
	board: "indoor" | "outdoor";
	/** Scenery past the place's own squares, at the back and left (the street behind the park), on a bigger board. */
	backdrop?: { node: ReactNode; extend: Extend };
};

// ── Small shapes ──

export const codeTree = (x: number, z: number, s = 1) => (
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
export const bush = (x: number, z: number) => (
	<group key={`b${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.6} />
		<Ball r={0.45} p={[0, 0.35, 0]} c={LEAF_DARK} s={[1.3, 0.8, 1]} />
		<Ball r={0.3} p={[0.3, 0.45, 0.15]} c={LEAF} />
		<Ball r={0.22} p={[-0.15, 0.55, 0.2]} c={LEAF_LIGHT} />
	</group>
);
// Generated models of the same things, the same size and on the same footprints; the code-built ones show until
// they load. Tripo faces a model down its x axis, so the bench and slide turn a quarter to put their backs to -z.
// A tree's shadow is the sun's (it's tall enough to cast a real one), so no contact shadow under it.
export const tree = (x: number, z: number, s = 1) => (
	<Model key={`t${x}${z}`} id="park-tree" height={3.05 * s} at={[x, 0, z]} fallback={codeTree(x, z, s)} />
);
export const bench = (x: number, z: number) => (
	<group key={`be${x}${z}`}>
		<group position={[x, 0, z]}>
			<Shadow r={0.8} s={[1, 0.55, 1]} />
		</group>
		<Model id="park-bench" height={1.2} at={[x, 0, z]} rot={-Math.PI / 2} fallback={codeBench(x, z)} />
	</group>
);
export const flowers = (x: number, z: number, c: string) => (
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
export const codeBench = (x: number, z: number, rot = 0) => (
	<group key={`be${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<B s={[1.6, 0.1, 0.5]} p={[0, 0.45, 0]} c={WOOD} />
		<B s={[1.6, 0.4, 0.08]} p={[0, 0.75, -0.22]} c={WOOD} />
		{[-0.65, 0.65].map((dx) => (
			<B key={dx} s={[0.08, 0.45, 0.45]} p={[dx, 0.22, 0]} c="#6b7a93" />
		))}
	</group>
);
export const codeDesk = (x: number, z: number) => (
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
export const desk = (x: number, z: number) => (
	<group key={`d${x}${z}`}>
		<group position={[x, 0, z + 0.2]}>
			<Shadow r={0.6} s={[1, 0.9, 1]} />
		</group>
		<Model id="school-desk" height={0.83} at={[x, 0, z + 0.2]} rot={Math.PI} fallback={codeDesk(x, z)} />
	</group>
);
export const shelf = (x: number, z: number, w: number, items: ReactNode, rot = 0) => (
	<group key={`s${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<Shadow r={w / 2 + 0.1} s={[1, 0.35, 1]} />
		<B s={[w, 1.6, 0.45]} p={[0, 0.8, 0]} c={WOOD} />
		{[0.55, 1.15].map((y) => (
			<B key={y} s={[w - 0.1, 0.05, 0.4]} p={[0, y, 0.03]} c={lighter(WOOD)} />
		))}
		{items}
	</group>
);
export const books = (w: number, y: number) =>
	Array.from({ length: Math.floor(w / 0.22) }, (_, i) => (
		<B
			key={`${y}${i}`}
			s={[0.16, 0.36 - (i % 3) * 0.05, 0.3]}
			p={[-w / 2 + 0.2 + i * 0.22, y + 0.2, 0.05]}
			c={["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b", "#8a5bd1"][i % 5]!}
		/>
	));
export const cage = (x: number, z: number, critter: ReactNode) => (
	<group key={`c${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.75} s={[1, 0.7, 1]} />
		<B s={[1.1, 0.7, 0.8]} p={[0, 0.85, 0]} c="#bfe3f0" o={0.35} />
		<B s={[1.2, 0.5, 0.9]} p={[0, 0.25, 0]} c={WOOD} />
		{critter}
	</group>
);

/** Gingham for the picnic blanket. */
export const picnicCloth = canvasTexture(
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
export function Fence({ area }: { area: Area }) {
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
export function Butterfly({ at, c, phase = 0 }: { at: V3; c: string; phase?: number }) {
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
		<group ref={body} position={at} userData={{ noCast: true }}>
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
export const pottedPlant = (x: number, z: number, s = 1) => (
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
export const painting = (draw: (ctx: CanvasRenderingContext2D) => void) =>
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
export const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
	ctx.fillStyle = c;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
};
export const PAINTINGS = [
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
export const BUNTING = ["#e85d75", "#f08a3c", "#f2c94c", "#7dbf52", "#3d74c9", "#8a5bd1"];
export function Bunting({ x0, x1, y }: { x0: number; x1: number; y: number }) {
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
export function Bubbles({ at, h }: { at: V3; h: number }) {
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
export const puppy = (x: number, z: number, rot: number, coat: string, ear: string) => (
	<group key={`pup${x}${z}`} position={[x, 0.16, z]} rotation={[0, rot, 0]}>
		<Ball r={0.2} p={[0, 0.1, 0]} c={coat} s={[1.4, 0.75, 1]} />
		<Ball r={0.13} p={[0.26, 0.17, 0.04]} c={coat} />
		<Ball r={0.06} p={[0.25, 0.17, 0.16]} c={ear} s={[0.7, 1.6, 0.6]} />
		<Ball r={0.035} p={[0.38, 0.15, 0.06]} c="#2b2b33" />
	</group>
);

// ── The places ──

export const grass = (area: Area) =>
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
export const tiles = (a: string, b: string) => (area: Area) =>
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
