import { CanvasTexture, SRGBColorSpace } from "three";
import { BLOCKS, type Block, PAVEMENT, ROAD, ROADS, SIZE } from "./town.ts";

/**
 * The town's ground, painted once onto a canvas: grey roads with dashed middles and zebra crossings, pale pavements
 * with a kerb, and each block's own floor (mown park grass with paths, garden lawns, the plaza's warm tiles, the
 * school's playground, the car park's bays). One texture for the whole board, so the ground is one draw.
 */

const PX = 2048;
const U = PX / SIZE;

const C = {
	road: "#868fa2",
	roadEdge: "#7a8396",
	line: "#f4f1e8",
	pavement: "#ebe3d4",
	kerb: "#cfc5b3",
	grass: "#94c972",
	grassStripe: "#8bc06a",
	lawn: "#a2cf7f",
	lawnStripe: "#99c776",
	path: "#eadcbf",
	plaza: "#ead6b6",
	plazaTile: "#dfc7a2",
	yard: "#b9bccb",
	yardLine: "#f7f4ff",
	tarmac: "#959cab",
};

export function groundTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = PX;
	canvas.height = PX;
	const ctx = canvas.getContext("2d");
	if (ctx) paint(ctx);
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

const rect = (ctx: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, c: string) => {
	ctx.fillStyle = c;
	ctx.fillRect(x * U, z * U, w * U, d * U);
};

function paint(ctx: CanvasRenderingContext2D) {
	rect(ctx, 0, 0, SIZE, SIZE, C.road);
	roads(ctx);
	for (const b of BLOCKS) block(ctx, b);
}

function roads(ctx: CanvasRenderingContext2D) {
	// A darker edge along each kerb, then dashes down the middle, broken at the crossroads.
	ctx.fillStyle = C.roadEdge;
	for (const band of ROADS) {
		ctx.fillRect(band * U, 0, 0.18 * U, PX);
		ctx.fillRect((band + ROAD - 0.18) * U, 0, 0.18 * U, PX);
		ctx.fillRect(0, band * U, PX, 0.18 * U);
		ctx.fillRect(0, (band + ROAD - 0.18) * U, PX, 0.18 * U);
	}
	ctx.fillStyle = C.line;
	const crossing = (t: number) => ROADS.some((r) => t > r - 1.6 && t < r + ROAD + 1.6);
	for (const band of ROADS) {
		const mid = band + ROAD / 2;
		for (let t = 0; t < SIZE; t += 1.6) {
			if (crossing(t) || crossing(t + 0.8)) continue;
			ctx.fillRect(t * U, (mid - 0.06) * U, 0.8 * U, 0.12 * U);
			ctx.fillRect((mid - 0.06) * U, t * U, 0.12 * U, 0.8 * U);
		}
	}
	// Zebra crossings on every road leaving a crossroads.
	for (const a of ROADS)
		for (const b of ROADS) {
			for (let k = 0; k < ROAD / 0.5; k++) {
				const s = a + 0.12 + k * 0.5;
				if (b + ROAD + 1.4 < SIZE) {
					ctx.fillRect(s * U, (b + ROAD + 0.35) * U, 0.28 * U, 0.9 * U);
					ctx.fillRect((b + ROAD + 0.35) * U, s * U, 0.9 * U, 0.28 * U);
				}
				if (b - 1.4 > 0) {
					ctx.fillRect(s * U, (b - 1.25) * U, 0.28 * U, 0.9 * U);
					ctx.fillRect((b - 1.25) * U, s * U, 0.9 * U, 0.28 * U);
				}
			}
		}
}

function block(ctx: CanvasRenderingContext2D, b: Block) {
	const w = b.x1 - b.x0;
	const d = b.z1 - b.z0;
	rect(ctx, b.x0, b.z0, w, d, C.kerb);
	rect(ctx, b.x0 + 0.12, b.z0 + 0.12, w - 0.24, d - 0.24, C.pavement);
	// Paving slab joints.
	ctx.fillStyle = C.kerb;
	for (let t = b.x0 + 1; t < b.x1; t += 1) {
		ctx.fillRect(t * U, b.z0 * U, 1, PAVEMENT * U);
		ctx.fillRect(t * U, (b.z1 - PAVEMENT) * U, 1, PAVEMENT * U);
	}
	for (let t = b.z0 + 1; t < b.z1; t += 1) {
		ctx.fillRect(b.x0 * U, t * U, PAVEMENT * U, 1);
		ctx.fillRect((b.x1 - PAVEMENT) * U, t * U, PAVEMENT * U, 1);
	}
	const x0 = b.x0 + PAVEMENT;
	const z0 = b.z0 + PAVEMENT;
	const iw = w - 2 * PAVEMENT;
	const id = d - 2 * PAVEMENT;
	const cx = (b.x0 + b.x1) / 2;
	const cz = (b.z0 + b.z1) / 2;
	switch (b.kind) {
		case "park":
			stripes(ctx, x0, z0, iw, id, C.grass, C.grassStripe);
			// Paths crossing to a round middle.
			rect(ctx, cx - 0.7, z0, 1.4, id, C.path);
			rect(ctx, x0, cz - 0.7, iw, 1.4, C.path);
			disc(ctx, cx, cz, 3, C.path);
			break;
		case "houses":
			stripes(ctx, x0, z0, iw, id, C.lawn, C.lawnStripe);
			rect(ctx, cx - 0.6, z0, 1.2, id, C.path);
			rect(ctx, x0, cz - 0.6, iw, 1.2, C.path);
			break;
		case "petshop":
			stripes(ctx, x0, z0, iw, id, C.lawn, C.lawnStripe);
			rect(ctx, b.x1 - 4.4, z0, 4.4 - PAVEMENT, 8, C.tarmac);
			bays(ctx, b.x1 - 4.2, z0 + 0.3, 3, 2.3, true);
			rect(ctx, x0, cz - 0.6, iw, 1.2, C.path);
			break;
		case "plaza":
			rect(ctx, x0, z0, iw, id, C.plaza);
			ctx.fillStyle = C.plazaTile;
			for (let i = 0; i < iw; i++) for (let j = 0; j < id; j++) if ((i + j) % 2) ctx.fillRect((x0 + i) * U, (z0 + j) * U, U, U);
			disc(ctx, cx, cz, 5.6, C.path);
			disc(ctx, cx, cz, 5.2, C.plaza);
			break;
		case "school":
			stripes(ctx, x0, z0, iw, id, C.lawn, C.lawnStripe);
			rect(ctx, b.x0 + 8, b.z0 + 7.5, b.x1 - b.x0 - 8 - PAVEMENT, b.z1 - b.z0 - 7.5 - PAVEMENT, C.yard);
			playground(ctx, b);
			break;
		case "carpark":
			rect(ctx, x0, z0, iw, id, C.tarmac);
			for (let row = 0; row < 3; row++) bays(ctx, b.x0 + 1.15, b.z0 + 1.6 + row * 4.6, 6, 2.1, false);
			break;
	}
}

/** Mown grass: wide stripes of two greens. */
function stripes(ctx: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, a: string, b: string) {
	rect(ctx, x, z, w, d, a);
	ctx.fillStyle = b;
	for (let t = 0; t < w; t += 2) ctx.fillRect((x + t) * U, z * U, U, d * U);
}

function disc(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, c: string) {
	ctx.fillStyle = c;
	ctx.beginPath();
	ctx.arc(x * U, z * U, r * U, 0, Math.PI * 2);
	ctx.fill();
}

/** Parking bays: white lines `gap` apart, `n` bays, running down z (`down`) or across x. */
function bays(ctx: CanvasRenderingContext2D, x: number, z: number, n: number, gap: number, down: boolean) {
	ctx.fillStyle = C.line;
	for (let i = 0; i <= n; i++) {
		if (down) ctx.fillRect(x * U, (z + i * gap) * U, 3.6 * U, 0.08 * U);
		else ctx.fillRect((x + i * gap) * U, z * U, 0.08 * U, 2.8 * U);
	}
}

/** Hopscotch and a painted circle in the school yard. */
function playground(ctx: CanvasRenderingContext2D, b: Block) {
	ctx.strokeStyle = C.yardLine;
	ctx.lineWidth = 0.08 * U;
	const x = b.x0 + 9.5;
	const z = b.z1 - 3;
	for (let i = 0; i < 5; i++) ctx.strokeRect((x + i * 0.7) * U, z * U, 0.7 * U, 0.7 * U);
	ctx.beginPath();
	ctx.arc((b.x1 - 4) * U, (b.z0 + 11) * U, 2 * U, 0, Math.PI * 2);
	ctx.stroke();
}
