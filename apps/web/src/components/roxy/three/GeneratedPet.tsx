import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { type ReactNode, Suspense, useEffect, useMemo, useRef } from "react";
import { Box3, Color, type Group, type Mesh, type MeshStandardMaterial, MeshToonMaterial, type Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { toonGradient } from "../world/Furniture.tsx";
import { Fallback, MODELS, type ModelId, withMeshopt } from "../world/Model.tsx";
import { useWake } from "../world/pace.tsx";

/**
 * Generated pets. The model's coat comes out of Tripo white with grey markings, and the shader paints it from the
 * look: light fur takes the pet's c1, mid greys its c2, and each keeps the texture's baked shading. Near-black
 * (eyes) and strongly coloured texels (nose, inner ears) keep their own colour. There's no rig (Tripo's auto-rig
 * can't find a toy cat's stubby legs), so code waddles it: a sway, a bob and a nod while it's moving.
 */

/** Pets that have a generated model. A pet wearing petwear stays code-built: its accessories hang off fixed points. */
export const GENERATED_PETS: Partial<Record<string, ModelId>> = { "pet-cat": "pet-cat" };

/** Pet coordinates (Pet3D's, before its 1.5 scale): feet at the origin, facing +z, about as tall as the code cat. */
const HEIGHT = 0.7;

const TINT = /* glsl */ `
#ifdef USE_MAP
	vec3 lin = texture2D( map, vMapUv ).rgb;
	vec3 s = pow( lin, vec3( 1.0 / 2.2 ) );
	float l = dot( s, vec3( 0.299, 0.587, 0.114 ) );
	float sat = max( max( s.r, s.g ), s.b ) - min( min( s.r, s.g ), s.b );
	float coat = smoothstep( 0.58, 0.68, l );
	vec3 fur = mix( uMarks * clamp( l / 0.5, 0.6, 1.2 ), uCoat * clamp( l / 0.82, 0.75, 1.1 ), coat );
	float keep = max( smoothstep( 0.28, 0.38, sat ), 1.0 - smoothstep( 0.18, 0.28, l ) );
	diffuseColor.rgb *= mix( fur, lin, keep );
#endif
`;

function tinted(source: MeshStandardMaterial) {
	const uniforms = { uCoat: { value: new Color() }, uMarks: { value: new Color() } };
	const material = new MeshToonMaterial({ map: source.map, gradientMap: toonGradient() });
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.fragmentShader = `uniform vec3 uCoat;\nuniform vec3 uMarks;\n${shader.fragmentShader.replace("#include <map_fragment>", TINT)}`;
	};
	material.customProgramCacheKey = () => "jade-tinted-pet";
	return { material, uniforms };
}

const at = new Vector3();

function Loaded({ id, c1, c2 }: { id: ModelId; c1: string; c2: string }) {
	const gltf = useLoader(GLTFLoader, MODELS[id], withMeshopt);
	const invalidate = useThree((s) => s.invalidate);
	const { object, scale, lift, uniforms } = useMemo(() => {
		const object: Object3D = gltf.scene.clone(true);
		let tint: ReturnType<typeof tinted> | undefined;
		object.traverse((o) => {
			const mesh = o as Mesh;
			if (!mesh.isMesh) return;
			tint ??= tinted(mesh.material as MeshStandardMaterial);
			mesh.material = tint.material;
		});
		const box = new Box3().setFromObject(object);
		const scale = HEIGHT / (box.max.y - box.min.y);
		return { object, scale, lift: -box.min.y * scale, uniforms: tint?.uniforms };
	}, [gltf]);
	useEffect(() => {
		uniforms?.uCoat.value.set(c1);
		uniforms?.uMarks.value.set(c2);
		invalidate();
	}, [uniforms, c1, c2, invalidate]);

	// The waddle: how much it's walking (0–1) eases toward whether it moved this frame.
	const root = useRef<Group>(null);
	const last = useRef<Vector3 | null>(null);
	const walk = useRef(0);
	const phase = useRef(0);
	const wake = useWake();
	const reduced = useMemo(() => prefersReducedMotion(), []);
	useFrame((_, dt) => {
		const g = root.current;
		if (!g) return;
		g.getWorldPosition(at);
		const speed = last.current ? at.distanceTo(last.current) / Math.max(dt, 1e-3) : 0;
		last.current ??= new Vector3();
		last.current.copy(at);
		walk.current += ((!reduced && speed > 0.2 ? 1 : 0) - walk.current) * Math.min(1, dt * 8);
		const k = walk.current;
		if (k < 0.001) return;
		phase.current += dt * 9;
		const p = phase.current;
		g.rotation.z = Math.sin(p) * 0.12 * k;
		g.rotation.x = Math.sin(p * 2) * 0.04 * k;
		g.position.y = Math.abs(Math.sin(p)) * 0.05 * k;
		if (k > 0.01) wake();
	});

	return (
		<group ref={root}>
			{/* Tripo faces a model down +x; pets face +z. */}
			<group rotation={[0, -Math.PI / 2, 0]}>
				<primitive object={object} scale={scale} position={[0, lift, 0]} />
			</group>
		</group>
	);
}

export function GeneratedPet({ fallback, ...props }: { id: ModelId; c1: string; c2: string; fallback: ReactNode }) {
	return (
		<Fallback fallback={fallback}>
			<Suspense fallback={fallback}>
				<Loaded {...props} />
			</Suspense>
		</Fallback>
	);
}
