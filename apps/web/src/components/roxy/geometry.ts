/**
 * The one body template every Roxy item is drawn on (viewBox 0 0 400 640). Items take the body shape and draw
 * from these numbers, so a shirt fits a slim, medium or round body alike.
 */

export type BodyShape = "slim" | "mid" | "round";

export const VIEW = { w: 400, h: 640 } as const;
export const CX = 200;

/** Head centre and the face's half-width/height. */
export const HEAD = { x: 200, y: 172, rx: 90, ry: 98 } as const;
export const EYE_Y = 186;
export const EYE_DX = 37;
export const BROW_Y = 150;
export const NOSE_Y = 214;
export const MOUTH_Y = 236;
export const EAR_Y = 188;

export const SHOULDER_Y = 292;
export const WAIST_Y = 385;
export const HIP_Y = 438;
export const ANKLE_Y = 590;

export type Dims = {
	/** Half-widths from the centre line. */
	shoulder: number;
	waist: number;
	hip: number;
	arm: number;
	leg: number;
	/** Distance of each leg's centre from the centre line. */
	legX: number;
};

export const DIMS: Record<BodyShape, Dims> = {
	slim: { shoulder: 54, waist: 44, hip: 50, arm: 24, leg: 30, legX: 23 },
	mid: { shoulder: 60, waist: 52, hip: 58, arm: 27, leg: 34, legX: 27 },
	round: { shoulder: 68, waist: 66, hip: 70, arm: 31, leg: 38, legX: 31 },
};

export const dims = (shape: BodyShape | undefined) => DIMS[shape ?? "mid"];

/** Half-width of the body at height `y`: tapering from shoulders to waist, then out to the hips. */
export function halfWidth(d: Dims, y: number, extra = 0) {
	const top = SHOULDER_Y + 22;
	if (y <= WAIST_Y) return d.shoulder + extra + (d.waist - d.shoulder) * Math.max(0, (y - top) / (WAIST_Y - top));
	if (y <= HIP_Y) return d.waist + extra + (d.hip - d.waist) * Math.sin(((y - WAIST_Y) / (HIP_Y - WAIST_Y)) * (Math.PI / 2));
	return d.hip + extra;
}

/**
 * Torso outline from the shoulders down to `bottom`, `extra` wider all round (clothes sit just outside the
 * skin), with an optional scooped neckline (half-width, depth).
 */
export function torso(d: Dims, bottom = HIP_Y, neck?: { w: number; depth: number }, extra = 0) {
	const sh = d.shoulder + extra;
	const top = SHOULDER_Y - extra / 2;
	const neckline = neck ? `L ${CX - neck.w},${top} Q ${CX},${top + neck.depth * 2} ${CX + neck.w},${top}` : "";
	const pts: number[] = [WAIST_Y - 40, WAIST_Y, (WAIST_Y + HIP_Y) / 2, HIP_Y].filter((y) => y < bottom);
	pts.push(bottom);
	const right = pts.map((y) => `L ${CX + halfWidth(d, y, extra)},${y}`).join(" ");
	const left = [...pts]
		.reverse()
		.map((y) => `L ${CX - halfWidth(d, y, extra)},${y}`)
		.join(" ");
	return `M ${CX - sh},${top + 22} Q ${CX - sh},${top} ${CX - sh + 22},${top} ${neckline} L ${CX + sh - 22},${top} Q ${CX + sh},${top} ${CX + sh},${top + 22} ${right} ${left} Z`;
}

/** An arm as a centre line, for a stroked path. `to` is how far down (0–1, shoulder to wrist). */
export function armPath(d: Dims, sign: 1 | -1, to = 1) {
	const x0 = CX + sign * (d.shoulder - d.arm / 2 + 9);
	const x1 = CX + sign * (d.shoulder + 20);
	const y0 = SHOULDER_Y + d.arm / 2;
	const y1 = 436;
	if (to >= 1) return `M ${x0},${y0} Q ${x0 + sign * 10},${(y0 + y1) / 2} ${x1},${y1}`;
	// Point part way along the same curve (quadratic Bézier, split at t).
	const cx = x0 + sign * 10;
	const cy = (y0 + y1) / 2;
	const t = to;
	const qx = x0 + (cx - x0) * t;
	const qy = y0 + (cy - y0) * t;
	const ex = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
	const ey = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
	return `M ${x0},${y0} Q ${qx},${qy} ${ex},${ey}`;
}

export const handAt = (d: Dims, sign: 1 | -1) => ({ x: CX + sign * (d.shoulder + 20), y: 444, r: d.arm * 0.62 });

/** A leg as a centre line from `from` down to `to`. */
export const legPath = (d: Dims, sign: 1 | -1, from = HIP_Y - 18, to = ANKLE_Y) =>
	`M ${CX + sign * d.legX},${from} L ${CX + sign * d.legX},${to}`;
export const footAt = (d: Dims, sign: 1 | -1) => ({ x: CX + sign * (d.legX + 5), y: ANKLE_Y + 10 });

/** Darken (amount < 0) or lighten (amount > 0) a hex colour. */
export function shade(hex: string, amount: number): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
	const r = mix((n >> 16) & 255);
	const g = mix((n >> 8) & 255);
	const b = mix(n & 255);
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Outline used on every shape: a soft dark line, never pure black. */
export const LINE = { stroke: "#2b1d14", strokeOpacity: 0.32, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
export const INK = "#2b1d14";
