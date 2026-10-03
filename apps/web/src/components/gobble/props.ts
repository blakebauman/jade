import {
	BoxGeometry,
	type BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Euler,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Matrix4,
	Quaternion,
	Shape,
	SphereGeometry,
	TorusGeometry,
	Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { KindId } from "./kinds.ts";

/**
 * The things in Gobble Town, built from chunky toy shapes in code: one merged geometry per kind, coloured per vertex,
 * so the town draws each kind as one instanced mesh. Every prop stands on y = 0, centred on its footprint and inside
 * its circle (`r` in kinds.ts). Cars, the bus and the bench run along x (vehicles face +x; the bench's seat faces
 * +z); buildings, the kiosk and the signs face +z.
 *
 * `body` carries a `tint` attribute: 1 on parts painted the copy's colour (their vertex colour is white, and the
 * renderer multiplies in the instance colour), 0 elsewhere. `glow` holds what lights up at Night (lamp glass,
 * windows, clock faces, headlights), drawn with an emissive material in the same instance transforms.
 */

export type PropGeometry = { body: BufferGeometry; glow?: BufferGeometry };

type V3 = [number, number, number];

/** Paint a part with the copy's own colour. */
const TINT = "tint";

// The same paints as Roxy's town (Furniture.tsx, street.tsx).
const WOOD = "#c9965f";
const WOOD_DARK = "#9c6b3f";
const WHITE = "#f6f1e7";
const CREAM = "#fff6e6";
const LEAF = "#5fa04a";
const LEAF_LIGHT = "#7dbf52";
const LEAF_DARK = "#4a8a3a";
const POT = "#d9734a";
const GOLD = "#e8b93c";
const IRON = "#3f4a5c";
const TYRE = "#3a3d48";
const RED = "#d8413c";
const BERRY = "#e85d75";
const BLUE = "#3d74c9";
const SUN = "#f2c94c";
const ORANGE = "#f08a3c";
const PINK = "#f6b6c8";
const GLASS = "#bfe3f0";
const STONE = "#d4c9b5";
const STONE_LIGHT = "#e6dccb";
const WATER = "#8cc7ec";
const SPRAY = "#cfeaf6";
/** Windows and lamps lit from inside. */
const WARM = "#fff2b8";
const CLOCK = "#fff6cf";

type Pose = {
	/** Turns, applied z, then x, then y. */
	rx?: number;
	ry?: number;
	rz?: number;
	/** Scale before turning; always positive, so faces never turn inside out. */
	s?: V3;
	/** Part of the Night glow instead of the body. */
	glow?: boolean;
};

/** Collects a prop's parts, each placed by a matrix and painted, then merges them. */
class Parts {
	private body: BufferGeometry[] = [];
	private glows: BufferGeometry[] = [];
	private frame = new Matrix4();

	/** Builds `fn`'s parts moved to `at` and turned `ry` about the vertical. */
	group(at: V3, ry: number, fn: () => void) {
		const saved = this.frame.clone();
		this.frame.multiply(new Matrix4().makeTranslation(...at)).multiply(new Matrix4().makeRotationY(ry));
		fn();
		this.frame = saved;
	}

	add(geometry: BufferGeometry, colour: string, at: V3, pose: Pose = {}) {
		const s = pose.s ?? [1, 1, 1];
		if (s.some((n) => n <= 0)) throw new Error("props: scales must be positive");
		const m = new Matrix4().compose(
			new Vector3(...at),
			new Quaternion().setFromEuler(new Euler(pose.rx ?? 0, pose.ry ?? 0, pose.rz ?? 0, "YXZ")),
			new Vector3(...s),
		);
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
		g.clearGroups();
		g.applyMatrix4(new Matrix4().multiplyMatrices(this.frame, m));
		const n = g.getAttribute("position").count;
		const tinted = colour === TINT && !pose.glow;
		const c = new Color(tinted ? "#ffffff" : colour);
		const colours = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b], i * 3);
		g.setAttribute("color", new Float32BufferAttribute(colours, 3));
		g.setAttribute("tint", new Float32BufferAttribute(new Float32Array(n).fill(tinted ? 1 : 0), 1));
		(pose.glow ? this.glows : this.body).push(g);
	}

	/** A box by its size and centre. `round` is the rounded corners' segments (0: a plain box). */
	box(size: V3, at: V3, colour: string, pose: Pose & { round?: number } = {}) {
		const round = pose.round ?? 1;
		const g = round
			? new RoundedBoxGeometry(size[0], size[1], size[2], round, Math.min(...size) * 0.25)
			: new BoxGeometry(size[0], size[1], size[2]);
		this.add(g, colour, at, pose);
	}

	/** A cylinder (or a frustum: `top` and `bottom` radii) by its centre, upright unless turned. */
	cyl(top: number, bottom: number, h: number, at: V3, colour: string, pose: Pose & { seg?: number; open?: boolean } = {}) {
		this.add(new CylinderGeometry(top, bottom, h, pose.seg ?? 10, 1, pose.open ?? false), colour, at, pose);
	}

	/** A disc facing +z (a sign, a clock face). */
	disc(r: number, depth: number, at: V3, colour: string, pose: Pose & { seg?: number } = {}) {
		this.cyl(r, r, depth, at, colour, { ...pose, rx: Math.PI / 2 });
	}

	ball(r: number, at: V3, colour: string, pose: Pose & { w?: number; hs?: number } = {}) {
		this.add(new SphereGeometry(r, pose.w ?? 10, pose.hs ?? 8), colour, at, pose);
	}

	cone(r: number, h: number, at: V3, colour: string, pose: Pose & { seg?: number } = {}) {
		this.add(new ConeGeometry(r, h, pose.seg ?? 10), colour, at, pose);
	}

	/** A ring lying flat. */
	ring(radius: number, tube: number, at: V3, colour: string, pose: Pose & { seg?: number } = {}) {
		this.add(new TorusGeometry(radius, tube, 5, pose.seg ?? 16), colour, at, { rx: Math.PI / 2, ...pose });
	}

	/** A triangular prism along x (a gable end under a roof), base at `at`. */
	prism(width: number, height: number, length: number, at: V3, colour: string) {
		const shape = new Shape();
		shape.moveTo(-width / 2, 0);
		shape.lineTo(width / 2, 0);
		shape.lineTo(0, height);
		shape.closePath();
		const g = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
		g.translate(0, 0, -length / 2);
		g.rotateY(Math.PI / 2);
		this.add(g, colour, at);
	}

	done(): PropGeometry {
		const merge = (list: BufferGeometry[]) => {
			const g = mergeGeometries(list, false);
			if (!g) throw new Error("props: parts didn't merge");
			g.computeBoundingBox();
			g.computeBoundingSphere();
			return g;
		};
		return { body: merge(this.body), ...(this.glows.length > 0 && { glow: merge(this.glows) }) };
	}
}

/**
 * A pitched roof along x: two thick slabs meeting at the ridge, over a gable in the wall colour. `half` is how far
 * the eaves reach from the middle in z, `wallHalf` the wall's; the roof's foot sits at `y`.
 */
function roof(
	p: Parts,
	o: { len: number; wallLen: number; half: number; wallHalf: number; rise: number; y: number; colour: string; wall: string; t: number },
) {
	const a = Math.atan2(o.rise, o.half);
	const slope = Math.hypot(o.half, o.rise);
	for (const side of [1, -1]) {
		p.box(
			[o.len, o.t, slope + o.t],
			[0, o.y + o.rise / 2 + (Math.cos(a) * o.t) / 2, side * (o.half / 2 + (Math.sin(a) * o.t) / 2)],
			o.colour,
			{ rx: side * a },
		);
	}
	p.cyl(o.t * 0.7, o.t * 0.7, o.len + 0.04, [0, o.y + o.rise + o.t * 0.6, 0], o.colour, { rz: Math.PI / 2, seg: 8 });
	p.prism(o.wallHalf * 2, (o.rise * o.wallHalf) / o.half, o.wallLen, [0, o.y, 0], o.wall);
}

/** A window on a +z wall: a glowing pane in a frame with a cross of bars and a sill. */
function pane(p: Parts, at: V3, w: number, h: number, frame = WHITE) {
	const [x, y, z] = at;
	p.box([w, h, 0.06], [x, y, z + 0.02], WARM, { round: 0, glow: true });
	p.box([w + 0.14, h + 0.14, 0.04], [x, y, z], frame, { round: 0 });
	p.box([w, 0.05, 0.06], [x, y, z + 0.04], frame, { round: 0 });
	p.box([0.05, h, 0.06], [x, y, z + 0.04], frame, { round: 0 });
	p.box([w + 0.24, 0.07, 0.16], [x, y - h / 2 - 0.08, z + 0.06], frame, { round: 0 });
}

/** A striped awning across a +z wall, its foot at `y`, with a scalloped edge. */
function awning(p: Parts, width: number, stripes: number, y: number, z: number, depth: number, colours: [string, string]) {
	const sw = width / stripes;
	const tilt = 0.42;
	for (let i = 0; i < stripes; i++) {
		const x = -width / 2 + sw * (i + 0.5);
		const colour = i % 2 ? colours[1] : colours[0];
		p.box([sw, 0.05, depth], [x, y + (Math.sin(tilt) * depth) / 2, z + (Math.cos(tilt) * depth) / 2], colour, { rx: tilt, round: 0 });
		p.ball(sw * 0.5, [x, y - 0.02, z + Math.cos(tilt) * depth], colour, { s: [1, 0.55, 0.35], w: 8, hs: 5 });
	}
}

/** A wheel along z (for things that drive along x). */
function wheel(p: Parts, at: V3, r: number, w: number) {
	p.cyl(r, r, w, at, TYRE, { rx: Math.PI / 2, seg: 9 });
	p.cyl(r * 0.42, r * 0.42, w + 0.01, at, WHITE, { rx: Math.PI / 2, seg: 6 });
}

const BUILD: Record<KindId, (p: Parts) => void> = {
	flower(p) {
		// Kept light: there are hundreds. A stem, a leaf, one flat five-lobed bloom and a yellow middle.
		p.cyl(0.014, 0.014, 0.27, [0, 0.135, 0], LEAF_DARK, { seg: 4, open: true });
		p.ball(0.05, [0.04, 0.1, 0], LEAF, { s: [1, 0.3, 0.5], rz: 0.5, w: 5, hs: 3 });
		p.cyl(0.12, 0.09, 0.05, [0, 0.28, 0], TINT, { seg: 5 });
		p.ball(0.04, [0, 0.31, 0], SUN, { w: 5, hs: 3 });
	},

	cone(p) {
		p.box([0.32, 0.05, 0.32], [0, 0.025, 0], "#d9732f");
		p.cyl(0.105, 0.14, 0.13, [0, 0.115, 0], ORANGE);
		p.cyl(0.08, 0.105, 0.09, [0, 0.225, 0], WHITE);
		p.cyl(0.045, 0.08, 0.13, [0, 0.335, 0], ORANGE);
		p.cyl(0.02, 0.045, 0.04, [0, 0.42, 0], ORANGE);
	},

	ball(p) {
		p.ball(0.21, [0, 0.21, 0], TINT, { w: 12, hs: 8 });
		p.cyl(0.213, 0.213, 0.07, [0, 0.21, 0], WHITE, { seg: 12, open: true, rz: 0.35 });
		p.ball(0.05, [-0.07, 0.4, 0], WHITE, { s: [1, 0.4, 1], rz: 0.35, w: 6, hs: 4 });
	},

	hydrant(p) {
		p.cyl(0.16, 0.16, 0.06, [0, 0.03, 0], RED);
		p.cyl(0.11, 0.11, 0.36, [0, 0.24, 0], RED);
		p.cyl(0.14, 0.14, 0.05, [0, 0.425, 0], "#b8322e");
		p.ball(0.11, [0, 0.45, 0], RED, { s: [1, 0.8, 1], hs: 5 });
		p.cyl(0.03, 0.03, 0.06, [0, 0.55, 0], GOLD, { seg: 6 });
		p.cyl(0.045, 0.045, 0.3, [0, 0.3, 0], GOLD, { rz: Math.PI / 2, seg: 6 });
	},

	bin(p) {
		p.cyl(0.24, 0.2, 0.58, [0, 0.29, 0], TINT, { seg: 12 });
		p.cyl(0.26, 0.26, 0.05, [0, 0.6, 0], "#4a4f5c", { seg: 12 });
		p.ball(0.25, [0, 0.62, 0], "#4a4f5c", { s: [1, 0.35, 1], w: 12, hs: 5 });
		p.box([0.14, 0.04, 0.05], [0, 0.72, 0], TYRE, { round: 0 });
		p.box([0.16, 0.12, 0.03], [0, 0.38, 0.226], WHITE, { round: 0, rx: -0.07 });
	},

	postbox(p) {
		p.cyl(0.22, 0.22, 0.08, [0, 0.04, 0], TYRE, { seg: 12 });
		p.cyl(0.19, 0.19, 0.62, [0, 0.39, 0], RED, { seg: 12 });
		p.cyl(0.22, 0.22, 0.06, [0, 0.73, 0], RED, { seg: 12 });
		p.ball(0.2, [0, 0.76, 0], RED, { s: [1, 0.5, 1], w: 12, hs: 6 });
		p.box([0.2, 0.035, 0.05], [0, 0.6, 0.18], TYRE, { round: 0 });
		p.box([0.14, 0.1, 0.03], [0, 0.42, 0.19], WHITE, { round: 0 });
		p.ball(0.035, [0, 0.87, 0], GOLD, { w: 6, hs: 4 });
	},

	bush(p) {
		p.ball(0.38, [0, 0.32, 0], LEAF_DARK, { s: [1.25, 0.85, 1.05], w: 12 });
		p.ball(0.26, [0.22, 0.42, 0.1], LEAF, { w: 12 });
		p.ball(0.2, [-0.14, 0.5, 0.16], LEAF_LIGHT, { w: 12 });
		for (const at of [
			[0.3, 0.55, 0.22],
			[-0.3, 0.38, 0.28],
			[0.05, 0.62, 0.3],
		] as V3[])
			p.ball(0.045, at, PINK, { w: 6, hs: 4 });
	},

	lamp(p) {
		p.cyl(0.12, 0.14, 0.12, [0, 0.06, 0], IRON);
		p.cyl(0.045, 0.045, 2.2, [0, 1.1, 0], IRON, { seg: 8 });
		p.cyl(0.07, 0.07, 0.1, [0, 0.55, 0], IRON, { seg: 8 });
		p.cyl(0.06, 0.08, 0.08, [0, 2.17, 0], IRON, { seg: 8 });
		p.ball(0.18, [0, 2.32, 0], WARM, { glow: true });
		p.cyl(0.06, 0.22, 0.14, [0, 2.5, 0], IRON);
		p.ball(0.045, [0, 2.6, 0], GOLD, { w: 6, hs: 4 });
	},

	bench(p) {
		for (const z of [-0.12, 0, 0.12]) p.box([1.1, 0.05, 0.11], [0, 0.42, z], WOOD);
		for (const y of [0.6, 0.74]) p.box([1.1, 0.1, 0.05], [0, y, -0.2 - (y - 0.6) * 0.15], WOOD, { rx: -0.15 });
		for (const x of [-0.46, 0.46]) {
			p.box([0.05, 0.42, 0.05], [x, 0.21, 0.12], IRON, { round: 0 });
			p.box([0.05, 0.8, 0.05], [x, 0.4, -0.19], IRON, { round: 0, rx: -0.08 });
			p.box([0.05, 0.05, 0.4], [x, 0.39, -0.03], IRON, { round: 0 });
			p.box([0.06, 0.05, 0.38], [x, 0.56, -0.02], IRON, { round: 0 });
		}
	},

	sign(p) {
		p.cyl(0.1, 0.12, 0.05, [0, 0.025, 0], IRON, { seg: 8 });
		p.cyl(0.035, 0.035, 1.3, [0, 0.65, 0], "#9aa3b2", { seg: 8 });
		// No entry: a red disc with a white bar, in a white rim.
		p.disc(0.3, 0.04, [0, 1.3, 0], WHITE, { seg: 16 });
		p.disc(0.25, 0.05, [0, 1.3, 0], RED, { seg: 16 });
		p.box([0.3, 0.07, 0.06], [0, 1.3, 0], WHITE, { round: 0 });
		// This way: a blue plate with a white arrow.
		p.box([0.5, 0.26, 0.04], [0, 0.85, 0], BLUE);
		p.box([0.22, 0.05, 0.06], [-0.04, 0.85, 0], WHITE, { round: 0 });
		p.cone(0.08, 0.1, [0.12, 0.85, 0], WHITE, { seg: 3, rz: -Math.PI / 2, s: [1, 1, 0.4] });
	},

	tree(p) {
		p.cyl(0.11, 0.16, 1.1, [0, 0.55, 0], WOOD_DARK, { seg: 8 });
		p.ball(0.72, [0, 1.35, 0], LEAF_DARK, { s: [1, 0.75, 1], w: 12 });
		p.ball(0.32, [0.42, 1.6, 0.25], LEAF, { w: 10, hs: 7 });
		p.ball(0.32, [-0.4, 1.7, -0.2], LEAF_LIGHT, { w: 10, hs: 7 });
		p.ball(0.55, [0.05, 1.85, 0.05], LEAF, { s: [1, 0.85, 1], w: 12 });
		p.ball(0.36, [-0.03, 2.32, 0], LEAF_LIGHT, { w: 12 });
	},

	car(p) {
		p.box([1.65, 0.46, 0.84], [0, 0.42, 0], TINT);
		p.box([0.95, 0.42, 0.76], [-0.1, 0.82, 0], TINT);
		// Windows all round the cabin.
		p.box([0.78, 0.26, 0.78], [-0.1, 0.84, 0], GLASS);
		p.box([0.97, 0.26, 0.55], [-0.1, 0.84, 0], GLASS);
		for (const x of [-0.52, 0.52]) for (const z of [-0.42, 0.42]) wheel(p, [x, 0.19, z], 0.19, 0.14);
		for (const z of [-0.26, 0.26]) {
			p.ball(0.075, [0.82, 0.47, z], WARM, { s: [0.5, 1, 1], w: 8, hs: 6, glow: true });
			p.box([0.04, 0.08, 0.14], [-0.83, 0.5, z], RED, { round: 0 });
		}
		p.box([0.08, 0.1, 0.7], [0.83, 0.26, 0], TYRE, { round: 0 });
		p.box([0.08, 0.1, 0.7], [-0.83, 0.26, 0], TYRE, { round: 0 });
	},

	kiosk(p) {
		p.box([1.6, 0.95, 1.0], [0, 0.475, 0], CREAM);
		p.box([1.4, 0.55, 0.06], [0, 0.45, 0.5], TINT);
		p.box([1.75, 0.08, 1.15], [0, 0.99, 0.02], WOOD);
		for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.45]) p.cyl(0.045, 0.045, 0.52, [x, 1.28, z], WHITE, { seg: 8 });
		p.box([1.8, 0.14, 1.2], [0, 1.6, 0], TINT);
		awning(p, 1.8, 6, 1.47, 0.55, 0.42, [TINT, WHITE]);
		// The big cone on the roof.
		p.cone(0.22, 0.36, [0, 1.85, 0], "#e0a96d", { rx: Math.PI });
		p.ball(0.22, [0, 2.08, 0], PINK, { s: [1, 0.85, 1] });
		p.ball(0.055, [0, 2.3, 0], RED, { w: 6, hs: 4 });
	},

	slide(p) {
		p.box([0.7, 0.08, 0.7], [-0.5, 1.2, 0], BERRY);
		for (const x of [-0.82, -0.18]) for (const z of [-0.32, 0.32]) p.cyl(0.045, 0.045, 1.55, [x, 0.775, z], BLUE, { seg: 8 });
		for (const z of [-0.32, 0.32]) p.box([0.64, 0.05, 0.04], [-0.5, 1.45, z], BLUE, { round: 0 });
		p.cone(0.55, 0.35, [-0.5, 1.725, 0], BERRY, { seg: 4, ry: Math.PI / 4 });
		// The ladder up the back.
		for (const z of [-0.2, 0.2]) p.cyl(0.03, 0.03, 1.25, [-0.9, 0.625, z], SUN, { seg: 6 });
		for (const y of [0.25, 0.5, 0.75, 1.0]) p.cyl(0.025, 0.025, 0.4, [-0.9, y, 0], SUN, { seg: 6, rx: Math.PI / 2 });
		// The chute, from the platform down to a run-out.
		const a = Math.atan2(1.05, 1.1);
		p.box([1.55, 0.05, 0.46], [0.4, 0.675, 0], SUN, { rz: -a });
		for (const z of [-0.23, 0.23]) p.box([1.55, 0.1, 0.04], [0.4, 0.72, z], BERRY, { rz: -a, round: 0 });
		p.box([0.22, 0.05, 0.46], [1.04, 0.16, 0], SUN);
		for (const z of [-0.18, 0.18]) p.cyl(0.03, 0.03, 0.15, [1.06, 0.075, z], BLUE, { seg: 6 });
	},

	fountain(p) {
		p.cyl(1.48, 1.48, 0.06, [0, 0.03, 0], STONE, { seg: 20 });
		p.cyl(1.4, 1.45, 0.4, [0, 0.24, 0], STONE, { seg: 20 });
		p.ring(1.37, 0.09, [0, 0.44, 0], STONE_LIGHT, { seg: 20 });
		p.cyl(1.32, 1.32, 0.04, [0, 0.4, 0], WATER, { seg: 20 });
		p.cyl(0.16, 0.18, 0.66, [0, 0.72, 0], STONE);
		// The big bowl, then the little one.
		p.cyl(0.75, 0.2, 0.22, [0, 1.12, 0], STONE, { seg: 16 });
		p.ring(0.73, 0.06, [0, 1.23, 0], STONE_LIGHT, { seg: 16 });
		p.cyl(0.68, 0.68, 0.03, [0, 1.225, 0], WATER, { seg: 16 });
		p.cyl(0.09, 0.1, 0.24, [0, 1.35, 0], STONE, { seg: 8 });
		p.cyl(0.38, 0.1, 0.14, [0, 1.5, 0], STONE, { seg: 12 });
		p.cyl(0.34, 0.34, 0.02, [0, 1.565, 0], WATER, { seg: 12 });
		p.ball(0.08, [0, 1.62, 0], SPRAY, { s: [1, 1.6, 1], w: 8, hs: 6 });
		// Water spilling from the big bowl into the basin.
		for (let i = 0; i < 6; i++) {
			const a = (i * Math.PI * 2) / 6;
			p.ball(0.07, [Math.cos(a) * 0.82, 0.8, Math.sin(a) * 0.82], SPRAY, { s: [1, 3.5, 1], w: 6, hs: 5 });
		}
	},

	bus(p) {
		p.box([3.0, 1.0, 1.15], [0, 0.78, 0], TINT, { round: 2 });
		p.box([2.85, 0.12, 1.05], [0, 1.32, 0], WHITE);
		p.box([2.5, 0.36, 1.18], [-0.15, 1.0, 0], GLASS);
		for (const x of [-1.0, -0.5, 0, 0.5]) p.box([0.06, 0.36, 1.19], [x, 1.0, 0], TINT, { round: 0 });
		p.box([0.08, 0.42, 0.95], [1.47, 1.0, 0], GLASS, { round: 0 });
		p.box([3.02, 0.08, 1.17], [0, 0.62, 0], WHITE, { round: 0 });
		p.box([0.45, 0.62, 0.04], [1.0, 0.62, 0.575], GLASS, { round: 0 });
		p.box([0.06, 0.14, 0.6], [1.49, 1.25, 0], GOLD, { round: 0 });
		for (const x of [-1.5, 1.5]) p.box([0.1, 0.14, 1.1], [x, 0.36, 0], TYRE, { round: 0 });
		for (const x of [-0.95, 0.95]) for (const z of [-0.52, 0.52]) wheel(p, [x, 0.27, z], 0.27, 0.18);
		for (const z of [-0.38, 0.38]) p.ball(0.08, [1.5, 0.52, z], WARM, { s: [0.5, 1, 1], w: 8, hs: 6, glow: true });
	},

	cottage(p) {
		const wall = "#bfe6d3";
		p.box([3.2, 0.15, 2.4], [0, 0.075, 0], STONE);
		p.box([3.0, 1.9, 2.2], [0, 1.05, 0], wall, { round: 2 });
		roof(p, { len: 3.35, wallLen: 2.96, half: 1.35, wallHalf: 1.1, rise: 1.1, y: 2.0, colour: "#5f86d9", wall, t: 0.14 });
		// Front: a berry door between two windows with flower boxes.
		p.box([0.6, 1.0, 0.1], [0, 0.65, 1.1], BERRY);
		p.ball(0.04, [0.18, 0.65, 1.17], GOLD, { w: 6, hs: 4 });
		for (const x of [-0.9, 0.9]) {
			pane(p, [x, 1.3, 1.1], 0.6, 0.55);
			p.box([0.7, 0.15, 0.16], [x, 0.88, 1.2], WOOD, { round: 0 });
			for (const dx of [-0.2, 0, 0.2]) p.ball(0.06, [x + dx, 0.98, 1.2], dx === 0 ? SUN : PINK, { w: 6, hs: 4 });
		}
		// Back and sides, and a round window in each gable.
		for (const x of [-0.8, 0.8]) p.group([0, 0, 0], Math.PI, () => pane(p, [x, 1.3, 1.1], 0.6, 0.55));
		for (const ry of [Math.PI / 2, -Math.PI / 2]) {
			p.group([0, 0, 0], ry, () => {
				pane(p, [0, 1.3, 1.5], 0.6, 0.55);
				p.disc(0.2, 0.06, [0, 2.45, 1.5], WARM, { glow: true });
				p.disc(0.26, 0.04, [0, 2.45, 1.49], WHITE, { seg: 12 });
			});
		}
		p.box([0.36, 1.0, 0.36], [0.8, 2.9, -0.55], POT);
		p.box([0.44, 0.1, 0.44], [0.8, 3.42, -0.55], "#8a6f5a", { round: 0 });
		// A path to the door, and a bush either side.
		p.box([0.7, 0.04, 0.9], [0, 0.02, 1.62], STONE_LIGHT);
		for (const x of [-1.85, 1.85]) {
			p.ball(0.36, [x, 0.27, 0.9], LEAF_DARK, { s: [1, 0.75, 1], w: 10, hs: 7 });
			p.ball(0.22, [x * 0.97, 0.5, 1.0], LEAF, { w: 8, hs: 6 });
		}
	},

	petshop(p) {
		const wall = "#f6e0c4";
		p.box([4.2, 0.15, 3.2], [0, 0.075, 0], STONE);
		p.box([4.0, 2.7, 3.0], [0, 1.5, 0], wall, { round: 2 });
		p.box([4.2, 0.2, 3.2], [0, 2.9, 0], CREAM);
		p.box([3.8, 0.1, 2.8], [0, 3.02, 0], "#e8a07c", { round: 0 });
		// The shop window, with a paw print on the glass, and the door.
		p.box([2.2, 1.1, 0.06], [-0.5, 1.15, 1.52], WARM, { round: 0, glow: true });
		p.box([2.36, 1.26, 0.04], [-0.5, 1.15, 1.5], WHITE, { round: 0 });
		for (const x of [-1.05, 0.05]) p.box([0.06, 1.1, 0.07], [x, 1.15, 1.53], WHITE, { round: 0 });
		p.box([2.5, 0.08, 0.2], [-0.5, 0.56, 1.56], WHITE, { round: 0 });
		p.box([0.8, 1.6, 0.1], [1.3, 0.95, 1.5], "#9fd9c4");
		p.box([0.45, 0.5, 0.04], [1.3, 1.35, 1.56], WARM, { round: 0, glow: true });
		p.ball(0.05, [1.58, 0.9, 1.57], GOLD, { w: 6, hs: 4 });
		awning(p, 4.0, 8, 2.05, 1.5, 0.75, ["#e8a07c", WHITE]);
		// Side windows.
		for (const ry of [Math.PI / 2, -Math.PI / 2]) p.group([0, 0, 0], ry, () => pane(p, [0, 1.5, 2.0], 1.0, 0.8));
		// The sign on the roof: a big paw.
		const brown = "#7a5236";
		for (const x of [-0.3, 0.3]) p.cyl(0.04, 0.04, 0.5, [x, 3.2, 1.15], IRON, { seg: 6 });
		p.disc(0.55, 0.12, [0, 3.5, 1.2], CREAM, { seg: 20 });
		p.ring(0.55, 0.06, [0, 3.5, 1.2], GOLD, { rx: 0, seg: 20 });
		p.ball(0.2, [0, 3.4, 1.28], brown, { s: [1.1, 0.85, 0.35] });
		for (const [x, y] of [
			[-0.24, 3.64],
			[-0.09, 3.74],
			[0.09, 3.74],
			[0.24, 3.64],
		] as const)
			p.ball(0.085, [x, y, 1.28], brown, { s: [1, 1.2, 0.4], w: 8, hs: 6 });
	},

	school(p) {
		const wall = "#e07a5f";
		const trim = "#fbf6ea";
		const slate = "#6d7fb8";
		p.box([5.8, 0.15, 3.6], [0, 0.075, 0], STONE);
		p.box([5.6, 3.0, 3.4], [0, 1.65, 0], wall, { round: 2 });
		p.box([5.7, 0.12, 3.5], [0, 1.62, 0], trim, { round: 0 });
		roof(p, { len: 5.9, wallLen: 5.56, half: 1.95, wallHalf: 1.7, rise: 0.9, y: 3.15, colour: slate, wall, t: 0.16 });
		// Front: two floors of windows, a blue double door under an arch, steps, and a sign of letter tiles.
		for (const x of [-2.1, -1.0, 1.0, 2.1]) for (const y of [0.95, 2.35]) pane(p, [x, y, 1.7], 0.7, 0.8, trim);
		p.disc(0.6, 0.08, [0, 1.6, 1.7], trim, { seg: 16 });
		p.box([1.1, 1.4, 0.1], [0, 0.85, 1.72], BLUE);
		p.box([0.03, 1.3, 0.12], [0, 0.85, 1.73], trim, { round: 0 });
		p.box([1.6, 0.12, 0.5], [0, 0.06, 1.9], STONE);
		p.box([1.4, 0.5, 0.08], [0, 2.35, 1.72], "#f2dc9a");
		[BERRY, BLUE, LEAF_LIGHT].forEach((c, i) => {
			p.box([0.3, 0.3, 0.08], [(i - 1) * 0.4, 2.35, 1.78], c);
		});
		// Back and sides.
		p.group([0, 0, 0], Math.PI, () => {
			for (const x of [-2.1, -0.7, 0.7, 2.1]) for (const y of [0.95, 2.35]) pane(p, [x, y, 1.7], 0.7, 0.8, trim);
		});
		for (const ry of [Math.PI / 2, -Math.PI / 2]) {
			p.group([0, 0, 0], ry, () => {
				for (const x of [-0.8, 0.8]) for (const y of [0.95, 2.35]) pane(p, [x, y, 2.8], 0.6, 0.8, trim);
			});
		}
		// The bell tower on the ridge.
		p.box([1.0, 0.6, 1.0], [0, 3.8, 0], trim);
		for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) p.cyl(0.07, 0.07, 0.5, [x, 4.33, z], trim, { seg: 8 });
		p.ball(0.18, [0, 4.33, 0], GOLD, { s: [1, 1.1, 1] });
		p.cone(0.72, 0.45, [0, 4.8, 0], slate, { seg: 4, ry: Math.PI / 4 });
		p.ball(0.06, [0, 5.06, 0], GOLD, { w: 6, hs: 4 });
	},

	tower(p) {
		const wall = "#f6e0c4";
		const stage = "#f6d7a8";
		const trim = "#fbf6ea";
		p.box([3.6, 0.25, 3.6], [0, 0.125, 0], STONE);
		p.box([3.2, 0.25, 3.2], [0, 0.375, 0], STONE_LIGHT);
		p.box([2.6, 4.4, 2.6], [0, 2.7, 0], wall, { round: 2 });
		for (const x of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) p.box([0.36, 4.4, 0.36], [x, 2.7, z], trim);
		p.box([2.8, 0.18, 2.8], [0, 2.6, 0], trim, { round: 0 });
		// The door, under a round arch.
		p.box([0.8, 1.2, 0.1], [0, 1.1, 1.31], WOOD_DARK);
		p.disc(0.4, 0.1, [0, 1.7, 1.31], WOOD_DARK, { seg: 12 });
		p.disc(0.52, 0.06, [0, 1.7, 1.3], trim, { seg: 12 });
		p.box([1.04, 1.2, 0.06], [0, 1.1, 1.3], trim, { round: 0 });
		p.ball(0.05, [0.25, 1.1, 1.38], GOLD, { w: 6, hs: 4 });
		// A tall arched window on every side, then the clock stage.
		for (let k = 0; k < 4; k++) {
			p.group([0, 0, 0], (k * Math.PI) / 2, () => {
				p.box([0.5, 0.8, 0.06], [0, 3.7, 1.32], WARM, { round: 0, glow: true });
				p.disc(0.25, 0.06, [0, 4.1, 1.32], WARM, { seg: 10, glow: true });
				p.box([0.64, 0.86, 0.04], [0, 3.68, 1.3], trim, { round: 0 });
				p.disc(0.32, 0.04, [0, 4.1, 1.3], trim, { seg: 10 });
				p.box([0.8, 0.08, 0.18], [0, 3.25, 1.36], trim, { round: 0 });
			});
		}
		p.box([3.1, 0.2, 3.1], [0, 4.95, 0], trim);
		p.box([3.0, 2.0, 3.0], [0, 5.95, 0], stage, { round: 2 });
		// Four clock faces, all at ten past ten (a smile).
		for (let k = 0; k < 4; k++) {
			p.group([0, 5.95, 0], (k * Math.PI) / 2, () => {
				p.disc(0.82, 0.12, [0, 0, 1.52], GOLD, { seg: 24 });
				p.disc(0.7, 0.14, [0, 0, 1.53], CLOCK, { seg: 24, glow: true });
				for (let i = 0; i < 12; i++) {
					const a = (i * Math.PI) / 6;
					const long = i % 3 === 0;
					p.box([0.05, long ? 0.14 : 0.08, 0.02], [Math.sin(a) * 0.58, Math.cos(a) * 0.58, 1.605], TYRE, {
						rz: -a,
						round: 0,
					});
				}
				const hand = (a: number, len: number, w: number) =>
					p.box([w, len, 0.03], [(Math.sin(a) * len) / 2.4, (Math.cos(a) * len) / 2.4, 1.615], TYRE, { rz: -a, round: 0 });
				hand(-Math.PI / 3 + 0.08, 0.4, 0.07);
				hand(Math.PI / 3, 0.56, 0.05);
				p.ball(0.05, [0, 0, 1.62], GOLD, { w: 6, hs: 4 });
			});
		}
		p.box([3.3, 0.2, 3.3], [0, 7.0, 0], trim);
		p.cone(2.3, 1.6, [0, 7.9, 0], "#5f86d9", { seg: 4, ry: Math.PI / 4 });
		p.ball(0.14, [0, 8.72, 0], GOLD, { w: 8, hs: 6 });
		p.cyl(0.03, 0.03, 0.55, [0, 9.05, 0], GOLD, { seg: 6 });
		p.box([0.4, 0.24, 0.03], [0.21, 9.18, 0], BERRY, { round: 0 });
		// A round paved square, with tubs of flowers by the door and at the corners.
		p.cyl(3.4, 3.4, 0.06, [0, 0.03, 0], STONE_LIGHT, { seg: 24 });
		p.ring(3.4, 0.07, [0, 0.07, 0], STONE, { seg: 24 });
		for (const [x, z] of [
			[-0.95, 2.1],
			[0.95, 2.1],
			[-2.1, -2.1],
			[2.1, -2.1],
			[-2.2, 1.6],
			[2.2, 1.6],
		] as const) {
			p.cyl(0.26, 0.2, 0.32, [x, 0.16, z], POT, { seg: 10 });
			p.ball(0.28, [x, 0.42, z], LEAF, { s: [1, 0.75, 1] });
			for (const [dx, dz] of [
				[-0.1, 0.12],
				[0.12, 0.05],
				[0, -0.12],
			] as const)
				p.ball(0.05, [x + dx, 0.6, z + dz], PINK, { w: 6, hs: 4 });
		}
	},
};

const cache = new Map<KindId, PropGeometry>();

/** Built once per kind and cached. */
export function propGeometry(id: KindId): PropGeometry {
	let g = cache.get(id);
	if (!g) {
		const parts = new Parts();
		BUILD[id](parts);
		g = parts.done();
		cache.set(id, g);
	}
	return g;
}
