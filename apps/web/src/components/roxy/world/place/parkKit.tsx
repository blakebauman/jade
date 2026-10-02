import { useFrame } from "@react-three/fiber";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import {
	BoxGeometry,
	type BufferGeometry,
	Color,
	ConeGeometry,
	DoubleSide,
	type Group,
	type InstancedMesh,
	Object3D,
	Shape,
	SphereGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { Static } from "../batch.tsx";
import { B, Cyl, GOLD, LEAF, LEAF_DARK, LEAF_LIGHT, Toon, toonGradient, WHITE, WOOD, WOOD_DARK } from "../Furniture.tsx";
import { useNight } from "../light.tsx";
import { useWake } from "../pace.tsx";
import type { Block } from "../path.ts";
import { type Area, canvasTexture, Shadow } from "../stage.tsx";

/**
 * The park's own pieces: mown grass, a cobbled path with an edging, the pond, the picket fence, planting, the lamp,
 * and the five finds as little toys. Repeated things (tufts, daisies, pickets, pebbles) are one instanced mesh each.
 */

type V3 = [number, number, number];

/**
 * A ball, like the furniture's, but with fewer faces the smaller it is (the park has hundreds of little ones) and
 * one shared geometry per size class.
 */
const balls = new Map<number, SphereGeometry>();
function Ball({ r, p, c, s, e }: { r: number; p: V3; c: string; s?: V3; e?: number }) {
	const seg = r < 0.05 ? 7 : r < 0.12 ? 10 : 14;
	let g = balls.get(seg);
	if (!g) {
		g = new SphereGeometry(1, seg, Math.ceil(seg * 0.7));
		balls.set(seg, g);
	}
	const scale: V3 = s ? [s[0] * r, s[1] * r, s[2] * r] : [r, r, r];
	return (
		<mesh position={p} scale={scale} geometry={g}>
			<Toon color={c} {...(e && { emissive: e })} />
		</mesh>
	);
}

/** The same scatter every visit, so the park doesn't rearrange itself. */
function seeded(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const inside = (b: Block, x: number, z: number, pad: number) =>
	"r" in b ? (x - b.cx) ** 2 + (z - b.cz) ** 2 < (b.r + pad) ** 2 : x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

/** `n` spots on the grass, clear of the path, the pond and everything in `avoid`. */
export function scatter(n: number, seed: number, area: Area, avoid: readonly Block[], pad = 0.15): [number, number][] {
	const rand = seeded(seed);
	const out: [number, number][] = [];
	for (let tries = 0; out.length < n && tries < n * 30; tries++) {
		const x = 0.4 + rand() * (area.w - 0.8);
		const z = 0.5 + rand() * (area.d - 0.8);
		if (z > PATH.z0 - 0.15 && z < PATH.z1 + 0.15) continue;
		if (avoid.some((b) => inside(b, x, z, pad))) continue;
		out.push([x, z]);
	}
	return out;
}

/** One instanced mesh: `geometry` at each spot, turned and sized a little differently, coloured from `colours`. */
function Scattered({
	geometry,
	spots,
	colours,
	seed,
	y = 0,
	size = [0.8, 1.3],
}: {
	geometry: BufferGeometry;
	spots: readonly (readonly [number, number])[];
	colours: readonly string[];
	seed: number;
	y?: number;
	size?: [number, number];
}) {
	const ref = useRef<InstancedMesh>(null);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const rand = seeded(seed);
		const t = new Object3D();
		const c = new Color();
		for (const [i, [x, z]] of spots.entries()) {
			t.position.set(x, y, z);
			t.rotation.set(0, rand() * Math.PI * 2, 0);
			t.scale.setScalar(size[0] + rand() * (size[1] - size[0]));
			t.updateMatrix();
			m.setMatrixAt(i, t.matrix);
			m.setColorAt(i, c.set(colours[Math.floor(rand() * colours.length)]!));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
		m.computeBoundingSphere();
	}, [spots, colours, seed, y, size]);
	return (
		// Too small and low to cast a shadow worth drawing, so they're left out of the shadow pass (they still receive).
		<instancedMesh ref={ref} args={[geometry, undefined, spots.length]} receiveShadow userData={{ noShadow: true }}>
			<Toon color="#ffffff" />
		</instancedMesh>
	);
}

// ── Grass ──

/** Mown grass: soft stripes from the mower, patches of lighter and darker green, clover and the odd daisy. */
export const parkGrass = (area: Area) =>
	canvasTexture(
		256,
		256,
		(ctx) => {
			ctx.fillStyle = "#9ccf76";
			ctx.fillRect(0, 0, 256, 256);
			// Mowing stripes, two to a tile, running along the path.
			ctx.fillStyle = "rgba(255,255,220,0.09)";
			ctx.fillRect(0, 0, 256, 64);
			ctx.fillRect(0, 128, 256, 64);
			const rand = seeded(7);
			const blob = (x: number, y: number, r: number, c: string) => {
				ctx.fillStyle = c;
				ctx.beginPath();
				ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
				ctx.fill();
			};
			for (let i = 0; i < 26; i++)
				blob(rand() * 256, rand() * 256, 10 + rand() * 18, i % 2 ? "rgba(70,130,50,0.07)" : "rgba(220,240,160,0.08)");
			// Blades: short strokes in two greens.
			for (let i = 0; i < 520; i++) {
				const x = rand() * 256;
				const y = rand() * 256;
				ctx.strokeStyle = i % 3 ? "rgba(62,120,44,0.22)" : "rgba(210,240,170,0.3)";
				ctx.lineWidth = 1.4;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + (rand() - 0.5) * 3, y - 4 - rand() * 3);
				ctx.stroke();
			}
			// Clover: three little leaves together.
			for (let i = 0; i < 14; i++) {
				const x = rand() * 256;
				const y = rand() * 256;
				for (const [dx, dy] of [
					[-2.5, 0],
					[2.5, 0],
					[0, -3.5],
				])
					blob(x + dx!, y + dy!, 2.6, "rgba(78,140,58,0.55)");
			}
			// Tiny daisies.
			for (let i = 0; i < 10; i++) {
				const x = rand() * 256;
				const y = rand() * 256;
				blob(x, y, 2.2, "rgba(255,255,250,0.9)");
				blob(x, y, 0.9, "#f2c94c");
			}
		},
		[area.w / 3, area.d / 3],
	);

/** A tuft of grass: three blades leaning out from the middle. */
const tuftGeometry = (() => {
	const blades = [-0.4, 0.05, 0.45].map((lean, i) => {
		const g = new ConeGeometry(0.03, 0.2 - i * 0.02, 3);
		g.translate(0, 0.1, 0);
		g.rotateZ(lean);
		g.rotateY(i * 2.1);
		return g;
	});
	const g = mergeGeometries(blades)!;
	for (const b of blades) b.dispose();
	return g;
})();
const daisyGeometry = new SphereGeometry(0.045, 6, 4).scale(1, 0.45, 1).translate(0, 0.05, 0);
const TUFT_GREENS = [LEAF, LEAF_LIGHT, LEAF_DARK, "#8cc65c"];
const PETALS = ["#ffffff", "#fff6cf", "#f6b6c8", "#d9c6f2", "#ffffff"];

/** Grass tufts and daisies over the lawn: two draw calls for a few hundred little things. */
export function Lawn({ area, avoid }: { area: Area; avoid: readonly Block[] }) {
	const tufts = useMemo(() => scatter(170, 11, area, avoid), [area, avoid]);
	const daisies = useMemo(() => scatter(70, 23, area, avoid), [area, avoid]);
	return (
		<>
			<Scattered geometry={tuftGeometry} spots={tufts} colours={TUFT_GREENS} seed={3} />
			<Scattered geometry={daisyGeometry} spots={daisies} colours={PETALS} seed={5} size={[0.7, 1.2]} />
		</>
	);
}

// ── The path ──

/** Where the path runs: the whole width of the park. */
export const PATH = { z0: 4.5, z1: 5.9 } as const;

/** Rounded cobbles in warm stone, set in sandy joints. One tile is a square of path. */
const cobbles = canvasTexture(
	128,
	128,
	(ctx) => {
		ctx.fillStyle = "#d9c49b";
		ctx.fillRect(0, 0, 128, 128);
		const stones = ["#efe2c4", "#e6d4ae", "#f3e9d2", "#e1cca2"];
		const rand = seeded(31);
		for (let row = 0; row < 4; row++)
			for (let col = 0; col < 5; col++) {
				const x = col * 26 + (row % 2 ? 13 : 0) - 4;
				const y = row * 32 + 2;
				ctx.fillStyle = stones[Math.floor(rand() * stones.length)]!;
				ctx.beginPath();
				ctx.roundRect(x + 2, y + 2, 22, 27, 9);
				ctx.fill();
				// A soft lit top edge on each cobble.
				ctx.fillStyle = "rgba(255,255,255,0.35)";
				ctx.beginPath();
				ctx.roundRect(x + 5, y + 4, 15, 5, 3);
				ctx.fill();
			}
	},
	[10, 1],
);

const edgeGeometry = new RoundedBoxGeometry(0.32, 0.1, 0.16, 1, 0.035);
const EDGE_STONES = ["#c7bba6", "#b8ab95", "#d4c9b5", "#bfb39c"];

/** The cobbled path, with a kerb of rounded stones down both sides. */
export function CobblePath({ w }: { w: number }) {
	const kerb = useMemo(() => {
		const out: [number, number][] = [];
		for (let x = 0.2; x < w; x += 0.36) out.push([x, PATH.z0], [x, PATH.z1]);
		return out;
	}, [w]);
	const ref = useRef<InstancedMesh>(null);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const rand = seeded(41);
		const t = new Object3D();
		const c = new Color();
		for (const [i, [x, z]] of kerb.entries()) {
			t.position.set(x, 0.03, z);
			t.rotation.set(0, (rand() - 0.5) * 0.12, 0);
			t.scale.set(0.9 + rand() * 0.2, 1, 1);
			t.updateMatrix();
			m.setMatrixAt(i, t.matrix);
			m.setColorAt(i, c.set(EDGE_STONES[Math.floor(rand() * EDGE_STONES.length)]!));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
		m.computeBoundingSphere();
	}, [kerb]);
	return (
		<>
			<mesh position={[w / 2, 0.012, (PATH.z0 + PATH.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[w, PATH.z1 - PATH.z0]} />
				<meshToonMaterial map={cobbles} gradientMap={toonGradient()} />
			</mesh>
			<instancedMesh ref={ref} args={[edgeGeometry, undefined, kerb.length]} receiveShadow userData={{ noShadow: true }}>
				<Toon color="#ffffff" />
			</instancedMesh>
		</>
	);
}

// ── The pond ──

const pondWater = canvasTexture(
	128,
	128,
	(ctx) => {
		const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
		g.addColorStop(0, "#3f86cf");
		g.addColorStop(0.7, "#5fa3e0");
		g.addColorStop(0.92, "#8cc7ec");
		g.addColorStop(1, "#b6dcef");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
	},
	[1, 1],
);
/** Light catching the water: soft streaks that drift slowly across. */
const shimmer = canvasTexture(
	128,
	128,
	(ctx) => {
		ctx.clearRect(0, 0, 128, 128);
		ctx.strokeStyle = "rgba(255,255,255,0.75)";
		ctx.lineCap = "round";
		const rand = seeded(53);
		for (let i = 0; i < 9; i++) {
			const x = rand() * 128;
			const y = rand() * 128;
			ctx.lineWidth = 1.5 + rand() * 2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + 8, y - 3, x + 14 + rand() * 12, y);
			ctx.stroke();
		}
	},
	[2, 2],
);

const pebbleGeometry = new SphereGeometry(0.16, 7, 5).scale(1.3, 0.55, 1);
const PEBBLES = ["#c9bfae", "#b3a894", "#ddd3c2", "#a89c88", "#cfc4b0"];

/** The pond at `at`: deep in the middle, pale at the edge, a ring of pebbles and light drifting over it. */
export function Pond({ at, r }: { at: [number, number]; r: number }) {
	const stones = useMemo(() => {
		const out: [number, number][] = [];
		const n = Math.round(r * 22);
		const rand = seeded(61);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2 + rand() * 0.06;
			const rr = r + 0.06 + rand() * 0.08;
			out.push([at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr]);
		}
		return out;
	}, [at, r]);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame((_, dt) => {
		if (reduced) return;
		wake("ambient");
		shimmer.offset.x = (shimmer.offset.x + dt * 0.025) % 1;
		shimmer.offset.y = (shimmer.offset.y + dt * 0.008) % 1;
	});
	return (
		<>
			<Cyl r={r + 0.25} h={0.04} p={[at[0], 0.01, at[1]]} c="#c2a77f" seg={40} />
			<mesh position={[at[0], 0.045, at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[r, 48]} />
				<meshToonMaterial map={pondWater} gradientMap={toonGradient()} />
			</mesh>
			<mesh position={[at[0], 0.05, at[1]]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noShadow: true }}>
				<circleGeometry args={[r - 0.1, 40]} />
				<meshBasicMaterial map={shimmer} transparent opacity={0.55} depthWrite={false} />
			</mesh>
			<Scattered geometry={pebbleGeometry} spots={stones} colours={PEBBLES} seed={67} y={0.05} size={[0.75, 1.25]} />
		</>
	);
}

/** Bulrushes in a clump: tall stems, brown velvet heads, a few long leaves. */
export const reeds = (x: number, z: number, n = 5, seed = 1) => {
	const rand = seeded(seed);
	return (
		<group key={`r${x}${z}`} position={[x, 0, z]}>
			{Array.from({ length: n }, (_, i) => {
				const dx = (rand() - 0.5) * 0.4;
				const dz = (rand() - 0.5) * 0.4;
				const h = 0.6 + rand() * 0.35;
				return (
					<group key={i}>
						<Cyl r={0.015} h={h} p={[dx, h / 2, dz]} c={LEAF_DARK} seg={5} />
						{i % 2 === 0 && <Cyl r={0.04} h={0.16} p={[dx, h - 0.05, dz]} c="#7a4e2c" seg={7} />}
						<Ball r={0.03} p={[dx + 0.05, h * 0.35, dz]} s={[0.6, 9, 0.6]} c={i % 2 ? LEAF : LEAF_LIGHT} />
					</group>
				);
			})}
		</group>
	);
};

/** A lily pad with a notch, and sometimes a pink flower on it. */
export const lily = (x: number, z: number, r: number, flower = false) => (
	<group key={`l${x}${z}`} position={[x, 0.06, z]}>
		<mesh rotation={[-Math.PI / 2, 0, 0]}>
			<circleGeometry args={[r, 14, 0.35, Math.PI * 2 - 0.5]} />
			<Toon color={LEAF} />
		</mesh>
		{flower && (
			<group position={[r * 0.2, 0.02, 0]}>
				{[0, 1, 2, 3, 4].map((i) => (
					<Ball key={i} r={0.05} p={[Math.cos(i * 1.26) * 0.05, 0.03, Math.sin(i * 1.26) * 0.05]} s={[1, 0.6, 1.8]} c="#f6b6c8" />
				))}
				<Ball r={0.03} p={[0, 0.05, 0]} c={GOLD} />
			</group>
		)}
	</group>
);

/** A duck, baked into one mesh (it paddles round as one piece). */
const duck = (s: number, c: string) => (
	<Static>
		<group scale={s}>
			<Ball r={0.22} p={[0, 0.12, 0]} c={c} s={[1.3, 0.8, 1]} />
			<Ball r={0.08} p={[-0.27, 0.2, 0]} c={c} s={[1, 0.7, 0.8]} />
			<Ball r={0.12} p={[0.22, 0.3, 0]} c={c} />
			<Cyl r={0.025} r2={0.05} h={0.11} p={[0.36, 0.29, 0]} rot={[0, 0, Math.PI / 2]} c="#f08a3c" seg={8} />
			<Ball r={0.02} p={[0.29, 0.34, 0.08]} c="#2b2b33" />
			<Ball r={0.02} p={[0.29, 0.34, -0.08]} c="#2b2b33" />
		</group>
	</Static>
);
const DUCKS = [duck(1, WHITE), duck(0.55, "#f7dd6b"), duck(0.5, "#f7dd6b")];

/** A duck and two yellow ducklings paddling slowly round the pond in a line, bobbing. Still when motion is reduced. */
export function DuckFamily({ at, r }: { at: [number, number]; r: number }) {
	const ducks = useRef<(Group | null)[]>([]);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	const place = (t: number) => {
		ducks.current.forEach((d, i) => {
			if (!d) return;
			const a = -t * 0.12 + 0.6 + i * 0.32;
			d.position.set(at[0] + Math.cos(a) * r, 0.05 + (reduced ? 0 : Math.sin(t * 2.2 + i) * 0.012), at[1] + Math.sin(a) * r);
			// Facing along the way round (clockwise as seen from above).
			d.rotation.y = -a + Math.PI;
		});
	};
	useLayoutEffect(() => place(0));
	useFrame(({ clock }) => {
		if (reduced) return;
		wake("ambient");
		place(clock.elapsedTime);
	});
	return (
		<group userData={{ noCast: true }}>
			{DUCKS.map((d, i) => (
				<group
					key={i}
					ref={(g) => {
						ducks.current[i] = g;
					}}
				>
					{d}
				</group>
			))}
		</group>
	);
}

/** A little blue bird hopping about the grass between three spots, stopping to peck. Still when motion is reduced. */
export function HoppingBird({ spots }: { spots: [number, number][] }) {
	const bird = useRef<Group>(null);
	const body = useRef<Group>(null);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame(({ clock }) => {
		const b = bird.current;
		if (reduced || !b || !body.current) return;
		wake("ambient");
		// Four seconds a spot: a peck or two, then three hops to the next one.
		const t = clock.elapsedTime / 4;
		const i = Math.floor(t) % spots.length;
		const k = t % 1;
		const [x0, z0] = spots[i]!;
		const [x1, z1] = spots[(i + 1) % spots.length]!;
		const move = Math.max(0, (k - 0.55) / 0.45);
		const step = Math.min(1, Math.floor(move * 3) / 3 + ((move * 3) % 1));
		b.position.set(x0 + (x1 - x0) * step, k > 0.55 && k < 1 ? Math.abs(Math.sin(move * Math.PI * 3)) * 0.12 : 0, z0 + (z1 - z0) * step);
		b.rotation.y = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
		body.current.rotation.z = k < 0.5 && Math.sin(k * 40) > 0.6 ? -0.5 : 0;
	});
	const [x, z] = spots[0]!;
	return (
		<group ref={bird} position={[x, 0, z]} userData={{ noCast: true }}>
			<group ref={body}>{birdBody}</group>
		</group>
	);
}

const birdBody = (
	<Static>
		<Ball r={0.07} p={[0, 0.08, 0]} c="#6fa8dc" s={[1.3, 1, 1]} />
		<Ball r={0.05} p={[0.08, 0.14, 0]} c="#6fa8dc" />
		<Ball r={0.03} p={[0.08, 0.1, 0]} c="#f6e7c4" s={[1, 1, 1.4]} />
		<Cyl r={0.003} r2={0.015} h={0.04} p={[0.14, 0.14, 0]} rot={[0, 0, Math.PI / 2]} c="#f2c94c" seg={5} />
		<B s={[0.08, 0.02, 0.05]} p={[-0.1, 0.12, 0]} c="#3d74c9" />
	</Static>
);

// ── The fence ──

const picketGeometry = (() => {
	const board = new BoxGeometry(0.1, 0.5, 0.05).translate(0, 0.25, 0);
	const point = new ConeGeometry(0.072, 0.12, 4)
		.rotateY(Math.PI / 4)
		.scale(1, 1, 0.5)
		.translate(0, 0.56, 0);
	const g = mergeGeometries([board.toNonIndexed(), point.toNonIndexed()])!;
	board.dispose();
	point.dispose();
	return g;
})();
const postGeometry = (() => {
	const post = new BoxGeometry(0.13, 0.72, 0.13).translate(0, 0.36, 0);
	const cap = new SphereGeometry(0.08, 8, 6).translate(0, 0.76, 0);
	const g = mergeGeometries([post.toNonIndexed(), cap.toNonIndexed()])!;
	post.dispose();
	cap.dispose();
	return g;
})();

/** A white picket fence with pointed pickets and capped posts along the back and left edges, and two rails. */
export function PicketFence({ area }: { area: Area }) {
	const pickets = useMemo(() => {
		const out: { x: number; z: number; turn: number }[] = [];
		for (let x = 0.3; x < area.w - 0.1; x += 0.3) out.push({ x, z: 0.12, turn: 0 });
		for (let z = 0.42; z < area.d - 0.1; z += 0.3) out.push({ x: 0.12, z, turn: Math.PI / 2 });
		return out;
	}, [area]);
	const posts = useMemo(() => {
		const out: { x: number; z: number; turn: number }[] = [{ x: 0.12, z: 0.12, turn: 0 }];
		for (let x = 1.8; x < area.w; x += 1.8) out.push({ x, z: 0.12, turn: 0 });
		for (let z = 1.8; z < area.d; z += 1.8) out.push({ x: 0.12, z, turn: 0 });
		return out;
	}, [area]);
	return (
		<>
			<Placed geometry={picketGeometry} at={pickets} colour={WHITE} />
			<Placed geometry={postGeometry} at={posts} colour="#ece4d6" />
			{[0.18, 0.4].map((y) => (
				<group key={y}>
					<B s={[area.w - 0.1, 0.06, 0.04]} p={[area.w / 2, y, 0.08]} c="#ece4d6" />
					<B s={[0.04, 0.06, area.d - 0.1]} p={[0.08, y, area.d / 2]} c="#ece4d6" />
				</group>
			))}
		</>
	);
}

function Placed({ geometry, at, colour }: { geometry: BufferGeometry; at: { x: number; z: number; turn: number }[]; colour: string }) {
	const ref = useRef<InstancedMesh>(null);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const t = new Object3D();
		for (const [i, p] of at.entries()) {
			t.position.set(p.x, 0, p.z);
			t.rotation.set(0, p.turn, 0);
			t.updateMatrix();
			m.setMatrixAt(i, t.matrix);
		}
		m.instanceMatrix.needsUpdate = true;
		m.computeBoundingSphere();
	}, [at]);
	return (
		<instancedMesh ref={ref} args={[geometry, undefined, at.length]}>
			<Toon color={colour} />
		</instancedMesh>
	);
}

// ── Planting and things in the park ──

/** A clipped hedge, `w` long along x: a soft block with leafy bumps along the top. */
export const hedge = (x: number, z: number, w: number) => (
	<group key={`h${x}${z}`} position={[x, 0, z]}>
		<B s={[w, 0.55, 0.5]} p={[0, 0.28, 0]} c={LEAF_DARK} />
		{Array.from({ length: Math.round(w / 0.35) }, (_, i) => (
			<Ball key={i} r={0.17} p={[-w / 2 + 0.2 + i * 0.35, 0.55, (i % 2) * 0.1 - 0.05]} c={i % 3 ? LEAF : LEAF_LIGHT} s={[1, 0.75, 1]} />
		))}
	</group>
);

/** A tulip: stem, a leaf, and a cup of petals. */
const tulip = (x: number, z: number, c: string, h = 0.32) => (
	<group key={`tu${x}${z}`} position={[x, 0, z]}>
		<Cyl r={0.012} h={h} p={[0, h / 2, 0]} c={LEAF} seg={5} />
		<Ball r={0.03} p={[0.03, h * 0.35, 0]} s={[0.7, 3, 0.5]} c={LEAF_LIGHT} />
		<Ball r={0.055} p={[0, h + 0.03, 0]} s={[1, 1.3, 1]} c={c} />
	</group>
);

const brickGeometry = new BoxGeometry(0.1, 0.12, 0.24);

/** A round flower bed in a ring of red bricks, full of tulips. */
export const flowerBed = (x: number, z: number, r: number, colours: string[]) => (
	<group key={`fb${x}${z}`} position={[x, 0, z]}>
		<Cyl r={r} h={0.08} p={[0, 0.04, 0]} c="#7a5236" seg={24} />
		{Array.from({ length: 14 }, (_, i) => {
			const a = (i / 14) * Math.PI * 2;
			return (
				<group key={i} position={[Math.cos(a) * r, 0.07, Math.sin(a) * r]} rotation={[0, -a, 0]}>
					<mesh geometry={brickGeometry}>
						<Toon color={i % 2 ? "#c9705a" : "#b85f4a"} />
					</mesh>
				</group>
			);
		})}
		{Array.from({ length: 9 }, (_, i) => {
			const a = i * 2.4;
			const d = i === 0 ? 0 : r * (0.35 + (i % 3) * 0.17);
			return tulip(Math.cos(a) * d, Math.sin(a) * d, colours[i % colours.length]!, 0.28 + (i % 3) * 0.05);
		})}
	</group>
);

/** A long bed along the left fence, edged in timber, tulips in rows. */
export const borderBed = (x0: number, z0: number, z1: number, colours: string[]) => (
	<group key={`bb${x0}${z0}`} position={[x0, 0, z0]}>
		<B s={[0.55, 0.08, z1 - z0]} p={[0.27, 0.04, (z1 - z0) / 2]} c="#7a5236" />
		<B s={[0.06, 0.14, z1 - z0 + 0.06]} p={[0.57, 0.07, (z1 - z0) / 2]} c={WOOD} />
		<B s={[0.6, 0.14, 0.06]} p={[0.29, 0.07, z1 - z0]} c={WOOD} />
		{Array.from({ length: Math.floor((z1 - z0) / 0.22) }, (_, i) =>
			tulip(0.15 + (i % 2) * 0.22, 0.12 + i * 0.22, colours[i % colours.length]!, 0.3 + (i % 3) * 0.05),
		)}
	</group>
);

/** A green park bin with a domed lid and slats. */
export const bin = (x: number, z: number) => (
	<group key={`bin${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.24} />
		<Cyl r={0.16} r2={0.14} h={0.46} p={[0, 0.23, 0]} c="#4f8a6b" seg={14} />
		{[0.08, 0.38].map((y) => (
			<Cyl key={y} r={0.175} h={0.04} p={[0, y, 0]} c="#3e6f55" seg={14} />
		))}
		<Ball r={0.17} p={[0, 0.47, 0]} s={[1, 0.45, 1]} c="#3e6f55" />
		<Ball r={0.035} p={[0, 0.55, 0]} c="#3e6f55" />
	</group>
);

/** A stone bird bath, a little bird perched on its rim. */
export const birdBath = (x: number, z: number) => (
	<group key={`bath${x}${z}`} position={[x, 0, z]}>
		<Shadow r={0.35} />
		<Cyl r={0.2} r2={0.24} h={0.08} p={[0, 0.04, 0]} c="#d4cbbb" seg={14} />
		<Cyl r={0.07} r2={0.1} h={0.5} p={[0, 0.33, 0]} c="#ddd5c6" seg={10} />
		<Cyl r={0.34} r2={0.14} h={0.14} p={[0, 0.63, 0]} c="#d4cbbb" seg={18} />
		<Cyl r={0.29} h={0.02} p={[0, 0.7, 0]} c="#8cc7ec" seg={18} />
		<group position={[0.3, 0.71, 0.04]} rotation={[0, 0.5, 0]}>
			<Ball r={0.06} p={[0, 0.05, 0]} c="#e8822e" s={[1.3, 1, 1]} />
			<Ball r={0.045} p={[0.07, 0.1, 0]} c="#e8822e" />
			<Cyl r={0.003} r2={0.012} h={0.035} p={[0.12, 0.1, 0]} rot={[0, 0, Math.PI / 2]} c="#2b2b33" seg={5} />
		</group>
	</group>
);

/** A wooden signpost with two arrows: a paw one way (the pet shop), a book the other (school). No words. */
export const signpost = (x: number, z: number) => {
	const arrow = (y: number, dir: 1 | -1, c: string, icon: ReactNode) => (
		<group position={[dir * 0.28, y, 0]}>
			<B s={[0.5, 0.18, 0.05]} p={[0, 0, 0]} c={c} />
			<mesh position={[dir * 0.3, 0, 0]} rotation={[0, 0, (-dir * Math.PI) / 2]} scale={[1, 1, 0.35]}>
				<coneGeometry args={[0.13, 0.12, 4]} />
				<Toon color={c} />
			</mesh>
			<group position={[0, 0, 0.03]}>{icon}</group>
		</group>
	);
	return (
		<group key={`sign${x}${z}`} position={[x, 0, z]} rotation={[0, -0.35, 0]}>
			<Shadow r={0.2} />
			<Cyl r={0.045} h={1.45} p={[0, 0.72, 0]} c={WOOD_DARK} seg={8} />
			<Ball r={0.06} p={[0, 1.47, 0]} c={WOOD} />
			{arrow(
				1.22,
				-1,
				"#f6b6c8",
				<>
					<Ball r={0.04} p={[0, -0.02, 0]} c={WOOD_DARK} s={[1.2, 1, 0.4]} />
					{[-0.05, -0.017, 0.017, 0.05].map((dx, i) => (
						<Ball key={dx} r={0.017} p={[dx, i === 1 || i === 2 ? 0.05 : 0.035, 0]} c={WOOD_DARK} s={[1, 1, 0.4]} />
					))}
				</>,
			)}
			{arrow(
				0.95,
				1,
				"#9fd8f0",
				<>
					<B s={[0.07, 0.1, 0.02]} p={[-0.037, 0, 0]} c="#3d74c9" />
					<B s={[0.07, 0.1, 0.02]} p={[0.037, 0, 0]} c="#3d74c9" />
				</>,
			)}
		</group>
	);
};

/** What's out on the picnic blanket: a plate of sandwiches, apples, cups, a jug and cookies. */
export const picnicSpread = (
	<>
		<Cyl r={0.16} h={0.02} p={[-0.3, 0.03, 0.1]} c={WHITE} seg={16} />
		{[0, 2.1].map((a) => (
			<group key={a} position={[-0.3 + Math.cos(a) * 0.05, 0.06, 0.1 + Math.sin(a) * 0.05]} rotation={[0, a, 0]}>
				<Cyl r={0.08} h={0.025} p={[0, 0, 0]} c="#f2dcae" seg={3} />
				<Cyl r={0.076} h={0.015} p={[0, 0.02, 0]} c="#e85d75" seg={3} />
				<Cyl r={0.08} h={0.025} p={[0, 0.04, 0]} c="#f2dcae" seg={3} />
			</group>
		))}
		<Ball r={0.06} p={[0.05, 0.07, 0.25]} c="#d8413c" />
		<Ball r={0.055} p={[0.15, 0.065, 0.3]} c="#7dbf52" />
		{[
			[-0.05, -0.25, "#9fd8f0"],
			[0.08, -0.32, "#f2c94c"],
		].map(([x, z, c]) => (
			<Cyl key={c as string} r={0.04} r2={0.032} h={0.1} p={[x as number, 0.06, z as number]} c={c as string} seg={10} />
		))}
		<Cyl r={0.07} r2={0.08} h={0.2} p={[-0.45, 0.11, -0.25]} c="#f6f1e7" seg={12} />
		<Cyl r={0.05} h={0.04} p={[-0.45, 0.23, -0.25]} c="#f6f1e7" seg={12} />
		{[0, 1, 2].map((i) => (
			<Cyl key={i} r={0.04} h={0.015} p={[0.35 + i * 0.03, 0.03 + i * 0.016, 0.22 - i * 0.02]} c="#c9965f" seg={10} />
		))}
	</>
);

/**
 * The lamp post by the bench: a stepped base, a slim post with collars, and a glass lantern under a little roof.
 * The lantern glows faintly by day and lights up at Night (one small warm light).
 */
const LANTERN = new Color("#ffd27a");

export function LampPost({ at }: { at: V3 }) {
	const night = useNight();
	return (
		<group position={at}>
			<Shadow r={0.3} />
			<Cyl r={0.15} r2={0.19} h={0.16} p={[0, 0.08, 0]} c="#3f4a5c" seg={10} />
			<Cyl r={0.07} r2={0.1} h={0.3} p={[0, 0.3, 0]} c="#3f4a5c" seg={10} />
			<Cyl r={0.045} h={1.5} p={[0, 1.15, 0]} c="#3f4a5c" seg={8} />
			{[0.48, 1.85].map((y) => (
				<Cyl key={y} r={0.07} h={0.05} p={[0, y, 0]} c="#2f3848" seg={10} />
			))}
			<Cyl r={0.13} r2={0.1} h={0.05} p={[0, 1.92, 0]} c="#2f3848" seg={4} rot={[0, Math.PI / 4, 0]} />
			<mesh position={[0, 2.08, 0]} rotation={[0, Math.PI / 4, 0]}>
				<cylinderGeometry args={[0.15, 0.11, 0.28, 4]} />
				<meshToonMaterial color="#fff2b8" gradientMap={toonGradient()} emissive={LANTERN} emissiveIntensity={night ? 1.4 : 0.35} />
			</mesh>
			<Cyl r={0.025} r2={0.21} h={0.16} p={[0, 2.3, 0]} c="#2f3848" seg={4} rot={[0, Math.PI / 4, 0]} />
			<Ball r={0.035} p={[0, 2.41, 0]} c="#2f3848" />
			{/* Always there (off by day), so turning Night on doesn't recompile every material in the park. */}
			<pointLight position={[0, 2.05, 0]} color="#ffcf80" intensity={night ? 5 : 0} distance={4.5} decay={1.6} />
		</group>
	);
}

// ── The finds ──

const twoSided = (c: string) => <meshToonMaterial color={c} gradientMap={toonGradient()} side={DoubleSide} />;

/** A golden acorn: a shiny nut in a bumpy cap with a little stem. */
export const acorn = (
	<group position={[0, 0, 0]} rotation={[0, 0, 0.35]}>
		<Ball r={0.1} p={[0, 0.11, 0]} c={GOLD} s={[1, 1.25, 1]} e={0.3} />
		<Ball r={0.035} p={[0, 0.0, 0]} c={GOLD} e={0.3} />
		<Ball r={0.11} p={[0, 0.2, 0]} c="#a8762e" s={[1.05, 0.6, 1.05]} />
		<Cyl r={0.012} h={0.07} p={[0.01, 0.28, 0]} c="#7a4e2c" seg={5} rot={[0, 0, -0.3]} />
	</group>
);

/** A scallop shell: a fan of pink ribs from a little hinge. */
export const shell = (
	<group rotation={[-0.25, 0.4, 0]}>
		{[-2, -1, 0, 1, 2].map((i) => (
			<group key={i} rotation={[0, i * 0.3, 0]}>
				<Ball r={0.04} p={[0, 0.04, 0.09]} s={[0.9, 0.55, 2.4]} c={i % 2 ? "#f6b6c8" : "#f9cbd7"} />
			</group>
		))}
		<B s={[0.1, 0.04, 0.05]} p={[0, 0.03, -0.02]} c="#f0a3b6" />
	</group>
);

const diamond = (() => {
	const s = new Shape();
	s.moveTo(0, 0.32);
	s.lineTo(0.22, 0.04);
	s.lineTo(0, -0.3);
	s.lineTo(-0.22, 0.04);
	s.closePath();
	return s;
})();
const kiteHalf = (() => {
	const s = new Shape();
	s.moveTo(0, 0.32);
	s.lineTo(0.22, 0.04);
	s.lineTo(0, -0.3);
	s.closePath();
	return s;
})();

/** The lost kite, snagged in a tree: a pink and yellow diamond on crossed spars, its tail of bows hanging down. */
export const kite = (
	<group rotation={[0.15, 0.6, 0.3]}>
		<mesh>
			<shapeGeometry args={[diamond]} />
			{twoSided("#e85d75")}
		</mesh>
		<mesh position={[0, 0, 0.004]}>
			<shapeGeometry args={[kiteHalf]} />
			{twoSided("#f2c94c")}
		</mesh>
		<Cyl r={0.008} h={0.62} p={[0, 0.01, 0.012]} c={WOOD_DARK} seg={4} />
		<Cyl r={0.008} h={0.44} p={[0, 0.04, 0.012]} rot={[0, 0, Math.PI / 2]} c={WOOD_DARK} seg={4} />
		{[0, 1, 2].map((i) => (
			<group key={i} position={[Math.sin(i * 1.4) * 0.05, -0.38 - i * 0.14, 0]}>
				<Cyl r={0.005} h={0.14} p={[0, 0.07, 0]} c="#6b5a4a" seg={3} />
				<Ball r={0.035} p={[-0.03, 0, 0]} s={[1.2, 0.7, 0.4]} c={["#8ec5f2", "#7dbf52", "#8a5bd1"][i]!} />
				<Ball r={0.035} p={[0.03, 0, 0]} s={[1.2, 0.7, 0.4]} c={["#8ec5f2", "#7dbf52", "#8a5bd1"][i]!} />
			</group>
		))}
	</group>
);

/** A ladybug: a red shell with black spots and a split down the back, and a black head. */
export const ladybug = (
	<group rotation={[0, 0.8, 0]} scale={1.15}>
		<Ball r={0.07} p={[0, 0.02, 0]} c="#d8413c" s={[1, 0.65, 1.2]} />
		<Ball r={0.035} p={[0, 0.02, 0.08]} c="#2b2b33" />
		<B s={[0.006, 0.01, 0.15]} p={[0, 0.067, -0.005]} c="#2b2b33" />
		{[
			[0.035, 0.03],
			[-0.035, 0.03],
			[0.04, -0.035],
			[-0.04, -0.035],
		].map(([x, z]) => (
			<Ball key={`${x}${z}`} r={0.016} p={[x!, 0.058, z!]} c="#2b2b33" s={[1, 0.4, 1]} />
		))}
		<Ball r={0.008} p={[0.015, 0.05, 0.11]} c={WHITE} />
		<Ball r={0.008} p={[-0.015, 0.05, 0.11]} c={WHITE} />
	</group>
);

const vane = (() => {
	const s = new Shape();
	s.moveTo(0, 0);
	s.quadraticCurveTo(0.08, 0.12, 0.03, 0.42);
	s.quadraticCurveTo(0, 0.46, -0.02, 0.42);
	s.quadraticCurveTo(-0.07, 0.15, 0, 0);
	return s;
})();

/** A blue feather lying on the bench: a curved vane on a pale quill. */
export const feather = (
	<group rotation={[-Math.PI / 2 + 0.08, 0, 0.9]} position={[0, 0.01, 0.15]}>
		<mesh>
			<shapeGeometry args={[vane]} />
			{twoSided("#3d74c9")}
		</mesh>
		<mesh position={[0, 0, 0.003]} scale={[0.5, 0.85, 1]}>
			<shapeGeometry args={[vane]} />
			{twoSided("#6fa8dc")}
		</mesh>
		<Cyl r={0.007} h={0.5} p={[0.005, 0.2, 0.006]} c={WHITE} seg={4} />
	</group>
);
