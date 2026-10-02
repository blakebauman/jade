import { bodyProfile, type Dims3, Y } from "./body.tsx";
import { Ball, Cone, darker, Flat, fabric, Hang, heartShape, lathe, lighter, M, type Pattern, Ring, starShape } from "./shapes.tsx";

/**
 * 3D clothes: shells around the body, each piece described by a few numbers (how far the sleeves go, where the hem
 * is, the fabric pattern) rather than modelled one by one. Tops, dresses and jackets go on the torso; sleeves go on
 * the arms and trousers, socks and shoes on the legs, so they move with the limbs.
 */

export type Wear = { c1: string; c2: string };

// ── Specs ──

type TopSpec = {
	sleeve: number;
	pattern?: Pattern;
	/** Where the hem sits: crop (above the waist), normal, or tunic (over the hips). */
	hem?: "crop" | "normal" | "tunic";
	motif?: "star" | "heart" | "planet";
	collar?: boolean;
	hood?: boolean;
	buttons?: boolean;
	/** Fixed colours, for holiday pieces drawn in their own palette. */
	fixed?: Wear;
};

const TOPS: Record<string, TopSpec> = {
	"top-tee": { sleeve: 0.45 },
	"top-stripes": { sleeve: 0.45, pattern: "stripes" },
	"top-tank": { sleeve: 0 },
	"top-long": { sleeve: 1 },
	"top-crop": { sleeve: 0.45, hem: "crop" },
	"top-polo": { sleeve: 0.45, collar: true, buttons: true },
	"top-ruffle": { sleeve: 0, pattern: "ribs" },
	"top-star": { sleeve: 0.45, motif: "star" },
	"top-heart": { sleeve: 0.45, motif: "heart" },
	"top-hoodie": { sleeve: 1, hood: true },
	"top-sweater": { sleeve: 1, pattern: "zigzag" },
	"top-sequin": { sleeve: 0, pattern: "sequin" },
	"top-lunar": { sleeve: 1, buttons: true, collar: true },
	"top-holi": { sleeve: 1, hem: "tunic", pattern: "splash" },
	"top-passover": { sleeve: 0.45, collar: true },
	"top-earth": { sleeve: 0.45, motif: "planet", fixed: { c1: "#3d74c9", c2: "#8cc152" } },
	"top-flannel": { sleeve: 1, pattern: "check", collar: true, fixed: { c1: "#b5452a", c2: "#2b2b33" } },
	"top-hanukkah": { sleeve: 1, pattern: "zigzag", fixed: { c1: "#3d74c9", c2: "#e8e2f0" } },
	"top-xmas": { sleeve: 1, pattern: "zigzag" },
	"top-kente": { sleeve: 0.45, pattern: "kente", fixed: { c1: "#e0a526", c2: "#2f9e6b" } },
};

type BottomSpec = { kind: "pants" | "shorts" | "skirt" | "tutu"; tight?: boolean; pattern?: Pattern; pockets?: boolean; bib?: boolean };
const BOTTOMS: Record<string, BottomSpec> = {
	"bottom-jeans": { kind: "pants" },
	"bottom-leggings": { kind: "pants", tight: true },
	"bottom-shorts": { kind: "shorts" },
	"bottom-skirt": { kind: "skirt" },
	"bottom-pleated": { kind: "skirt", pattern: "pleats" },
	"bottom-cargo": { kind: "pants", pockets: true },
	"bottom-overalls": { kind: "pants", bib: true },
	"bottom-tutu": { kind: "tutu" },
};

type DressSpec = {
	sleeve: number;
	/** Hem height: knee is ~0.55, floor ~0.15. */
	hem: number;
	flare: number;
	pattern?: Pattern;
	/** Pattern on the skirt only. */
	skirt?: Pattern;
	sash?: boolean;
	pants?: boolean;
	trim?: boolean;
};
const DRESSES: Record<string, DressSpec> = {
	"dress-simple": { sleeve: 0.4, hem: 0.62, flare: 0.16 },
	"dress-sun": { sleeve: 0, hem: 0.6, flare: 0.2, skirt: "bands" },
	"dress-stripe": { sleeve: 0.4, hem: 0.62, flare: 0.16, pattern: "stripes" },
	"dress-dots": { sleeve: 0.4, hem: 0.62, flare: 0.18, pattern: "dots" },
	"dress-tiered": { sleeve: 0, hem: 0.5, flare: 0.28, skirt: "bands" },
	"dress-jumpsuit": { sleeve: 0, hem: 1, flare: 0, pants: true },
	"dress-party": { sleeve: 0.25, hem: 0.5, flare: 0.32, skirt: "sequin", sash: true },
	"dress-gown": { sleeve: 0, hem: 0.12, flare: 0.5, skirt: "sequin" },
	"dress-newyear": { sleeve: 0, hem: 0.58, flare: 0.22, pattern: "sequin" },
	"dress-qipao": { sleeve: 0.25, hem: 0.35, flare: 0.04, trim: true },
	"dress-valentine": { sleeve: 0.4, hem: 0.58, flare: 0.24, skirt: "hearts" },
	"dress-abaya": { sleeve: 1, hem: 0.14, flare: 0.16, trim: true },
	"dress-spring": { sleeve: 0.4, hem: 0.6, flare: 0.2, skirt: "flowers" },
	"dress-easter": { sleeve: 0.25, hem: 0.58, flare: 0.24, skirt: "zigzag" },
	"dress-kaftan": { sleeve: 0.7, hem: 0.16, flare: 0.22, trim: true },
	"dress-pumpkin": { sleeve: 0, hem: 0.62, flare: 0.36, skirt: "pleats" },
	"dress-dia": { sleeve: 0.25, hem: 0.5, flare: 0.3, skirt: "flowers" },
	"dress-lehenga": { sleeve: 0.3, hem: 0.12, flare: 0.5, skirt: "sequin", sash: true },
};

type OuterSpec = { kind: "open" | "closed" | "cape"; sleeve: number; hem?: number; pattern?: Pattern; collar?: boolean; lining?: string };
const OUTER: Record<string, OuterSpec> = {
	"outer-denim": { kind: "open", sleeve: 1, collar: true },
	"outer-cardigan": { kind: "open", sleeve: 1, hem: 0.88 },
	"outer-raincoat": { kind: "closed", sleeve: 1, hem: 0.72 },
	"outer-puffer": { kind: "closed", sleeve: 1, pattern: "ribs" },
	"outer-blazer": { kind: "open", sleeve: 1, collar: true },
	"outer-cape": { kind: "cape", sleeve: 0 },
	"outer-bat": { kind: "cape", sleeve: 0, lining: "#8a5bd1" },
	"outer-vest": { kind: "open", sleeve: 0, pattern: "ribs" },
};

export const CLOTHES_3D = new Set([...Object.keys(TOPS), ...Object.keys(BOTTOMS), ...Object.keys(DRESSES), ...Object.keys(OUTER)]);

// ── Torso pieces ──

const EXTRA = 0.03;

function shell(d: Dims3, y0: number, y1: number, c: string, pattern: Pattern = "plain", c2 = c, extra = EXTRA, open?: number) {
	return (
		<group scale={[1, 1, d.depth]}>
			<M c={c} map={fabric(pattern, c, c2)} side="double">
				<primitive object={lathe(bodyProfile(d, y0, y1, extra), open ? { open } : {})} attach="geometry" />
			</M>
		</group>
	);
}

/** The front of the chest, for motifs and buttons: on the surface, facing forward. */
const chest = (d: Dims3, _y: number) => (d.waist + (d.shoulder - d.waist) * 0.7 + EXTRA + 0.01) * d.depth;

function motif(kind: TopSpec["motif"], d: Dims3, c2: string) {
	const z = chest(d, 1.4);
	if (kind === "planet")
		return (
			<group position={[0, 1.38, z]}>
				<M c="#5fa3e0" s={[1, 1, 0.3]}>
					<sphereGeometry args={[0.12, 18, 12]} />
				</M>
				<M c={c2} p={[-0.03, 0.02, 0.03]} s={[1, 0.7, 0.3]}>
					<sphereGeometry args={[0.06, 12, 8]} />
				</M>
			</group>
		);
	const shape = kind === "heart" ? heartShape(0.12) : starShape(0.14);
	return <Flat shape={shape} c={c2} p={[0, 1.38, z]} />;
}

export function Top({ item, d, w }: { item: string; d: Dims3; w: Wear }) {
	const spec = TOPS[item];
	if (!spec) return null;
	const { c1, c2 } = spec.fixed ?? w;
	const y0 = spec.hem === "crop" ? Y.waist - 0.04 : spec.hem === "tunic" ? Y.hip - 0.22 : Y.hip - 0.03;
	return (
		<group>
			{shell(d, y0, Y.neck - 0.03, c1, spec.pattern, c2)}
			{spec.hem === "tunic" && <Cone r={d.hip + 0.07} r2={d.hip + EXTRA} h={0.24} p={[0, Y.hip - 0.1, 0]} c={c1} />}
			{spec.motif && motif(spec.motif, d, c2)}
			{spec.collar &&
				[-1, 1].map((s) => (
					<M
						key={s}
						c={spec.fixed ? darker(c1, 0.2) : c2}
						p={[s * 0.08, Y.neck - 0.07, chest(d, 1.55) * 0.75]}
						r={[0.5, 0, s * 0.6]}
						s={[1, 1, 0.3]}
					>
						<boxGeometry args={[0.14, 0.1, 0.06]} />
					</M>
				))}
			{spec.buttons &&
				[1.2, 1.32, 1.44].map((y) => <Ball key={y} r={0.02} p={[0, y, chest(d, y) + 0.005]} c={spec.fixed ? "#e8b93c" : c2} />)}
			{spec.hood && (
				<M c={darker(c1, 0.1)} p={[0, Y.neck - 0.02, -0.18]} s={[1.1, 0.6, 0.8]}>
					<sphereGeometry args={[0.26, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
				</M>
			)}
		</group>
	);
}

export function Dress({ item, d, w }: { item: string; d: Dims3; w: Wear }) {
	const spec = DRESSES[item];
	if (!spec) return null;
	const { c1, c2 } = w;
	if (spec.pants) return <>{shell(d, Y.hip - 0.05, Y.neck - 0.03, c1)}</>;
	const top = Y.waist + 0.02;
	const skirtH = top - spec.hem;
	return (
		<group>
			{shell(d, Y.waist - 0.06, Y.neck - 0.03, c1, spec.pattern ?? "plain", c2)}
			<group position={[0, top - skirtH / 2, 0]} scale={[1, 1, d.depth + 0.08]}>
				<M c={c1} map={fabric(spec.skirt ?? spec.pattern ?? "plain", c1, c2, [8, 2])} side="double">
					<cylinderGeometry args={[d.waist + EXTRA + 0.01, d.hip + EXTRA + spec.flare + skirtH * 0.12, skirtH, 36, 1, true]} />
				</M>
			</group>
			{spec.sash && <Ring r={d.waist + EXTRA + 0.02} tube={0.035} p={[0, Y.waist, 0]} c={c2} rot={[Math.PI / 2, 0, 0]} />}
			{spec.trim && <Ring r={0.13} tube={0.022} p={[0, Y.neck - 0.04, 0]} c="#e8b93c" rot={[Math.PI / 2, 0, 0]} />}
		</group>
	);
}

export function Outer({ item, d, w }: { item: string; d: Dims3; w: Wear }) {
	const spec = OUTER[item];
	if (!spec) return null;
	const { c1 } = w;
	if (spec.kind === "cape")
		return (
			<group>
				<group scale={[1, 1, d.depth + 0.3]}>
					<M c={c1} side="double">
						<primitive
							object={lathe(
								[
									[d.shoulder + 0.06, Y.neck - 0.08],
									[d.shoulder + 0.18, Y.waist],
									[d.hip + 0.36, 0.35],
								],
								{ back: true },
							)}
							attach="geometry"
						/>
					</M>
				</group>
				{spec.lining && (
					<group scale={[0.97, 1, d.depth + 0.27]}>
						<M c={spec.lining} side="double">
							<primitive
								object={lathe(
									[
										[d.shoulder + 0.05, Y.neck - 0.12],
										[d.shoulder + 0.16, Y.waist],
										[d.hip + 0.33, 0.4],
									],
									{ back: true },
								)}
								attach="geometry"
							/>
						</M>
					</group>
				)}
				<Ball r={0.05} p={[0, Y.neck - 0.08, 0.12]} c="#e8b93c" />
			</group>
		);
	const hem = spec.hem ?? Y.hip - 0.06;
	return (
		<group>
			{shell(d, hem, Y.neck - 0.04, c1, spec.pattern ?? "plain", darker(c1, 0.15), EXTRA + 0.035, spec.kind === "open" ? 0.32 : undefined)}
			{spec.collar &&
				[-1, 1].map((s) => (
					<M key={s} c={darker(c1, 0.15)} p={[s * 0.12, Y.neck - 0.1, chest(d, 1.55) * 0.82]} r={[0.3, s * 0.4, s * 0.5]} s={[1, 1, 0.3]}>
						<boxGeometry args={[0.12, 0.22, 0.05]} />
					</M>
				))}
		</group>
	);
}

/** Sleeves for whatever the torso wears: the outer layer's if it has sleeves, else the top's or dress's. */
export function sleeveFor(
	top?: string,
	dress?: string,
	outer?: string,
): { len: number; c: "outer" | "top" | "dress"; puffy?: boolean } | null {
	const o = outer && OUTER[outer];
	if (o && o.sleeve > 0) return { len: o.sleeve, c: "outer", puffy: o.pattern === "ribs" };
	const t = top && TOPS[top];
	if (t) return t.sleeve > 0 ? { len: t.sleeve, c: "top" } : null;
	const dr = dress && DRESSES[dress];
	if (dr) return dr.sleeve > 0 ? { len: dr.sleeve, c: "dress", puffy: dr.sleeve <= 0.25 } : null;
	return null;
}

export const topFixed = (item: string | undefined) => (item ? TOPS[item]?.fixed : undefined);
export const topPattern = (item: string | undefined) => (item ? TOPS[item]?.pattern : undefined);

/** A sleeve over an arm (in the arm's own coordinates, hanging down from the shoulder). */
export function Sleeve({
	len,
	armLen,
	armR,
	c,
	map,
	puffy,
}: {
	len: number;
	armLen: number;
	armR: number;
	c: string;
	map?: ReturnType<typeof fabric>;
	puffy?: boolean;
}) {
	if (puffy) return <Ball r={armR * 2} p={[0, -armR * 0.8, 0]} c={c} s={[1, 0.9, 1]} />;
	return (
		<Hang r={armR + 0.025} len={Math.max(armR * 2.4, armLen * len)} c={c} p={[0, armR * 0.6, 0]} {...(map !== undefined && { map })} />
	);
}

// ── Leg pieces (in the leg's own coordinates: origin at the hip joint, hanging down) ──

const LEG_LEN = Y.hip - Y.ankle;

export function LegWear({ bottom, dress, d, w, dressW }: { bottom?: string; dress?: string; d: Dims3; w: Wear; dressW: Wear }) {
	const b = bottom ? BOTTOMS[bottom] : undefined;
	const dr = dress ? DRESSES[dress] : undefined;
	if (dr?.pants) return <Hang r={d.leg + 0.05} len={LEG_LEN - 0.04} c={dressW.c1} p={[0, 0.04, 0]} />;
	if (!b || b.kind === "skirt" || b.kind === "tutu") return null;
	const len = b.kind === "shorts" ? 0.36 : LEG_LEN - 0.06;
	return (
		<group>
			<Hang r={d.leg + (b.tight ? 0.015 : 0.045)} len={len} c={w.c1} p={[0, 0.06, 0]} />
			{b.pockets && (
				<M c={darker(w.c1, 0.12)} p={[d.leg * 0.9, -0.45, 0]} s={[0.4, 1, 1]}>
					{<boxGeometry args={[0.1, 0.16, 0.14]} />}
				</M>
			)}
		</group>
	);
}

/** What a bottom puts around the hips: the seat of trousers, a skirt, a tutu, an overalls bib. */
export function Hips({ item, d, w }: { item: string; d: Dims3; w: Wear }) {
	const b = BOTTOMS[item];
	if (!b) return null;
	const { c1 } = w;
	const seat = shell(d, Y.hip - 0.12, Y.waist - 0.02, c1, "plain", c1, EXTRA + 0.01);
	if (b.kind === "skirt" || b.kind === "tutu") {
		const h = b.kind === "tutu" ? 0.3 : 0.42;
		const flare = b.kind === "tutu" ? 0.32 : 0.16;
		return (
			<group>
				{seat}
				<group position={[0, Y.waist - 0.04 - h / 2, 0]} scale={[1, 1, d.depth + 0.1]}>
					<M c={c1} map={fabric(b.pattern ?? "plain", c1, darker(c1, 0.2), [10, 1])} side="double">
						<cylinderGeometry args={[d.waist + EXTRA + 0.01, d.hip + flare, h, 36, 1, true]} />
					</M>
					{b.kind === "tutu" && (
						<M c={lighter(c1, 0.25)} p={[0, 0.05, 0]} side="double">
							<cylinderGeometry args={[d.waist + EXTRA + 0.02, d.hip + flare * 0.8, h * 0.75, 36, 1, true]} />
						</M>
					)}
				</group>
			</group>
		);
	}
	return (
		<group>
			{seat}
			{b.bib && (
				<group>
					<M c={c1} p={[0, Y.waist + 0.12, chest(d, Y.waist) - 0.02]} s={[1, 1, 0.3]}>
						<boxGeometry args={[0.28, 0.26, 0.08]} />
					</M>
					{[-1, 1].map((s) => (
						<M key={s} c={c1} p={[s * 0.12, Y.shoulder - 0.06, 0]} r={[0, 0, 0]} s={[1, 1, d.depth]}>
							<torusGeometry args={[d.shoulder * 0.55, 0.025, 6, 16, Math.PI]} />
						</M>
					))}
				</group>
			)}
		</group>
	);
}

// ── Socks and shoes (leg coordinates) ──

type SockSpec = { to: number; pattern?: Pattern };
const SOCKS: Record<string, SockSpec> = {
	"socks-ankle": { to: 0.22 },
	"socks-knee": { to: 0.5 },
	"socks-stripe": { to: 0.5, pattern: "stripes" },
	"socks-tights": { to: LEG_LEN },
};
export function Sock({ item, d, w }: { item: string; d: Dims3; w: Wear }) {
	const s = SOCKS[item];
	if (!s) return null;
	return <Hang r={d.leg + 0.012} len={s.to} c={w.c1} p={[0, -LEG_LEN + s.to, 0]} map={fabric(s.pattern ?? "plain", w.c1, w.c2, [3, 4])} />;
}

type ShoeSpec = {
	boot?: number;
	sole?: "c2" | "white" | "dark";
	low?: boolean;
	straps?: boolean;
	ears?: boolean;
	wheels?: boolean;
	curl?: boolean;
	fixed?: string;
};
const SHOES: Record<string, ShoeSpec> = {
	"shoes-sneakers": { sole: "c2" },
	"shoes-hightops": { boot: 0.22, sole: "white" },
	"shoes-flats": { low: true },
	"shoes-sandals": { low: true, straps: true },
	"shoes-boots": { boot: 0.38, sole: "dark" },
	"shoes-rainboots": { boot: 0.34 },
	"shoes-maryjanes": { low: true, straps: true },
	"shoes-cowboy": { boot: 0.36, sole: "dark" },
	"shoes-slippers": { ears: true },
	"shoes-skates": { boot: 0.2, sole: "white", wheels: true },
	"shoes-elf": { curl: true },
};
export const SHOES_3D = new Set(Object.keys(SHOES));
export const SOCKS_3D = new Set(Object.keys(SOCKS));

export function Foot({ item, d, w, skin }: { item?: string; d: Dims3; w: Wear; skin: string }) {
	const y = -LEG_LEN;
	const fw = d.leg * 2.1;
	if (!item || !SHOES[item])
		return (
			<M c={skin} p={[0, y - 0.05, 0.05]} s={[1, 0.6, 1.4]}>
				<sphereGeometry args={[d.leg * 1.05, 16, 12]} />
			</M>
		);
	const s = SHOES[item]!;
	const soleC = s.sole === "c2" ? w.c2 : s.sole === "white" ? "#f7f3ea" : s.sole === "dark" ? darker(w.c1, 0.45) : darker(w.c1, 0.2);
	return (
		<group position={[0, y, 0]}>
			{s.boot && <Hang r={d.leg + 0.03} len={s.boot} c={w.c1} p={[0, s.boot - 0.02, 0]} />}
			<M c={s.straps ? skin : w.c1} p={[0, -0.05, 0.06]} s={[1, s.low ? 0.45 : 0.62, 1.45]}>
				<sphereGeometry args={[fw / 2 + 0.01, 18, 12]} />
			</M>
			{s.straps && <Ring r={fw / 2} tube={0.018} p={[0, -0.03, 0.08]} c={w.c1} rot={[0, 0, 0]} />}
			<M c={soleC} p={[0, -0.1, 0.06]} s={[1, 0.18, 1.5]}>
				<sphereGeometry args={[fw / 2 + 0.02, 18, 10]} />
			</M>
			{s.ears && [-1, 1].map((e) => <Ball key={e} r={0.04} p={[e * 0.05, 0.04, 0.12]} c={w.c1} s={[0.8, 2, 0.6]} />)}
			{s.wheels && [-0.08, 0.2].map((z) => <Ball key={z} r={0.045} p={[0, -0.14, z]} c={w.c2} />)}
			{s.curl && <Cone r={0.05} h={0.2} p={[0, 0, 0.26]} rot={[-1.1, 0, 0]} c={w.c1} />}
		</group>
	);
}
