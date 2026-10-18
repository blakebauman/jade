import {
	AdditiveBlending,
	BoxGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Group,
	type Material,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	type Object3D,
} from "three";
import { bake } from "./bake.ts";

/**
 * The camp round the fire: the campfire itself (a teepee of split logs on a ring of stones, an ember bed and a
 * layered flame that leans and flickers), three log benches facing it, a little tent, a woodpile and a lantern on a
 * post. Chunky shapes in the blocks' own palette, so it belongs on the island. Laid out round the fire's cell, all
 * inside the clearing; nothing here gets in the way of digging or building (it's scenery, walked through).
 */

const lambert = new Map<string, MeshLambertMaterial>();
const mat = (colour: string) => {
	const hit = lambert.get(colour);
	if (hit) return hit;
	const m = new MeshLambertMaterial({ color: new Color(colour) });
	lambert.set(colour, m);
	return m;
};
const unit = new BoxGeometry(1, 1, 1);
const log = new CylinderGeometry(0.5, 0.5, 1, 7);
const stone = new BoxGeometry(1, 1, 1);

function piece(
	g: Object3D,
	geometry: BoxGeometry | CylinderGeometry | ConeGeometry,
	material: Material,
	s: [number, number, number],
	p: [number, number, number],
	r: [number, number, number] = [0, 0, 0],
) {
	const m = new Mesh(geometry, material);
	m.scale.set(...s);
	m.position.set(...p);
	m.rotation.set(...r);
	m.castShadow = true;
	m.receiveShadow = true;
	g.add(m);
	return m;
}

export type Campfire = {
	group: Group;
	/** The flame's layers, outer to inner, each with its resting size in `userData.size`. */
	flames: Mesh[];
	/** The glowing bed under the logs: brightest when the fire's high, a dull red when it's embers. */
	embers: Mesh;
};

export function campfire(): Campfire {
	const g = new Group();
	// A ring of stones, each a little different.
	const greys = ["#7d7f86", "#8d9097", "#6f7178", "#9a9ca2"];
	for (let k = 0; k < 10; k++) {
		const a = (k / 10) * Math.PI * 2 + 0.2;
		const w = 0.2 + ((k * 37) % 7) * 0.02;
		piece(
			g,
			stone,
			mat(greys[k % greys.length]!),
			[w, 0.14 + (k % 3) * 0.03, w * 0.85],
			[Math.cos(a) * 0.48, 0.07, Math.sin(a) * 0.48],
			[0, a, 0],
		);
	}
	const embers = new Mesh(new CylinderGeometry(0.34, 0.38, 0.05, 10), new MeshBasicMaterial({ color: "#ff7a2a" }));
	embers.position.y = 0.03;
	embers.userData.keep = true;
	g.add(embers);
	// Split logs leaning in to a point: a teepee.
	const bark = mat("#6b4a2b");
	for (let k = 0; k < 5; k++) {
		const a = (k / 5) * Math.PI * 2;
		const leg = new Group();
		leg.position.set(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
		leg.rotation.y = -a;
		piece(leg, log, k % 2 ? bark : mat("#7b5532"), [0.11, 0.62, 0.11], [0, 0.27, 0], [0, 0, 0.62]);
		g.add(leg);
	}
	// The flame: stacked four-sided cones, so it reads as pixel fire, lit from inside.
	const flame = (colour: string, r: number, h: number, y: number) => {
		const m = new Mesh(new ConeGeometry(r, h, 4), new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.92 }));
		m.position.y = y;
		m.userData.size = m.scale.clone();
		m.userData.y = y;
		g.add(m);
		return m;
	};
	const flames = [flame("#ff6a1a", 0.3, 0.9, 0.45), flame("#ffae2a", 0.21, 0.7, 0.42), flame("#fff1a0", 0.11, 0.42, 0.33)];
	// A soft warm halo round the flame (additive, never casts).
	const halo = new Mesh(
		new ConeGeometry(0.42, 1.2, 8, 1, true),
		new MeshBasicMaterial({ color: "#ff9a40", transparent: true, opacity: 0.05, blending: AdditiveBlending, depthWrite: false }),
	);
	halo.position.y = 0.55;
	halo.userData.halo = true;
	g.add(halo);
	g.userData.halo = halo;
	return { group: g, flames, embers };
}

/** Moves the flame each frame: it leans and licks, smaller as the fuel runs down, gone (just embers) when it's out. */
export function flicker(fire: Campfire, t: number, strength: number) {
	const on = strength > 0;
	fire.flames.forEach((f, k) => {
		f.visible = on;
		if (!on) return;
		const lick = 1 + 0.16 * Math.sin(t * (9 + k * 4) + k * 1.7) + 0.08 * Math.sin(t * 23 + k);
		const size = f.userData.size as { x: number; y: number; z: number };
		const s = 0.45 + 0.55 * strength;
		f.scale.set(size.x * s * (2 - lick) ** 0.5, size.y * s * lick, size.z * s * (2 - lick) ** 0.5);
		f.position.y = (f.userData.y as number) * s * lick;
		f.rotation.y = t * (0.6 + k * 0.4);
		f.rotation.z = 0.08 * Math.sin(t * 3.1 + k);
	});
	const halo = fire.group.userData.halo as Mesh;
	halo.visible = on;
	halo.scale.setScalar(0.5 + 0.6 * strength);
	const bed = fire.embers.material as MeshBasicMaterial;
	bed.color.setRGB(0.55 + 0.45 * Math.max(0.3, strength), 0.18 + 0.32 * strength, 0.06 + 0.06 * strength);
}

/** A log bench: a half-round log on two stumps. */
function bench(): Group {
	const g = new Group();
	piece(g, log, mat("#7b5532"), [0.34, 1.7, 0.34], [0, 0.42, 0], [0, 0, Math.PI / 2]);
	piece(g, unit, mat("#a8794a"), [1.6, 0.04, 0.26], [0, 0.6, 0]);
	piece(g, log, mat("#6b4a2b"), [0.26, 0.3, 0.26], [-0.6, 0.15, 0]);
	piece(g, log, mat("#6b4a2b"), [0.26, 0.3, 0.26], [0.6, 0.15, 0]);
	return g;
}

/** A small A-frame tent in a warm canvas colour, with its flap tied open. */
function tent(): Group {
	const g = new Group();
	const canvas = mat("#d9774a");
	const stripe = mat("#f2d2a0");
	piece(g, unit, canvas, [0.06, 1.6, 2.2], [-0.56, 0.62, 0], [0, 0, -0.6]);
	piece(g, unit, canvas, [0.06, 1.6, 2.2], [0.56, 0.62, 0], [0, 0, 0.6]);
	piece(g, unit, stripe, [0.07, 0.12, 2.22], [-0.5, 0.7, 0], [0, 0, -0.6]);
	piece(g, unit, stripe, [0.07, 0.12, 2.22], [0.5, 0.7, 0], [0, 0, 0.6]);
	piece(g, unit, mat("#3b2a22"), [0.9, 1.0, 0.04], [0, 0.45, -1.08]);
	piece(g, unit, mat("#8b6238"), [0.06, 1.5, 0.06], [0, 0.75, -1.12]);
	piece(g, unit, mat("#8b6238"), [0.06, 1.5, 0.06], [0, 0.75, 1.12]);
	return g;
}

/** Split logs stacked in a neat pile: where the fire's wood comes from (in the story, at least). */
function woodpile(): Group {
	const g = new Group();
	for (let row = 0; row < 3; row++)
		for (let k = 0; k < 4 - row; k++)
			piece(
				g,
				log,
				mat(k % 2 ? "#7b5532" : "#6b4a2b"),
				[0.22, 1.2, 0.22],
				[-0.33 + k * 0.22 + row * 0.11, 0.11 + row * 0.19, 0],
				[Math.PI / 2, 0, 0],
			);
	return g;
}

/** A lantern on a post: the warm light that says "camp" from across the clearing. */
function lantern(): { group: Group; glass: Mesh } {
	const g = new Group();
	piece(g, unit, mat("#6b4a2b"), [0.12, 1.6, 0.12], [0, 0.8, 0]);
	piece(g, unit, mat("#6b4a2b"), [0.5, 0.08, 0.08], [0.2, 1.55, 0]);
	piece(g, unit, mat("#3a3a40"), [0.24, 0.05, 0.24], [0.4, 1.42, 0]);
	piece(g, unit, mat("#3a3a40"), [0.24, 0.05, 0.24], [0.4, 1.12, 0]);
	const glass = new Mesh(unit, new MeshBasicMaterial({ color: "#ffd27a" }));
	glass.scale.set(0.18, 0.26, 0.18);
	glass.position.set(0.4, 1.27, 0);
	glass.userData.keep = true;
	g.add(glass);
	return { group: g, glass };
}

export type Camp = { group: Group; fire: Campfire; lantern: Mesh };

/** The whole camp, centred on the fire (its cell's middle at the origin, ground at y 0). */
export function camp(): Camp {
	const g = new Group();
	const fire = campfire();
	g.add(fire.group);
	for (const [a, r] of [
		[Math.PI * 0.25, 2.6],
		[Math.PI * 0.95, 2.6],
		[Math.PI * 1.6, 2.7],
	] as const) {
		const b = bench();
		b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
		b.rotation.y = -a + Math.PI / 2;
		g.add(b);
	}
	const t = tent();
	t.position.set(-4.6, 0, -2.4);
	t.rotation.y = 0.7;
	g.add(t);
	const w = woodpile();
	w.position.set(3.6, 0, -3.4);
	w.rotation.y = -0.5;
	g.add(w);
	const l = lantern();
	l.group.position.set(-3.6, 0, 1.4);
	g.add(l.group);
	// The fire stays its own group (its flames move); everything else round it bakes into one mesh.
	g.remove(fire.group);
	const baked = bake(g);
	// The fire's stones and logs bake too; its flames, embers and halo stay free to move.
	const halo = fire.group.userData.halo;
	fire.group = bake(fire.group);
	fire.group.userData.halo = halo;
	fire.group.scale.setScalar(1.3);
	baked.add(fire.group);
	return { group: baked, fire, lantern: l.glass };
}
