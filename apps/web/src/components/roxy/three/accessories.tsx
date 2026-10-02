import type { ReactNode } from "react";
import { type Dims3, HEAD_R, onFace, Y } from "./body.tsx";
import { Ball, Cone, darker, Flat, Hang, heartShape, lighter, M, Mat, Ring, starShape, type V3 } from "./shapes.tsx";

/** Hats, glasses and earrings sit on the head (head coordinates); necklaces and bags on the body. */

const R = HEAD_R;
const GOLD = "#e8b93c";

// ── Hats ──

/** A dome over the head, down to `theta` (radians from the top). */
const dome = (c: string, theta = 1.25, r = 1.13) => (
	<mesh>
		<sphereGeometry args={[R * r, 32, 18, 0, Math.PI * 2, 0, theta]} />
		<Mat c={c} side="double" />
	</mesh>
);
const band = (c: string, y = R * 0.32, r = R * 1.1, tube = 0.06) => (
	<Ring r={r} tube={tube} p={[0, y, 0]} c={c} rot={[Math.PI / 2, 0, 0]} />
);
/** Things around the head like a crown of flowers. */
const around = (n: number, y: number, draw: (p: V3, i: number) => ReactNode) =>
	Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		return <group key={i}>{draw([Math.cos(a) * R * 0.95, y, Math.sin(a) * R * 0.95], i)}</group>;
	});
const flower = (p: V3, c: string, r = 0.06) => (
	<group position={p}>
		{[0, 1, 2, 3, 4].map((i) => {
			const a = (i / 5) * Math.PI * 2;
			return <Ball key={i} r={r} p={[Math.cos(a) * r, Math.sin(a) * r, 0]} c={c} />;
		})}
		<Ball r={r * 0.7} c="#f2c94c" />
	</group>
);
const hijab = (c: string, trim?: string) => (
	<group>
		<mesh>
			<sphereGeometry args={[R * 1.12, 32, 20, 0, Math.PI * 2, 0, 0.95]} />
			<Mat c={c} side="double" />
		</mesh>
		<mesh>
			<sphereGeometry args={[R * 1.12, 32, 20, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0.94, 1.7]} />
			<Mat c={c} side="double" />
		</mesh>
		<M c={darker(c, 0.08)} p={[0, -R * 1.0, -0.04]} s={[1, 1, 0.85]} side="double">
			<cylinderGeometry args={[R * 0.8, R * 0.95, 0.32, 28, 1, true]} />
		</M>
		{trim && <Ring r={R * 0.86} tube={0.025} p={[0, -0.05, R * 0.62]} c={trim} rot={[0, 0, 0]} />}
	</group>
);

export const HIDES_HAIR_3D = new Set(["hat-hijab", "hat-hijab-gold"]);

const HATS: Record<string, (c1: string, c2: string) => ReactNode> = {
	"hat-cap": (c) => (
		<>
			{dome(c, 1.2, 1.12)}
			<M c={darker(c, 0.15)} p={[0, R * 0.38, R * 0.85]} s={[1, 0.12, 1]}>
				<cylinderGeometry args={[0.4, 0.42, 0.2, 24, 1, false, -Math.PI / 2, Math.PI]} />
			</M>
		</>
	),
	"hat-beanie": (c) => (
		<>
			{dome(c, 1.3, 1.14)}
			{band(darker(c, 0.15), R * 0.25, R * 1.12, 0.08)}
		</>
	),
	"hat-bow": (c) => (
		<group position={[R * 0.5, R * 0.85, 0.1]} rotation={[0, 0, -0.3]}>
			{[-1, 1].map((s) => (
				<Ball key={s} r={0.16} p={[s * 0.15, 0, 0]} c={c} s={[1, 0.65, 0.5]} />
			))}
			<Ball r={0.07} c={darker(c, 0.15)} />
		</group>
	),
	"hat-headband": (c) => <Ring r={R * 1.04} tube={0.045} p={[0, R * 0.25, 0]} c={c} rot={[0, Math.PI / 2, 0]} arc={Math.PI} />,
	"hat-hijab": (c) => hijab(c),
	"hat-hijab-gold": (c) => hijab(c, GOLD),
	"hat-headwrap": (c1, c2) => (
		<>
			{dome(c1, 1.3, 1.15)}
			{band(c2, R * 0.55, R * 0.95, 0.06)}
			<Ball r={0.22} p={[0.05, R * 1.12, 0.05]} c={c1} />
		</>
	),
	"hat-flowers": () => <>{around(9, R * 0.5, (p, i) => flower(p, ["#e66fb0", "#f6b6c8", "#a873d9"][i % 3]!))}</>,
	"hat-crown": () => (
		<group position={[0, R * 0.95, 0]}>
			<M c={GOLD} side="double">
				<cylinderGeometry args={[0.3, 0.3, 0.18, 24, 1, true]} />
			</M>
			{[0, 1, 2, 3, 4].map((i) => {
				const a = (i / 5) * Math.PI * 2;
				return <Cone key={i} r={0.07} h={0.16} p={[Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3]} c={GOLD} />;
			})}
			{["#e85d75", "#5fa3e0", "#5fc9a3"].map((c, i) => (
				<Ball key={c} r={0.035} p={[(i - 1) * 0.15, 0.02, 0.29]} c={c} />
			))}
		</group>
	),
	// Holiday hats.
	"hat-newyear": () => (
		<>
			<Ring r={R * 1.04} tube={0.035} p={[0, R * 0.3, 0]} c={GOLD} rot={[0, Math.PI / 2, 0]} arc={Math.PI} />
			{[-0.25, 0, 0.25].map((x) => (
				<Flat key={x} shape={starShape(x === 0 ? 0.13 : 0.09)} c={GOLD} p={[x, R * 1.05 - Math.abs(x) * 0.4, R * 0.25]} />
			))}
		</>
	),
	"hat-hearts": () => (
		<>
			<Ring r={R * 1.04} tube={0.04} p={[0, R * 0.25, 0]} c="#e85d75" rot={[0, Math.PI / 2, 0]} arc={Math.PI} />
			{[-1, 1].map((s) => (
				<Flat key={s} shape={heartShape(0.1)} c="#e85d75" p={[s * 0.3, R * 1.3, 0]} />
			))}
		</>
	),
	"hat-springflowers": () => <>{[-0.3, 0, 0.3].map((x) => flower([x, R * 0.95 - Math.abs(x) * 0.3, R * 0.35], "#bfe3f0", 0.07))}</>,
	"hat-bunnyears": () => (
		<>
			<Ring r={R * 1.04} tube={0.04} p={[0, R * 0.25, 0]} c="#f7f3ea" rot={[0, Math.PI / 2, 0]} arc={Math.PI} />
			{[-1, 1].map((s) => (
				<group key={s} position={[s * 0.25, R * 1.25, 0]} rotation={[0, 0, -s * 0.2]}>
					<Ball r={0.11} c="#f7f3ea" s={[1, 3, 0.5]} />
					<Ball r={0.06} p={[0, 0, 0.04]} c="#f6b6c8" s={[1, 3.4, 0.4]} />
				</group>
			))}
		</>
	),
	"hat-leaves": () => (
		<>
			{around(12, R * 0.48, (p, i) => (
				<Ball r={0.07} p={p} c={i % 2 ? "#8cc152" : "#2f9e6b"} s={[0.6, 1, 1.6]} />
			))}
		</>
	),
	"hat-witch": () => (
		<group position={[0, R * 0.55, 0]}>
			<M c="#2b2b33" p={[0, 0.02, 0]}>
				<cylinderGeometry args={[0.85, 0.85, 0.04, 32]} />
			</M>
			<Cone r={0.5} h={1} p={[0, 0.52, 0]} c="#2b2b33" rot={[-0.15, 0, 0.1]} />
			<M c="#8a5bd1" p={[0, 0.1, 0]}>
				<cylinderGeometry args={[0.46, 0.5, 0.1, 28, 1, true]} />
			</M>
		</group>
	),
	"hat-marigolds": () => <>{around(10, R * 0.5, (p, i) => flower(p, i % 2 ? "#f08a3c" : "#f4cd4b", 0.065))}</>,
	"hat-autumnbeanie": (c) => (
		<>
			{dome(c, 1.3, 1.14)}
			{band(darker(c, 0.18), R * 0.25, R * 1.12, 0.08)}
			<Ball r={0.08} p={[0.3, R * 1.0, 0.2]} c="#b5452a" s={[1, 0.4, 1.6]} />
		</>
	),
	"hat-pompom": (c) => (
		<>
			{dome(c, 1.3, 1.14)}
			{band("#e8e2f0", R * 0.25, R * 1.12, 0.08)}
			<Ball r={0.16} p={[0, R * 1.15, 0]} c="#e8e2f0" />
		</>
	),
	"hat-santa": () => (
		<>
			{dome("#d8413c", 1.15, 1.14)}
			<Cone r={0.42} h={0.7} p={[0.15, R * 1.2, -0.1]} rot={[0, 0, -0.7]} c="#d8413c" />
			<Ball r={0.11} p={[0.5, R * 1.45, -0.1]} c="#f7f3ea" />
			{band("#f7f3ea", R * 0.38, R * 1.1, 0.1)}
		</>
	),
	"hat-gele": () => (
		<>
			{dome("#f4cd4b", 1.35, 1.2)}
			<Ball r={0.35} p={[0.15, R * 1.05, 0]} c="#f4cd4b" s={[1.6, 0.8, 1.1]} />
			<Ball r={0.22} p={[0.6, R * 1.1, 0]} c="#d9692e" s={[1.3, 0.6, 0.9]} />
		</>
	),
};

export const HATS_3D = new Set(Object.keys(HATS));
export function Hat({ item, c1, c2 }: { item: string; c1: string; c2: string }) {
	const draw = HATS[item];
	return draw ? <group>{draw(c1, c2)}</group> : null;
}

// ── Glasses ──

const GLASSES: Record<string, { seg: number; turn?: number; shape?: "heart" | "star" }> = {
	"glasses-round": { seg: 28 },
	"glasses-square": { seg: 4, turn: Math.PI / 4 },
	"glasses-heart": { seg: 28, shape: "heart" },
	"glasses-star": { seg: 28, shape: "star" },
	"glasses-newyear": { seg: 6, turn: Math.PI / 6 },
};
export const GLASSES_3D = new Set(Object.keys(GLASSES));

export function Glasses({ item, c }: { item: string; c: string }) {
	const g = GLASSES[item];
	if (!g) return null;
	const eyes = [onFace(163, 186, 0.08), onFace(237, 186, 0.08)];
	return (
		<group>
			{eyes.map((p, i) =>
				g.shape ? (
					<Flat
						key={i}
						shape={g.shape === "heart" ? heartShape(0.13) : starShape(0.17, 5, 0.55)}
						c={c}
						p={[p[0], p[1], p[2] - 0.01]}
						depth={0.025}
					/>
				) : (
					<Ring key={i} r={0.13} tube={0.02} p={p} c={c} rot={[0, 0, g.turn ?? 0]} seg={g.seg} />
				),
			)}
			<M c={c} p={[0, eyes[0]![1] + 0.03, eyes[0]![2] + 0.02]} r={[0, 0, Math.PI / 2]}>
				<cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
			</M>
			{[-1, 1].map((s) => (
				<M key={s} c={c} p={[s * R * 0.86, eyes[0]![1], 0.2]} r={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
				</M>
			))}
		</group>
	);
}

// ── Earrings ──

const EARRINGS: Record<string, (p: V3) => ReactNode> = {
	"earrings-studs": (p) => <Ball r={0.035} p={p} c="#bfe3f0" />,
	"earrings-hoops": (p) => <Ring r={0.07} tube={0.012} p={[p[0], p[1] - 0.06, p[2]]} c={GOLD} rot={[0, Math.PI / 2, 0]} />,
	"earrings-stars": (p) => <Flat shape={starShape(0.06)} c={GOLD} p={[p[0], p[1] - 0.06, p[2]]} rot={[0, Math.PI / 2, 0]} />,
	"earrings-drops": (p) => <Ball r={0.04} p={[p[0], p[1] - 0.09, p[2]]} c="#8a5bd1" s={[1, 1.5, 1]} />,
	"earrings-pearls": (p) => <Ball r={0.045} p={[p[0], p[1] - 0.04, p[2]]} c="#f7f3ea" />,
	"earrings-lantern": (p) => <Ball r={0.05} p={[p[0], p[1] - 0.1, p[2]]} c="#d8413c" s={[1, 1.3, 1]} />,
	"earrings-crescent": (p) => (
		<Ring r={0.05} tube={0.015} p={[p[0], p[1] - 0.08, p[2]]} c={GOLD} rot={[0, Math.PI / 2, 0.6]} arc={Math.PI * 1.3} />
	),
	"earrings-jhumka": (p) => <Cone r={0.05} h={0.08} p={[p[0], p[1] - 0.1, p[2]]} c={GOLD} />,
};
export const EARRINGS_3D = new Set(Object.keys(EARRINGS));
export function Earrings({ item }: { item: string }) {
	const draw = EARRINGS[item];
	if (!draw) return null;
	return (
		<>
			{[-1, 1].map((s) => (
				<group key={s}>{draw([s * R * 0.99, -0.16, 0.02])}</group>
			))}
		</>
	);
}

// ── Necklaces (body coordinates) ──

const beads = (n: number, r: number, colour: (i: number) => string, size = 0.035, y = Y.neck - 0.08, depth = 0.8) =>
	Array.from({ length: n }, (_, i) => {
		const a = Math.PI * 0.15 + (i / (n - 1)) * Math.PI * 0.7;
		return <Ball key={i} r={size} p={[-Math.cos(a) * r, y - Math.sin(a) * 0.06, Math.sin(a) * r * depth]} c={colour(i)} />;
	});

const NECKLACES: Record<string, (c1: string, d: Dims3) => ReactNode> = {
	"necklace-heart": (_, d) => (
		<>
			<Ring r={0.17} tube={0.008} p={[0, Y.neck - 0.08, 0.02]} c={GOLD} rot={[1.3, 0, 0]} />
			<Flat shape={heartShape(0.05)} c={GOLD} p={[0, Y.neck - 0.17, d.shoulder * d.depth * 0.75]} />
		</>
	),
	"necklace-beads": (c1) => <>{beads(9, 0.17, (i) => (i % 2 ? c1 : lighter(c1, 0.4)))}</>,
	"necklace-pearls": () => <>{beads(11, 0.17, () => "#f7f3ea", 0.03)}</>,
	"necklace-choker": (c1) => <Ring r={0.115} tube={0.025} p={[0, Y.neck + 0.03, 0]} c={c1} rot={[Math.PI / 2, 0, 0]} />,
	"necklace-marigold": (_, d) => <>{beads(13, 0.24, (i) => (i % 2 ? "#f08a3c" : "#f4cd4b"), 0.06, Y.neck - 0.14, d.depth + 0.2)}</>,
	"necklace-crescent": (_, d) => (
		<>
			<Ring r={0.17} tube={0.008} p={[0, Y.neck - 0.08, 0.02]} c={GOLD} rot={[1.3, 0, 0]} />
			<Ring r={0.05} tube={0.015} p={[0, Y.neck - 0.18, d.shoulder * d.depth * 0.75]} c={GOLD} rot={[0, 0, 0.6]} arc={Math.PI * 1.3} />
		</>
	),
	"necklace-scarf": (c1, d) => (
		<>
			<Ring r={0.15} tube={0.07} p={[0, Y.neck - 0.02, 0]} c={c1} rot={[Math.PI / 2, 0, 0]} />
			<Hang r={0.06} len={0.4} c={c1} p={[0.1, Y.neck - 0.05, d.shoulder * d.depth * 0.7]} />
		</>
	),
	"necklace-kwanzaa": () => <>{beads(11, 0.18, (i) => ["#d8413c", "#2b2b33", "#2f9e6b"][i % 3]!, 0.038)}</>,
};
export const NECKLACES_3D = new Set(Object.keys(NECKLACES));
export function Necklace({ item, c1, d }: { item: string; c1: string; d: Dims3 }) {
	const draw = NECKLACES[item];
	return draw ? <group>{draw(c1, d)}</group> : null;
}

// ── Bags ──

/** Where a bag goes: on the back, at the hip on a strap, or in the left hand (hand coordinates). */
export type BagPlace = "back" | "hip" | "hand";
const BAGS: Record<string, { at: BagPlace; draw: (c1: string, d: Dims3) => ReactNode }> = {
	"bag-backpack": {
		at: "back",
		draw: (c1, d) => (
			<>
				<M c={c1} p={[0, 1.3, -d.shoulder * d.depth - 0.12]} s={[1, 1, 0.55]}>
					<capsuleGeometry args={[0.26, 0.2, 6, 14]} />
				</M>
				{[-1, 1].map((s) => (
					<M key={s} c={darker(c1, 0.15)} p={[s * d.shoulder * 0.55, 1.35, 0]} s={[1, 1, d.depth + 0.12]}>
						<torusGeometry args={[d.shoulder * 0.62, 0.02, 6, 20]} />
					</M>
				))}
			</>
		),
	},
	"bag-purse": {
		at: "hip",
		draw: (c1) => (
			<M c={c1} s={[1, 0.8, 0.45]}>
				{<boxGeometry args={[0.26, 0.22, 0.2]} />}
			</M>
		),
	},
	"bag-tote": {
		at: "hand",
		draw: (c1) => (
			<M c={c1} p={[0, -0.2, 0]}>
				{<boxGeometry args={[0.3, 0.32, 0.12]} />}
			</M>
		),
	},
	"bag-fan": {
		at: "hand",
		draw: () => (
			<M c="#d8413c" p={[0, 0.05, 0.06]} r={[0, 0, Math.PI / 2]} side="double">
				<circleGeometry args={[0.24, 18, 0, Math.PI]} />
			</M>
		),
	},
	"bag-heart": { at: "hip", draw: (c1) => <Flat shape={heartShape(0.13)} c={c1} depth={0.08} /> },
	"bag-lantern": {
		at: "hand",
		draw: () => (
			<>
				<Ball r={0.12} p={[0, -0.22, 0]} c={GOLD} s={[1, 1.3, 1]} emissive={0.3} />
				<M c={GOLD} p={[0, -0.08, 0]}>
					<cylinderGeometry args={[0.008, 0.008, 0.14, 6]} />
				</M>
			</>
		),
	},
	"bag-basket": {
		at: "hand",
		draw: () => (
			<>
				<M c="#c9a26b" p={[0, -0.22, 0]}>
					<cylinderGeometry args={[0.18, 0.13, 0.16, 18]} />
				</M>
				{["#f6b6c8", "#bfe3f0", "#f4cd4b"].map((c, i) => (
					<Ball key={c} r={0.05} p={[(i - 1) * 0.08, -0.12, 0]} c={c} s={[1, 1.3, 1]} />
				))}
				<Ring r={0.15} tube={0.012} p={[0, -0.14, 0]} c="#b0894f" arc={Math.PI} />
			</>
		),
	},
	"bag-earthtote": {
		at: "hand",
		draw: (c1) => (
			<M c={c1} p={[0, -0.2, 0]}>
				{<boxGeometry args={[0.3, 0.32, 0.12]} />}
			</M>
		),
	},
};
export const BAGS_3D = new Set(Object.keys(BAGS));
export const bagPlace = (item: string | undefined): BagPlace | null => (item ? (BAGS[item]?.at ?? null) : null);
export function Bag({ item, c1, d }: { item: string; c1: string; d: Dims3 }) {
	const bag = BAGS[item];
	return bag ? <group>{bag.draw(c1, d)}</group> : null;
}
