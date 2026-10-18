import type { Animal, Emote } from "@jade/core/woods";
import {
	AdditiveBlending,
	BoxGeometry,
	CanvasTexture,
	Color,
	Group,
	type Material,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	PlaneGeometry,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
} from "three";
import { bake } from "./bake.ts";

/**
 * Everything that walks the island, built from boxes so it sits with the blocks: kids' figures, the lost animals and
 * the Night Deer. Materials are shared by colour, so a crowd of figures costs a handful of programs.
 */

const box = new BoxGeometry(1, 1, 1);
const lambert = new Map<string, MeshLambertMaterial>();
const glow = new Map<string, MeshBasicMaterial>();

function mat(colour: string) {
	const hit = lambert.get(colour);
	if (hit) return hit;
	const m = new MeshLambertMaterial({ color: new Color(colour) });
	lambert.set(colour, m);
	return m;
}
/** Unlit, so it glows in the dark (flames, antlers, an owl's eyes). */
function lit(colour: string) {
	const hit = glow.get(colour);
	if (hit) return hit;
	const m = new MeshBasicMaterial({ color: new Color(colour), transparent: true });
	glow.set(colour, m);
	return m;
}

function part(material: Material, w: number, h: number, d: number, x: number, y: number, z: number, parent: Group) {
	const m = new Mesh(box, material);
	m.scale.set(w, h, d);
	m.position.set(x, y, z);
	parent.add(m);
	return m;
}

export type FigureModel = { group: Group; legs: [Mesh, Mesh]; arms: [Mesh, Mesh]; bubble: Sprite };

/** A kid: boots, trousers, a jumper in their seat's colour, and a head. Faces -z, feet at y 0, 1.8 tall. */
export function figure(colour: string, label: string): FigureModel {
	const g = new Group();
	const legs: [Mesh, Mesh] = [
		part(mat("#3b4a6b"), 0.24, 0.74, 0.26, -0.13, 0.37, 0, g),
		part(mat("#3b4a6b"), 0.24, 0.74, 0.26, 0.13, 0.37, 0, g),
	];
	part(mat(colour), 0.54, 0.62, 0.3, 0, 1.05, 0, g);
	const arms: [Mesh, Mesh] = [
		part(mat(colour), 0.18, 0.62, 0.22, -0.36, 1.05, 0, g),
		part(mat(colour), 0.18, 0.62, 0.22, 0.36, 1.05, 0, g),
	];
	part(mat("#f0c7a0"), 0.46, 0.46, 0.46, 0, 1.6, 0, g);
	part(mat("#5a3a24"), 0.5, 0.14, 0.5, 0, 1.86, 0.02, g);
	part(mat("#2a2a33"), 0.07, 0.07, 0.02, -0.1, 1.63, -0.235, g);
	part(mat("#2a2a33"), 0.07, 0.07, 0.02, 0.1, 1.63, -0.235, g);
	// Legs and arms swing from the hip and shoulder.
	for (const m of [...legs, ...arms]) m.geometry = shifted;
	legs[0].position.y = legs[1].position.y = 0.74;
	arms[0].position.y = arms[1].position.y = 1.36;
	const tag = nameTag(label, colour);
	tag.position.set(0, 2.3, 0);
	g.add(tag);
	const bubble = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
	bubble.position.set(0, 2.85, 0);
	bubble.scale.set(0.6, 0.6, 1);
	bubble.visible = false;
	g.add(bubble);
	return { group: g, legs, arms, bubble };
}

/** A box with its top at the origin, so a limb scaled to length hangs down and swings from its top. */
const shifted = new BoxGeometry(1, 1, 1).translate(0, -0.5, 0);

export function swing(m: FigureModel, t: number, amount: number) {
	const a = Math.sin(t * 9) * 0.7 * amount;
	m.legs[0].rotation.x = a;
	m.legs[1].rotation.x = -a;
	m.arms[0].rotation.x = -a;
	m.arms[1].rotation.x = a;
}

/** A label over a figure's head, like the tile a kid is known by: a pale square with their initial or name. */
export function nameTag(label: string, colour: string): Sprite {
	const c = document.createElement("canvas");
	const wide = label.length > 1;
	c.width = wide ? 256 : 96;
	c.height = 96;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#f3e2bf";
		ctx.strokeStyle = colour;
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.roundRect(6, 6, c.width - 12, 84, 22);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = "#2b2118";
		ctx.font = `600 ${wide ? 46 : 56}px system-ui, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(label, c.width / 2, 50, c.width - 30);
	}
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	const s = new Sprite(new SpriteMaterial({ map: t, depthWrite: false }));
	s.scale.set((c.width / 96) * 0.42, 0.42, 1);
	return s;
}

const bubbles = new Map<Emote, CanvasTexture>();
/** A speech bubble with a heart, a star, a wave or an arrow in it, drawn as shapes (never emoji). */
export function emoteTexture(e: Emote): CanvasTexture {
	const hit = bubbles.get(e);
	if (hit) return hit;
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const ctx = c.getContext("2d")!;
	ctx.fillStyle = "#fffaf0";
	ctx.beginPath();
	ctx.arc(64, 58, 50, 0, Math.PI * 2);
	ctx.moveTo(52, 100);
	ctx.lineTo(64, 124);
	ctx.lineTo(76, 100);
	ctx.fill();
	ctx.lineWidth = 9;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	if (e === "heart") {
		ctx.fillStyle = "#e0436b";
		ctx.beginPath();
		ctx.moveTo(64, 86);
		ctx.bezierCurveTo(20, 58, 34, 22, 64, 42);
		ctx.bezierCurveTo(94, 22, 108, 58, 64, 86);
		ctx.fill();
	} else if (e === "star") {
		ctx.fillStyle = "#f2b81f";
		ctx.beginPath();
		for (let k = 0; k < 10; k++) {
			const r = k % 2 ? 15 : 34;
			const a = -Math.PI / 2 + (k * Math.PI) / 5;
			ctx.lineTo(64 + Math.cos(a) * r, 60 + Math.sin(a) * r);
		}
		ctx.fill();
	} else if (e === "wave") {
		ctx.strokeStyle = "#3b8fd9";
		for (const r of [14, 26, 38]) {
			ctx.beginPath();
			ctx.arc(46, 60, r, -0.8, 0.8);
			ctx.stroke();
		}
	} else {
		ctx.strokeStyle = "#3f9b5a";
		ctx.beginPath();
		ctx.moveTo(64, 30);
		ctx.lineTo(64, 84);
		ctx.moveTo(42, 62);
		ctx.lineTo(64, 86);
		ctx.lineTo(86, 62);
		ctx.stroke();
	}
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	bubbles.set(e, t);
	return t;
}

const ANIMAL_LOOK: Record<Animal, { body: string; head: string; extra: (g: Group) => void; size: number }> = {
	bunny: {
		body: "#f4f1ec",
		head: "#f4f1ec",
		size: 0.55,
		extra: (g) => {
			part(mat("#f4f1ec"), 0.08, 0.3, 0.06, -0.07, 0.62, -0.2, g);
			part(mat("#f4f1ec"), 0.08, 0.3, 0.06, 0.07, 0.62, -0.2, g);
			part(mat("#ffffff"), 0.12, 0.12, 0.1, 0, 0.26, 0.24, g);
		},
	},
	fox: {
		body: "#e07a2f",
		head: "#e98a3c",
		size: 0.65,
		extra: (g) => {
			part(mat("#e07a2f"), 0.12, 0.14, 0.4, 0, 0.32, 0.38, g);
			part(mat("#ffffff"), 0.12, 0.12, 0.12, 0, 0.32, 0.6, g);
			part(mat("#3a2a20"), 0.07, 0.12, 0.05, -0.1, 0.62, -0.24, g);
			part(mat("#3a2a20"), 0.07, 0.12, 0.05, 0.1, 0.62, -0.24, g);
		},
	},
	owl: {
		body: "#8a6a4a",
		head: "#9a7a58",
		size: 0.5,
		extra: (g) => {
			part(lit("#ffe9a0"), 0.1, 0.1, 0.02, -0.08, 0.5, -0.33, g);
			part(lit("#ffe9a0"), 0.1, 0.1, 0.02, 0.08, 0.5, -0.33, g);
		},
	},
	lamb: {
		body: "#f3f0e6",
		head: "#55504a",
		size: 0.65,
		extra: (g) => {
			part(mat("#f3f0e6"), 0.36, 0.12, 0.36, 0, 0.6, -0.2, g);
		},
	},
	hedgehog: {
		body: "#6b5440",
		head: "#d9bf9c",
		size: 0.45,
		extra: (g) => {
			part(mat("#3d2f24"), 0.42, 0.18, 0.48, 0, 0.36, 0.04, g);
		},
	},
	duckling: {
		body: "#f7d64a",
		head: "#f7d64a",
		size: 0.4,
		extra: (g) => {
			part(mat("#f08a24"), 0.14, 0.06, 0.12, 0, 0.42, -0.3, g);
		},
	},
};

const haloGeometry = new PlaneGeometry(2.2, 2.2);
let halo: MeshBasicMaterial | null = null;
function haloMaterial() {
	if (halo) return halo;
	const c = document.createElement("canvas");
	c.width = c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, "rgba(255,240,180,0.85)");
		g.addColorStop(0.45, "rgba(255,226,150,0.35)");
		g.addColorStop(1, "rgba(255,220,140,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
	}
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	halo = new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
	return halo;
}

/** A lost (or found) animal, about knee high, facing -z, with a soft glow under it so it can be found in the dark. */
export function animal(kind: Animal, glowing = true): Group {
	const look = ANIMAL_LOOK[kind];
	const g = new Group();
	const inner = new Group();
	part(mat(look.body), 0.4, 0.3, 0.5, 0, 0.25, 0.05, inner);
	part(mat(look.head), 0.3, 0.28, 0.28, 0, 0.45, -0.2, inner);
	part(mat("#22201e"), 0.05, 0.05, 0.02, -0.08, 0.5, -0.345, inner);
	part(mat("#22201e"), 0.05, 0.05, 0.02, 0.08, 0.5, -0.345, inner);
	look.extra(inner);
	inner.scale.setScalar(look.size / 0.5);
	g.add(inner);
	if (glowing) {
		// A soft round pool of light round its feet, so it can be found in the dark.
		const halo = new Mesh(haloGeometry, haloMaterial());
		halo.rotation.x = -Math.PI / 2;
		halo.position.y = 0.03;
		halo.renderOrder = 2;
		halo.name = "halo";
		g.add(halo);
	}
	return g;
}

/**
 * The Night Deer: tall, dark and shy, with branching antlers that glow like moonlight and two soft bright eyes. Built
 * facing -z; its four legs hang from the hips and shoulders (in `userData.legs`) so it can walk.
 */
export function deer(): Group {
	const g = new Group();
	const coat = mat("#2a3554");
	const dark = mat("#1b2238");
	const pale = mat("#c9d2e6");
	const hoof = mat("#12151f");
	const legs: Group[] = [];
	for (const [x, z] of [
		[-0.32, -0.72],
		[0.32, -0.72],
		[-0.3, 0.74],
		[0.3, 0.74],
	] as const) {
		const hip = new Group();
		hip.position.set(x, 1.5, z);
		part(dark, 0.2, 0.8, 0.22, 0, -0.4, 0, hip);
		part(coat, 0.15, 0.62, 0.16, 0, -1.08, 0, hip);
		part(hoof, 0.17, 0.12, 0.2, 0, -1.44, -0.02, hip);
		g.add(hip);
		legs.push(hip);
	}
	part(coat, 0.86, 0.72, 1.9, 0, 1.78, 0, g);
	part(dark, 0.92, 0.3, 0.6, 0, 1.6, -0.62, g);
	part(pale, 0.36, 0.22, 0.2, 0, 2.02, 0.98, g);
	const neck = part(coat, 0.4, 0.95, 0.42, 0, 2.38, -0.86, g);
	neck.rotation.x = 0.35;
	part(pale, 0.3, 0.5, 0.06, 0, 2.3, -1.08, g);
	part(coat, 0.46, 0.44, 0.62, 0, 2.95, -1.18, g);
	part(dark, 0.3, 0.26, 0.34, 0, 2.86, -1.58, g);
	part(hoof, 0.14, 0.08, 0.06, 0, 2.9, -1.76, g);
	for (const s of [-1, 1]) {
		const ear = part(coat, 0.32, 0.12, 0.08, 0.32 * s, 3.12, -1.06, g);
		ear.rotation.z = 0.35 * s;
	}
	// Antlers: a beam each side with three tines, all glowing softly.
	const antler = lit("#c4f3ff");
	for (const s of [-1, 1]) {
		part(antler, 0.08, 0.5, 0.08, 0.16 * s, 3.4, -1.04, g);
		const beam = part(antler, 0.5, 0.08, 0.08, 0.38 * s, 3.62, -1.0, g);
		beam.rotation.z = 0.3 * s;
		part(antler, 0.07, 0.36, 0.07, 0.3 * s, 3.82, -1.02, g);
		part(antler, 0.07, 0.44, 0.07, 0.56 * s, 3.9, -0.98, g);
		part(antler, 0.07, 0.3, 0.07, 0.68 * s, 3.66, -1.1, g);
	}
	part(lit("#d6f6ff"), 0.1, 0.08, 0.04, -0.17, 3.0, -1.5, g);
	part(lit("#d6f6ff"), 0.1, 0.08, 0.04, 0.17, 3.0, -1.5, g);
	// Bake the body, and each leg on its own (they swing), to a few draw calls.
	for (const leg of legs) g.remove(leg);
	const body = bake(g, { shadows: false, glowThroughFog: true });
	body.scale.setScalar(1.2);
	const baked = legs.map((leg) => {
		const b = bake(leg, { shadows: false });
		body.add(b);
		return b;
	});
	body.userData.legs = baked;
	return body;
}

/** Walks the deer's legs: diagonal pairs together, like a real deer's gentle walk. */
export function deerWalk(model: Group, t: number) {
	const legs = model.userData.legs as Group[];
	const a = Math.sin(t * 3.2) * 0.32;
	legs[0]!.rotation.x = a;
	legs[3]!.rotation.x = a;
	legs[1]!.rotation.x = -a;
	legs[2]!.rotation.x = -a;
}

/** The campfire: crossed logs, a ring of stones, and a flame of stacked glowing blocks that flicker. */
export function campfire(): { group: Group; flames: Mesh[] } {
	const g = new Group();
	const stone = mat("#7d7f86");
	for (let k = 0; k < 8; k++) {
		const a = (k / 8) * Math.PI * 2;
		part(stone, 0.22, 0.16, 0.22, Math.cos(a) * 0.42, 0.08, Math.sin(a) * 0.42, g);
	}
	const log = mat("#6b4a2b");
	part(log, 0.7, 0.14, 0.14, 0, 0.1, 0, g).rotation.y = 0.6;
	part(log, 0.7, 0.14, 0.14, 0, 0.16, 0, g).rotation.y = -0.6;
	const flames = [
		part(lit("#ff8a1f"), 0.42, 0.42, 0.42, 0, 0.36, 0, g),
		part(lit("#ffc93c"), 0.28, 0.32, 0.28, 0.02, 0.6, -0.02, g),
		part(lit("#fff3b0"), 0.14, 0.2, 0.14, -0.02, 0.8, 0.02, g),
	];
	for (const f of flames) f.userData.size = f.scale.clone();
	return { group: g, flames };
}
