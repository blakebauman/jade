import { useEffect, useMemo } from "react";
import { DoubleSide, type Texture } from "three";
import { type Area, canvasTexture } from "../stage.tsx";

/**
 * The board a place is built on, like a diorama on a table: outdoors a cut-away of turf, soil and pebbles under the
 * grass; indoors a timber plinth under the floor. Only the two sides facing the camera are drawn (front and right;
 * a drag turns the view 30° at most, never round the back). `extend` grows the board past the place's own squares
 * at the back and left, for scenery Roxy can't walk to (the street behind the park).
 *
 * Underneath, a soft shadow on the "table" grounds the whole thing.
 */

type Kind = "outdoor" | "indoor";
export type Extend = { back: number; left: number };

const DEPTH = { outdoor: 1.1, indoor: 0.55 } as const;

/** One metre of board side, drawn once per kind and repeated along each side. */
function sideTexture(kind: Kind, length: number) {
	const px = 128;
	return canvasTexture(
		px,
		px,
		(ctx) => {
			if (kind === "outdoor") {
				// Soil, darker as it goes down, with a band of rich topsoil, pebbles, and the turf lip hanging over.
				const g = ctx.createLinearGradient(0, 0, 0, px);
				g.addColorStop(0, "#a8754b");
				g.addColorStop(0.55, "#8d5f3c");
				g.addColorStop(1, "#6e4a31");
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, px, px);
				ctx.fillStyle = "rgba(60,36,20,0.22)";
				ctx.fillRect(0, 26, px, 6);
				ctx.fillRect(0, 78, px, 4);
				const pebble = (x: number, y: number, r: number, c: string) => {
					ctx.fillStyle = c;
					ctx.beginPath();
					ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
					ctx.fill();
				};
				// A few stones of different sizes, scattered unevenly (a fixed scatter, so every side matches).
				const stones = ["#b59b80", "#c9b39a", "#9c8670", "#a88d72"];
				const scatter = [
					[14, 48, 5],
					[52, 62, 3],
					[90, 44, 4],
					[118, 70, 2],
					[30, 92, 3],
					[74, 100, 6],
					[106, 112, 3],
					[8, 118, 2],
				];
				for (const [i, [x, y, r]] of scatter.entries()) pebble(x!, y!, r!, stones[i % stones.length]!);
				// The turf: a green lip with soft bumps hanging over the soil.
				ctx.fillStyle = "#7fbf5a";
				ctx.fillRect(0, 0, px, 12);
				for (let x = 0; x < px; x += 16) {
					ctx.beginPath();
					ctx.arc(x + 8, 12, 8, 0, Math.PI);
					ctx.fill();
				}
				ctx.fillStyle = "#5f9f45";
				ctx.fillRect(0, 0, px, 3);
			} else {
				// A painted timber plinth: a top board, panels, a dark kick line at the bottom.
				ctx.fillStyle = "#d6b48a";
				ctx.fillRect(0, 0, px, px);
				ctx.fillStyle = "#e6c9a2";
				ctx.fillRect(0, 0, px, 22);
				ctx.fillStyle = "rgba(90,58,30,0.35)";
				ctx.fillRect(0, 22, px, 3);
				ctx.fillRect(0, px - 14, px, 14);
				ctx.strokeStyle = "rgba(90,58,30,0.25)";
				ctx.lineWidth = 3;
				ctx.strokeRect(10, 36, px - 20, px - 60);
			}
		},
		[length, 1],
	);
}

export function Board({ area, kind, extend }: { area: Area; kind: Kind; extend?: Extend }) {
	const depth = DEPTH[kind];
	const x0 = -(extend?.left ?? 0);
	const z0 = -(extend?.back ?? 0);
	const w = area.w - x0;
	const d = area.d - z0;
	const front = useMemo(() => sideTexture(kind, w), [kind, w]);
	const right = useMemo(() => sideTexture(kind, d), [kind, d]);
	const shadow = useMemo(() => tableShadow(), []);
	useEffect(
		() => () => {
			front.dispose();
			right.dispose();
			shadow.dispose();
		},
		[front, right, shadow],
	);
	// The sides start at the ground's top (0) and go down `depth` past the 0.3 slab.
	const h = depth + 0.3;
	return (
		<group>
			<mesh position={[x0 + w / 2, -h / 2, area.d + 0.001]}>
				<planeGeometry args={[w, h]} />
				<meshLambertMaterial map={front} />
			</mesh>
			<mesh position={[area.w + 0.001, -h / 2, z0 + d / 2]} rotation={[0, Math.PI / 2, 0]}>
				<planeGeometry args={[d, h]} />
				<meshLambertMaterial map={right} color="#e8ddd2" />
			</mesh>
			{/* The table's shadow, a little down and to the front-left of the board. */}
			<mesh position={[x0 + w / 2 - 0.4, -h - 0.6, z0 + d / 2 + 0.6]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noShadow: true }}>
				<planeGeometry args={[w * 1.25, d * 1.3]} />
				<meshBasicMaterial map={shadow} transparent depthWrite={false} side={DoubleSide} />
			</mesh>
		</group>
	);
}

/** A soft rounded-rectangle shadow, dark in the middle and fading out. */
function tableShadow(): Texture {
	return canvasTexture(
		128,
		128,
		(ctx) => {
			const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
			g.addColorStop(0, "rgba(40,28,20,0.32)");
			g.addColorStop(0.6, "rgba(40,28,20,0.16)");
			g.addColorStop(1, "rgba(40,28,20,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 128, 128);
		},
		[1, 1],
	);
}
