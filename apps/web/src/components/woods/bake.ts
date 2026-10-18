import { BufferAttribute, type BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Bakes every plain one-colour shape under `root` into at most two vertex-coloured meshes (one lit, one glowing), so a
 * model built from dozens of boxes costs two draw calls instead of dozens. See-through or textured parts are left as
 * they are, moved under the new group in place, as is anything marked `userData.keep` (a part that changes colour). The returned group replaces `root` (which is emptied).
 */
export function bake(
	root: Object3D,
	opts: { shadows?: boolean /** Glowing parts shine through the fog. */; glowThroughFog?: boolean } = {},
): Group {
	root.updateMatrixWorld(true);
	const inverse = root.matrixWorld.clone().invert();
	const lit: BufferGeometry[] = [];
	const glow: BufferGeometry[] = [];
	const keep: Object3D[] = [];
	root.traverse((o) => {
		const m = o as Mesh;
		if (!m.isMesh) return;
		const material = m.material;
		const plain =
			(material instanceof MeshLambertMaterial || material instanceof MeshBasicMaterial) && !material.map && !material.transparent;
		if (!plain) {
			keep.push(m);
			return;
		}
		const local = m.matrixWorld.clone().premultiply(inverse);
		const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(local);
		const c = material.color;
		const colours = new Float32Array(g.attributes.position!.count * 3);
		for (let k = 0; k < colours.length; k += 3) colours.set([c.r, c.g, c.b], k);
		g.setAttribute("color", new BufferAttribute(colours, 3));
		g.deleteAttribute("uv");
		(material instanceof MeshBasicMaterial ? glow : lit).push(g);
	});
	const out = new Group();
	out.position.copy(root.position);
	out.quaternion.copy(root.quaternion);
	out.scale.copy(root.scale);
	out.userData = { ...root.userData };
	const add = (list: BufferGeometry[], material: MeshLambertMaterial | MeshBasicMaterial) => {
		const merged = list.length ? mergeGeometries(list) : null;
		if (!merged) return;
		const mesh = new Mesh(merged, material);
		mesh.castShadow = mesh.receiveShadow = opts.shadows ?? true;
		if (material instanceof MeshBasicMaterial) mesh.castShadow = false;
		out.add(mesh);
	};
	add(lit, new MeshLambertMaterial({ vertexColors: true }));
	add(glow, new MeshBasicMaterial({ vertexColors: true, fog: !opts.glowThroughFog }));
	for (const o of keep) {
		const local = o.matrixWorld.clone().premultiply(inverse);
		o.removeFromParent();
		local.decompose(o.position, o.quaternion, o.scale);
		out.add(o);
	}
	return out;
}
