import { Static } from "../batch.tsx";
import { B, Ball, Cyl, LEAF, LEAF_DARK, LEAF_LIGHT, lighter, Toon, WHITE } from "../Furniture.tsx";
import { useNight } from "../light.tsx";
import { Model, type ModelId } from "../Model.tsx";
import { Shadow } from "../stage.tsx";
import type { Extend } from "./board.tsx";

/**
 * The street behind the park: past the back fence a grass verge, a pavement, a road with two parked toy cars, and
 * across it the town (the pet shop, the school, a cottage); along the left a lawn with trees and another cottage.
 * Scenery only: Roxy can't walk there. It sits on the park's board, grown by `STREET_EXTEND`, so the park reads as
 * one corner of a little town rather than a patch of grass in the sky.
 *
 * The buildings are generated models (Tripo); each shows a simple code-built house until it loads.
 */
export const STREET_EXTEND: Extend = { back: 8, left: 4.5 };

type V3 = [number, number, number];

const X0 = -STREET_EXTEND.left;
const X1 = 14;
const Z0 = -STREET_EXTEND.back;
const GRASS = "#94c972";
const PAVING = "#ebe3d4";
const ROAD = "#8790a3";

/** A flat strip of ground from (x0, z0) to (x1, z1), its top at `top`. */
const strip = (x0: number, z0: number, x1: number, z1: number, c: string, top = 0) => (
	<mesh key={`${x0}${z0}${c}`} position={[(x0 + x1) / 2, top - 0.15, (z0 + z1) / 2]}>
		<boxGeometry args={[x1 - x0, 0.3, z1 - z0]} />
		<Toon color={c} />
	</mesh>
);

// The road runs along x behind the park: verge, pavement, kerb, road, far pavement, then the plots the houses sit on.
const VERGE = [-1, 0] as const;
const PAVEMENT = [-2, -1] as const;
const ROADWAY = [-4.2, -2] as const;
const FAR = [-5, -4.2] as const;

/** A toy car parked along the road, facing +x. */
const car = (x: number, z: number, c: string) => (
	<group key={`car${x}`} position={[x, -0.06, z]}>
		<B s={[1.5, 0.42, 0.78]} p={[0, 0.36, 0]} c={c} />
		<B s={[0.86, 0.38, 0.7]} p={[-0.1, 0.72, 0]} c={lighter(c, 0.25)} />
		{/* Windows all round the cabin. */}
		<B s={[0.7, 0.24, 0.72]} p={[-0.1, 0.74, 0]} c="#bfe3f0" />
		<B s={[0.88, 0.24, 0.5]} p={[-0.1, 0.74, 0]} c="#bfe3f0" />
		{[-0.48, 0.48].flatMap((dx) =>
			[-0.38, 0.38].map((dz) => (
				<Cyl key={`${dx}${dz}`} r={0.17} h={0.12} p={[dx, 0.17, dz]} rot={[Math.PI / 2, 0, 0]} c="#3a3d48" seg={14} />
			)),
		)}
		<Ball r={0.07} p={[0.75, 0.42, 0.24]} c="#fff6cf" s={[0.5, 1, 1]} />
		<Ball r={0.07} p={[0.75, 0.42, -0.24]} c="#fff6cf" s={[0.5, 1, 1]} />
	</group>
);

const bush = (x: number, z: number, s = 1) => (
	<group key={`sb${x}${z}`} position={[x, 0, z]} scale={s}>
		<Ball r={0.42} p={[0, 0.3, 0]} c={LEAF_DARK} s={[1.3, 0.8, 1]} />
		<Ball r={0.28} p={[0.28, 0.42, 0.12]} c={LEAF} />
		<Ball r={0.2} p={[-0.14, 0.5, 0.18]} c={LEAF_LIGHT} />
	</group>
);

const postBox = (x: number, z: number) => (
	<group key={`pb${x}`} position={[x, 0, z]}>
		<Cyl r={0.2} h={0.75} p={[0, 0.38, 0]} c="#d8413c" seg={16} />
		<Ball r={0.2} p={[0, 0.76, 0]} c="#d8413c" s={[1, 0.5, 1]} />
		<B s={[0.22, 0.04, 0.05]} p={[0, 0.58, 0.19]} c="#3a3d48" />
	</group>
);

const LAMPS: V3[] = [
	[3, 0, -1.5],
	[8.6, 0, -1.5],
	[13.5, 0, -1.5],
];
/** A street lamp's post and hood (baked with the ground); its glass is `LampGlow`. */
const lampPost = ([x, , z]: V3) => (
	<group key={`lp${x}`} position={[x, 0, z]}>
		<Cyl r={0.12} h={0.12} p={[0, 0.06, 0]} c="#3f4a5c" seg={10} />
		<Cyl r={0.045} h={2.2} p={[0, 1.1, 0]} c="#3f4a5c" seg={8} />
		<Cyl r={0.22} r2={0.06} h={0.14} p={[0, 2.5, 0]} c="#3f4a5c" seg={10} />
	</group>
);

/** The flat ground: one baked mesh, out of the shadow pass (it only receives). */
const GROUND = (
	<Static cast={false}>
		{strip(X0, VERGE[0], X1, VERGE[1], GRASS)}
		{strip(X0, VERGE[1], 0, 10, GRASS)}
		{strip(X0, PAVEMENT[0], X1, PAVEMENT[1], PAVING)}
		{/* Paving seams, and the kerb: the road sits a little lower. */}
		{Array.from({ length: Math.round(X1 - X0) }, (_, i) => (
			<B key={`ps${i}`} s={[0.04, 0.02, 0.98]} p={[X0 + i + 0.5, 0.005, (PAVEMENT[0] + PAVEMENT[1]) / 2]} c="#d6ccb9" />
		))}
		<B s={[X1 - X0, 0.14, 0.14]} p={[(X0 + X1) / 2, -0.04, PAVEMENT[0]]} c="#cfc6b6" />
		<B s={[X1 - X0, 0.14, 0.14]} p={[(X0 + X1) / 2, -0.04, FAR[1]]} c="#cfc6b6" />
		{strip(X0, ROADWAY[0], X1, ROADWAY[1], ROAD, -0.06)}
		{/* The dashed line down the middle, and a zebra crossing. */}
		{Array.from({ length: 11 }, (_, i) => (
			<B key={`dl${i}`} s={[0.8, 0.02, 0.09]} p={[X0 + 0.9 + i * 1.7, -0.055, -3.1]} c={WHITE} />
		))}
		{Array.from({ length: 5 }, (_, i) => (
			<B key={`zc${i}`} s={[0.32, 0.02, 1.9]} p={[10.6 + i * 0.55, -0.05, -3.1]} c={WHITE} />
		))}
		{strip(X0, FAR[0], X1, FAR[1], PAVING)}
		{strip(X0, Z0, X1, FAR[0], GRASS)}
		{/* Little garden paths up to the front doors. */}
		{strip(2.7, -5.8, 3.7, -5, PAVING, 0.01)}
		{strip(8.1, -5.9, 9.1, -5, PAVING, 0.01)}
		{strip(12.3, -5.8, 13.1, -5, PAVING, 0.01)}
		{strip(-1.2, 6.4, -0.1, 7.2, PAVING, 0.01)}
	</Static>
);

/** What stands on it (cars, bushes, lamp posts), which casts shadows. */
const STANDING = (
	<Static>
		{car(5.4, -3.7, "#e85d75")}
		{car(1.2, -2.5, "#3cb6c9")}
		{postBox(5.2, -1.5)}
		{LAMPS.map(lampPost)}
		{[0.9, 6.2, 11.2, 14.3].map((x) => bush(x, -5.4, 0.9))}
		{[2.0, 4.6, 7.1, 10.2].map((x) => bush(x, -7.6, 1.2))}
		{[
			[-3.6, 2.6],
			[-1.2, 5.2],
			[-3.8, 8.6],
		].map(([x, z]) => bush(x!, z!, 1.1))}
	</Static>
);

/**
 * The lamps' glass: glows a little by day, properly at Night, when each throws a warm pool of light. The lights are
 * only there at Night: a light at nothing still costs every pixel, every frame (turning Night on recompiles the
 * materials once instead).
 */
function LampGlow() {
	const night = useNight();
	return (
		<>
			{LAMPS.map(([x, , z]) => (
				<group key={x} position={[x, 0, z]}>
					<Ball r={0.18} p={[0, 2.3, 0]} c="#fff2b8" e={night ? 1.6 : 0.4} />
					{night && <pointLight position={[0, 2.1, 0]} color="#ffc86e" intensity={6} distance={3.8} decay={1.4} />}
				</group>
			))}
		</>
	);
}

/** A simple house, while the generated one loads (or if it can't). */
const stand = (w: number, h: number, d: number, wall: string, roof: string) => (
	<group>
		<B s={[w, h, d]} p={[0, h / 2, 0]} c={wall} />
		<mesh position={[0, h + 0.55, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, d / 1.1]}>
			<boxGeometry args={[w * 0.72, w * 0.72, 1.1]} />
			<Toon color={roof} />
		</mesh>
	</group>
);

/** A generated building on its plot. Tripo faces a model down x; `rot` turns it to face the park. */
function House({ id, at, height, rot, wall, roof }: { id: ModelId; at: V3; height: number; rot: number; wall: string; roof: string }) {
	return (
		<>
			<group position={at}>
				<Shadow r={1.9} s={[1, 0.8, 1]} />
			</group>
			<Model
				id={id}
				height={height}
				at={at}
				rot={rot}
				fallback={
					<group position={at} rotation={[0, rot + Math.PI / 2, 0]}>
						{stand(2.6, height * 0.55, 2.4, wall, roof)}
					</group>
				}
			/>
		</>
	);
}

const tree = (x: number, z: number, h: number) => (
	<group key={`st${x}${z}`}>
		<Model
			id="park-tree"
			height={h}
			at={[x, 0, z]}
			fallback={
				<group position={[x, 0, z]} scale={h / 3}>
					<Cyl r={0.16} r2={0.22} h={1.4} p={[0, 0.7, 0]} c="#9c6b3f" seg={10} />
					<Ball r={0.9} p={[0, 2, 0]} c={LEAF} />
				</group>
			}
		/>
	</group>
);

export function Street() {
	return (
		<>
			{GROUND}
			{STANDING}
			<group userData={{ noCast: true }}>
				<House id="street-petshop" at={[3.2, 0, -6.6]} height={3.3} rot={-Math.PI / 2} wall="#f6e0c4" roof="#e8a07c" />
				<House id="street-school" at={[8.6, 0, -6.7]} height={3.8} rot={-Math.PI / 2} wall="#e07a5f" roof="#e8a07c" />
				<House id="street-cottage" at={[12.7, 0, -6.6]} height={3.2} rot={-Math.PI / 2} wall="#bfe6d3" roof="#5f86d9" />
			</group>
			<House id="street-cottage" at={[-2.5, 0, 7]} height={3} rot={0} wall="#bfe6d3" roof="#5f86d9" />
			{tree(-0.9, -0.5, 2.4)}
			{tree(10.4, -0.45, 2.2)}
			{tree(-2.6, 0.9, 2.8)}
			{tree(-3.2, 4.4, 2.5)}
			{tree(-1.6, 9.3, 2.2)}
			{tree(5.9, -7.3, 2.6)}
			<LampGlow />
		</>
	);
}
