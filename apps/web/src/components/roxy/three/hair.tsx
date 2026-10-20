import type { ReactNode } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, LatheGeometry, Vector2 } from "three";
import { HEAD_R } from "./body.tsx";
import { Ball, Cone, darker, fabric, M, Mat, type V3 } from "./shapes.tsx";

/**
 * Hair in 3D, in head coordinates (origin at the head's centre, facing +z). Built from a cap over the top, a back
 * piece, a fringe, and whatever the style adds: locks, buns, puffs, a ponytail. Edges are cut into points (the ends
 * of locks) rather than left as smooth rims, and smooth styles carry a band of shine across the crown.
 *
 * A style has fixed hair and, for ponytails and pigtails, pieces that swing: each hangs from its own pivot so the
 * model can sway it as Roxy walks or turns.
 */

const R = HEAD_R;
const FRONT = Math.PI / 2;

// ── Shapes ──

/** How a patch's edge runs: theta (0 at the crown) at u, from 0 to 1 across the patch. */
type Edge = (u: number) => number;
const flat =
	(theta: number): Edge =>
	() =>
		theta;
/**
 * An edge cut into `n` points: `theta` where locks part, `theta + depth` at each lock's tip. `lean` tips the points
 * sideways, as hair falls when it's swept.
 */
const points =
	(theta: number, depth: number, n: number, lean = 0): Edge =>
	(u) => {
		const f = (u * n) % 1;
		const peak = 0.5 + lean * 0.35;
		const t = f < peak ? f / peak : (1 - f) / (1 - peak);
		return theta + depth * Math.sin((t * Math.PI) / 2) ** 1.6;
	};

const patches = new Map<string, BufferGeometry>();
/**
 * Part of a sphere around the head, from `phi0` round `phiLen`, between two edges that can follow any curve. Laid out
 * like three's SphereGeometry (x = −r·cos φ·sin θ, y = r·cos θ, z = r·sin φ·sin θ) so it lines up with the face.
 */
function patch(key: string, r: number, phi0: number, phiLen: number, top: Edge, bottom: Edge, seg = 56, rows = 10) {
	const id = `${key}|${r}|${phi0.toFixed(3)}|${phiLen.toFixed(3)}|${seg}|${rows}`;
	const hit = patches.get(id);
	if (hit) return hit;
	const pos: number[] = [];
	const nor: number[] = [];
	for (let iy = 0; iy <= rows; iy++)
		for (let ix = 0; ix <= seg; ix++) {
			const u = ix / seg;
			const t0 = top(u);
			const theta = t0 + ((bottom(u) - t0) * iy) / rows;
			const phi = phi0 + u * phiLen;
			const nx = -Math.cos(phi) * Math.sin(theta);
			const ny = Math.cos(theta);
			const nz = Math.sin(phi) * Math.sin(theta);
			pos.push(nx * R * r, ny * R * r, nz * R * r);
			nor.push(nx, ny, nz);
		}
	const index: number[] = [];
	for (let iy = 0; iy < rows; iy++)
		for (let ix = 0; ix < seg; ix++) {
			const a = iy * (seg + 1) + ix + 1;
			const b = iy * (seg + 1) + ix;
			const c = (iy + 1) * (seg + 1) + ix;
			const d = (iy + 1) * (seg + 1) + ix + 1;
			index.push(a, b, d, b, c, d);
		}
	const g = new BufferGeometry();
	g.setIndex(index);
	g.setAttribute("position", new Float32BufferAttribute(pos, 3));
	g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
	patches.set(id, g);
	return g;
}

function Patch({
	id,
	r = 1.07,
	phi = [0, Math.PI * 2],
	top = flat(0),
	bottom,
	c,
	map,
}: {
	id: string;
	r?: number;
	phi?: [number, number];
	top?: Edge;
	bottom: Edge;
	c: string;
	map?: ReturnType<typeof fabric>;
}) {
	return (
		<mesh>
			<primitive object={patch(id, r, phi[0], phi[1], top, bottom)} attach="geometry" />
			<Mat c={c} side="double" {...(map !== undefined && { map })} />
		</mesh>
	);
}

const locks3 = new Map<string, LatheGeometry>();
/** A lock of hair: round at the root, tapering to a point that curls a little forward. Hangs down from its top. */
function lockGeometry(r: number, len: number, curl: number) {
	const key = `${r}|${len}|${curl}`;
	let g = locks3.get(key);
	if (!g) {
		const pts: Vector2[] = [];
		const n = 12;
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			// Full through the middle, a quick taper at the end.
			const w = r * (t < 0.15 ? 0.75 + (t / 0.15) * 0.25 : 1 - ((t - 0.15) / 0.85) ** 2.2 * 0.92);
			pts.push(new Vector2(Math.max(0.004, w), -t * len));
		}
		pts.push(new Vector2(0.001, -len - r * 0.05));
		g = new LatheGeometry(pts, 12);
		// Bend the lower part forward, so the end of the lock curls.
		const p = g.attributes.position!;
		for (let i = 0; i < p.count; i++) {
			const t = -p.getY(i) / len;
			p.setZ(i, p.getZ(i) * 0.72 + curl * t ** 2.5);
		}
		g.computeVertexNormals();
		locks3.set(key, g);
	}
	return g;
}

function Lock({ r, len, c, p, rot, curl = 0.08 }: { r: number; len: number; c: string; p?: V3; rot?: V3; curl?: number }) {
	return (
		<group position={p} rotation={rot}>
			<M c={c}>
				<primitive object={lockGeometry(r, len, curl)} attach="geometry" />
			</M>
		</group>
	);
}

// ── Pieces ──

/** How far down the back of the head hair grows (theta; the neck meets the head at about 2.7). */
const NAPE = 2.25;
/**
 * An edge at `theta` all round that rises over the forehead to `front`, a hairline curving up off the face, and dips
 * at the back to `nape`, so the back of the head is hair down to the neck (between the ears, which stay clear).
 */
const hairline =
	(theta: number, front = 0.95, nape = NAPE): Edge =>
	(u) =>
		theta - Math.max(0, theta - front) * Math.exp(-(((u - 0.25) / 0.1) ** 2)) + Math.max(0, nape - theta) * napeAt(u);
/** How much of the drop to the nape an edge takes at u: all of it across the back, easing off before the ears. */
const napeAt = (u: number) => {
	const d = Math.abs(u - 0.75);
	return d < 0.1 ? 1 : d > 0.21 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (d - 0.1)) / 0.11);
};
const cap = (c: string, theta = 1.3, r = 1.07) => <Patch id={`cap${theta}`} c={c} bottom={hairline(theta)} r={r} />;
/** The hair at the back of the head, its lower edge cut into the ends of locks. Leaves the face clear. */
const back = (c: string, theta = 1.95) => (
	<Patch
		id={`back${theta}`}
		c={darker(c, 0.1)}
		top={flat(0.8)}
		bottom={points(theta, 0.22, 7)}
		phi={[FRONT + 1.1, Math.PI * 2 - 2.2]}
		r={1.08}
	/>
);
/** A fringe across the forehead, straight, swept to one side, or parted; its edge is the ends of little locks. */
const fringe = (c: string, kind: "straight" | "swept" | "part") => {
	if (kind === "part")
		return (
			<>
				{[-1, 1].map((s) => (
					<group key={s} rotation={[0, s * 0.42, 0]}>
						<Patch
							id={`fringe-part${s}`}
							c={c}
							top={flat(0.5)}
							bottom={points(1.0, 0.16, 3, s * 0.6)}
							phi={[FRONT - 0.42, 0.84]}
							r={1.09}
						/>
					</group>
				))}
			</>
		);
	if (kind === "swept")
		return (
			<group rotation={[0, 0, -0.25]}>
				<Patch id="fringe-swept" c={c} top={flat(0.55)} bottom={points(0.92, 0.2, 5, 0.8)} phi={[FRONT - 0.95, 1.9]} r={1.09} />
			</group>
		);
	return <Patch id="fringe" c={c} top={flat(0.55)} bottom={points(0.9, 0.14, 7)} phi={[FRONT - 1, 2]} r={1.09} />;
};
/** A lighter, warmer shade of a hair colour, for where it catches the light. */
const gloss = (c: string) => `#${new Color(c).offsetHSL(0.01, 0.05, 0.09).getHexString()}`;
/** An edge that bows `depth` away from `theta` in the middle and meets it at both ends. */
const bow =
	(theta: number, depth: number): Edge =>
	(u) =>
		theta + depth * Math.sin(Math.PI * u) ** 0.8;
/**
 * Shine on the crown, as cartoon hair catches the light: one crescent, pointed at both ends and off to the side the
 * sun comes from (a full band across the front reads as a headband on dark hair).
 */
const shine = (c: string, r = 1.1) => (
	<Patch id="shine" c={gloss(c)} top={bow(0.8, -0.08)} bottom={bow(0.8, 0.05)} phi={[FRONT - 0.3, 1.05]} r={r} />
);
/** A long panel of hair down the back, to `to` below the head's centre, ending in the points of a few locks. */
const panel = (c: string, to: number, w = 1.05) => (
	<>
		<M p={[0, -to / 2 + 0.05, -R * 0.55]} c={darker(c, 0.12)} s={[w, 1, 0.45]}>
			<capsuleGeometry args={[R * 0.8, Math.max(0.05, to - R * 1.4), 6, 16]} />
		</M>
		{[-0.32, 0, 0.32].map((x, i) => (
			<Lock key={x} r={0.17} len={0.38 + (i % 2) * 0.06} c={darker(c, 0.12)} p={[x * w, -to + R * 0.5, -R * 0.55]} curl={-0.05} />
		))}
	</>
);
/** Locks falling in front of the shoulders. */
const locks = (c: string, len: number, r = 0.12, spread = 0.82) => (
	<>
		{[-1, 1].map((s) => (
			<Lock key={s} r={r} len={len} c={c} p={[s * R * spread, -0.1, R * 0.2]} rot={[0.1, 0, s * 0.08]} />
		))}
	</>
);
/** Whether a point (head coordinates) is over the face: in front, between the cheeks, below the hairline. */
export const overFace = (p: V3) => p[2] > R * 0.2 && Math.abs(p[0]) < R * 0.75 && p[1] < R * 0.62;

/**
 * Where the balls of a cloud of curls or coils go. Any that would land over the face go up onto the crown instead,
 * so the curls frame the face rather than cover it.
 */
export function cloudPoints(n: number, rx: number, ry: number, cy: number, rz = rx): V3[] {
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		const t = ((i * 7) % n) / n;
		const p: V3 = [Math.cos(a) * rx, cy + Math.sin(a * 2) * ry * 0.3 + (t - 0.5) * ry, Math.sin(a) * rz - 0.1];
		return overFace(p) ? [p[0] * 0.8, R * 0.72 + t * 0.12, R * 0.38] : p;
	});
}
/** The curl clouds each style is built from: [count, rx, ry, cy, ball radius, rz]. */
export const CLOUDS: Record<string, [number, number, number, number, number, number][]> = {
	"hair-curly": [
		[22, R * 1.02, 0.7, 0.05, 0.24, R * 0.95],
		[8, R * 0.7, 0.2, 0.5, 0.22, R * 0.7],
	],
	"hair-coily": [[18, R * 1.3, 0.6, 0.3, 0.2, R * 1.2]],
};
const clouds = (style: string, c: string) =>
	CLOUDS[style]!.map(([n, rx, ry, cy, br, rz], k) =>
		cloudPoints(n, rx, ry, cy, rz).map((p, i) => <Ball key={`${k}-${i}`} r={br} p={p} c={i % 3 ? c : darker(c, 0.12)} />),
	);

type Style = { fixed: (c: string) => ReactNode; swing?: (c: string) => { at: V3; node: ReactNode }[] };

const STYLES: Record<string, Style> = {
	"hair-buzz": { fixed: (c) => cap(c, 1.4, 1.06) },
	"hair-pixie": {
		fixed: (c) => (
			<>
				{cap(c, 1.3)}
				{back(c, 1.75)}
				{fringe(c, "swept")}
				{shine(c)}
			</>
		),
	},
	"hair-bob": {
		fixed: (c) => (
			<>
				{cap(c, 1.3)}
				{fringe(c, "straight")}
				<Patch
					id="bob"
					c={darker(c, 0.05)}
					top={flat(0.9)}
					bottom={points(2.15, 0.1, 11)}
					phi={[FRONT + 0.8, Math.PI * 2 - 1.6]}
					r={1.12}
				/>
				{shine(c)}
			</>
		),
	},
	"hair-long": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c)}
				{fringe(c, "part")}
				{shine(c)}
				{panel(c, 1.4)}
				{locks(c, 0.95)}
			</>
		),
	},
	"hair-wavy": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c)}
				{fringe(c, "part")}
				{shine(c)}
				{[0, 1, 2, 3].map((i) => (
					<Ball
						key={i}
						r={R * (0.72 - i * 0.04)}
						p={[i % 2 ? 0.08 : -0.08, -0.45 - i * 0.28, -R * 0.55]}
						c={darker(c, 0.1)}
						s={[1.3, 0.8, 0.5]}
					/>
				))}
				{[-1, 1].map((s) => (
					<Lock key={s} r={0.13} len={0.9} c={c} p={[s * R * 0.82, -0.1, R * 0.2]} rot={[0.1, 0, s * 0.08]} curl={0.16} />
				))}
			</>
		),
	},
	"hair-curly": {
		fixed: (c) => (
			<>
				{cap(c, 1.4)}
				{clouds("hair-curly", c)}
			</>
		),
	},
	"hair-coily": {
		fixed: (c) => (
			<>
				{cap(c, 1.25)}
				{/* The big round shape sits back from the face, so it frames it like a halo. */}
				<Ball r={R * 1.34} p={[0, 0.3, -0.3]} c={darker(c, 0.05)} />
				{clouds("hair-coily", c)}
			</>
		),
	},
	"hair-puffs": {
		fixed: (c) => (
			<>
				{cap(c, 1.3)}
				{[-1, 1].map((s) => (
					<group key={s}>
						<Ball r={0.36} p={[s * R * 0.85, R * 0.75, -0.05]} c={c} />
						<Ball r={0.2} p={[s * R * 0.72, R * 0.88, 0.12]} c={gloss(c)} />
					</group>
				))}
			</>
		),
	},
	"hair-locs": {
		fixed: (c) => (
			<>
				{cap(c, 1.32)}
				{Array.from({ length: 11 }, (_, i) => {
					const a = Math.PI * 0.15 + (i / 10) * Math.PI * 0.7;
					return (
						<Lock
							key={i}
							r={0.07}
							len={1.05 + (i % 3) * 0.12}
							c={i % 2 ? c : darker(c, 0.12)}
							p={[Math.cos(a) * R * 0.98, 0.05, -Math.sin(a) * R * 0.85]}
							rot={[-0.08, 0, Math.cos(a) * 0.12]}
							curl={0}
						/>
					);
				})}
				{locks(c, 1, 0.07, 0.9)}
			</>
		),
	},
	"hair-braids": {
		fixed: (c) => (
			<>
				{cap(c, 1.32)}
				{Array.from({ length: 12 }, (_, i) => {
					const a = Math.PI * 0.12 + (i / 11) * Math.PI * 0.76;
					return (
						<group key={i} position={[Math.cos(a) * R * 0.98, 0.05, -Math.sin(a) * R * 0.85]} rotation={[-0.06, 0, Math.cos(a) * 0.1]}>
							<Braid c={i % 2 ? c : darker(c, 0.15)} len={1.35} r={0.055} />
						</group>
					);
				})}
				{[-1, 1].map((s) => (
					<group key={s} position={[s * R * 0.92, -0.1, R * 0.2]} rotation={[0.1, 0, s * 0.08]}>
						<Braid c={c} len={1.25} r={0.055} />
					</group>
				))}
			</>
		),
	},
	"hair-cornrows": {
		fixed: (c) => <Patch id="cornrows" c={c} bottom={hairline(1.4)} r={1.06} map={fabric("stripes", c, darker(c, 0.3), [10, 1])} />,
	},
	"hair-pigtails": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c, 1.8)}
				{fringe(c, "part")}
				{shine(c)}
				{[-1, 1].map((s) => (
					<Ball key={s} r={0.07} p={[s * R * 1.02, 0.12, -0.05]} c="#e85d75" />
				))}
			</>
		),
		swing: (c) =>
			[-1, 1].map((s) => ({
				at: [s * R * 1.08, 0.12, -0.08] as V3,
				node: <Lock r={0.17} len={0.85} c={c} rot={[0, 0, s * 0.45]} curl={0.06} />,
			})),
	},
	"hair-ponytail": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c, 1.75)}
				{fringe(c, "swept")}
				{shine(c)}
				<Ball r={0.07} p={[0, R * 0.55, -R * 0.85]} c="#3cb6c9" />
			</>
		),
		swing: (c) => [{ at: [0, R * 0.55, -R * 0.95], node: <Lock r={0.19} len={1.0} c={darker(c, 0.08)} rot={[0.35, 0, 0]} curl={-0.12} /> }],
	},
	"hair-bun": {
		fixed: (c) => (
			<>
				{cap(c, 1.32)}
				{back(c, 1.7)}
				{shine(c)}
				<Ball r={0.3} p={[0, R * 1.08, -0.1]} c={c} />
				<M c={darker(c, 0.15)} p={[0, R * 1.08, -0.1]} r={[Math.PI / 2, 0, 0]}>
					<torusGeometry args={[0.3, 0.035, 8, 24]} />
				</M>
			</>
		),
	},
	"hair-spacebuns": {
		fixed: (c) => (
			<>
				{cap(c, 1.32)}
				{back(c, 1.7)}
				{fringe(c, "part")}
				{shine(c)}
				{[-1, 1].map((s) => (
					<Ball key={s} r={0.24} p={[s * R * 0.62, R * 0.92, -0.05]} c={c} />
				))}
			</>
		),
	},
	"hair-side": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c)}
				<group rotation={[0, 0, 0.35]}>
					<Patch id="side" c={c} top={flat(0.5)} bottom={points(1.15, 0.2, 4, -0.8)} phi={[FRONT - 1.1, 1.6]} r={1.1} />
				</group>
				{shine(c, 1.115)}
				{panel(c, 1.3)}
				<Lock r={0.14} len={1} c={c} p={[-R * 0.85, -0.08, R * 0.2]} rot={[0.1, 0, -0.06]} />
			</>
		),
	},
	"hair-mohawk": {
		fixed: (c) => (
			<>
				{cap(darker(c, 0.35), 1.4, 1.06)}
				{[-0.35, -0.12, 0.1, 0.32].map((z, i) => (
					<Cone key={z} r={0.12} h={0.42 - Math.abs(i - 1.5) * 0.05} p={[0, R * 1.02, z]} c={c} rot={[-0.15 + i * 0.1, 0, 0]} />
				))}
			</>
		),
	},
	"hair-princess": {
		fixed: (c) => (
			<>
				{cap(c)}
				{back(c)}
				{fringe(c, "part")}
				{shine(c)}
				{panel(c, 2.0, 1.15)}
				{[-1, 1].map((s) => (
					<Lock key={s} r={0.14} len={1.4} c={c} p={[s * R * 0.82, -0.1, R * 0.2]} rot={[0.1, 0, s * 0.08]} curl={0.14} />
				))}
			</>
		),
	},
};

/** A braid: beads of hair down a thin core, alternating a little side to side, with a tie at the end. */
function Braid({ c, len, r }: { c: string; len: number; r: number }) {
	const n = Math.round(len / (r * 1.7));
	return (
		<>
			{/* Small low-poly beads: a head of braids is a couple of hundred of them. */}
			{Array.from({ length: n }, (_, i) => (
				<M key={i} c={i % 2 ? c : darker(c, 0.08)} p={[(i % 2 ? 1 : -1) * r * 0.25, -(i + 0.5) * r * 1.7, 0]} s={[1, 1.1, 0.85]}>
					<sphereGeometry args={[r * 1.15, 8, 6]} />
				</M>
			))}
			<Ball r={r * 0.9} p={[0, -len - r * 0.4, 0]} c="#e85d75" />
		</>
	);
}

export const HAIR_3D = new Set(Object.keys(STYLES));

/** The hair that stays put on the head. */
export function Hair3D({ item, c }: { item: string; c: string }) {
	const style = STYLES[item];
	return style ? <group>{style.fixed(c)}</group> : null;
}

/** The pieces of a style that swing (a ponytail, pigtails), each with the point it hangs from. */
export const hairSwing = (item: string, c: string) => STYLES[item]?.swing?.(c) ?? [];
