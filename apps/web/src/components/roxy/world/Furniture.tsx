import type { Furniture as FurnitureDef } from "@jade/core/roxy";
import { type ReactNode, useMemo } from "react";
import { type BufferGeometry, Color, DataTexture, NearestFilter, RedFormat } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Furniture built from soft, rounded shapes in code: toy-like, flat pastel colour with a three-step toon shade, so
 * the 3D room sits well with Roxy's 2D illustration. Each piece is drawn centred on its footprint, its back to -z.
 */

type V3 = [number, number, number];

/** Three-step toon shading, shared by everything in the room. */
let gradient: DataTexture | undefined;
export function toonGradient() {
	if (!gradient) {
		gradient = new DataTexture(new Uint8Array([165, 215, 255]), 3, 1, RedFormat);
		gradient.minFilter = NearestFilter;
		gradient.magFilter = NearestFilter;
		gradient.needsUpdate = true;
	}
	return gradient;
}

export function Toon({ color, emissive, opacity }: { color: string; emissive?: number; opacity?: number }) {
	return (
		<meshToonMaterial
			color={color}
			gradientMap={toonGradient()}
			{...(emissive && { emissive: new Color(color), emissiveIntensity: emissive })}
			{...(opacity !== undefined && { transparent: true, opacity })}
		/>
	);
}

const geometries = new Map<string, BufferGeometry>();
function rounded(w: number, h: number, d: number) {
	const key = `${w}|${h}|${d}`;
	let g = geometries.get(key);
	if (!g) {
		g = new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.22);
		geometries.set(key, g);
	}
	return g;
}

/** A rounded box, positioned by its centre. */
export function B({ s, p, c, e, o }: { s: V3; p: V3; c: string; e?: number; o?: number }) {
	return (
		<mesh position={p} geometry={rounded(...s)}>
			<Toon color={c} {...(e && { emissive: e })} {...(o !== undefined && { opacity: o })} />
		</mesh>
	);
}
export function Cyl({
	r,
	r2,
	h,
	p,
	c,
	rot,
	e,
	seg = 24,
}: {
	r: number;
	r2?: number;
	h: number;
	p: V3;
	c: string;
	rot?: V3;
	e?: number;
	seg?: number;
}) {
	return (
		<mesh position={p} rotation={rot}>
			<cylinderGeometry args={[r, r2 ?? r, h, seg]} />
			<Toon color={c} {...(e && { emissive: e })} />
		</mesh>
	);
}
export function Ball({ r, p, c, s, e }: { r: number; p: V3; c: string; s?: V3; e?: number }) {
	return (
		<mesh position={p} scale={s}>
			<sphereGeometry args={[r, 20, 14]} />
			<Toon color={c} {...(e && { emissive: e })} />
		</mesh>
	);
}

export const WOOD = "#c9965f";
export const WOOD_DARK = "#9c6b3f";
export const WHITE = "#f6f1e7";
export const LEAF = "#5fa04a";
/** Leaf greens for the sunny and shady sides of a plant (mixing in white turns toon leaves grey). */
export const LEAF_LIGHT = "#7dbf52";
export const LEAF_DARK = "#4a8a3a";
export const POT = "#d9734a";
export const GOLD = "#e8b93c";

export const lighter = (hex: string, amount = 0.35) => `#${new Color(hex).lerp(new Color("#ffffff"), amount).getHexString()}`;

const flame = (p: V3) => <Ball r={0.06} p={p} c="#f4cd4b" s={[1, 1.6, 1]} e={0.9} />;
const candles = (n: number, colours: (i: number) => string, y: number, span: number) =>
	Array.from({ length: n }, (_, i) => {
		const x = -span / 2 + (span * i) / (n - 1);
		return (
			<group key={i}>
				<Cyl r={0.035} h={0.22} p={[x, y + 0.11, 0]} c={colours(i)} seg={8} />
				{flame([x, y + 0.3, 0])}
			</group>
		);
	});

type Build = (o: { w: number; d: number; c: string }) => ReactNode;

const bed: Build = ({ w, d, c }) => (
	<>
		<B s={[w, 0.35, d]} p={[0, 0.18, 0]} c={WOOD} />
		<B s={[w - 0.1, 0.22, d - 0.1]} p={[0, 0.46, 0]} c={WHITE} />
		<B s={[w - 0.04, 0.14, d * 0.62]} p={[0, 0.58, d * 0.18]} c={c} />
		<B s={[w * 0.7, 0.16, 0.42]} p={[0, 0.63, -d / 2 + 0.36]} c={WHITE} />
		<B s={[w, 0.95, 0.14]} p={[0, 0.48, -d / 2 + 0.07]} c={WOOD_DARK} />
	</>
);

const BUILDS: Record<string, Build> = {
	bed,
	bunkbed: (o) => (
		<>
			{bed(o)}
			<group position={[0, 1.15, 0]}>{bed({ ...o, c: lighter(o.c, 0.2) })}</group>
			{[-1, 1].flatMap((sx) =>
				[-1, 1].map((sz) => (
					<B key={`${sx}${sz}`} s={[0.12, 2.2, 0.12]} p={[(sx * o.w) / 2, 1.1, (sz * o.d) / 2 - sz * 0.06]} c={WOOD_DARK} />
				)),
			)}
			<B s={[0.1, 1.2, 0.5]} p={[o.w / 2 + 0.05, 1, o.d / 2 - 0.4]} c={WOOD} />
		</>
	),
	dresser: ({ w }) => (
		<>
			<B s={[w * 0.95, 0.95, 0.7]} p={[0, 0.48, 0]} c={WOOD} />
			{[0.25, 0.5, 0.75].map((y) => (
				<group key={y}>
					<B s={[w * 0.85, 0.2, 0.04]} p={[0, y, 0.35]} c={lighter(WOOD)} />
					<Ball r={0.04} p={[0, y, 0.39]} c={GOLD} />
				</group>
			))}
		</>
	),
	wardrobe: ({ w }) => (
		<>
			<B s={[w * 0.95, 2.1, 0.75]} p={[0, 1.05, 0]} c={WOOD} />
			<B s={[0.03, 1.9, 0.04]} p={[0, 1.05, 0.38]} c={WOOD_DARK} />
			{[-0.12, 0.12].map((x) => (
				<Ball key={x} r={0.05} p={[x, 1.05, 0.4]} c={GOLD} />
			))}
		</>
	),
	nightstand: () => (
		<>
			<B s={[0.75, 0.6, 0.6]} p={[0, 0.3, 0]} c={WOOD} />
			<Cyl r={0.08} h={0.2} p={[0, 0.7, 0]} c={WHITE} />
			<Cyl r={0.1} r2={0.18} h={0.18} p={[0, 0.88, 0]} c="#f2c94c" e={0.4} />
		</>
	),
	lamp: ({ c }) => (
		<>
			<Cyl r={0.22} h={0.06} p={[0, 0.03, 0]} c={WOOD_DARK} />
			<Cyl r={0.03} h={1.5} p={[0, 0.8, 0]} c={WOOD_DARK} seg={8} />
			<Cyl r={0.2} r2={0.36} h={0.4} p={[0, 1.6, 0]} c={c} e={0.35} />
		</>
	),
	toybox: ({ c }) => (
		<>
			<B s={[0.85, 0.55, 0.6]} p={[0, 0.28, 0]} c={c} />
			<B s={[0.9, 0.08, 0.65]} p={[0, 0.58, 0]} c={lighter(c)} />
			<Ball r={0.16} p={[0.1, 0.78, 0]} c="#3d74c9" />
		</>
	),
	"rug-round": ({ w, d, c }) => (
		<>
			<Cyl r={Math.min(w, d) / 2 - 0.1} h={0.03} p={[0, 0.015, 0]} c={c} seg={40} />
			<Cyl r={Math.min(w, d) / 2 - 0.45} h={0.035} p={[0, 0.02, 0]} c={lighter(c)} seg={40} />
		</>
	),
	"rug-long": ({ w, d, c }) => (
		<>
			<B s={[w - 0.15, 0.03, d - 0.15]} p={[0, 0.015, 0]} c={c} />
			<B s={[w - 0.6, 0.035, d - 0.6]} p={[0, 0.02, 0]} c={lighter(c)} />
		</>
	),
	sofa: ({ w, c }) => (
		<>
			<B s={[w, 0.42, 0.9]} p={[0, 0.25, 0]} c={c} />
			<B s={[w, 0.65, 0.28]} p={[0, 0.62, -0.32]} c={c} />
			{[-1, 1].map((s) => (
				<B key={s} s={[0.28, 0.6, 0.9]} p={[s * (w / 2 - 0.14), 0.42, 0]} c={lighter(c, 0.1)} />
			))}
			{[-0.6, 0.6].map((x) => (
				<B key={x} s={[1, 0.14, 0.62]} p={[x * (w / 3), 0.52, 0.08]} c={lighter(c, 0.25)} />
			))}
		</>
	),
	armchair: ({ c }) => (
		<>
			<B s={[0.9, 0.4, 0.85]} p={[0, 0.25, 0]} c={c} />
			<B s={[0.9, 0.65, 0.25]} p={[0, 0.6, -0.3]} c={c} />
			{[-1, 1].map((s) => (
				<B key={s} s={[0.2, 0.55, 0.85]} p={[s * 0.4, 0.4, 0]} c={lighter(c, 0.1)} />
			))}
		</>
	),
	beanbag: ({ c }) => <Ball r={0.45} p={[0, 0.28, 0]} c={c} s={[1, 0.65, 1]} />,
	table: () => (
		<>
			<Cyl r={0.85} h={0.1} p={[0, 0.75, 0]} c={WOOD} seg={32} />
			<Cyl r={0.08} h={0.7} p={[0, 0.36, 0]} c={WOOD_DARK} seg={12} />
			<Cyl r={0.35} h={0.05} p={[0, 0.03, 0]} c={WOOD_DARK} seg={20} />
			<Cyl r={0.12} r2={0.09} h={0.18} p={[0.25, 0.89, 0.1]} c="#5fa3e0" />
		</>
	),
	chair: ({ c }) => (
		<>
			<B s={[0.6, 0.1, 0.6]} p={[0, 0.46, 0]} c={c} />
			<B s={[0.6, 0.6, 0.08]} p={[0, 0.8, -0.26]} c={c} />
			{[-1, 1].flatMap((sx) =>
				[-1, 1].map((sz) => <B key={`${sx}${sz}`} s={[0.07, 0.45, 0.07]} p={[sx * 0.25, 0.22, sz * 0.25]} c={WOOD_DARK} />),
			)}
		</>
	),
	bookshelf: ({ w }) => {
		const books = ["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b", "#8a5bd1", "#f08a3c"];
		return (
			<>
				<B s={[w * 0.95, 1.85, 0.45]} p={[0, 0.93, 0]} c={WOOD} />
				{[0.45, 1.05, 1.62].map((y, row) =>
					Array.from({ length: 7 }, (_, i) => (
						<B
							key={`${row}${i}`}
							s={[0.16, 0.42 - (i % 3) * 0.05, 0.3]}
							p={[-w * 0.4 + i * 0.26, y + 0.02, 0.1]}
							c={books[(i + row) % books.length]!}
						/>
					)),
				)}
			</>
		);
	},
	tv: ({ w }) => (
		<>
			<B s={[w * 0.9, 0.5, 0.5]} p={[0, 0.25, 0]} c={WOOD} />
			<B s={[w * 0.8, 0.85, 0.08]} p={[0, 0.98, -0.1]} c="#2b2b33" />
			<B s={[w * 0.72, 0.7, 0.02]} p={[0, 0.98, -0.05]} c="#5fa3e0" e={0.5} />
		</>
	),
	plant: () => (
		<>
			<Cyl r={0.26} r2={0.2} h={0.45} p={[0, 0.23, 0]} c={POT} />
			<Ball r={0.36} p={[0, 0.85, 0]} c={LEAF} />
			<Ball r={0.26} p={[0.18, 1.15, 0.05]} c={LEAF_LIGHT} />
			<Ball r={0.22} p={[-0.2, 1.1, -0.05]} c={LEAF} />
		</>
	),
	"plant-small": () => (
		<>
			<Cyl r={0.17} r2={0.13} h={0.3} p={[0, 0.15, 0]} c={POT} />
			<Ball r={0.22} p={[0, 0.48, 0]} c={LEAF} />
		</>
	),
	desk: ({ w }) => (
		<>
			<B s={[w * 0.95, 0.08, 0.8]} p={[0, 0.76, 0]} c={WOOD} />
			{[-1, 1].map((s) => (
				<B key={s} s={[0.08, 0.72, 0.72]} p={[s * (w * 0.45), 0.36, 0]} c={WOOD_DARK} />
			))}
			<B s={[0.6, 0.04, 0.42]} p={[0.2, 0.82, 0.05]} c="#9aa3ad" />
			<B s={[0.6, 0.38, 0.03]} p={[0.2, 1.01, -0.16]} c="#5fa3e0" e={0.4} />
		</>
	),
	piano: ({ w }) => (
		<>
			<B s={[w * 0.95, 1.05, 0.62]} p={[0, 0.53, -0.05]} c="#2b2b33" />
			<B s={[w * 0.9, 0.06, 0.28]} p={[0, 0.75, 0.32]} c={WHITE} />
			{Array.from({ length: 10 }, (_, i) => (
				<B key={i} s={[0.06, 0.05, 0.14]} p={[-w * 0.4 + i * 0.18 + 0.09, 0.79, 0.26]} c="#2b2b33" />
			))}
			<B s={[0.6, 0.45, 0.4]} p={[0, 0.23, 0.75]} c="#2b2b33" />
		</>
	),
	drums: () => (
		<>
			<Cyl r={0.42} h={0.36} p={[0, 0.45, 0.1]} rot={[Math.PI / 2, 0, 0]} c="#d8413c" />
			<Cyl r={0.36} h={0.38} p={[0, 0.45, 0.1]} rot={[Math.PI / 2, 0, 0]} c={WHITE} />
			{[-0.5, 0.5].map((x) => (
				<Cyl key={x} r={0.22} h={0.22} p={[x, 0.75, 0]} c="#d8413c" />
			))}
			<Cyl r={0.32} h={0.02} p={[0.75, 1.15, -0.3]} c={GOLD} />
			<Cyl r={0.02} h={1.15} p={[0.75, 0.58, -0.3]} c="#9aa3ad" seg={6} />
			<Cyl r={0.2} h={0.08} p={[0, 0.45, 0.8]} c="#2b2b33" />
		</>
	),
	guitar: () => (
		<>
			<B s={[0.4, 0.06, 0.3]} p={[0, 0.03, 0]} c={WOOD_DARK} />
			<Ball r={0.22} p={[0, 0.32, 0]} c="#d9692e" s={[1, 1, 0.35]} />
			<Ball r={0.16} p={[0, 0.62, 0]} c="#d9692e" s={[1, 1, 0.35]} />
			<B s={[0.07, 0.65, 0.05]} p={[0, 1.05, 0]} c={WOOD_DARK} />
			<Cyl r={0.06} h={0.04} p={[0, 0.4, 0.08]} rot={[Math.PI / 2, 0, 0]} c="#2b2b33" />
		</>
	),
	bike: () => (
		<>
			{[-0.6, 0.6].map((z) => (
				<mesh key={z} position={[0, 0.32, z]} rotation={[0, Math.PI / 2, 0]}>
					<torusGeometry args={[0.28, 0.05, 10, 28]} />
					<Toon color="#2b2b33" />
				</mesh>
			))}
			<B s={[0.08, 0.08, 1.2]} p={[0, 0.55, 0]} c="#3cb6c9" />
			<B s={[0.08, 0.6, 0.08]} p={[0, 0.65, -0.35]} c="#3cb6c9" />
			<B s={[0.24, 0.08, 0.32]} p={[0, 0.98, -0.35]} c="#2b2b33" />
			<B s={[0.5, 0.06, 0.06]} p={[0, 1.05, 0.45]} c="#2b2b33" />
		</>
	),
	yoga: ({ w, d, c }) => <B s={[w * 0.8, 0.03, d * 0.92]} p={[0, 0.015, 0]} c={c} />,
	weights: ({ w }) => (
		<>
			<B s={[w * 0.9, 0.08, 0.5]} p={[0, 0.5, 0]} c="#9aa3ad" />
			{[-1, 1].map((s) => (
				<B key={s} s={[0.08, 0.5, 0.5]} p={[s * w * 0.42, 0.25, 0]} c="#9aa3ad" />
			))}
			{[-0.5, 0, 0.5].map((x) => (
				<group key={x}>
					<Cyl r={0.03} h={0.4} p={[x, 0.62, 0]} rot={[0, 0, Math.PI / 2]} c="#2b2b33" seg={8} />
					{[-0.17, 0.17].map((dx) => (
						<Cyl key={dx} r={0.09} h={0.07} p={[x + dx, 0.62, 0]} rot={[0, 0, Math.PI / 2]} c="#3d74c9" />
					))}
				</group>
			))}
		</>
	),
	easel: () => (
		<>
			{[-0.25, 0.25].map((x) => (
				<B key={x} s={[0.06, 1.5, 0.06]} p={[x, 0.75, 0.1]} c={WOOD} />
			))}
			<B s={[0.06, 1.4, 0.06]} p={[0, 0.7, -0.25]} c={WOOD} />
			<B s={[0.75, 0.6, 0.04]} p={[0, 1.15, 0.14]} c={WHITE} />
			{[
				["#e85d75", -0.15, 1.2],
				["#5fa3e0", 0.12, 1.08],
				["#f2c94c", 0.1, 1.28],
			].map(([c, x, y]) => (
				<Ball key={c as string} r={0.07} p={[x as number, y as number, 0.17]} c={c as string} s={[1, 1, 0.3]} />
			))}
		</>
	),
	telescope: () => (
		<>
			{[0, 2.1, 4.2].map((a) => (
				<B key={a} s={[0.05, 0.9, 0.05]} p={[Math.cos(a) * 0.18, 0.45, Math.sin(a) * 0.18]} c={WOOD_DARK} />
			))}
			<Cyl r={0.1} r2={0.13} h={0.8} p={[0.1, 1.05, 0]} rot={[0, 0, -0.9]} c="#3d74c9" />
		</>
	),
	petbed: ({ c }) => (
		<>
			<mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[0.32, 0.12, 12, 28]} />
				<Toon color={c} />
			</mesh>
			<Cyl r={0.3} h={0.08} p={[0, 0.06, 0]} c={lighter(c)} />
		</>
	),
	cattree: () => (
		<>
			<B s={[0.8, 0.08, 0.8]} p={[0, 0.04, 0]} c="#c9b28c" />
			<Cyl r={0.08} h={1.6} p={[0, 0.8, 0]} c="#e8d9b0" seg={10} />
			<B s={[0.6, 0.08, 0.6]} p={[0, 0.85, 0]} c="#c9b28c" />
			<Cyl r={0.3} h={0.15} p={[0, 1.65, 0]} c="#c9b28c" />
			<Ball r={0.08} p={[0.32, 0.65, 0]} c="#e85d75" />
		</>
	),
	aquarium: ({ w }) => (
		<>
			<B s={[w * 0.9, 0.6, 0.6]} p={[0, 0.3, 0]} c={WOOD} />
			<B s={[w * 0.85, 0.75, 0.55]} p={[0, 0.98, 0]} c="#7cc8e8" o={0.55} />
			{[
				[-0.3, 0.95, "#e8822e"],
				[0.25, 1.1, "#f2c94c"],
			].map(([x, y, c]) => (
				<Ball key={c as string} r={0.08} p={[x as number, y as number, 0.05]} c={c as string} s={[1.5, 1, 0.6]} />
			))}
			<Ball r={0.12} p={[0.5, 0.7, 0]} c={LEAF} s={[0.6, 1.6, 0.6]} />
		</>
	),
	// Holiday decorations.
	"xmas-tree": () => (
		<>
			<Cyl r={0.14} h={0.4} p={[0, 0.2, 0]} c={POT} />
			{[0, 1, 2].map((i) => (
				<Cyl key={i} r={0.01} r2={0.55 - i * 0.14} h={0.6} p={[0, 0.6 + i * 0.4, 0]} c="#2f9e6b" />
			))}
			<Ball r={0.09} p={[0, 1.65, 0]} c={GOLD} e={0.6} />
			{[
				[0.3, 0.55, 0.2, "#d8413c"],
				[-0.25, 0.85, 0.15, "#3cb6c9"],
				[0.15, 1.2, 0.12, "#f2c94c"],
			].map(([x, y, z, c]) => (
				<Ball key={c as string} r={0.06} p={[x as number, y as number, z as number]} c={c as string} e={0.3} />
			))}
		</>
	),
	menorah: () => (
		<>
			<B s={[0.8, 0.6, 0.5]} p={[0, 0.3, 0]} c={WOOD} />
			<Cyl r={0.04} h={0.3} p={[0, 0.75, 0]} c={GOLD} seg={8} />
			<B s={[0.7, 0.05, 0.06]} p={[0, 0.9, 0]} c={GOLD} />
			{candles(9, (i) => (i === 4 ? WHITE : "#bfe3f0"), 0.92, 0.64)}
		</>
	),
	kinara: () => (
		<>
			<B s={[0.8, 0.6, 0.5]} p={[0, 0.3, 0]} c={WOOD} />
			<B s={[0.7, 0.08, 0.14]} p={[0, 0.64, 0]} c={WOOD_DARK} />
			{candles(7, (i) => (i < 3 ? "#d8413c" : i === 3 ? "#2b2b33" : "#2f9e6b"), 0.68, 0.6)}
		</>
	),
	diyas: () => (
		<>
			<B s={[0.8, 0.3, 0.5]} p={[0, 0.15, 0]} c={WOOD} />
			{[-0.25, 0, 0.25].map((x) => (
				<group key={x}>
					<Ball r={0.1} p={[x, 0.32, 0]} c="#c77d5e" s={[1, 0.5, 1]} />
					{flame([x, 0.42, 0])}
				</group>
			))}
		</>
	),
	pumpkins: () => (
		<>
			{[
				[-0.15, 0, 0.32],
				[0.22, 0.1, 0.24],
				[0, -0.25, 0.2],
			].map(([x, z, r]) => (
				<group key={`${x}${z}`}>
					<Ball r={r!} p={[x!, r! * 0.75, z!]} c="#f08a3c" s={[1, 0.75, 1]} />
					<Cyl r={0.03} h={0.1} p={[x!, r! * 1.5, z!]} c="#2f9e6b" seg={6} />
				</group>
			))}
		</>
	),
};

/** Wall things, centred on their spot along the wall, facing into the room (+z). */
const WALL: Record<string, Build> = {
	window: ({ w }) => (
		<group position={[0, 1.75, 0]}>
			<B s={[w * 0.85, 1.15, 0.08]} p={[0, 0, 0]} c={WHITE} />
			<B s={[w * 0.75, 1, 0.02]} p={[0, 0, 0.04]} c="#bfe3f0" e={0.45} />
			<B s={[0.05, 1, 0.03]} p={[0, 0, 0.06]} c={WHITE} />
			<B s={[w * 0.75, 0.05, 0.03]} p={[0, 0, 0.06]} c={WHITE} />
			<B s={[w * 0.95, 0.08, 0.18]} p={[0, -0.6, 0.06]} c={WHITE} />
		</group>
	),
	picture: ({ c }) => (
		<group position={[0, 1.7, 0]}>
			<B s={[0.8, 0.62, 0.05]} p={[0, 0, 0]} c={WOOD} />
			<B s={[0.66, 0.48, 0.02]} p={[0, 0, 0.03]} c={c} />
			<Cyl r={0.08} h={0.02} p={[0.15, 0.08, 0.05]} rot={[Math.PI / 2, 0, 0]} c="#f2c94c" />
		</group>
	),
	clock: () => (
		<group position={[0, 2, 0]}>
			<Cyl r={0.28} h={0.06} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c="#e85d75" />
			<Cyl r={0.23} h={0.03} p={[0, 0, 0.03]} rot={[Math.PI / 2, 0, 0]} c={WHITE} />
			<B s={[0.03, 0.16, 0.02]} p={[0, 0.06, 0.05]} c="#2b2b33" />
			<B s={[0.12, 0.03, 0.02]} p={[0.05, 0, 0.05]} c="#2b2b33" />
		</group>
	),
	shelf: ({ w }) => (
		<group position={[0, 1.55, 0.15]}>
			<B s={[w * 0.9, 0.07, 0.3]} p={[0, 0, 0]} c={WOOD} />
			<Cyl r={0.1} r2={0.08} h={0.16} p={[-0.5, 0.12, 0]} c={POT} />
			<Ball r={0.13} p={[-0.5, 0.3, 0]} c={LEAF} />
			{["#3d74c9", "#f2c94c", "#e85d75"].map((c, i) => (
				<B key={c} s={[0.1, 0.3, 0.22]} p={[0.2 + i * 0.12, 0.18, 0]} c={c} />
			))}
		</group>
	),
	mirror: () => (
		<group position={[0, 1.7, 0]}>
			<mesh scale={[0.7, 1, 1]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[0.42, 0.42, 0.05, 32]} />
				<Toon color={GOLD} />
			</mesh>
			<mesh scale={[0.7, 1, 1]} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[0.36, 0.36, 0.02, 32]} />
				<Toon color="#d9eef5" emissive={0.35} />
			</mesh>
		</group>
	),
	lights: ({ w }) => (
		<group position={[0, 2.5, 0.05]}>
			{Array.from({ length: 9 }, (_, i) => {
				const t = i / 8;
				const x = -w * 0.45 + t * w * 0.9;
				const y = -Math.sin(t * Math.PI) * 0.25;
				return <Ball key={i} r={0.06} p={[x, y, 0]} c={["#f2c94c", "#e85d75", "#5fa3e0", "#5fc9a3"][i % 4]!} e={0.8} />;
			})}
		</group>
	),
	lanterns: ({ w }) => (
		<group position={[0, 2.4, 0.15]}>
			{[-1, 0, 1].map((i) => (
				<group key={i} position={[(i * w) / 3, -Math.abs(i) * -0.1, 0]}>
					<Ball r={0.17} p={[0, 0, 0]} c="#d8413c" s={[1, 0.85, 1]} e={0.3} />
					<Cyl r={0.08} h={0.06} p={[0, 0.17, 0]} c={GOLD} />
					<Cyl r={0.08} h={0.06} p={[0, -0.17, 0]} c={GOLD} />
				</group>
			))}
		</group>
	),
	crescent: () => (
		<group position={[0, 1.9, 0.08]}>
			<mesh rotation={[0, 0, -0.6]}>
				<torusGeometry args={[0.24, 0.07, 10, 24, Math.PI * 1.3]} />
				<Toon color={GOLD} emissive={0.4} />
			</mesh>
			<Ball r={0.09} p={[0.05, -0.38, 0]} c="#f2c94c" e={0.7} />
		</group>
	),
};

/** One piece of furniture, centred on the origin of its footprint (unturned). */
export function FurnitureMesh({ item, colour }: { item: FurnitureDef; colour: string | undefined }) {
	const build = (item.kind === "wall" ? WALL : BUILDS)[item.id];
	const node = useMemo(() => build?.({ w: item.w, d: item.d, c: colour ?? "#cccccc" }), [build, item, colour]);
	return <group>{node}</group>;
}

export const FURNITURE_ART = new Set([...Object.keys(BUILDS), ...Object.keys(WALL)]);
