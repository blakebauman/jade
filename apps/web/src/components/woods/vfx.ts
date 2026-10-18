import { B, BLOCKS } from "@jade/core/woods";
import {
	AdditiveBlending,
	type Blending,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	type Camera,
	CanvasTexture,
	Color,
	DynamicDrawUsage,
	Euler,
	Group,
	InstancedMesh,
	LinearFilter,
	Matrix4,
	MeshLambertMaterial,
	NormalBlending,
	type PerspectiveCamera,
	Points,
	Quaternion,
	ShaderMaterial,
	SRGBColorSpace,
	UniformsLib,
	UniformsUtils,
	Vector2,
	Vector3,
} from "three";

/**
 * The little bits that make the woods feel alive: chips and crumbs when a block is dug, a puff when one is placed,
 * sparks and embers over the campfire, smoke, fireflies at night and stars when an animal comes home. Everything is
 * pooled, so however busy it gets it's three draw calls: one batch of tiny cubes and two batches of points (glowing
 * and soft). Cells are a block's low corner, like the world's; effects centre themselves on the block.
 */

/** Each block's main and accent colour (from its atlas tile), for the crumbs it breaks into. */
export const BLOCK_COLOURS: Record<number, [string, string]> = {
	[B.air]: ["#ffffff", "#e8e8e8"],
	[B.grass]: ["#5fae4a", "#8b5e3c"],
	[B.dirt]: ["#8b5e3c", "#704a2e"],
	[B.stone]: ["#8a8d93", "#74777d"],
	[B.sand]: ["#e6d49a", "#d4c083"],
	[B.log]: ["#6b4a2b", "#c9a36a"],
	[B.leaves]: ["#3b8d3f", "#4fa04a"],
	[B.planks]: ["#b9884b", "#8a6232"],
	[B.glass]: ["#dcf0fa", "#ffffff"],
	[B.brick]: ["#a3473a", "#cfc6bb"],
	[B.coal]: ["#8a8d93", "#2b2b2e"],
	[B.iron]: ["#8a8d93", "#d9a988"],
	[B.gold]: ["#8a8d93", "#f2c93b"],
	[B.gem]: ["#8a8d93", "#3fd6c6"],
	[B.torch]: ["#8b6238", "#ffc93c"],
	[B.water]: ["#3480ce", "#60a8e8"],
	[B.bedrock]: ["#44464b", "#5c5f65"],
	[B.woolWhite]: ["#efeeea", "#d9d7d0"],
	[B.woolRed]: ["#d6453d", "#b9352f"],
	[B.woolYellow]: ["#f2c43a", "#d9a823"],
	[B.woolGreen]: ["#5cae47", "#478f36"],
	[B.woolBlue]: ["#3b7fd9", "#2c66b8"],
	[B.woolPink]: ["#ec8fb6", "#d6739c"],
	[B.birchLog]: ["#ece8dd", "#3b3631"],
	[B.birchLeaves]: ["#8fbe52", "#a2c95c"],
	[B.pineLeaves]: ["#2c6644", "#1f4f34"],
	[B.tallGrass]: ["#62b04b", "#8fcf6a"],
	[B.flowerRed]: ["#e0443a", "#4a9a3a"],
	[B.flowerYellow]: ["#f5cd32", "#4a9a3a"],
	[B.flowerBlue]: ["#4f7fe0", "#4a9a3a"],
	[B.mushroom]: ["#d8433a", "#f0e6d2"],
	[B.path]: ["#97714a", "#8b5e3c"],
	[B.mossyStone]: ["#8a8d93", "#5f8f3e"],
};
for (const b of BLOCKS) BLOCK_COLOURS[b.id] ??= ["#8a8d93", "#74777d"];

/** Pool sizes: tiny cubes, glowing points (plus fireflies on top), soft points. */
export const POOL = { cubes: 192, glow: 320, soft: 128, fireflies: 24 } as const;

/** Shapes in the points sheet. */
const DOT = 0;
const STAR = 1;
const HEART = 2;
const PUFF = 3;

const SPARK_COLOURS = ["#fff2a8", "#ffd34d", "#ffb02e", "#ff7a1a"];
const SMOKE_COLOURS = ["#8f8f94", "#a3a3a8", "#7d7d82"];

/** A ring of particles in flat arrays; spawning takes the next slot, so the oldest gives way when it's full. */
class Pool {
	readonly cap: number;
	next = 0;
	readonly p: Float32Array;
	readonly v: Float32Array;
	readonly c: Float32Array;
	/** Cubes: how long each side is, relative to size (1,1,1 for a crumb; long and thin for an outline edge). */
	readonly ext: Float32Array;
	readonly age: Float32Array;
	readonly life: Float32Array;
	readonly size0: Float32Array;
	readonly size1: Float32Array;
	readonly grav: Float32Array;
	readonly drag: Float32Array;
	readonly sway: Float32Array;
	readonly spin: Float32Array;
	readonly seed: Float32Array;
	readonly alpha: Float32Array;
	readonly shape: Float32Array;
	readonly floor: Float32Array;
	/** Bounces left; -1 never touches the ground. */
	readonly bounce: Int8Array;

	constructor(cap: number) {
		this.cap = cap;
		this.p = new Float32Array(cap * 3);
		this.v = new Float32Array(cap * 3);
		this.c = new Float32Array(cap * 3);
		this.ext = new Float32Array(cap * 3).fill(1);
		this.age = new Float32Array(cap).fill(1);
		this.life = new Float32Array(cap);
		this.size0 = new Float32Array(cap);
		this.size1 = new Float32Array(cap);
		this.grav = new Float32Array(cap);
		this.drag = new Float32Array(cap);
		this.sway = new Float32Array(cap);
		this.spin = new Float32Array(cap);
		this.seed = new Float32Array(cap);
		this.alpha = new Float32Array(cap);
		this.shape = new Float32Array(cap);
		this.floor = new Float32Array(cap);
		this.bounce = new Int8Array(cap);
	}

	/** A fresh slot with everything reset to a still, unit-sized particle. */
	spawn(x: number, y: number, z: number, life: number): number {
		const i = this.next;
		this.next = (this.next + 1) % this.cap;
		const k = i * 3;
		this.p[k] = x;
		this.p[k + 1] = y;
		this.p[k + 2] = z;
		this.v[k] = this.v[k + 1] = this.v[k + 2] = 0;
		this.ext[k] = this.ext[k + 1] = this.ext[k + 2] = 1;
		this.age[i] = 0;
		this.life[i] = life;
		this.size0[i] = this.size1[i] = 1;
		this.grav[i] = this.drag[i] = this.sway[i] = this.spin[i] = 0;
		this.seed[i] = Math.random() * 100;
		this.alpha[i] = 1;
		this.shape[i] = DOT;
		this.bounce[i] = -1;
		return i;
	}

	vel(i: number, x: number, y: number, z: number) {
		this.v[i * 3] = x;
		this.v[i * 3 + 1] = y;
		this.v[i * 3 + 2] = z;
	}

	colour(i: number, col: Color) {
		this.c[i * 3] = col.r;
		this.c[i * 3 + 1] = col.g;
		this.c[i * 3 + 2] = col.b;
	}

	step(dt: number, time: number) {
		for (let i = 0; i < this.cap; i++) {
			if (this.age[i]! >= this.life[i]!) continue;
			this.age[i]! += dt;
			const k = i * 3;
			const d = Math.max(0, 1 - this.drag[i]! * dt);
			this.v[k]! *= d;
			this.v[k + 2]! *= d;
			this.v[k + 1] = this.v[k + 1]! * d - this.grav[i]! * dt;
			const sw = this.sway[i]!;
			if (sw) {
				const s = this.seed[i]!;
				this.p[k]! += Math.sin(time * 2.7 + s) * sw * dt;
				this.p[k + 2]! += Math.cos(time * 2.3 + s * 1.3) * sw * dt;
			}
			this.p[k]! += this.v[k]! * dt;
			this.p[k + 1]! += this.v[k + 1]! * dt;
			this.p[k + 2]! += this.v[k + 2]! * dt;
			const b = this.bounce[i]!;
			if (b >= 0 && this.p[k + 1]! < this.floor[i]!) {
				this.p[k + 1] = this.floor[i]!;
				if (b > 0 && this.v[k + 1]! < -0.5) {
					this.v[k + 1] = -this.v[k + 1]! * 0.35;
					this.v[k]! *= 0.6;
					this.v[k + 2]! *= 0.6;
					this.bounce[i] = b - 1;
				} else {
					this.v[k] = this.v[k + 1] = this.v[k + 2] = 0;
					this.spin[i] = 0;
					this.grav[i] = 0;
				}
			}
		}
	}

	live(): number {
		let n = 0;
		for (let i = 0; i < this.cap; i++) if (this.age[i]! < this.life[i]!) n++;
		return n;
	}
}

/** The points sheet: a soft dot, a star, a heart and a smoke puff, drawn white so each point takes its own tint. */
function drawSheet(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	let ctx: CanvasRenderingContext2D | null = null;
	try {
		ctx = canvas.getContext("2d");
	} catch {
		ctx = null;
	}
	if (!ctx) return canvas;
	const glow = (cx: number, cy: number, r: number, a: number) => {
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
		g.addColorStop(0, `rgba(255,255,255,${a})`);
		g.addColorStop(0.4, `rgba(255,255,255,${a * 0.55})`);
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
	};
	// Soft dot.
	glow(32, 32, 30, 1);
	// Star: five points with a faint halo.
	glow(96, 32, 30, 0.35);
	ctx.beginPath();
	for (let n = 0; n < 10; n++) {
		const a = -Math.PI / 2 + (n * Math.PI) / 5;
		const r = n % 2 === 0 ? 26 : 11;
		const x = 96 + Math.cos(a) * r;
		const y = 34 + Math.sin(a) * r;
		if (n === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.fillStyle = "#ffffff";
	ctx.fill();
	// Heart.
	ctx.beginPath();
	ctx.moveTo(32, 112);
	ctx.bezierCurveTo(6, 94, 6, 74, 18, 70);
	ctx.bezierCurveTo(26, 67, 31, 72, 32, 78);
	ctx.bezierCurveTo(33, 72, 38, 67, 46, 70);
	ctx.bezierCurveTo(58, 74, 58, 94, 32, 112);
	ctx.closePath();
	ctx.fillStyle = "#ffffff";
	ctx.fill();
	// Smoke puff: a few soft blobs, lumpy rather than a perfect circle.
	glow(92, 98, 20, 0.7);
	glow(104, 92, 16, 0.6);
	glow(98, 104, 18, 0.6);
	glow(88, 90, 14, 0.5);
	return canvas;
}

const VERT = /* glsl */ `
attribute float size;
attribute float alpha;
attribute float shape;
attribute vec3 tint;
uniform float uScale;
varying vec3 vTint;
varying float vAlpha;
varying float vShape;
#include <fog_pars_vertex>
void main() {
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * mvPosition;
	gl_PointSize = min(size * uScale / max(-mvPosition.z, 0.1), 220.0);
	vTint = tint;
	vAlpha = alpha;
	vShape = shape;
	#include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vTint;
varying float vAlpha;
varying float vShape;
#include <fog_pars_fragment>
void main() {
	float col = mod(vShape, 2.0);
	float row = floor(vShape / 2.0);
	vec2 uv = vec2((gl_PointCoord.x + col) * 0.5, (1.0 - gl_PointCoord.y) * 0.5 + (1.0 - row) * 0.5);
	vec4 t = texture2D(uMap, uv);
	float a = t.a * vAlpha;
	if (a < 0.01) discard;
	gl_FragColor = vec4(vTint * t.rgb, a);
	#include <fog_fragment>
}`;

/** One batch of points: positions, tints, sizes, alphas and shapes, refilled each frame from a pool. */
class PointLayer {
	readonly points: Points;
	readonly geometry: BufferGeometry;
	readonly material: ShaderMaterial;
	readonly pos: BufferAttribute;
	readonly tint: BufferAttribute;
	readonly size: BufferAttribute;
	readonly alpha: BufferAttribute;
	readonly shape: BufferAttribute;
	readonly cap: number;
	n = 0;

	constructor(cap: number, map: CanvasTexture, scale: { value: number }, blending: Blending, fog: boolean) {
		this.cap = cap;
		const g = new BufferGeometry();
		const attr = (items: number) => {
			const a = new BufferAttribute(new Float32Array(cap * items), items);
			a.setUsage(DynamicDrawUsage);
			return a;
		};
		this.pos = attr(3);
		this.tint = attr(3);
		this.size = attr(1);
		this.alpha = attr(1);
		this.shape = attr(1);
		g.setAttribute("position", this.pos);
		g.setAttribute("tint", this.tint);
		g.setAttribute("size", this.size);
		g.setAttribute("alpha", this.alpha);
		g.setAttribute("shape", this.shape);
		g.setDrawRange(0, 0);
		this.geometry = g;
		this.material = new ShaderMaterial({
			uniforms: { ...UniformsUtils.clone(UniformsLib.fog), uMap: { value: map }, uScale: scale },
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
			blending,
			fog,
		});
		this.points = new Points(g, this.material);
		this.points.frustumCulled = false;
		this.points.castShadow = false;
		this.points.receiveShadow = false;
	}

	begin() {
		this.n = 0;
	}

	push(x: number, y: number, z: number, r: number, g: number, b: number, size: number, alpha: number, shape: number) {
		if (this.n >= this.cap) return;
		const i = this.n++;
		this.pos.setXYZ(i, x, y, z);
		this.tint.setXYZ(i, r, g, b);
		this.size.setX(i, size);
		this.alpha.setX(i, alpha);
		this.shape.setX(i, shape);
	}

	end() {
		this.geometry.setDrawRange(0, this.n);
		this.pos.needsUpdate = true;
		this.tint.needsUpdate = true;
		this.size.needsUpdate = true;
		this.alpha.needsUpdate = true;
		this.shape.needsUpdate = true;
	}
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

// The twelve edges of a unit cube, as centre offsets and which axis runs along it.
const EDGES: readonly [number, number, number, 0 | 1 | 2][] = [
	[0, -0.5, -0.5, 0],
	[0, 0.5, -0.5, 0],
	[0, -0.5, 0.5, 0],
	[0, 0.5, 0.5, 0],
	[-0.5, 0, -0.5, 1],
	[0.5, 0, -0.5, 1],
	[-0.5, 0, 0.5, 1],
	[0.5, 0, 0.5, 1],
	[-0.5, -0.5, 0, 2],
	[0.5, -0.5, 0, 2],
	[-0.5, 0.5, 0, 2],
	[0.5, 0.5, 0, 2],
];

/** All of the woods' little effects, pooled into a fixed three draw calls. Add `group` to the scene, call `update` each frame. */
export class Effects {
	readonly group: Group;
	private readonly reduced: boolean;
	/** How many of each burst to make (fewer on phones and with reduced motion). */
	private readonly k: number;
	private readonly cubes: Pool;
	private readonly glow: Pool;
	private readonly soft: Pool;
	private readonly cubeMesh: InstancedMesh;
	private readonly glowLayer: PointLayer;
	private readonly softLayer: PointLayer;
	private readonly sheet: CanvasTexture;
	private readonly scale = { value: 600 };

	private fireOn = false;
	private readonly fireAt = new Vector3();
	private fireStrength = 0;
	private emberDue = 0;
	private smokeDue = 0;

	private readonly ffMax: number;
	private ffTarget = 0;
	private ffOn = 0;
	private readonly ffAround = new Vector3();
	private readonly ffHome: Float32Array;
	private readonly ffPhase: Float32Array;
	private readonly ffSeated: Uint8Array;

	private readonly m = new Matrix4();
	private readonly q = new Quaternion();
	private readonly e = new Euler();
	private readonly s = new Vector3();
	private readonly at = new Vector3();
	private readonly col = new Color();
	private readonly buf = new Vector2();

	constructor(opts: { reducedMotion?: boolean; mobile?: boolean } = {}) {
		this.reduced = !!opts.reducedMotion;
		this.k = (this.reduced ? 0.5 : 1) * (opts.mobile ? 0.6 : 1);
		this.ffMax = Math.round(POOL.fireflies * (opts.mobile ? 0.6 : 1));

		this.cubes = new Pool(POOL.cubes);
		this.glow = new Pool(POOL.glow);
		this.soft = new Pool(POOL.soft);
		this.ffHome = new Float32Array(POOL.fireflies * 3);
		this.ffPhase = new Float32Array(POOL.fireflies);
		this.ffSeated = new Uint8Array(POOL.fireflies);
		for (let i = 0; i < POOL.fireflies; i++) this.ffPhase[i] = Math.random() * Math.PI * 2;

		this.sheet = new CanvasTexture(drawSheet());
		this.sheet.colorSpace = SRGBColorSpace;
		this.sheet.magFilter = LinearFilter;
		this.sheet.minFilter = LinearFilter;
		this.sheet.generateMipmaps = false;

		this.cubeMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: "#ffffff" }), POOL.cubes);
		this.cubeMesh.instanceMatrix.setUsage(DynamicDrawUsage);
		for (let i = 0; i < POOL.cubes; i++) this.cubeMesh.setColorAt(i, this.col.set("#ffffff"));
		this.cubeMesh.instanceColor?.setUsage(DynamicDrawUsage);
		this.cubeMesh.count = 0;
		this.cubeMesh.frustumCulled = false;
		this.cubeMesh.castShadow = false;
		this.cubeMesh.receiveShadow = false;

		this.glowLayer = new PointLayer(POOL.glow + POOL.fireflies, this.sheet, this.scale, AdditiveBlending, false);
		this.softLayer = new PointLayer(POOL.soft, this.sheet, this.scale, NormalBlending, true);

		// Points are sized in blocks, so they need to know how tall the screen is and how wide the camera sees.
		const buf = this.buf;
		const scale = this.scale;
		this.glowLayer.points.onBeforeRender = (renderer, _scene, camera) => {
			renderer.getDrawingBufferSize(buf);
			const fov = (camera as PerspectiveCamera).isPerspectiveCamera ? (camera as PerspectiveCamera).fov : 60;
			scale.value = buf.y / (2 * Math.tan((fov * Math.PI) / 360));
		};
		this.softLayer.points.onBeforeRender = this.glowLayer.points.onBeforeRender;

		this.group = new Group();
		this.group.name = "woods-effects";
		this.group.userData.noCast = true;
		this.group.add(this.cubeMesh, this.softLayer.points, this.glowLayer.points);
	}

	private count(n: number) {
		return Math.max(1, Math.round(n * this.k));
	}

	/** A few small chips flying off the face being dug. */
	chips(cell: [number, number, number], block: number, normal: [number, number, number] = [0, 1, 0]) {
		const [main, accent] = BLOCK_COLOURS[block] ?? BLOCK_COLOURS[B.stone]!;
		const [nx, ny, nz] = normal;
		const cx = cell[0] + 0.5 + nx * 0.52;
		const cy = cell[1] + 0.5 + ny * 0.52;
		const cz = cell[2] + 0.5 + nz * 0.52;
		const n = this.count(3);
		for (let j = 0; j < n; j++) {
			// Jitter across the face, not out of it.
			const jx = nx ? 0 : rand(-0.35, 0.35);
			const jy = ny ? 0 : rand(-0.35, 0.35);
			const jz = nz ? 0 : rand(-0.35, 0.35);
			const i = this.cubes.spawn(cx + jx, cy + jy, cz + jz, rand(0.35, 0.55));
			this.cubes.vel(i, nx * 1.6 + rand(-0.9, 0.9), ny * 1.6 + rand(1, 2.2), nz * 1.6 + rand(-0.9, 0.9));
			this.cubes.size0[i] = this.cubes.size1[i] = rand(0.06, 0.1);
			this.cubes.grav[i] = 14;
			this.cubes.spin[i] = rand(4, 9);
			this.cubes.colour(i, this.col.set(Math.random() < 0.6 ? main : accent));
		}
	}

	/** A block broke: little cubes in its colours tumble out, bounce once and shrink away. */
	burst(cell: [number, number, number], block: number) {
		const [main, accent] = BLOCK_COLOURS[block] ?? BLOCK_COLOURS[B.stone]!;
		const n = this.count(14);
		for (let j = 0; j < n; j++) {
			const ox = rand(0.15, 0.85);
			const oy = rand(0.15, 0.85);
			const oz = rand(0.15, 0.85);
			const i = this.cubes.spawn(cell[0] + ox, cell[1] + oy, cell[2] + oz, rand(0.9, 1.3));
			this.cubes.vel(i, (ox - 0.5) * 5, rand(2.5, 4.5), (oz - 0.5) * 5);
			this.cubes.size0[i] = this.cubes.size1[i] = rand(0.08, 0.14);
			this.cubes.grav[i] = 16;
			this.cubes.spin[i] = rand(3, 8);
			this.cubes.floor[i] = cell[1];
			this.cubes.bounce[i] = 1;
			this.cubes.colour(i, this.col.set(j % 3 === 2 ? accent : main));
		}
	}

	/** A block went down: a quick white outline round it and a puff of dust at its foot. */
	pop(cell: [number, number, number]) {
		const cx = cell[0] + 0.5;
		const cy = cell[1] + 0.5;
		const cz = cell[2] + 0.5;
		const step = this.reduced ? 2 : 1;
		for (let j = 0; j < EDGES.length; j += step) {
			const [ex, ey, ez, axis] = EDGES[j]!;
			const i = this.cubes.spawn(cx + ex * 1.03, cy + ey * 1.03, cz + ez * 1.03, 0.28);
			this.cubes.size0[i] = this.cubes.size1[i] = 0.06;
			const k = i * 3;
			this.cubes.ext[k] = axis === 0 ? 1.1 / 0.06 : 1;
			this.cubes.ext[k + 1] = axis === 1 ? 1.1 / 0.06 : 1;
			this.cubes.ext[k + 2] = axis === 2 ? 1.1 / 0.06 : 1;
			this.cubes.colour(i, this.col.set("#ffffff"));
		}
		const n = this.count(8);
		for (let j = 0; j < n; j++) {
			const a = (j / n) * Math.PI * 2 + rand(-0.2, 0.2);
			const i = this.soft.spawn(cx + Math.cos(a) * 0.55, cell[1] + 0.08, cz + Math.sin(a) * 0.55, rand(0.35, 0.5));
			this.soft.vel(i, Math.cos(a) * 1.2, rand(0.2, 0.5), Math.sin(a) * 1.2);
			this.soft.drag[i] = 3;
			this.soft.size0[i] = 0.25;
			this.soft.size1[i] = 0.55;
			this.soft.alpha[i] = 0.7;
			this.soft.shape[i] = PUFF;
			this.soft.colour(i, this.col.set("#f4f1ea"));
		}
	}

	/** The fire was fed: a shower of sparks rising off it and a quick bright flare. */
	sparks(at: [number, number, number], strength = 1) {
		const s = clamp01(strength);
		const cx = at[0] + 0.5;
		const cy = at[1] + 0.5;
		const cz = at[2] + 0.5;
		const flares = this.reduced ? 1 : 3;
		for (let j = 0; j < flares; j++) {
			const i = this.glow.spawn(cx, cy + 0.2 + j * 0.15, cz, this.reduced ? 0.6 : 0.45);
			this.glow.size0[i] = 1.3 + s;
			this.glow.size1[i] = 2.2 + s;
			this.glow.alpha[i] = 0.55;
			this.glow.colour(i, this.col.set("#ffb347"));
		}
		if (this.reduced) return;
		const n = this.count(28 * Math.max(0.3, s));
		for (let j = 0; j < n; j++) {
			const i = this.glow.spawn(cx + rand(-0.3, 0.3), cy + rand(0, 0.3), cz + rand(-0.3, 0.3), rand(0.7, 1.3));
			this.glow.vel(i, rand(-1.5, 1.5), rand(3.5, 6) * (0.7 + 0.3 * s), rand(-1.5, 1.5));
			this.glow.grav[i] = 4;
			this.glow.drag[i] = 0.8;
			this.glow.sway[i] = 0.6;
			this.glow.size0[i] = rand(0.1, 0.16);
			this.glow.size1[i] = 0.04;
			this.glow.colour(i, this.col.set(pick(SPARK_COLOURS)));
		}
	}

	/** A torch went out: a little grey puff. */
	smokePuff(at: [number, number, number]) {
		const n = this.count(6);
		for (let j = 0; j < n; j++) {
			const i = this.soft.spawn(at[0] + 0.5 + rand(-0.12, 0.12), at[1] + 0.6, at[2] + 0.5 + rand(-0.12, 0.12), rand(0.9, 1.3));
			this.soft.vel(i, rand(-0.3, 0.3), rand(0.6, 1), rand(-0.3, 0.3));
			this.soft.drag[i] = 1;
			this.soft.size0[i] = 0.3;
			this.soft.size1[i] = rand(0.8, 1.1);
			this.soft.alpha[i] = 0.6;
			this.soft.shape[i] = PUFF;
			this.soft.colour(i, this.col.set(pick(SMOKE_COLOURS)));
		}
	}

	/** An animal came home: a ring of gold stars spreading out and a couple of hearts floating up. */
	stars(at: [number, number, number]) {
		const cx = at[0] + 0.5;
		const cy = at[1] + 1;
		const cz = at[2] + 0.5;
		const n = this.count(10);
		for (let j = 0; j < n; j++) {
			const a = (j / n) * Math.PI * 2;
			const i = this.soft.spawn(cx + Math.cos(a) * 0.3, cy, cz + Math.sin(a) * 0.3, rand(1, 1.3));
			this.soft.vel(i, Math.cos(a) * 1.8, 1.4, Math.sin(a) * 1.8);
			this.soft.drag[i] = 1.6;
			this.soft.size0[i] = 0.38;
			this.soft.size1[i] = 0.18;
			this.soft.shape[i] = STAR;
			this.soft.colour(i, this.col.set(j % 2 ? "#ffe680" : "#ffd23f"));
		}
		const hearts = this.reduced ? 1 : 3;
		for (let j = 0; j < hearts; j++) {
			const i = this.soft.spawn(cx + rand(-0.3, 0.3), cy + 0.2, cz + rand(-0.3, 0.3), rand(1.4, 1.8));
			this.soft.vel(i, 0, rand(0.8, 1.2), 0);
			this.soft.sway[i] = this.reduced ? 0 : 0.5;
			this.soft.size0[i] = 0.42;
			this.soft.size1[i] = 0.32;
			this.soft.shape[i] = HEART;
			this.soft.colour(i, this.col.set(j % 2 ? "#ff9ec4" : "#ff7eb3"));
		}
	}

	/** The campfire's cell and how big it's burning, 0 to 1 (0: out, just a wisp of smoke). Null: no fire at all. */
	setFire(at: [number, number, number] | null, strength: number) {
		this.fireOn = !!at;
		if (at) this.fireAt.set(at[0] + 0.5, at[1], at[2] + 0.5);
		this.fireStrength = clamp01(strength);
	}

	/** How many fireflies are out (0 to 1) and where the kid is, so they gather round. */
	setFireflies(on: number, around: [number, number, number]) {
		this.ffTarget = clamp01(on);
		this.ffAround.set(around[0], around[1], around[2]);
	}

	private emitFire(dt: number) {
		if (!this.fireOn) return;
		const s = this.fireStrength;
		const { x, y, z } = this.fireAt;
		this.emberDue += 22 * s * this.k * dt;
		this.smokeDue += (0.8 + 1.6 * s) * this.k * dt;
		while (this.emberDue >= 1) {
			this.emberDue -= 1;
			const i = this.glow.spawn(x + rand(-0.3, 0.3), y + rand(0.4, 0.9), z + rand(-0.3, 0.3), rand(1.2, 2));
			this.glow.vel(i, rand(-0.2, 0.2), rand(1.1, 2) * (0.6 + 0.4 * s), rand(-0.2, 0.2));
			this.glow.drag[i] = 0.4;
			this.glow.sway[i] = 0.45;
			this.glow.size0[i] = rand(0.08, 0.14);
			this.glow.size1[i] = 0.03;
			this.glow.colour(i, this.col.set(pick(SPARK_COLOURS)));
		}
		while (this.smokeDue >= 1) {
			this.smokeDue -= 1;
			const i = this.soft.spawn(x + rand(-0.2, 0.2), y + 1 + 0.4 * s, z + rand(-0.2, 0.2), rand(2.5, 3.5));
			this.soft.vel(i, rand(-0.12, 0.12), rand(0.45, 0.7), rand(-0.12, 0.12));
			this.soft.sway[i] = 0.2;
			this.soft.size0[i] = 0.5;
			this.soft.size1[i] = rand(1.4, 1.8);
			this.soft.alpha[i] = 0.22 + 0.13 * s;
			this.soft.shape[i] = PUFF;
			this.soft.colour(i, this.col.set(pick(SMOKE_COLOURS)));
		}
	}

	/** Steps every effect on by dt seconds and refills the batches. Call once a frame. */
	update(dt: number, _camera: Camera, time: number) {
		const d = Math.min(Math.max(dt, 0), 0.1);
		this.emitFire(d);
		this.cubes.step(d, time);
		this.glow.step(d, time);
		this.soft.step(d, time);
		this.drawCubes();
		this.drawPoints(this.glow, this.glowLayer, true);
		this.fireflies(d, time);
		this.glowLayer.end();
		this.drawPoints(this.soft, this.softLayer, false);
		this.softLayer.end();
	}

	private drawCubes() {
		const p = this.cubes;
		const mesh = this.cubeMesh;
		let n = 0;
		for (let i = 0; i < p.cap; i++) {
			const life = p.life[i]!;
			const age = p.age[i]!;
			if (age >= life) continue;
			const t = age / life;
			const k = i * 3;
			const base = p.size0[i]! + (p.size1[i]! - p.size0[i]!) * t;
			// Hold their size, then shrink away at the end.
			const sz = base * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
			const spin = p.spin[i]!;
			const sd = p.seed[i]!;
			if (spin) this.q.setFromEuler(this.e.set(sd + age * spin, sd * 1.7 + age * spin * 0.8, sd * 0.3));
			else this.q.identity();
			this.s.set(sz * p.ext[k]!, sz * p.ext[k + 1]!, sz * p.ext[k + 2]!);
			this.at.set(p.p[k]!, p.p[k + 1]! + (p.bounce[i]! >= 0 ? sz / 2 : 0), p.p[k + 2]!);
			this.m.compose(this.at, this.q, this.s);
			mesh.setMatrixAt(n, this.m);
			this.col.setRGB(p.c[k]!, p.c[k + 1]!, p.c[k + 2]!);
			mesh.setColorAt(n, this.col);
			n++;
		}
		mesh.count = n;
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	}

	private drawPoints(p: Pool, layer: PointLayer, fades: boolean) {
		layer.begin();
		for (let i = 0; i < p.cap; i++) {
			const life = p.life[i]!;
			const age = p.age[i]!;
			if (age >= life) continue;
			const t = age / life;
			const k = i * 3;
			const size = p.size0[i]! + (p.size1[i]! - p.size0[i]!) * t;
			const a = p.alpha[i]! * Math.min(1, t / 0.1) * (1 - t * t);
			// Glowing things cool as they go: yellow to a deeper orange.
			const cool = fades ? 1 - 0.35 * t : 1;
			this.col.setRGB(p.c[k]!, p.c[k + 1]!, p.c[k + 2]!).convertLinearToSRGB();
			layer.push(p.p[k]!, p.p[k + 1]!, p.p[k + 2]!, this.col.r, this.col.g * cool, this.col.b * cool * cool, size, a, p.shape[i]!);
		}
	}

	private fireflies(dt: number, time: number) {
		// Ease in and out rather than popping on at dusk.
		this.ffOn += (this.ffTarget - this.ffOn) * Math.min(1, dt * 0.8);
		if (Math.abs(this.ffTarget - this.ffOn) < 0.002) this.ffOn = this.ffTarget;
		const want = this.ffOn * this.ffMax;
		const { x: ax, y: ay, z: az } = this.ffAround;
		for (let i = 0; i < this.ffMax; i++) {
			const weight = clamp01(want - i);
			if (weight <= 0) {
				this.ffSeated[i] = 0;
				continue;
			}
			const k = i * 3;
			const ph = this.ffPhase[i]!;
			const dx = this.ffHome[k]! - ax;
			const dz = this.ffHome[k + 2]! - az;
			if (!this.ffSeated[i] || dx * dx + dz * dz > 144) {
				// Find a new spot near the kid, out of their way.
				const a = Math.random() * Math.PI * 2;
				const r = rand(3, 11);
				this.ffHome[k] = ax + Math.cos(a) * r;
				this.ffHome[k + 1] = ay + rand(0.3, 2.2);
				this.ffHome[k + 2] = az + Math.sin(a) * r;
				this.ffSeated[i] = 1;
			}
			let x = this.ffHome[k]!;
			let y = this.ffHome[k + 1]!;
			let z = this.ffHome[k + 2]!;
			let glow = 0.6;
			if (!this.reduced) {
				x += Math.sin(time * 0.37 + ph * 3) * 1.2 + Math.sin(time * 0.71 + ph) * 0.5;
				y += Math.sin(time * 0.53 + ph * 2) * 0.4;
				z += Math.cos(time * 0.31 + ph * 2.5) * 1.2 + Math.cos(time * 0.83 + ph) * 0.5;
				const b = 0.5 + 0.5 * Math.sin(time * (1.3 + (ph % 1)) + ph * 5);
				glow = 0.12 + 0.88 * b * b * b;
			}
			this.glowLayer.push(x, y, z, 0.78, 1, 0.42, 0.22, weight * glow, DOT);
		}
	}

	/** Particles alive right now (fireflies not counted). */
	live(): number {
		return this.cubes.live() + this.glow.live() + this.soft.live();
	}

	/** How many things in `group` draw: always the same however much is going on. */
	drawObjects(): number {
		return this.group.children.length;
	}

	dispose() {
		this.cubeMesh.geometry.dispose();
		(this.cubeMesh.material as MeshLambertMaterial).dispose();
		this.cubeMesh.dispose();
		this.glowLayer.geometry.dispose();
		this.glowLayer.material.dispose();
		this.softLayer.geometry.dispose();
		this.softLayer.material.dispose();
		this.sheet.dispose();
		// Leaves the group as it is: three uploads the disposed resources again if it's shown again (a remount).
		this.group.removeFromParent();
	}
}
