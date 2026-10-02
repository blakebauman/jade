import type { ReactNode } from "react";
import { HEAD_R } from "./body.tsx";
import { Ball, Cone, darker, fabric, Hang, M, Mat, type V3 } from "./shapes.tsx";

/**
 * Hair in 3D, in head coordinates (origin at the head's centre, facing +z). Built from a cap over the top, a back
 * piece, a fringe, and whatever the style adds: strands, buns, puffs, a ponytail.
 */

const R = HEAD_R;

/** Part of a sphere around the head: theta from the top (0) down, phi around (front is π/2). */
function Shell({
	r = 1.07,
	theta = [0, 1.3],
	phi = [0, Math.PI * 2],
	c,
	map,
}: {
	r?: number;
	theta?: [number, number];
	phi?: [number, number];
	c: string;
	map?: ReturnType<typeof fabric>;
}) {
	return (
		<mesh>
			<sphereGeometry args={[R * r, 36, 24, phi[0], phi[1], theta[0], theta[1] - theta[0]]} />
			<Mat c={c} side="double" {...(map !== undefined && { map })} />
		</mesh>
	);
}

const FRONT = Math.PI / 2;
/** Everything but a gap at the front, `gap` radians wide. */
const notFront = (gap: number): [number, number] => [FRONT + gap / 2, Math.PI * 2 - gap];

const cap = (c: string, theta = 1.3, r = 1.07) => <Shell c={c} theta={[0, theta]} r={r} />;
const back = (c: string, theta = 1.95) => <Shell c={darker(c, 0.1)} theta={[0.8, theta]} phi={notFront(2.2)} r={1.08} />;
/** A fringe across the forehead, straight, swept to one side, or parted. */
const fringe = (c: string, kind: "straight" | "swept" | "part") => {
	if (kind === "part")
		return (
			<>
				{[-1, 1].map((s) => (
					<group key={s} rotation={[0, s * 0.42, 0]}>
						<Shell c={c} theta={[0.55, 1.15]} phi={[FRONT - 0.42, 0.84]} r={1.09} />
					</group>
				))}
			</>
		);
	if (kind === "swept")
		return (
			<group rotation={[0, 0, -0.25]}>
				<Shell c={c} theta={[0.6, 1.08]} phi={[FRONT - 0.95, 1.9]} r={1.09} />
			</group>
		);
	return <Shell c={c} theta={[0.6, 1.02]} phi={[FRONT - 1, 2]} r={1.09} />;
};
/** A long panel of hair down the back, to `to` below the head's centre. */
const panel = (c: string, to: number, w = 1.05) => (
	<M p={[0, -to / 2 + 0.05, -R * 0.55]} c={darker(c, 0.12)} s={[w, 1, 0.45]}>
		<capsuleGeometry args={[R * 0.8, Math.max(0.05, to - R * 1.4), 6, 16]} />
	</M>
);
/** Strands falling in front of the shoulders. */
const locks = (c: string, len: number, r = 0.11, spread = 0.82) => (
	<>
		{[-1, 1].map((s) => (
			<Hang key={s} r={r} len={len} c={c} p={[s * R * spread, -0.15, R * 0.2]} rot={[0.1, 0, s * 0.08]} />
		))}
	</>
);
/** A cloud of balls, for curls and coils. */
const cloud = (c: string, n: number, rx: number, ry: number, cy: number, br: number, rz = rx) => (
	<>
		{Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			const t = ((i * 7) % n) / n;
			const p: V3 = [Math.cos(a) * rx, cy + Math.sin(a * 2) * ry * 0.3 + (t - 0.5) * ry, Math.sin(a) * rz - 0.1];
			return <Ball key={i} r={br} p={p} c={i % 3 ? c : darker(c, 0.12)} />;
		})}
	</>
);

type Style = (c: string) => ReactNode;

const STYLES: Record<string, Style> = {
	"hair-buzz": (c) => cap(c, 1.4, 1.02),
	"hair-pixie": (c) => (
		<>
			{cap(c, 1.3)}
			{back(c, 1.75)}
			{fringe(c, "swept")}
		</>
	),
	"hair-bob": (c) => (
		<>
			{cap(c, 1.3)}
			{fringe(c, "straight")}
			<Shell c={darker(c, 0.05)} theta={[0.9, 2.2]} phi={notFront(1.6)} r={1.12} />
		</>
	),
	"hair-long": (c) => (
		<>
			{cap(c)}
			{back(c)}
			{fringe(c, "part")}
			{panel(c, 1.4)}
			{locks(c, 0.95)}
		</>
	),
	"hair-wavy": (c) => (
		<>
			{cap(c)}
			{back(c)}
			{fringe(c, "part")}
			{[0, 1, 2, 3].map((i) => (
				<Ball
					key={i}
					r={R * (0.72 - i * 0.04)}
					p={[i % 2 ? 0.08 : -0.08, -0.45 - i * 0.28, -R * 0.55]}
					c={darker(c, 0.1)}
					s={[1.3, 0.8, 0.5]}
				/>
			))}
			{locks(c, 0.9, 0.12)}
		</>
	),
	"hair-curly": (c) => (
		<>
			{cap(c, 1.4)}
			{cloud(c, 22, R * 1.02, 0.7, 0.05, 0.24, R * 0.95)}
			{cloud(c, 8, R * 0.7, 0.2, 0.5, 0.22)}
		</>
	),
	"hair-coily": (c) => (
		<>
			{cap(c, 1.25)}
			<Ball r={R * 1.38} p={[0, 0.3, -0.18]} c={darker(c, 0.05)} />
			{cloud(c, 18, R * 1.3, 0.6, 0.3, 0.2, R * 1.2)}
		</>
	),
	"hair-puffs": (c) => (
		<>
			{cap(c, 1.3)}
			{[-1, 1].map((s) => (
				<Ball key={s} r={0.36} p={[s * R * 0.85, R * 0.75, -0.05]} c={c} />
			))}
		</>
	),
	"hair-locs": (c) => (
		<>
			{cap(c, 1.32)}
			{Array.from({ length: 11 }, (_, i) => {
				const a = Math.PI * 0.15 + (i / 10) * Math.PI * 0.7;
				return (
					<Hang
						key={i}
						r={0.065}
						len={1.05 + (i % 3) * 0.12}
						c={i % 2 ? c : darker(c, 0.12)}
						p={[Math.cos(a) * R * 0.98, 0.05, -Math.sin(a) * R * 0.85]}
						rot={[-0.08, 0, Math.cos(a) * 0.12]}
					/>
				);
			})}
			{locks(c, 1, 0.065, 0.9)}
		</>
	),
	"hair-braids": (c) => (
		<>
			{cap(c, 1.32)}
			{Array.from({ length: 12 }, (_, i) => {
				const a = Math.PI * 0.12 + (i / 11) * Math.PI * 0.76;
				return (
					<Hang
						key={i}
						r={0.05}
						len={1.35}
						c={i % 2 ? c : darker(c, 0.15)}
						p={[Math.cos(a) * R * 0.98, 0.05, -Math.sin(a) * R * 0.85]}
						rot={[-0.06, 0, Math.cos(a) * 0.1]}
					/>
				);
			})}
			{locks(c, 1.3, 0.05, 0.92)}
		</>
	),
	"hair-cornrows": (c) => <Shell c={c} theta={[0, 1.4]} r={1.03} map={fabric("stripes", c, darker(c, 0.3), [10, 1])} />,
	"hair-pigtails": (c) => (
		<>
			{cap(c)}
			{back(c, 1.8)}
			{fringe(c, "part")}
			{[-1, 1].map((s) => (
				<group key={s}>
					<Ball r={0.07} p={[s * R * 1.02, 0.12, -0.05]} c="#e85d75" />
					<Hang r={0.16} len={0.85} c={c} p={[s * R * 1.08, 0.12, -0.08]} rot={[0, 0, s * 0.45]} />
				</group>
			))}
		</>
	),
	"hair-ponytail": (c) => (
		<>
			{cap(c)}
			{back(c, 1.75)}
			{fringe(c, "swept")}
			<Ball r={0.07} p={[0, R * 0.55, -R * 0.85]} c="#3cb6c9" />
			<Hang r={0.17} len={1.0} c={darker(c, 0.08)} p={[0, R * 0.55, -R * 0.95]} rot={[0.35, 0, 0]} />
		</>
	),
	"hair-bun": (c) => (
		<>
			{cap(c, 1.32)}
			{back(c, 1.7)}
			<Ball r={0.3} p={[0, R * 1.08, -0.1]} c={c} />
		</>
	),
	"hair-spacebuns": (c) => (
		<>
			{cap(c, 1.32)}
			{back(c, 1.7)}
			{fringe(c, "part")}
			{[-1, 1].map((s) => (
				<Ball key={s} r={0.24} p={[s * R * 0.62, R * 0.92, -0.05]} c={c} />
			))}
		</>
	),
	"hair-side": (c) => (
		<>
			{cap(c)}
			{back(c)}
			<group rotation={[0, 0, 0.35]}>
				<Shell c={c} theta={[0.55, 1.25]} phi={[FRONT - 1.1, 1.6]} r={1.1} />
			</group>
			{panel(c, 1.3)}
			<Hang r={0.13} len={1} c={c} p={[-R * 0.85, -0.12, R * 0.2]} rot={[0.1, 0, -0.06]} />
		</>
	),
	"hair-mohawk": (c) => (
		<>
			{cap(darker(c, 0.35), 1.4, 1.02)}
			{[-0.35, -0.12, 0.1, 0.32].map((z, i) => (
				<Cone key={z} r={0.12} h={0.42 - Math.abs(i - 1.5) * 0.05} p={[0, R * 1.02, z]} c={c} rot={[-0.15 + i * 0.1, 0, 0]} />
			))}
		</>
	),
	"hair-princess": (c) => (
		<>
			{cap(c)}
			{back(c)}
			{fringe(c, "part")}
			{panel(c, 2.0, 1.15)}
			{locks(c, 1.4, 0.13)}
		</>
	),
};

export const HAIR_3D = new Set(Object.keys(STYLES));

export function Hair3D({ item, c }: { item: string; c: string }) {
	const style = STYLES[item];
	return style ? <group>{style(c)}</group> : null;
}
