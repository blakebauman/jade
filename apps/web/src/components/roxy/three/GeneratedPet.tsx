import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { type ReactNode, Suspense, useEffect, useMemo, useRef } from "react";
import { Box3, Color, type Group, type Mesh, type MeshStandardMaterial, MeshToonMaterial, type Object3D, Vector2, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { toonGradient } from "../world/Furniture.tsx";
import { Fallback, MODELS, type ModelId, withMeshopt } from "../world/Model.tsx";
import { useWake } from "../world/pace.tsx";
import { Bowl } from "./bowl.tsx";

/**
 * Generated pets. The model's coat comes out of Tripo white with grey markings, and the shader paints it from the
 * look: light fur takes the pet's c1, mid greys its c2, and each keeps the texture's baked shading. Near-black
 * (eyes) and strongly coloured texels (nose, inner ears) keep their own colour. There's no rig (Tripo's auto-rig
 * can't find a toy cat's stubby legs), so code waddles it: a sway, a bob and a nod while it's moving.
 */

/**
 * Pets that have a generated model, each about as tall as its code-built one (Pet3D's coordinates, before its 1.5
 * scale). `split` is where grey markings end and light coat begins (texture lightness, sRGB); the hamster's grey is
 * paler than the others'. `keep` is how saturated a texel must be to keep its own colour; the hamster's fur is pure
 * grey, so its pink ears and paws can be paler than the cat's, whose cream fur is a little warm. `swap` is for a
 * pet whose c1 is the darker part: the hamster's body is c1 and its pale belly c2, so its grey back takes c1.
 * `anchors` are where petwear hangs, measured from each model like the code pets' (`head` is the top of the skull
 * between the ears, `neck` the middle of where a collar goes, `neckR` its radius, `bib` how far forward the chest is
 * under the collar and how big a bandana fits there); the accessory waddles with the pet. Without `anchors` the
 * code pet's are used: the goldfish's model swims in the code-built bowl, which is what its accessories go on.
 *
 * Tripo faces most models down +x, so they turn a quarter to face +z; `turn` says otherwise (found from where the
 * eyes are in each model). `dark` is how dark a texel must be to stay as it is (eyes), and `marksL` how light the
 * markings usually are, for their shading; the turtle's skin is nearly as dark as its eyes. `at` moves the model,
 * and `around` is code-built scenery drawn with it, in the pet's coordinates.
 */
type V3 = [number, number, number];
export type PetAnchors = { neck: V3; neckR: number; head: V3; bib: { z: number; r: number } };
type GeneratedPetDef = {
	model: ModelId;
	height: number;
	anchors?: PetAnchors;
	turn?: number;
	split?: [number, number];
	keep?: [number, number];
	dark?: [number, number];
	marksL?: number;
	swap?: true;
	at?: V3;
	around?: ReactNode;
};
export const GENERATED_PETS: Partial<Record<string, GeneratedPetDef>> = {
	"pet-cat": {
		model: "pet-cat",
		height: 0.7,
		anchors: { neck: [0, 0.27, 0.21], neckR: 0.2, head: [0, 0.6, 0.12], bib: { z: 0.31, r: 0.2 } },
	},
	"pet-dog": {
		model: "pet-dog",
		height: 0.72,
		anchors: { neck: [0, 0.31, 0.07], neckR: 0.17, head: [0, 0.71, 0.12], bib: { z: 0.24, r: 0.17 } },
	},
	"pet-bunny": {
		model: "pet-bunny",
		height: 0.8,
		anchors: { neck: [0, 0.27, 0.06], neckR: 0.18, head: [0, 0.62, 0.1], bib: { z: 0.24, r: 0.13 } },
	},
	"pet-hamster": {
		model: "pet-hamster",
		height: 0.45,
		// No neck to speak of: the collar goes just under its cheeks.
		anchors: { neck: [0, 0.24, 0.03], neckR: 0.15, head: [0, 0.44, 0.03], bib: { z: 0.17, r: 0.11 } },
		split: [0.69, 0.77],
		keep: [0.14, 0.22],
		swap: true,
	},
	"pet-goldfish": {
		model: "pet-goldfish",
		height: 0.2,
		turn: Math.PI / 2,
		at: [0, 0.18, 0.02],
		around: (
			<>
				<Bowl />
			</>
		),
	},
	"pet-turtle": {
		model: "pet-turtle",
		height: 0.34,
		turn: Math.PI,
		dark: [0.08, 0.12],
		marksL: 0.27,
		// The head pokes out in front of the shell: hats go on it, not on the shell, and the collar under its chin.
		anchors: { neck: [0, 0.11, 0.18], neckR: 0.08, head: [0, 0.235, 0.2], bib: { z: 0.27, r: 0.045 } },
	},
	"pet-frog": {
		model: "pet-frog",
		height: 0.45,
		split: [0.7, 0.78],
		swap: true,
		// The collar goes at the throat, under the wide mouth; hats sit between the eyes.
		anchors: { neck: [0, 0.27, 0.025], neckR: 0.165, head: [0, 0.43, 0.04], bib: { z: 0.17, r: 0.1 } },
	},
};
const SPLIT: [number, number] = [0.58, 0.68];
const KEEP: [number, number] = [0.28, 0.38];
const DARK: [number, number] = [0.18, 0.28];

const TINT = /* glsl */ `
#ifdef USE_MAP
	vec3 lin = texture2D( map, vMapUv ).rgb;
	vec3 s = pow( lin, vec3( 1.0 / 2.2 ) );
	float l = dot( s, vec3( 0.299, 0.587, 0.114 ) );
	float sat = max( max( s.r, s.g ), s.b ) - min( min( s.r, s.g ), s.b );
	float coat = smoothstep( uSplit.x, uSplit.y, l );
	vec3 fur = mix( uMarks * clamp( l / uMarksL, 0.6, 1.2 ), uCoat * clamp( l / 0.82, 0.75, 1.1 ), coat );
	// Pink (red over green, blue not below green) is kept even when pale; warm cream fur has blue lowest.
	float pink = step( 0.06, s.r - s.g ) * step( s.g - 0.01, s.b ) * smoothstep( 0.06, 0.12, sat );
	float keep = max( max( smoothstep( uKeep.x, uKeep.y, sat ), pink ), 1.0 - smoothstep( uDark.x, uDark.y, l ) );
	diffuseColor.rgb *= mix( fur, lin, keep );
#endif
`;

function tinted(source: MeshStandardMaterial, def: GeneratedPetDef) {
	const split = def.split ?? SPLIT;
	const uniforms = {
		uCoat: { value: new Color() },
		uMarks: { value: new Color() },
		uSplit: { value: new Vector2(...split) },
		uKeep: { value: new Vector2(...(def.keep ?? KEEP)) },
		uDark: { value: new Vector2(...(def.dark ?? DARK)) },
		uMarksL: { value: def.marksL ?? split[0] - 0.08 },
	};
	const material = new MeshToonMaterial({ map: source.map, gradientMap: toonGradient() });
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.fragmentShader = `uniform vec3 uCoat;\nuniform vec3 uMarks;\nuniform vec2 uSplit;\nuniform vec2 uKeep;\nuniform vec2 uDark;\nuniform float uMarksL;\n${shader.fragmentShader.replace("#include <map_fragment>", TINT)}`;
	};
	material.customProgramCacheKey = () => "jade-tinted-pet";
	return { material, uniforms };
}

const at = new Vector3();

function Loaded({ def, c1, c2, wear }: { def: GeneratedPetDef; c1: string; c2: string; wear?: ReactNode }) {
	const gltf = useLoader(GLTFLoader, MODELS[def.model], withMeshopt);
	const invalidate = useThree((s) => s.invalidate);
	const { object, scale, lift, uniforms } = useMemo(() => {
		const object: Object3D = gltf.scene.clone(true);
		let tint: ReturnType<typeof tinted> | undefined;
		object.traverse((o) => {
			const mesh = o as Mesh;
			if (!mesh.isMesh) return;
			tint ??= tinted(mesh.material as MeshStandardMaterial, def);
			mesh.material = tint.material;
		});
		const box = new Box3().setFromObject(object);
		const scale = def.height / (box.max.y - box.min.y);
		return { object, scale, lift: -box.min.y * scale, uniforms: tint?.uniforms };
	}, [gltf, def]);
	useEffect(() => {
		const [light, grey] = def.swap ? [c2, c1] : [c1, c2];
		uniforms?.uCoat.value.set(light);
		uniforms?.uMarks.value.set(grey);
		invalidate();
	}, [uniforms, def, c1, c2, invalidate]);

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
			{def.around}
			<group position={def.at ?? [0, 0, 0]} rotation={[0, def.turn ?? -Math.PI / 2, 0]}>
				<primitive object={object} scale={scale} position={[0, lift, 0]} />
			</group>
			{wear}
		</group>
	);
}

export function GeneratedPet({
	fallback,
	...props
}: {
	def: GeneratedPetDef;
	c1: string;
	c2: string;
	wear?: ReactNode;
	fallback: ReactNode;
}) {
	return (
		<Fallback fallback={fallback}>
			<Suspense fallback={fallback}>
				<Loaded {...props} />
			</Suspense>
		</Fallback>
	);
}
