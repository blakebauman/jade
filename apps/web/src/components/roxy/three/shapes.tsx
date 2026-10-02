import { hex, ITEM, type Look, type Slot } from "@jade/core/roxy";
import type { ReactNode } from "react";
import {
	CanvasTexture,
	Color,
	DoubleSide,
	LatheGeometry,
	NearestFilter,
	RepeatWrapping,
	Shape,
	SRGBColorSpace,
	type Texture,
	Vector2,
} from "three";
import { toonGradient } from "../world/Furniture.tsx";

/**
 * Building blocks for 3D Roxy: one toon material, fabric patterns drawn in code, and a few soft shapes (lathed
 * shells for clothes, capsules for limbs). Everything is made here, so there are no model files to load.
 */

export type V3 = [number, number, number];

/** The colours a worn item was given, as hex (c1, c2), falling back to grey. */
export function colours(look: Look, slot: Slot): { c1: string; c2: string } {
	const worn = look.slots[slot];
	const item = worn && ITEM.get(worn.item);
	const [p1, p2] = item?.colors ?? [];
	return { c1: p1 ? hex(p1, worn?.c1) : "#9aa3ad", c2: p2 ? hex(p2, worn?.c2) : "#f7f3ea" };
}

export const darker = (c: string, amount = 0.25) => `#${new Color(c).multiplyScalar(1 - amount).getHexString()}`;
export const lighter = (c: string, amount = 0.35) => `#${new Color(c).lerp(new Color("#ffffff"), amount).getHexString()}`;

/** The one material: toon-shaded colour, optionally with a pattern. */
export function Mat({
	c,
	map,
	side,
	opacity,
	emissive,
}: {
	c: string;
	map?: Texture | null;
	side?: "double";
	opacity?: number;
	emissive?: number;
}) {
	return (
		<meshToonMaterial
			color={map ? "#ffffff" : c}
			gradientMap={toonGradient()}
			{...(map && { map })}
			{...(side && { side: DoubleSide })}
			{...(opacity !== undefined && { transparent: true, opacity })}
			{...(emissive && { emissive: new Color(c), emissiveIntensity: emissive })}
		/>
	);
}

// ── Fabric patterns ──

export type Pattern =
	| "plain"
	| "stripes"
	| "dots"
	| "zigzag"
	| "check"
	| "kente"
	| "sequin"
	| "hearts"
	| "stars"
	| "splash"
	| "flowers"
	| "bands"
	| "pleats"
	| "ribs";

const patterns = new Map<string, CanvasTexture>();
/** A small repeating fabric texture in the item's colours. Cached, since many figures share them. */
export function fabric(pattern: Pattern, c1: string, c2: string, repeat: [number, number] = [6, 3]): CanvasTexture | null {
	if (pattern === "plain") return null;
	const key = `${pattern}|${c1}|${c2}|${repeat}`;
	const hit = patterns.get(key);
	if (hit) return hit;
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = c1;
	ctx.fillRect(0, 0, 64, 64);
	ctx.fillStyle = c2;
	ctx.strokeStyle = c2;
	const shape = (draw: () => void) => {
		ctx.beginPath();
		draw();
		ctx.closePath();
		ctx.fill();
	};
	switch (pattern) {
		case "stripes":
			ctx.fillRect(0, 0, 64, 22);
			break;
		case "bands":
			ctx.fillRect(0, 32, 64, 32);
			break;
		case "pleats":
			ctx.fillStyle = darker(c1, 0.18);
			for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 3, 64);
			break;
		case "ribs":
			ctx.fillStyle = darker(c1, 0.15);
			for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 3);
			break;
		case "dots":
			shape(() => ctx.arc(16, 16, 8, 0, Math.PI * 2));
			shape(() => ctx.arc(48, 48, 8, 0, Math.PI * 2));
			break;
		case "sequin":
			ctx.fillStyle = lighter(c1, 0.5);
			for (let y = 4; y < 64; y += 10) for (let x = (y / 10) % 2 ? 4 : 9; x < 64; x += 10) shape(() => ctx.arc(x, y, 3, 0, Math.PI * 2));
			break;
		case "zigzag":
			ctx.lineWidth = 7;
			ctx.beginPath();
			ctx.moveTo(0, 40);
			for (let x = 0; x <= 64; x += 16) ctx.lineTo(x + 8, x % 32 ? 40 : 24);
			ctx.stroke();
			break;
		case "check":
			ctx.globalAlpha = 0.65;
			ctx.fillRect(0, 0, 64, 14);
			ctx.fillRect(0, 32, 64, 14);
			ctx.fillRect(0, 0, 14, 64);
			ctx.fillRect(32, 0, 14, 64);
			break;
		case "kente":
			for (let y = 0; y < 4; y++)
				for (let x = 0; x < 4; x++) {
					ctx.fillStyle = ["#2f9e6b", "#b3263f", "#2b2b33", "#e0a526"][(x + y) % 4]!;
					ctx.fillRect(x * 16, y * 16, 16, 9);
				}
			break;
		case "hearts":
			for (const [x, y] of [
				[16, 18],
				[48, 50],
			])
				shape(() => {
					ctx.moveTo(x!, y! + 9);
					ctx.bezierCurveTo(x! - 13, y!, x! - 8, y! - 10, x!, y! - 3);
					ctx.bezierCurveTo(x! + 8, y! - 10, x! + 13, y!, x!, y! + 9);
				});
			break;
		case "stars":
			for (const [x, y] of [
				[16, 16],
				[48, 48],
			])
				shape(() => {
					for (let i = 0; i < 10; i++) {
						const a = (Math.PI / 5) * i - Math.PI / 2;
						const r = i % 2 ? 4 : 10;
						ctx.lineTo(x! + Math.cos(a) * r, y! + Math.sin(a) * r);
					}
				});
			break;
		case "splash":
			for (const [x, y, c] of [
				[14, 14, "#e85d75"],
				[46, 20, "#f2c94c"],
				[24, 46, "#5fc9a3"],
				[52, 52, "#a873d9"],
			] as const) {
				ctx.fillStyle = c;
				shape(() => ctx.arc(x, y, 9, 0, Math.PI * 2));
			}
			break;
		case "flowers":
			for (const [x, y] of [
				[16, 16],
				[48, 46],
			]) {
				ctx.fillStyle = c2;
				for (let i = 0; i < 5; i++) {
					const a = (i / 5) * Math.PI * 2;
					shape(() => ctx.arc(x! + Math.cos(a) * 5, y! + Math.sin(a) * 5, 4, 0, Math.PI * 2));
				}
				ctx.fillStyle = "#f2c94c";
				shape(() => ctx.arc(x!, y!, 3, 0, Math.PI * 2));
			}
			break;
	}
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	t.wrapS = RepeatWrapping;
	t.wrapT = RepeatWrapping;
	t.magFilter = NearestFilter;
	t.repeat.set(...repeat);
	patterns.set(key, t);
	return t;
}

// ── Shapes ──

const lathes = new Map<string, LatheGeometry>();
/**
 * A body-shaped shell turned around the y axis from a (radius, height) profile. `open` leaves a gap at the front
 * (an open jacket); `back` keeps only the back half (a cape).
 */
export function lathe(profile: [number, number][], opts: { open?: number; back?: boolean } = {}) {
	const key = `${profile.map((p) => p.map((n) => n.toFixed(3)).join(",")).join(";")}|${opts.open ?? 0}|${opts.back ?? false}`;
	let g = lathes.get(key);
	if (!g) {
		const points = profile.map(([r, y]) => new Vector2(r, y));
		g = opts.back
			? new LatheGeometry(points, 24, Math.PI / 2, Math.PI)
			: new LatheGeometry(points, 40, opts.open ?? 0, Math.PI * 2 - 2 * (opts.open ?? 0));
		lathes.set(key, g);
	}
	return g;
}

/** A mesh with the toon material. */
export function M({
	children,
	p,
	r,
	s,
	c,
	map,
	side,
	onClick,
}: {
	children: ReactNode;
	p?: V3;
	r?: V3;
	s?: V3 | number;
	c: string;
	map?: Texture | null;
	side?: "double";
	onClick?: () => void;
}) {
	return (
		<mesh position={p} rotation={r} scale={s} onClick={onClick}>
			{children}
			<Mat c={c} {...(map !== undefined && { map })} {...(side && { side })} />
		</mesh>
	);
}

/** A capsule hanging down from its top end (limbs, sleeves, strands of hair). */
export function Hang({ r, len, c, p, rot, map }: { r: number; len: number; c: string; p?: V3; rot?: V3; map?: Texture | null }) {
	return (
		<group position={p} rotation={rot}>
			<M p={[0, -len / 2, 0]} c={c} {...(map !== undefined && { map })}>
				<capsuleGeometry args={[r, Math.max(0.001, len - 2 * r), 6, 14]} />
			</M>
		</group>
	);
}

export function Ball({ r, p, c, s, emissive }: { r: number; p?: V3; c: string; s?: V3; emissive?: number }) {
	return (
		<mesh position={p} scale={s}>
			<sphereGeometry args={[r, 22, 16]} />
			<Mat c={c} {...(emissive && { emissive })} />
		</mesh>
	);
}

export function Cone({
	r,
	h,
	p,
	c,
	rot,
	r2 = 0,
	seg = 18,
}: {
	r: number;
	h: number;
	p?: V3;
	c: string;
	rot?: V3;
	r2?: number;
	seg?: number;
}) {
	return (
		<mesh position={p} rotation={rot}>
			<cylinderGeometry args={[r2, r, h, seg]} />
			<Mat c={c} />
		</mesh>
	);
}

export function Ring({
	r,
	tube,
	p,
	c,
	rot,
	arc = Math.PI * 2,
	seg = 28,
}: {
	r: number;
	tube: number;
	p?: V3;
	c: string;
	rot?: V3;
	arc?: number;
	seg?: number;
}) {
	return (
		<mesh position={p} rotation={rot}>
			<torusGeometry args={[r, tube, 10, seg, arc]} />
			<Mat c={c} />
		</mesh>
	);
}

/** Flat shapes for motifs on clothes and frames: a heart and a star, extruded a little. */
export function heartShape(s: number) {
	const sh = new Shape();
	sh.moveTo(0, -s * 0.9);
	sh.bezierCurveTo(-s * 1.4, 0, -s * 0.9, s * 1.1, 0, s * 0.35);
	sh.bezierCurveTo(s * 0.9, s * 1.1, s * 1.4, 0, 0, -s * 0.9);
	return sh;
}
export function starShape(r: number, points = 5, inner = 0.45) {
	const sh = new Shape();
	for (let i = 0; i < points * 2; i++) {
		const a = (Math.PI / points) * i + Math.PI / 2;
		const rr = i % 2 ? r * inner : r;
		const x = Math.cos(a) * rr;
		const y = Math.sin(a) * rr;
		if (i === 0) sh.moveTo(x, y);
		else sh.lineTo(x, y);
	}
	sh.closePath();
	return sh;
}
export function Flat({ shape, c, p, rot, depth = 0.02 }: { shape: Shape; c: string; p?: V3; rot?: V3; depth?: number }) {
	return (
		<mesh position={p} rotation={rot}>
			<extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
			<Mat c={c} />
		</mesh>
	);
}
