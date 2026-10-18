import { blockInfo } from "@jade/core/woods";
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Texture } from "three";
import { tileUv } from "./mesher.ts";

/**
 * What the kid is holding, seen in the bottom-right corner in first person: the block in hand (with its own pixel
 * faces), or a hand when it's empty. It bobs with each step, swings while digging and dips when it builds, and is
 * drawn last, over the world and anything see-through, so it never pokes into a wall or under a cloud.
 */

/** BoxGeometry's faces in order (+x, -x, +y, -y, +z, -z) and which tile each takes. */
const FACE_TILE = ["side", "side", "top", "bottom", "side", "side"] as const;

function blockGeometry(id: number) {
	const info = blockInfo(id);
	const thin = info.draw === "torch" || info.draw === "plant";
	const g = new BoxGeometry(thin ? 0.22 : 1, thin ? 0.9 : 1, thin ? 0.22 : 1);
	const uv = g.attributes.uv!;
	for (let face = 0; face < 6; face++) {
		const [u0, v0, u1, v1] = tileUv(info.tiles[FACE_TILE[face]!]);
		for (let k = 0; k < 4; k++) {
			const i = face * 4 + k;
			uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
		}
	}
	return g;
}

export class Held {
	readonly group = new Group();
	private block: Mesh;
	private hand: Mesh;
	private shown = -1;
	private swing = 0;
	private dip = 0;
	private geometries = new Map<number, BoxGeometry>();

	constructor(atlas: Texture) {
		const mat = new MeshLambertMaterial({ map: atlas, alphaTest: 0.5, transparent: true, depthTest: false, depthWrite: false });
		this.block = new Mesh(new BoxGeometry(1, 1, 1), mat);
		this.block.scale.setScalar(0.15);
		this.hand = new Mesh(
			new BoxGeometry(0.1, 0.1, 0.34),
			new MeshLambertMaterial({ color: "#f0c7a0", transparent: true, depthTest: false, depthWrite: false }),
		);
		for (const m of [this.block, this.hand]) {
			m.renderOrder = 1000;
			m.frustumCulled = false;
		}
		this.group.add(this.block, this.hand);
		this.group.position.set(0.36, -0.3, -0.62);
	}

	/** Shows `id` in hand (0 or nothing carried: an empty hand). */
	hold(id: number) {
		if (id === this.shown) return;
		this.shown = id;
		this.hand.visible = !id;
		this.block.visible = !!id;
		if (!id) return;
		let g = this.geometries.get(id);
		if (!g) {
			g = blockGeometry(id);
			this.geometries.set(id, g);
		}
		this.block.geometry = g;
	}

	/** A quick dip forward: a block was built. */
	built() {
		this.dip = 1;
	}

	/**
	 * `walking` 0–1 how fast the kid is moving, `stride` the distance walked (for the bob), `mining` whether a dig is
	 * under way. With reduced motion it holds still.
	 */
	update(dt: number, walking: number, stride: number, mining: boolean, still: boolean) {
		this.swing = mining ? this.swing + dt * 9 : 0;
		this.dip = Math.max(0, this.dip - dt * 5);
		const bob = still ? 0 : Math.sin(stride * 4.2) * 0.022 * walking;
		const sway = still ? 0 : Math.cos(stride * 2.1) * 0.018 * walking;
		const chop = mining && !still ? Math.abs(Math.sin(this.swing)) : 0;
		const dip = Math.sin(this.dip * Math.PI);
		this.group.position.set(0.36 + sway, -0.3 + bob - dip * 0.04, -0.62 - dip * 0.06);
		this.group.rotation.set(-0.35 * chop - 0.25 * dip, 0.55 - 0.2 * chop, 0.05 + 0.25 * chop);
		this.block.rotation.set(0.15, 0.6, 0);
		this.hand.rotation.set(-0.3, 0.3, 0);
	}
}
