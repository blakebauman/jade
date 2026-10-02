import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type BufferGeometry, Float32BufferAttribute, FrontSide, type Group, Matrix4, Mesh, MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonGradient } from "./Furniture.tsx";

/**
 * Scenery that never moves, drawn in one go. A town place is built from hundreds of small toy shapes, each its own
 * draw call; inside `Static` every plain toon shape (no picture, not see-through, not glowing) is baked into one
 * mesh coloured per vertex, so a whole place costs a handful of draw calls and an iPad can afford the detail.
 * Anything else inside (glass, glowing lamps, pictures) is left as it is.
 *
 * Only for things that stay put and aren't tapped: no handlers, no animation, no Suspense (a generated model that
 * swaps in later would leave its stand-in baked behind). What's baked is fixed: a later change to a baked child's
 * colour, glow or visibility won't show. Keep the children's identity stable (module-level JSX or memoised); new
 * children rebake the whole group.
 */
export function Static({
	children,
	cast = true,
}: {
	children: ReactNode;
	/** False for low ground detail whose shadow no one would see. */
	cast?: boolean;
}) {
	const holder = useRef<Group>(null);
	const [baked, setBaked] = useState<Mesh | null>(null);
	useLayoutEffect(() => {
		const g = holder.current;
		if (!g) return;
		g.updateWorldMatrix(true, true);
		const toLocal = new Matrix4().copy(g.matrixWorld).invert();
		const parts: BufferGeometry[] = [];
		const taken: Mesh[] = [];
		const m = new Matrix4();
		g.traverse((o) => {
			const mesh = o as Mesh;
			if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh || !mesh.visible) return;
			const mat = mesh.material as MeshToonMaterial;
			// Left as they are: pictures, glass, glowing parts, two-sided cut-outs (a kite's sail, a feather) and anything
			// mirrored (its faces would turn inside out), since the bake is one-sided toon.
			if (
				Array.isArray(mat) ||
				!mat.isMeshToonMaterial ||
				mat.map ||
				mat.transparent ||
				mat.side !== FrontSide ||
				mat.emissiveIntensity * mat.emissive.getHex() > 0 ||
				mesh.matrixWorld.determinant() < 0
			)
				return;
			let geo = mesh.geometry.clone();
			geo = geo.index ? geo.toNonIndexed() : geo;
			for (const name of Object.keys(geo.attributes)) if (name !== "position" && name !== "normal") geo.deleteAttribute(name);
			geo.applyMatrix4(m.multiplyMatrices(toLocal, mesh.matrixWorld));
			// The material's colour is already linear (three's colour management), which is what vertex colours want.
			const n = geo.attributes.position!.count;
			const colour = new Float32Array(n * 3);
			const { r, g: gr, b } = mat.color;
			for (let i = 0; i < n * 3; i += 3) {
				colour[i] = r;
				colour[i + 1] = gr;
				colour[i + 2] = b;
			}
			geo.setAttribute("color", new Float32BufferAttribute(colour, 3));
			parts.push(geo);
			taken.push(mesh);
		});
		if (!parts.length) return;
		const merged = mergeGeometries(parts);
		for (const p of parts) p.dispose();
		if (!merged) return;
		const mesh = new Mesh(merged, bakedMaterial());
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		mesh.userData.noCast = !cast;
		for (const t of taken) t.visible = false;
		setBaked(mesh);
		return () => {
			for (const t of taken) t.visible = true;
			merged.dispose();
			setBaked(null);
		};
	}, [children, cast]);
	return (
		<>
			<group ref={holder}>{children}</group>
			{baked && <primitive object={baked} />}
		</>
	);
}

let shared: MeshToonMaterial | undefined;
/** The one material every baked place shares: toon, coloured by its vertices. */
function bakedMaterial() {
	shared ??= new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
	return shared;
}
