import { BoxGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from "three";

/**
 * A rain shower round the kid: thin pale streaks falling through a box that follows the camera, so it's always raining
 * where they are and nowhere it would cost to draw. One instanced draw call; how many drops show follows how hard it's
 * raining. Gentler and fewer with reduced motion.
 */
const SPAN = 26;
const HIDDEN = new Vector3(0, 0, 0);
const HIGH = 18;

export class Rain {
	readonly mesh: InstancedMesh;
	private drops: Float32Array;
	private max: number;
	private m = new Matrix4();
	private speed: number;

	constructor(opts: { mobile?: boolean; reducedMotion?: boolean } = {}) {
		this.max = opts.reducedMotion ? 160 : opts.mobile ? 320 : 700;
		this.speed = opts.reducedMotion ? 6 : 15;
		this.mesh = new InstancedMesh(
			new BoxGeometry(0.025, 0.55, 0.025),
			new MeshBasicMaterial({ color: "#cfe0f2", transparent: true, opacity: 0.55, depthWrite: false }),
			this.max,
		);
		this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
		this.mesh.frustumCulled = false;
		this.mesh.userData.noCast = true;
		this.mesh.count = 0;
		// Each drop: x, y, z offsets inside the box (it wraps), and a little speed of its own.
		this.drops = new Float32Array(this.max * 4);
		let s = 12345;
		const r = () => {
			s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
			return s / 4294967296;
		};
		for (let k = 0; k < this.max; k++) this.drops.set([r() * SPAN, r() * HIGH, r() * SPAN, 0.8 + r() * 0.4], k * 4);
	}

	/** `amount` 0 (dry) to 1 (a proper shower). */
	update(dt: number, camera: { position: Vector3 }, amount: number) {
		const n = Math.round(this.max * Math.min(1, Math.max(0, amount)));
		this.mesh.count = n;
		this.mesh.visible = n > 0;
		if (!n) return;
		const c = camera.position;
		const step = Math.min(dt, 0.1) * this.speed;
		for (let k = 0; k < n; k++) {
			const o = k * 4;
			let y = this.drops[o + 1]! - step * this.drops[o + 3]!;
			if (y < 0) y += HIGH;
			this.drops[o + 1] = y;
			// Wrap round the camera so drops are always near it, whichever way it walks.
			const x = c.x - SPAN / 2 + ((((this.drops[o]! - c.x) % SPAN) + SPAN) % SPAN);
			const z = c.z - SPAN / 2 + ((((this.drops[o + 2]! - c.z) % SPAN) + SPAN) % SPAN);
			// Not right in front of the eye, where a drop would be a big pale bar.
			const close = Math.abs(x - c.x) < 2 && Math.abs(z - c.z) < 2;
			this.m.makeTranslation(x, c.y - HIGH / 2 + y, z);
			if (close) this.m.scale(HIDDEN);
			this.mesh.setMatrixAt(k, this.m);
		}
		this.mesh.instanceMatrix.needsUpdate = true;
	}
}
