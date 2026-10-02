import type { Look, Slot } from "@jade/core/roxy";
import { useEffect, useMemo } from "react";
import { figureTexture } from "../world/texture.ts";
import { lathe, M, type V3 } from "./shapes.tsx";

/**
 * 3D Roxy's proportions: a chunky toy about 2.9 units tall (the same height as the world's squares expect), with a
 * big head. Clothes are shells around the same body, so they fit every shape.
 */

export type Shape3 = "slim" | "mid" | "round";
export type Dims3 = { shoulder: number; waist: number; hip: number; leg: number; legX: number; arm: number; depth: number };

export const DIMS3: Record<Shape3, Dims3> = {
	slim: { shoulder: 0.3, waist: 0.24, hip: 0.27, leg: 0.095, legX: 0.12, arm: 0.075, depth: 0.72 },
	mid: { shoulder: 0.33, waist: 0.29, hip: 0.31, leg: 0.11, legX: 0.135, arm: 0.085, depth: 0.74 },
	round: { shoulder: 0.38, waist: 0.38, hip: 0.39, leg: 0.125, legX: 0.15, arm: 0.095, depth: 0.78 },
};

export const Y = { ankle: 0.13, knee: 0.55, hip: 1.0, waist: 1.28, shoulder: 1.52, neck: 1.66, head: 2.2 } as const;
export const HEAD_R = 0.6;

const smooth = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t));

/** The body's radius at height y (before squashing front to back by `depth`). */
export function radiusAt(d: Dims3, y: number) {
	if (y <= Y.hip) return d.hip * Math.sqrt(Math.max(0, 1 - ((Y.hip - y) / 0.09) ** 2));
	if (y <= Y.waist) return smooth(d.hip, d.waist, (y - Y.hip) / (Y.waist - Y.hip));
	if (y <= Y.shoulder) return smooth(d.waist, d.shoulder, (y - Y.waist) / (Y.shoulder - Y.waist));
	// Round over the shoulders to the neck.
	const t = Math.min(1, (y - Y.shoulder) / (Y.neck - Y.shoulder));
	return 0.11 + (d.shoulder - 0.11) * Math.sqrt(Math.max(0, 1 - t * t));
}

/** A lathe profile for the body between two heights, `extra` further out (clothes sit just outside the skin). */
export function bodyProfile(d: Dims3, y0: number, y1: number, extra = 0, steps = 14): [number, number][] {
	const pts: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const y = y0 + ((y1 - y0) * i) / steps;
		pts.push([Math.max(0.01, radiusAt(d, y) + extra), y]);
	}
	return pts;
}

/** The torso in skin. */
export function Torso({ d, skin }: { d: Dims3; skin: string }) {
	return (
		<group scale={[1, 1, d.depth]}>
			<M c={skin}>
				<primitive object={lathe([[0.001, Y.hip - 0.09], ...bodyProfile(d, Y.hip - 0.088, Y.neck), [0.001, Y.neck]])} attach="geometry" />
			</M>
			<M c={skin} p={[0, Y.neck + 0.06, 0]}>
				<cylinderGeometry args={[0.1, 0.11, 0.16, 16]} />
			</M>
		</group>
	);
}

/** Face shapes are small changes to the head's proportions. */
export const HEAD_SCALE: Record<string, V3> = {
	"face-oval": [0.97, 1.05, 0.95],
	"face-round": [1.04, 0.99, 1],
	"face-heart": [1, 1.03, 0.95],
	"face-square": [1.03, 0.98, 0.98],
};

// ── The face ──

/** Slots drawn on the face, from the studio's own art. */
const FACE_SLOTS: Slot[] = ["eyes", "brows", "nose", "mouth", "marks", "blush", "eyeshadow", "lips", "facepaint"];
/** The SVG region the face covers, and the patch of the head's sphere it's wrapped onto. */
const FACE_VIEW = { x: 100, y: 112, w: 200, h: 166 };
export const FACE_PATCH = { phiLength: 1.6, thetaStart: 1.02, thetaLength: 1.32 };

/** Where a point of the SVG face lands on the head (for glasses and earrings), relative to the head's centre. */
export function onFace(svgX: number, svgY: number, out = 0): V3 {
	const u = (svgX - FACE_VIEW.x) / FACE_VIEW.w;
	const v = (svgY - FACE_VIEW.y) / FACE_VIEW.h;
	const phi = Math.PI / 2 - FACE_PATCH.phiLength / 2 + u * FACE_PATCH.phiLength;
	const theta = FACE_PATCH.thetaStart + v * FACE_PATCH.thetaLength;
	const r = HEAD_R + out;
	return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
}

/** The eyes, brows, mouth and makeup, wrapped onto the front of the head. */
export function Face({ look }: { look: Look }) {
	const key = JSON.stringify([
		look.slots.eyes,
		look.slots.brows,
		look.slots.nose,
		look.slots.mouth,
		look.slots.marks,
		look.slots.blush,
		look.slots.eyeshadow,
		look.slots.lips,
		look.slots.facepaint,
		look.slots.form,
		look.skin,
		look.slots.hair?.c1,
	]);
	// Keyed on `key`, the part of the look the face uses.
	const face = useMemo(() => figureTexture(look, FACE_VIEW, { only: FACE_SLOTS }), [key]);
	useEffect(() => () => face.texture.dispose(), [face]);
	return (
		<mesh>
			<sphereGeometry
				args={[
					HEAD_R + 0.004,
					40,
					30,
					Math.PI / 2 - FACE_PATCH.phiLength / 2,
					FACE_PATCH.phiLength,
					FACE_PATCH.thetaStart,
					FACE_PATCH.thetaLength,
				]}
			/>
			<meshBasicMaterial map={face.texture} transparent alphaTest={0.05} depthWrite={false} />
		</mesh>
	);
}
