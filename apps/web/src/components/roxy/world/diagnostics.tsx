import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

/**
 * Dev only: what the last frame cost, on `window.__THREE_GAME_DIAGNOSTICS__` for the canvas inspector. Read in the
 * frame loop, so it holds the frame before (three.js resets its counts at the start of each render).
 */
export function Diagnostics() {
	useFrame(({ gl, scene }) => {
		const { render, memory, programs } = gl.info;
		// What's drawn: visible meshes, and those that also go into the shadow pass.
		let meshes = 0;
		let casters = 0;
		let instanced = 0;
		scene.traverseVisible((o) => {
			const m = o as Mesh;
			if (!m.isMesh) return;
			meshes++;
			if (m.castShadow) casters++;
			if ((m as { isInstancedMesh?: boolean }).isInstancedMesh) instanced++;
		});
		(window as { __THREE_GAME_DIAGNOSTICS__?: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
			renderer: {
				calls: render.calls,
				triangles: render.triangles,
				geometries: memory.geometries,
				textures: memory.textures,
				programs: programs?.length ?? 0,
			},
			scene: { meshes, casters, instanced },
			dpr: gl.getPixelRatio(),
			shadows: gl.shadowMap.enabled,
		};
	});
	return null;
}
