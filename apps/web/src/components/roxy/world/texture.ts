import type { Look, Slot } from "@jade/core/roxy";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { RoxyFigure } from "../RoxyFigure.tsx";

/** Pixels per SVG unit when drawing a figure to a texture: crisp on a 2× iPad without huge textures. */
const SCALE = 1.6;

/**
 * A Roxy (or part of one) drawn onto a canvas texture, so the illustrated character can stand in the 3D world.
 * The same SVG art the studio shows, so every outfit, gem and pet works here with no new drawing.
 */
export function figureTexture(
	look: Look,
	view: { x: number; y: number; w: number; h: number },
	opts: { omit?: Slot[]; only?: Slot[] } = {},
) {
	const width = Math.round(view.w * SCALE);
	const height = Math.round(view.h * SCALE);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.generateMipmaps = false;

	const svg = renderToStaticMarkup(
		createElement(RoxyFigure, { look, viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`, size: { width, height }, ...opts }),
	);
	const img = new Image();
	// Wait until it has loaded before drawing; until then the texture is clear, never a broken image.
	const ready = new Promise<void>((resolve) => {
		img.onload = () => {
			const ctx = canvas.getContext("2d");
			ctx?.clearRect(0, 0, width, height);
			ctx?.drawImage(img, 0, 0, width, height);
			texture.needsUpdate = true;
			resolve();
		};
		img.onerror = () => resolve();
	});
	img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	return { texture, ready, aspect: view.w / view.h };
}
