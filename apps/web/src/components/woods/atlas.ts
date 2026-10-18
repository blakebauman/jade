import { seeded } from "@jade/core/math";
import { TILE_NAMES } from "@jade/core/woods";
import { CanvasTexture, NearestFilter, NearestMipmapLinearFilter, SRGBColorSpace } from "three";
import { ATLAS_COLS, ATLAS_ROWS } from "./mesher.ts";

/**
 * Every block's faces, drawn as 16×16 pixel art into one canvas: a base colour speckled with lighter and darker
 * pixels, and a few marks that say what the block is (bark rings, plank seams, brick courses, ore flecks). Drawn in
 * code, so there are no image files to load or precache.
 */

const S = 16;
type Px = (x: number, y: number, rgba: string) => void;
type Painter = (px: Px, rng: () => number) => void;

const speckle =
	(base: string, light: string, dark: string, amount = 0.35): Painter =>
	(px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const r = rng();
				px(x, y, r < amount / 2 ? dark : r < amount ? light : base);
			}
	};

const ore =
	(fleck: string, shine: string): Painter =>
	(px, rng) => {
		speckle("#8a8d93", "#9ea1a7", "#74777d")(px, rng);
		for (let n = 0; n < 6; n++) {
			const cx = 2 + Math.floor(rng() * 12);
			const cy = 2 + Math.floor(rng() * 12);
			px(cx, cy, fleck);
			px(cx + 1, cy, fleck);
			px(cx, cy + 1, rng() < 0.5 ? shine : fleck);
		}
	};

const wool =
	(base: string, light: string, dark: string): Painter =>
	(px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) px(x, y, (x + y) % 4 === 0 ? dark : (x * 3 + y) % 7 === 0 ? light : rng() < 0.1 ? light : base);
	};

/** A flower: a thin stem with two leaves and a five-petal head. */
const flower =
	(petal: string, middle: string): Painter =>
	(px) => {
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, "rgba(0,0,0,0)");
		for (let y = 7; y < S; y++) px(7, y, "#4a9a3a");
		px(6, 11, "#5fb04a");
		px(5, 10, "#5fb04a");
		px(8, 12, "#5fb04a");
		px(9, 11, "#5fb04a");
		for (const [dx, dy] of [
			[0, -2],
			[-2, 0],
			[2, 0],
			[-1, 2],
			[1, 2],
			[-1, -1],
			[1, -1],
			[0, 1],
			[-1, 1],
			[1, 1],
			[-2, -1],
			[2, -1],
		] as const)
			px(7 + dx, 4 + dy, petal);
		px(7, 4, middle);
		px(7, 5, middle);
	};

const PAINT: Record<string, Painter> = {
	// Soft and close in tone: grass covers most of the view, so it has to sit back.
	grass_top: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const r = rng();
				px(x, y, r < 0.1 ? "#58a645" : r < 0.22 ? "#6cba55" : r < 0.26 ? "#7cc663" : "#63b04d");
			}
	},
	grass_side: (px, rng) => {
		speckle("#8b5e3c", "#a2734d", "#704a2e")(px, rng);
		for (let x = 0; x < S; x++) {
			const drop = 3 + Math.floor(rng() * 3);
			for (let y = 0; y < drop; y++) px(x, y, rng() < 0.3 ? "#77c35d" : "#5fae4a");
		}
	},
	dirt: speckle("#8b5e3c", "#a2734d", "#704a2e"),
	stone: speckle("#8a8d93", "#9ea1a7", "#74777d", 0.45),
	sand: speckle("#e6d49a", "#f1e3b2", "#d4c083", 0.4),
	log_side: (px, rng) => {
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, x % 4 === 0 ? "#5a3d22" : rng() < 0.2 ? "#7b5532" : "#6b4a2b");
	},
	log_top: (px) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
				px(x, y, d > 6.5 ? "#5a3d22" : Math.floor(d) % 2 === 0 ? "#c9a36a" : "#b38c55");
			}
	},
	leaves: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const r = rng();
				px(x, y, r < 0.12 ? "rgba(0,0,0,0)" : r < 0.4 ? "#2f7d36" : r < 0.6 ? "#4fa04a" : "#3b8d3f");
			}
	},
	planks: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const seam = y % 4 === 3 || (x === (Math.floor(y / 4) % 2 ? 4 : 11) && y % 4 !== 3);
				px(x, y, seam ? "#8a6232" : rng() < 0.15 ? "#c9995a" : "#b9884b");
			}
	},
	glass: (px) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
				const glint = (x === 3 && y > 2 && y < 7) || (x === 4 && y > 3 && y < 6);
				px(x, y, edge ? "rgba(220,240,250,0.9)" : glint ? "rgba(255,255,255,0.75)" : "rgba(200,230,245,0.18)");
			}
	},
	brick: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const mortar = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7;
				px(x, y, mortar ? "#cfc6bb" : rng() < 0.2 ? "#b4523e" : "#a3473a");
			}
	},
	coal: ore("#2b2b2e", "#4a4a50"),
	iron: ore("#d9a988", "#f0c8ab"),
	gold: ore("#f2c93b", "#fff0a0"),
	gem: ore("#3fd6c6", "#b8fff6"),
	torch: (px) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const stick = x >= 7 && x <= 8;
				let c = "rgba(0,0,0,0)";
				if (stick && y >= 6) c = y % 3 === 0 ? "#6b4a2b" : "#8b6238";
				if (stick && y < 6) c = y < 2 ? "#fff3b0" : y < 4 ? "#ffc93c" : "#ff8a1f";
				px(x, y, c);
			}
	},
	birch_side: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const band = (y * 7 + Math.floor(x / 5) * 5) % 11 === 0 && rng() < 0.85;
				px(x, y, band ? "#3b3631" : rng() < 0.2 ? "#d9d4c7" : "#ece8dd");
			}
	},
	birch_top: (px) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
				px(x, y, d > 6.5 ? "#ece8dd" : Math.floor(d) % 2 === 0 ? "#e2c992" : "#d1b47a");
			}
	},
	birch_leaves: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const r = rng();
				px(x, y, r < 0.12 ? "rgba(0,0,0,0)" : r < 0.4 ? "#7fb24a" : r < 0.6 ? "#a2c95c" : "#8fbe52");
			}
	},
	pine_leaves: (px, rng) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				const r = rng();
				// Needles: short dark streaks, slanting.
				const needle = (x + y * 2) % 5 === 0;
				px(x, y, r < 0.1 ? "rgba(0,0,0,0)" : needle ? "#1f4f34" : r < 0.5 ? "#2c6644" : "#367653");
			}
	},
	tall_grass: (px, rng) => {
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, "rgba(0,0,0,0)");
		for (let k = 0; k < 7; k++) {
			const x0 = 1 + Math.floor(rng() * 14);
			const tall = 7 + Math.floor(rng() * 8);
			const lean = rng() < 0.5 ? -1 : 1;
			for (let t = 0; t < tall; t++) {
				const x = Math.min(15, Math.max(0, x0 + (t > tall * 0.6 ? lean : 0)));
				px(x, S - 1 - t, t > tall - 3 ? "#8fcf6a" : rng() < 0.3 ? "#4e9a3c" : "#62b04b");
			}
		}
	},
	flower_red: flower("#e0443a", "#f6d04d"),
	flower_yellow: flower("#f5cd32", "#e08a24"),
	flower_blue: flower("#4f7fe0", "#f2f0e6"),
	mushroom: (px) => {
		for (let y = 0; y < S; y++)
			for (let x = 0; x < S; x++) {
				let c = "rgba(0,0,0,0)";
				const capY = y >= 5 && y <= 9;
				const capX = Math.abs(x - 7.5) <= 6 - (9 - y) * 0.8;
				if (capY && capX) c = (x === 5 && y === 6) || (x === 9 && y === 7) || (x === 7 && y === 5) ? "#fff6ea" : "#d8433a";
				if (y > 9 && x >= 6 && x <= 9) c = "#f0e6d2";
				px(x, y, c);
			}
	},
	water: speckle("rgba(52,128,206,0.72)", "rgba(96,168,232,0.72)", "rgba(40,108,186,0.72)", 0.3),
	bedrock: speckle("#44464b", "#5c5f65", "#2e3034", 0.6),
	wool_white: wool("#efeeea", "#ffffff", "#d9d7d0"),
	wool_red: wool("#d6453d", "#e8645b", "#b9352f"),
	wool_yellow: wool("#f2c43a", "#fbd965", "#d9a823"),
	wool_green: wool("#5cae47", "#78c562", "#478f36"),
	wool_blue: wool("#3b7fd9", "#5f9ae6", "#2c66b8"),
	wool_pink: wool("#ec8fb6", "#f6acc9", "#d6739c"),
};

/** The atlas as a canvas: one tile per name in TILE_NAMES, left to right then down. */
export function drawAtlas(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = ATLAS_COLS * S;
	canvas.height = ATLAS_ROWS * S;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;
	TILE_NAMES.forEach((name, i) => {
		const ox = (i % ATLAS_COLS) * S;
		const oy = Math.floor(i / ATLAS_COLS) * S;
		const px: Px = (x, y, rgba) => {
			ctx.fillStyle = rgba;
			ctx.clearRect(ox + x, oy + y, 1, 1);
			ctx.fillRect(ox + x, oy + y, 1, 1);
		};
		PAINT[name]?.(px, seeded(i * 7919 + 13));
	});
	return canvas;
}

export function atlasTexture() {
	const t = new CanvasTexture(drawAtlas());
	t.magFilter = NearestFilter;
	// Crisp pixels up close; far off, mipmaps blend each tile down so distant leaves read as soft colour, not noise.
	t.minFilter = NearestMipmapLinearFilter;
	t.generateMipmaps = true;
	t.anisotropy = 4;
	t.colorSpace = SRGBColorSpace;
	return t;
}

/** One tile on its own, for the hotbar and inventory (a small canvas data URL). */
export function tileImage(name: string, atlas = drawAtlas()): string {
	const i = TILE_NAMES.indexOf(name);
	const c = document.createElement("canvas");
	c.width = S;
	c.height = S;
	const ctx = c.getContext("2d");
	if (!ctx || i < 0) return "";
	ctx.drawImage(atlas, (i % ATLAS_COLS) * S, Math.floor(i / ATLAS_COLS) * S, S, S, 0, 0, S, S);
	return c.toDataURL();
}

export const PAINTED = Object.keys(PAINT);
