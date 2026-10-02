import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import { type BufferGeometry, ExtrudeGeometry, type Group, Shape, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { Static } from "../batch.tsx";
import { Cyl, GOLD, lighter, Toon, toonGradient, WOOD_DARK } from "../Furniture.tsx";
import { useNight } from "../light.tsx";
import { useWake } from "../pace.tsx";
import { type Area, canvasTexture } from "../stage.tsx";
import type { V3 } from "./kit.tsx";

/**
 * What the town's rooms are built from: panelled walls with a picture rail and a cap along the top, windows with a
 * painted view (the sky and the rooftops by day, stars and lit windows at Night), wall lamps that come on at Night,
 * a door, and floors with grout lines or floorboards. The back wall stands along z = 0, the left wall along x = 0.
 */

const H = 3;
/** Where the panelling stops and the wallpaper starts. */
const WAINSCOT = 1;

// ── Light shapes ──

/**
 * The rooms' own box and ball: the same toy shapes as `B` and `Ball`, with fewer faces (a box's rounded edges in one
 * step, a ball in 12 slices), since a room has hundreds of small ones and an iPad draws every triangle twice (the
 * shadow too).
 */
const boxes = new Map<string, BufferGeometry>();
function lowBox(w: number, h: number, d: number) {
	const key = `${w}|${h}|${d}`;
	let g = boxes.get(key);
	if (!g) {
		g = new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.25);
		boxes.set(key, g);
	}
	return g;
}
const ball = new SphereGeometry(1, 12, 9);

export function B({ s, p, c, e, o }: { s: V3; p: V3; c: string; e?: number; o?: number }) {
	return (
		<mesh position={p} geometry={lowBox(...s)}>
			<Toon color={c} {...(e && { emissive: e })} {...(o !== undefined && { opacity: o })} />
		</mesh>
	);
}
export function Ball({ r, p, c, s, e }: { r: number; p: V3; c: string; s?: V3; e?: number }) {
	return (
		<mesh position={p} geometry={ball} scale={s ? [s[0] * r, s[1] * r, s[2] * r] : r}>
			<Toon color={c} {...(e && { emissive: e })} />
		</mesh>
	);
}

// ── Floors ──

/** Tiles, two colours in a check, with grout lines, a soft shine and a little wear. Each 2×2 squares of floor. */
export const floorTiles = (a: string, b: string) => (area: Area) =>
	canvasTexture(
		256,
		256,
		(ctx) => {
			for (let y = 0; y < 2; y++)
				for (let x = 0; x < 2; x++) {
					ctx.fillStyle = (x + y) % 2 ? a : b;
					ctx.fillRect(x * 128, y * 128, 128, 128);
					const g = ctx.createLinearGradient(x * 128, y * 128, x * 128 + 128, y * 128 + 128);
					g.addColorStop(0, "rgba(255,255,255,0.22)");
					g.addColorStop(0.5, "rgba(255,255,255,0)");
					g.addColorStop(1, "rgba(120,100,80,0.06)");
					ctx.fillStyle = g;
					ctx.fillRect(x * 128, y * 128, 128, 128);
				}
			ctx.fillStyle = "rgba(150,135,115,0.07)";
			for (const [x, y, r] of [
				[60, 180, 30],
				[200, 70, 22],
				[170, 210, 16],
			]) {
				ctx.beginPath();
				ctx.ellipse(x!, y!, r! * 1.6, r!, 0.4, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.strokeStyle = "rgba(130,118,100,0.55)";
			ctx.lineWidth = 5;
			for (let i = 0; i <= 2; i++) {
				ctx.beginPath();
				ctx.moveTo(i * 128, 0);
				ctx.lineTo(i * 128, 256);
				ctx.moveTo(0, i * 128);
				ctx.lineTo(256, i * 128);
				ctx.stroke();
			}
		},
		[area.w / 2, area.d / 2],
	);

/** Floorboards running left to right, five to every two squares, their ends staggered, with a little grain. */
export const floorBoards = (tones: readonly string[]) => (area: Area) =>
	canvasTexture(
		256,
		256,
		(ctx) => {
			const rows = 5;
			const h = 256 / rows;
			for (let r = 0; r < rows; r++) {
				const y = r * h;
				const seam = (r * 97 + 40) % 256;
				// Two lengths of board per row, joined at `seam` (and again where the texture wraps).
				ctx.fillStyle = tones[r % tones.length]!;
				ctx.fillRect(0, y, 256, h);
				ctx.fillStyle = tones[(r + 1) % tones.length]!;
				ctx.fillRect(seam, y, 256 - seam, h);
				ctx.strokeStyle = "rgba(110,70,35,0.13)";
				ctx.lineWidth = 1.5;
				for (let g = 0; g < 3; g++) {
					ctx.beginPath();
					const gy = y + 10 + g * 13;
					ctx.moveTo(0, gy);
					for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.05 + r + g) * 2.5);
					ctx.stroke();
				}
				ctx.fillStyle = "rgba(90,55,25,0.45)";
				ctx.fillRect(0, y, 256, 2.5);
				ctx.fillRect(seam, y, 2.5, h);
				ctx.fillStyle = "rgba(255,255,255,0.12)";
				ctx.fillRect(0, y + 2.5, 256, 2);
			}
		},
		[area.w / 2, area.d / 2],
	);

// ── Walls ──

export type WallStyle = {
	/** The wallpaper, drawn into one square tile `tile` squares across. */
	paper: (ctx: CanvasRenderingContext2D) => void;
	tile: number;
	/** Behind the wallpaper (and on the wall's ends and top). */
	paint: string;
	/** The panelling below the rail. */
	panel: string;
	/** Rail, skirting and the cap along the top. */
	trim: string;
};

/** Centres of evenly spaced panels along a wall `len` long, about 0.9 apart. */
const panelCentres = (len: number) => {
	const n = Math.max(1, Math.floor(len / 0.9));
	return Array.from({ length: n }, (_, i) => (len / n) * (i + 0.5));
};

/** The back and left walls of a room `area` big: panelling, rail, skirting, wallpaper and a cap on top. */
export function walls(area: Area, st: WallStyle) {
	const { w, d } = area;
	const paperH = H - WAINSCOT;
	const back = canvasTexture(128, 128, st.paper, [w / st.tile, paperH / st.tile]);
	const left = canvasTexture(128, 128, st.paper, [d / st.tile, paperH / st.tile]);
	const raised = lighter(st.panel, 0.3);
	return (
		<>
			<Static>
				<B s={[w + 0.2, H, 0.2]} p={[w / 2 - 0.1, H / 2, -0.1]} c={st.paint} />
				<B s={[0.2, H, d + 0.2]} p={[-0.1, H / 2, d / 2 - 0.1]} c={lighter(st.paint, 0.1)} />
				{/* Panelling, with raised panels. */}
				<B s={[w, WAINSCOT, 0.05]} p={[w / 2, WAINSCOT / 2, 0.025]} c={st.panel} />
				<B s={[0.05, WAINSCOT, d]} p={[0.025, WAINSCOT / 2, d / 2]} c={st.panel} />
				{panelCentres(w).map((x) => (
					<B key={`pb${x}`} s={[0.66, 0.56, 0.03]} p={[x, 0.53, 0.06]} c={raised} />
				))}
				{panelCentres(d).map((z) => (
					<B key={`pl${z}`} s={[0.03, 0.56, 0.66]} p={[0.06, 0.53, z]} c={raised} />
				))}
				{/* Rail, skirting, and the cap along the tops (which the camera looks down on). */}
				<B s={[w, 0.08, 0.1]} p={[w / 2, WAINSCOT + 0.02, 0.05]} c={st.trim} />
				<B s={[0.1, 0.08, d]} p={[0.05, WAINSCOT + 0.02, d / 2]} c={st.trim} />
				<B s={[w, 0.16, 0.08]} p={[w / 2, 0.08, 0.04]} c={st.trim} />
				<B s={[0.08, 0.16, d]} p={[0.04, 0.08, d / 2]} c={st.trim} />
				<B s={[w + 0.36, 0.12, 0.36]} p={[w / 2 - 0.1, H + 0.04, -0.1]} c={st.trim} />
				<B s={[0.36, 0.12, d + 0.36]} p={[-0.1, H + 0.04, d / 2 - 0.1]} c={st.trim} />
				{/* Posts at the corner and the two open ends. */}
				<B s={[0.3, H, 0.3]} p={[-0.1, H / 2, -0.1]} c={st.trim} />
				<B s={[0.26, H, 0.3]} p={[w + 0.02, H / 2, -0.1]} c={st.trim} />
				<B s={[0.3, H, 0.26]} p={[-0.1, H / 2, d + 0.02]} c={st.trim} />
			</Static>
			<mesh position={[w / 2, WAINSCOT + paperH / 2, 0.004]}>
				<planeGeometry args={[w, paperH]} />
				<meshToonMaterial map={back} gradientMap={toonGradient()} />
			</mesh>
			<mesh position={[0.004, WAINSCOT + paperH / 2, d / 2]} rotation={[0, Math.PI / 2, 0]}>
				<planeGeometry args={[d, paperH]} />
				<meshToonMaterial map={left} gradientMap={toonGradient()} color="#f4f0ea" />
			</mesh>
		</>
	);
}

// ── Windows ──

/** The view out of a window: sky, a cloud, a tree and the rooftops across the road; at Night, stars and lit windows. */
function view(night: boolean) {
	return canvasTexture(
		160,
		120,
		(ctx) => {
			const sky = ctx.createLinearGradient(0, 0, 0, 120);
			sky.addColorStop(0, night ? "#1c2a5a" : "#8fd0f2");
			sky.addColorStop(1, night ? "#46508a" : "#d9f0fb");
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, 160, 120);
			const blob = (x: number, y: number, r: number, c: string) => {
				ctx.fillStyle = c;
				ctx.beginPath();
				ctx.arc(x, y, r, 0, Math.PI * 2);
				ctx.fill();
			};
			if (night) {
				blob(124, 26, 12, "#fff6cf");
				blob(129, 22, 11, "#1f2e60");
				for (const [x, y] of [
					[20, 18],
					[46, 34],
					[70, 12],
					[96, 40],
					[150, 50],
					[34, 54],
				])
					blob(x!, y!, 1.6, "#fff6cf");
			} else {
				blob(128, 24, 11, "#fff3b8");
				for (const [x, r] of [
					[30, 9],
					[42, 12],
					[55, 8],
				])
					blob(x!, 30, r!, "#ffffff");
			}
			// A hill, a round tree, and rooftops with chimneys.
			blob(150, 150, 70, night ? "#2c4a45" : "#8fcf78");
			ctx.fillStyle = night ? "#3b3a2e" : "#8a6040";
			ctx.fillRect(132, 70, 6, 30);
			blob(135, 62, 16, night ? "#2e5a4a" : "#5fa04a");
			const roofs: [number, number, number, string, string][] = [
				[0, 78, 46, "#e8a0a8", "#c95d6b"],
				[44, 70, 40, "#f2d49a", "#5a7fc4"],
				[84, 84, 38, "#bfe3d6", "#e08a4c"],
			];
			for (const [x, y, w, wall, roof] of roofs) {
				ctx.fillStyle = night ? "#3a3f66" : wall;
				ctx.fillRect(x, y, w, 120 - y);
				ctx.fillStyle = night ? "#262a4a" : roof;
				ctx.beginPath();
				ctx.moveTo(x - 4, y);
				ctx.lineTo(x + w / 2, y - 16);
				ctx.lineTo(x + w + 4, y);
				ctx.fill();
				ctx.fillRect(x + w * 0.7, y - 18, 6, 12);
				ctx.fillStyle = night ? "#ffd77a" : "#ffffff";
				for (let i = 0; i < 2; i++) ctx.fillRect(x + 8 + i * (w / 2 - 2), y + 10, 9, 11);
			}
		},
		[1, 1],
	);
}
const VIEWS = { day: view(false), night: view(true) };

/** A window on the back wall centred at (x, y), `w` by `h`: frame, glazing bars, sill and a curtain each side. */
export const windowFrame = (x: number, y: number, w: number, h: number, frame: string, curtain: string) => (
	<group key={`w${x}${y}`} position={[x, y, 0]}>
		<B s={[w + 0.16, 0.1, 0.1]} p={[0, h / 2 + 0.03, 0.06]} c={frame} />
		<B s={[w + 0.16, 0.1, 0.1]} p={[0, -h / 2 - 0.03, 0.06]} c={frame} />
		<B s={[0.1, h + 0.12, 0.1]} p={[-w / 2 - 0.03, 0, 0.06]} c={frame} />
		<B s={[0.1, h + 0.12, 0.1]} p={[w / 2 + 0.03, 0, 0.06]} c={frame} />
		<B s={[0.045, h, 0.05]} p={[0, 0, 0.05]} c={frame} />
		<B s={[w, 0.045, 0.05]} p={[0, 0, 0.05]} c={frame} />
		<B s={[w + 0.36, 0.07, 0.24]} p={[0, -h / 2 - 0.1, 0.12]} c={frame} />
		{/* Curtains gathered at the sides, under a pleated pelmet. */}
		{[-1, 1].map((side) => (
			<group key={side} position={[side * (w / 2 + 0.16), -0.08, 0.13]}>
				<B s={[0.22, h + 0.25, 0.1]} p={[0, 0, 0]} c={curtain} />
				<B s={[0.26, 0.06, 0.14]} p={[0, -0.12, 0.01]} c={lighter(curtain, 0.4)} />
			</group>
		))}
		<B s={[w + 0.7, 0.2, 0.16]} p={[0, h / 2 + 0.17, 0.14]} c={curtain} />
		{[-0.375, -0.125, 0.125, 0.375].map((f) => (
			<Ball key={f} r={0.07} p={[f * (w + 0.5), h / 2 + 0.06, 0.2]} c={curtain} s={[1.4, 0.8, 0.6]} />
		))}
	</group>
);

/** The glass of a window: the painted view, swapped for the night one at Night. Unlit, it's outside. */
export function WindowView({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
	const night = useNight();
	return (
		<mesh position={[x, y, 0.02]}>
			<planeGeometry args={[w, h]} />
			<meshBasicMaterial map={night ? VIEWS.night : VIEWS.day} />
		</mesh>
	);
}

// ── Lamps ──

/** A wall lamp's bracket and shade, on the back wall (`left` false) or the left wall. The bulb is `Bulb`. */
export const sconce = (p: V3, shade: string, onLeft = false) => (
	<group key={`sc${p.join()}`} position={p} rotation={[0, onLeft ? Math.PI / 2 : 0, 0]}>
		<B s={[0.16, 0.24, 0.05]} p={[0, 0.05, 0.02]} c={WOOD_DARK} />
		<Cyl r={0.025} h={0.3} p={[0, 0.14, 0.17]} rot={[Math.PI / 2, 0, 0]} c={WOOD_DARK} seg={6} />
		<Cyl r={0.08} r2={0.2} h={0.22} p={[0, 0.1, 0.32]} c={shade} seg={16} />
	</group>
);

/** A lamp's bulb: soft by day, glowing at Night, with (optionally) the light it throws round the room. */
export function Bulb({ p, light, onLeft = false }: { p: V3; light?: boolean; onLeft?: boolean }) {
	const night = useNight();
	const at: V3 = onLeft ? [p[0] + 0.32, p[1], p[2]] : [p[0], p[1], p[2] + 0.32];
	return (
		<>
			<Ball r={0.085} p={at} c="#fff1c4" e={night ? 1.2 : 0.25} />
			{light && (
				<pointLight
					position={[at[0] + (onLeft ? 1.6 : 0), at[1] - 0.3, at[2] + (onLeft ? 0 : 1.6)]}
					color="#ffd59a"
					intensity={night ? 4 : 0}
					distance={8}
					decay={1.2}
				/>
			)}
		</>
	);
}

/** A lamp on the back wall (or the left wall): the bracket and shade baked with the room, the bulb lit at Night. */
export const lamp = (p: V3, shade: string, opts: { onLeft?: boolean; light?: boolean } = {}) => ({
	still: sconce(p, shade, opts.onLeft),
	bulb: <Bulb key={`bu${p.join()}`} p={[p[0], p[1] + 0.02, p[2]]} light={opts.light} onLeft={opts.onLeft} />,
});

// ── A door on the left wall ──

/** A panelled door in the left wall at `z`, with its frame, knob and a mat in front. */
export const door = (z: number, colour: string, frame: string, mat: string) => (
	<group key={`door${z}`} position={[0, 0, z]}>
		<B s={[0.12, 0.14, 1.2]} p={[0.06, 2.23, 0]} c={frame} />
		<B s={[0.12, 2.22, 0.12]} p={[0.06, 1.11, -0.55]} c={frame} />
		<B s={[0.12, 2.22, 0.12]} p={[0.06, 1.11, 0.55]} c={frame} />
		<B s={[0.06, 2.08, 0.96]} p={[0.04, 1.06, 0]} c={colour} />
		<B s={[0.03, 0.62, 0.62]} p={[0.08, 1.55, 0]} c={lighter(colour, 0.25)} />
		<B s={[0.03, 0.62, 0.62]} p={[0.08, 0.62, 0]} c={lighter(colour, 0.25)} />
		<Ball r={0.05} p={[0.12, 1.02, 0.34]} c={GOLD} />
		<B s={[0.6, 0.025, 0.95]} p={[0.42, 0.012, 0]} c={mat} />
		<B s={[0.5, 0.027, 0.85]} p={[0.42, 0.014, 0]} c={lighter(mat, 0.3)} />
	</group>
);

// ── Shapes ──

/** A flat shape pushed out into a solid, centred. */
function extruded(shape: Shape, depth: number) {
	const g = new ExtrudeGeometry(shape, {
		depth,
		bevelEnabled: true,
		bevelThickness: depth * 0.3,
		bevelSize: 0.012,
		bevelSegments: 1,
		curveSegments: 6,
	});
	g.center();
	return g;
}

/** A five-pointed star, `r` to the points. */
export function starGeometry(r: number, depth = 0.03) {
	const s = new Shape();
	for (let i = 0; i < 10; i++) {
		const a = Math.PI / 2 + (i * Math.PI) / 5;
		const rr = i % 2 ? r * 0.45 : r;
		if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
		else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
	}
	s.closePath();
	return extruded(s, depth);
}

/** A heart, about `r` across. */
export function heartGeometry(r: number, depth = 0.05) {
	const s = new Shape();
	s.moveTo(0, -r * 0.9);
	s.bezierCurveTo(-r * 0.2, -r * 0.55, -r, -r * 0.2, -r, r * 0.25);
	s.bezierCurveTo(-r, r * 0.75, -r * 0.3, r * 0.85, 0, r * 0.45);
	s.bezierCurveTo(r * 0.3, r * 0.85, r, r * 0.75, r, r * 0.25);
	s.bezierCurveTo(r, -r * 0.2, r * 0.2, -r * 0.55, 0, -r * 0.9);
	return extruded(s, depth);
}

/** A paw print facing +z (a pad and four toes), `s` across. */
export const paw = (p: V3, s: number, c: string, key?: string) => (
	<group key={key ?? `paw${p.join()}`} position={p} scale={s}>
		<Ball r={0.3} p={[0, -0.12, 0]} c={c} s={[1.15, 0.95, 0.35]} />
		{[-0.4, -0.14, 0.14, 0.4].map((dx, i) => (
			<Ball key={dx} r={0.13} p={[dx, 0.22 + (i === 1 || i === 2 ? 0.12 : 0), 0]} c={c} s={[1, 1.25, 0.35]} />
		))}
	</group>
);

/** A paw print flat on the floor, pointing along `rot`. */
export const floorPaw = (x: number, z: number, rot: number, c: string) => (
	<group key={`fp${x}${z}`} position={[x, 0.008, z]} rotation={[-Math.PI / 2, 0, rot]}>
		{paw([0, 0, 0], 0.16, c)}
	</group>
);

// ── Little moving things ──

/**
 * Fish swimming up and down a tank `len` long (along z) from `at`, each turning round at the ends. Still with
 * reduced motion.
 */
export function Fish({
	at,
	len,
	fish,
}: {
	at: V3;
	len: number;
	fish: { y: number; x: number; c: string; speed: number; phase: number }[];
}) {
	const refs = useRef<(Group | null)[]>([]);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame(({ clock }) => {
		if (reduced) return;
		wake("ambient");
		const t = clock.elapsedTime;
		fish.forEach((f, i) => {
			const g = refs.current[i];
			if (!g) return;
			const a = t * f.speed + f.phase;
			g.position.z = Math.sin(a) * (len / 2);
			g.position.y = f.y + Math.sin(a * 2.3) * 0.03;
			g.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
			g.rotation.z = Math.sin(t * 8 + i) * 0.08;
		});
	});
	return (
		<group position={at} userData={{ noCast: true }}>
			{fish.map((f, i) => (
				<group
					key={`${f.c}${i}`}
					ref={(g) => {
						refs.current[i] = g;
					}}
					position={[f.x, f.y, 0]}
				>
					<Static>
						<Ball r={0.07} p={[0, 0, 0]} c={f.c} s={[0.55, 1, 1.4]} />
						<Cyl r={0.001} r2={0.07} h={0.09} p={[0, 0, -0.12]} rot={[Math.PI / 2, 0, 0]} c={f.c} seg={6} />
						<Ball r={0.015} p={[0.035, 0.02, 0.06]} c="#2b2b33" />
						<Ball r={0.015} p={[-0.035, 0.02, 0.06]} c="#2b2b33" />
					</Static>
				</group>
			))}
		</group>
	);
}

/** Something that turns slowly round its own z axis (a hamster wheel). Still with reduced motion. */
export function Spin({ p, speed, children }: { p: V3; speed: number; children: ReactNode }) {
	const g = useRef<Group>(null);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	useFrame((_, dt) => {
		if (reduced || !g.current) return;
		wake("ambient");
		g.current.rotation.z -= dt * speed;
	});
	return (
		<group ref={g} position={p} userData={{ noCast: true }}>
			{children}
		</group>
	);
}

/** A find's model, baked into one draw call (it stays put until it's picked up, and FindBurst moves its group). */
export const baked = (node: ReactNode) => <Static>{node}</Static>;
