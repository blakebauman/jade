import { useLoader } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useMemo } from "react";
import { Box3, type Material, type Mesh, type MeshStandardMaterial, MeshToonMaterial, type Object3D } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradient } from "./Furniture.tsx";

/**
 * Generated models (Tripo text-to-3D, in public/models): town scenery that's never recoloured, and pets, whose
 * white-and-grey coats are tinted from the palette (three/GeneratedPet.tsx). Each file has been cut down to one 512px
 * colour map and meshopt geometry; here its material becomes the same three-step toon as the shapes built in code,
 * so the two sit together. Until a file has loaded, or if it can't, the code-built version shows instead.
 */

export const MODELS = {
	"park-tree": "/models/town/park-tree.glb",
	"park-bench": "/models/town/park-bench.glb",
	"park-slide": "/models/town/park-slide.glb",
	"petshop-counter": "/models/town/petshop-counter.glb",
	"school-desk": "/models/town/school-desk.glb",
	"school-teacher-desk": "/models/town/school-teacher-desk.glb",
	"school-bookshelf": "/models/town/school-bookshelf.glb",
	"pet-cat": "/models/pets/pet-cat.glb",
	"pet-dog": "/models/pets/pet-dog.glb",
	"pet-bunny": "/models/pets/pet-bunny.glb",
	"pet-hamster": "/models/pets/pet-hamster.glb",
} as const;
export type ModelId = keyof typeof MODELS;

type V3 = [number, number, number];

export const withMeshopt = (loader: GLTFLoader) => {
	loader.setMeshoptDecoder(MeshoptDecoder);
};

const toon = new Map<Material, MeshToonMaterial>();
function toToon(m: Material) {
	let t = toon.get(m);
	if (!t) {
		const src = m as MeshStandardMaterial;
		t = new MeshToonMaterial({ map: src.map, color: src.color, gradientMap: toonGradient() });
		toon.set(m, t);
	}
	return t;
}

function Loaded({ id, height, at, rot }: { id: ModelId; height: number; at: V3; rot: number }) {
	const gltf = useLoader(GLTFLoader, MODELS[id], withMeshopt);
	// A clone per use, so the park's four trees can share one file.
	const { object, scale, lift } = useMemo(() => {
		const object: Object3D = gltf.scene.clone(true);
		object.traverse((o) => {
			const mesh = o as Mesh;
			if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toToon) : toToon(mesh.material);
		});
		const box = new Box3().setFromObject(object);
		const scale = height / (box.max.y - box.min.y);
		return { object, scale, lift: -box.min.y * scale };
	}, [gltf, height]);
	return (
		<group position={at} rotation={[0, rot, 0]}>
			<primitive object={object} scale={scale} position={[0, lift, 0]} />
		</group>
	);
}

export class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

/** A generated model standing on the ground at `at`, `height` tall, turned `rot` about y. */
export function Model({ fallback, ...props }: { id: ModelId; height: number; at: V3; rot?: number; fallback: ReactNode }) {
	return (
		<Fallback fallback={fallback}>
			<Suspense fallback={fallback}>
				<Loaded {...props} rot={props.rot ?? 0} />
			</Suspense>
		</Fallback>
	);
}
