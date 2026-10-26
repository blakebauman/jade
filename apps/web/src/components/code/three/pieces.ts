import { at, type Board, sizeOf } from "@jade/core/code";
import {
	BoxGeometry,
	type BufferGeometry,
	ConeGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshToonMaterial,
	PlaneGeometry,
	Quaternion,
	Shape,
	SphereGeometry,
	Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonGradient } from "../../roxy/world/Furniture.tsx";

/**
 * The 3D garden's pieces, built in code with no canvas, so tests can count them. A square is one unit; square (x, y)
 * sits on the ground at world (x + 0.5, 0, y + 0.5). The grass top is y = 0.
 *
 * Colours match the flat board. Scenes are always daylit and never use the four law colours or brand red: the brass
 * is a brown brass (not marigold) and the pond a green-teal (not sky).
 */
export const C = {
	grass: "#a5d47f",
	grass2: "#97c96f",
	hedge: "#3e7d3b",
	hedgeHi: "#5a9c4c",
	pond: "#4a9fb4",
	pondHi: "#8fd0de",
	lily: "#6aa84f",
	soil: "#8a5a35",
	soilHi: "#a87148",
	seed: "#5b3a1e",
	shell: "#5f8f3e",
	shellHi: "#86b257",
	shellRim: "#476d2e",
	skin: "#9fc46a",
	chalk: "#fbfaf4",
	post: "#6b5844",
	glass: "#d9dee2",
	glow: "#fff3c4",
	flag: "#f7f7f2",
	flower: "#e98bc0",
	stem: "#4f8f3a",
	ink: "#24302a",
	brass: "#b08d57",
	wood: "#c08a52",
	woodDark: "#8f5f34",
};

/** Every board character. */
export const CHARS = [".", "#", "~", "s", "L", "b", "F", "o"] as const;

type V3 = [number, number, number];

const materials = new Map<string, MeshToonMaterial>();
/** One shared toon material per colour (the ones `Static` bakes away). */
export function toon(colour: string) {
	let m = materials.get(colour);
	if (!m) {
		m = new MeshToonMaterial({ color: colour, gradientMap: toonGradient() });
		materials.set(colour, m);
	}
	return m;
}

const geometries = new Map<string, BufferGeometry>();
/** Shapes are shared by size; they're never disposed (a few dozen small buffers). */
function geo(key: string, make: () => BufferGeometry) {
	let g = geometries.get(key);
	if (!g) {
		g = make();
		geometries.set(key, g);
	}
	return g;
}
const box = (w: number, h: number, d: number) => geo(`box${w}|${h}|${d}`, () => new BoxGeometry(w, h, d));
const rounded = (w: number, h: number, d: number) =>
	geo(`rbox${w}|${h}|${d}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.3));
const ball = (r: number, ws = 10, hs = 7) => geo(`ball${r}|${ws}|${hs}`, () => new SphereGeometry(r, ws, hs));
const cyl = (r: number, h: number, seg = 10, r2 = r) => geo(`cyl${r}|${r2}|${h}|${seg}`, () => new CylinderGeometry(r, r2, h, seg));
const cone = (r: number, h: number, seg = 8) => geo(`cone${r}|${h}|${seg}`, () => new ConeGeometry(r, h, seg));

function add(g: Group, shape: BufferGeometry, colour: string, p: V3 = [0, 0, 0], r?: V3, s?: V3) {
	const m = new Mesh(shape, toon(colour));
	m.position.set(...p);
	if (r) m.rotation.set(...r);
	if (s) m.scale.set(...s);
	g.add(m);
	return m;
}

function addHedge(g: Group) {
	add(g, rounded(0.86, 0.56, 0.86), C.hedge, [0, 0.28, 0]);
	add(g, ball(0.2), C.hedgeHi, [-0.17, 0.5, -0.14]);
	add(g, ball(0.17), C.hedgeHi, [0.17, 0.5, 0.12]);
	add(g, ball(0.13), C.hedgeHi, [0.12, 0.53, -0.2]);
}

/** A hedge alone (no grass), as one shape: the copy that shakes over the baked one when Tuck bumps it. */
export const hedgeShape = () =>
	geo("hedge", () => {
		const g = new Group();
		addHedge(g);
		return bake(g);
	});

let vertexToon: MeshToonMaterial | undefined;
/** Toon coloured by its vertices, for baked shapes drawn outside `Static`. */
export function bakedToon() {
	vertexToon ??= new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
	return vertexToon;
}

const TILE = 0.97;
const TILE_H = 0.1;

/**
 * What never changes on a square (grass, hedge, pond, a lantern's post, a bed's soil, the flag), centred on the
 * square's middle at the ground. `odd` picks the second grass shade, so squares can be counted.
 */
export function pieceFor(ch: string, odd = false): Group {
	const g = new Group();
	if (ch !== "~") add(g, box(TILE, TILE_H, TILE), odd ? C.grass2 : C.grass, [0, -TILE_H / 2, 0]);
	switch (ch) {
		case "#":
			addHedge(g);
			break;
		case "~":
			// Sunk below the grass round it, so the neighbours' green edges make a bank.
			add(g, box(1, 0.04, 1), C.pond, [0, -0.07, 0]);
			add(g, cyl(0.16, 0.012, 12), C.lily, [0.19, -0.044, 0.16]);
			add(g, cyl(0.08, 0.008, 10), C.pondHi, [-0.2, -0.046, -0.14]);
			add(g, cyl(0.05, 0.008, 8), C.pondHi, [-0.05, -0.046, -0.24]);
			break;
		case "L":
			add(g, cyl(0.1, 0.05, 10), C.post, [0, 0.025, 0]);
			add(g, cyl(0.032, 0.42, 8), C.post, [0, 0.23, 0]);
			add(g, box(0.2, 0.025, 0.2), C.post, [0, 0.43, 0]);
			add(g, cone(0.16, 0.12, 4), C.post, [0, 0.69, 0], [0, Math.PI / 4, 0]);
			add(g, ball(0.03, 8, 6), C.brass, [0, 0.77, 0]);
			break;
		case "b":
			add(g, box(0.78, 0.08, 0.78), C.soil, [0, 0.04, 0]);
			add(g, box(0.6, 0.03, 0.07), C.soilHi, [0, 0.085, -0.16]);
			add(g, box(0.6, 0.03, 0.07), C.soilHi, [0, 0.085, 0.16]);
			break;
		case "F": {
			add(g, cyl(0.09, 0.04, 10), C.post, [-0.12, 0.02, 0.05]);
			add(g, cyl(0.022, 0.9, 8), C.post, [-0.12, 0.45, 0.05]);
			add(g, ball(0.04, 8, 6), C.brass, [-0.12, 0.92, 0.05]);
			const pennant = geo("pennant", () => {
				const s = new Shape();
				s.moveTo(0, 0);
				s.lineTo(0.4, -0.13);
				s.lineTo(0, -0.26);
				s.closePath();
				return new ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
			});
			add(g, pennant, C.flag, [-0.1, 0.86, 0.04]);
			break;
		}
	}
	return g;
}

/**
 * The part of a square that changes with the garden, as one vertex-coloured shape (null if nothing does): a seed and
 * its mound, a lantern's glass, a bed's flower, and the chalk outline to draw over.
 */
export function livePieceFor(ch: string): BufferGeometry | null {
	switch (ch) {
		case "s":
			return geo("live-s", () => {
				const g = new Group();
				add(g, ball(0.2, 12, 6), C.soilHi, [0, 0, 0], undefined, [1, 0.3, 0.8]);
				add(g, ball(0.08, 10, 8), C.seed, [0, 0.07, 0], [0.3, 0, 0.2], [1, 1.5, 1]);
				return bake(g);
			});
		case "L":
			return geo("live-L", () => box(0.15, 0.2, 0.15).clone());
		case "b":
			return geo("live-b", () => {
				const g = new Group();
				add(g, cyl(0.018, 0.3, 6), C.stem, [0, 0.15, 0]);
				add(g, ball(0.06, 8, 6), C.stem, [0.06, 0.12, 0], [0, 0, -0.6], [1.6, 0.4, 0.8]);
				for (let i = 0; i < 5; i++) {
					const a = (i / 5) * Math.PI * 2;
					add(g, ball(0.06, 6, 5), C.flower, [Math.cos(a) * 0.075, 0.32, Math.sin(a) * 0.075], undefined, [1, 0.55, 1]);
				}
				add(g, ball(0.045, 8, 6), C.glow, [0, 0.34, 0]);
				return bake(g);
			});
		case "o":
			return geo("live-o", () => chalkOutline(0, 0));
		default:
			return null;
	}
}

/** A square's dashed chalk outline, flat on the grass, centred at (cx, cz). */
export function chalkOutline(cx: number, cz: number): BufferGeometry {
	const parts: BufferGeometry[] = [];
	const half = 0.38;
	const dash = 0.12;
	const gap = 0.07;
	const t = 0.045;
	const along = (horizontal: boolean, fixed: number) => {
		for (let s = -half; s < half - 0.01; s += dash + gap) {
			const len = Math.min(dash, half - s);
			const p = new PlaneGeometry(horizontal ? len : t, horizontal ? t : len);
			p.rotateX(-Math.PI / 2);
			p.translate(cx + (horizontal ? s + len / 2 : fixed), 0.006, cz + (horizontal ? fixed : s + len / 2));
			parts.push(p);
		}
	};
	along(true, -half);
	along(true, half);
	along(false, -half);
	along(false, half);
	const merged = mergeGeometries(parts);
	for (const p of parts) p.dispose();
	return merged;
}

/** Painted squares as one flat shape of chalk patches. */
export function chalkPatches(cells: { x: number; y: number }[]): BufferGeometry | null {
	if (!cells.length) return null;
	const parts = cells.map(({ x, y }) => {
		const p = new PlaneGeometry(0.8, 0.8);
		p.rotateX(-Math.PI / 2);
		p.translate(x + 0.5, 0.008, y + 0.5);
		return p;
	});
	const merged = mergeGeometries(parts);
	for (const p of parts) p.dispose();
	return merged;
}

/** Outlines still to draw over, as one shape. */
export function chalkOutlines(cells: { x: number; y: number }[]): BufferGeometry | null {
	if (!cells.length) return null;
	const parts = cells.map(({ x, y }) => chalkOutline(x + 0.5, y + 0.5));
	const merged = mergeGeometries(parts);
	for (const p of parts) p.dispose();
	return merged;
}

/** The fixed scenery for a whole board: the wooden plinth and every square's fixed piece. */
export function buildScenery(rows: readonly string[]): Group {
	const board: Board = { rows: [...rows], start: { x: 0, y: 0, dir: 0 } };
	const { w, h } = sizeOf(board);
	const g = new Group();
	// The plinth's top sits just under the grass, so the gaps between squares read as the tray they sit in.
	add(g, box(w + 0.44, 0.3, h + 0.44), C.wood, [w / 2, -0.21, h / 2]);
	add(g, box(w + 0.6, 0.1, h + 0.6), C.woodDark, [w / 2, -0.37, h / 2]);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const ch = at(board, { x, y });
			if (ch === " ") continue;
			const p = pieceFor(ch, (x + y) % 2 === 1);
			p.position.set(x + 0.5, 0, y + 0.5);
			g.add(p);
		}
	return g;
}

/** Every mesh in a group, for counting. */
export function meshesIn(g: Group): Mesh[] {
	const out: Mesh[] = [];
	g.traverse((o) => {
		if ((o as Mesh).isMesh) out.push(o as Mesh);
	});
	return out;
}

/** How many triangles a shape draws. */
export const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position!.count) / 3;

/**
 * Merges a group of plain toon meshes into one shape coloured per vertex (for something that moves as one, or is
 * drawn many times by instancing). The group must not be in a scene.
 */
export function bake(g: Group): BufferGeometry {
	g.updateMatrixWorld(true);
	const parts: BufferGeometry[] = [];
	g.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.isMesh) return;
		let part = mesh.geometry.clone();
		part = part.index ? part.toNonIndexed() : part;
		for (const name of Object.keys(part.attributes)) if (name !== "position" && name !== "normal") part.deleteAttribute(name);
		part.applyMatrix4(mesh.matrixWorld);
		const n = part.attributes.position!.count;
		const colour = new Float32Array(n * 3);
		const { r, g: gr, b } = (mesh.material as MeshToonMaterial).color;
		for (let i = 0; i < n * 3; i += 3) {
			colour[i] = r;
			colour[i + 1] = gr;
			colour[i + 2] = b;
		}
		part.setAttribute("color", new Float32BufferAttribute(colour, 3));
		parts.push(part);
	});
	const merged = mergeGeometries(parts);
	for (const p of parts) p.dispose();
	return merged;
}

// ── Tuck ──

export type TuckParts = {
	/** Shell, rim and hex plates. */
	shell: BufferGeometry;
	/** Head and eyes. */
	head: BufferGeometry;
	foot: BufferGeometry;
	/** The brass pen and its chalk tip, which slide down together when the pen is down. */
	pen: BufferGeometry;
};

/** Where Tuck's feet stand, facing north (−z). */
export const FEET: V3[] = [
	[-0.22, 0.04, -0.17],
	[0.22, 0.04, -0.17],
	[-0.22, 0.04, 0.17],
	[0.22, 0.04, 0.17],
];

/** How far the pen slides down to draw. */
export const PEN_DROP = 0.1;

/** Tuck, the code's turtle, built facing north (−z), about 0.8 of a square long. */
let tuckParts: TuckParts | undefined;
export function buildTuck(): TuckParts {
	if (tuckParts) return tuckParts;
	const R = 0.3;
	const S: V3 = [1, 0.62, 1.12];
	const Y0 = 0.1;
	const shell = new Group();
	add(shell, new SphereGeometry(R, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.shell, [0, Y0, 0], undefined, S);
	add(shell, cyl(R * 1.03, 0.04, 18), C.shellRim, [0, Y0, 0], undefined, [1, 1, S[2]]);
	// Hex plates: one on top, six round it, each laid flat on the dome.
	const plate = cyl(0.075, 0.02, 6);
	const up = new Vector3(0, 1, 0);
	const spots: [number, number][] = [[0, 0]];
	for (let i = 0; i < 6; i++) spots.push([(i / 6) * Math.PI * 2 + Math.PI / 6, 0.95]);
	for (const [theta, phi] of spots) {
		const p = new Vector3(Math.sin(phi) * Math.cos(theta) * R * S[0], Math.cos(phi) * R * S[1], Math.sin(phi) * Math.sin(theta) * R * S[2]);
		const n = new Vector3(p.x / (S[0] * S[0]), p.y / (S[1] * S[1]), p.z / (S[2] * S[2])).normalize();
		const m = add(shell, plate, C.shellHi, [p.x + n.x * 0.004, Y0 + p.y + n.y * 0.004, p.z + n.z * 0.004]);
		m.quaternion.copy(new Quaternion().setFromUnitVectors(up, n));
	}
	const head = new Group();
	add(head, ball(0.12, 12, 10), C.skin, [0, 0.14, -0.38]);
	add(head, ball(0.06, 8, 6), C.skin, [0, 0.09, -0.29]);
	for (const sx of [-1, 1]) {
		add(head, ball(0.024, 8, 6), C.ink, [sx * 0.055, 0.19, -0.47]);
		add(head, ball(0.009, 6, 4), C.chalk, [sx * 0.05, 0.2, -0.492]);
	}
	const foot = new Group();
	add(foot, ball(0.075, 10, 6), C.skin, [0, 0, 0], undefined, [1, 0.55, 1.25]);
	const pen = new Group();
	add(pen, cyl(0.034, 0.2, 10), C.brass, [0, 0.28, 0.33]);
	add(pen, cyl(0.04, 0.03, 10), C.ink, [0, 0.39, 0.33]);
	add(pen, cyl(0.04, 0.025, 10), C.brass, [0, 0.21, 0.31], undefined, [1, 1, 1.6]);
	add(pen, cone(0.03, 0.08, 8), C.chalk, [0, 0.14, 0.33], [Math.PI, 0, 0]);
	tuckParts = { shell: bake(shell), head: bake(head), foot: bake(foot), pen: bake(pen) };
	return tuckParts;
}

/** Tuck's heading as a turn about world up: `angle` is degrees clockwise from north, seen from above. */
export const headingY = (angle: number) => (-angle * Math.PI) / 180;

// ── The camera ──

/** Where the camera looks from (relative to what it looks at): a three-quarter view from in front, a little right. */
export const CAMERA_OFFSET = new Vector3(3.2, 11, 9.4);

/**
 * The board as the fixed camera sees it: its width and height in world units across the view, and the point the
 * camera should look at so the board sits in the middle (taller things, the flag and lanterns, included).
 */
export function viewBounds(w: number, h: number) {
	const forward = CAMERA_OFFSET.clone().negate().normalize();
	const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
	const upv = new Vector3().crossVectors(right, forward).normalize();
	let u0 = Number.POSITIVE_INFINITY;
	let u1 = Number.NEGATIVE_INFINITY;
	let v0 = Number.POSITIVE_INFINITY;
	let v1 = Number.NEGATIVE_INFINITY;
	const p = new Vector3();
	for (const x of [-0.3, w + 0.3])
		for (const z of [-0.3, h + 0.3])
			for (const y of [-0.42, 0.95]) {
				p.set(x, y, z);
				const u = p.dot(right);
				const v = p.dot(upv);
				u0 = Math.min(u0, u);
				u1 = Math.max(u1, u);
				v0 = Math.min(v0, v);
				v1 = Math.max(v1, v);
			}
	const look = right
		.clone()
		.multiplyScalar((u0 + u1) / 2)
		.add(upv.clone().multiplyScalar((v0 + v1) / 2));
	return { width: u1 - u0, height: v1 - v0, look };
}
