import { useFrame, useLoader } from "@react-three/fiber";
import { type RefObject, Suspense, useEffect, useMemo, useRef } from "react";
import {
	AdditiveBlending,
	CanvasTexture,
	Color,
	type Group,
	type Mesh,
	type MeshStandardMaterial,
	MeshToonMaterial,
	type Object3D,
	type Sprite,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonGradient } from "../roxy/world/Furniture.tsx";
import { Fallback, withMeshopt } from "../roxy/world/Model.tsx";
import type { Fx } from "./fx.tsx";
import { useBeat } from "./live.ts";

/**
 * The Phoenix: a generated model (Tripo image-to-3D from a Gemini concept, `public/models/phoenix/phoenix.glb`, wings
 * spread along ±x, beak to +z, belly at y 0, wingspan 2). It has no rig, so its wings flap in the vertex shader: every
 * vertex past the shoulder (|x| > 0.2) turns about the shoulder by `flap`, more toward the tip, so the wing bends.
 *
 * It perches on the stage's light arch, breathing and glowing in time. When the party's hype is full it rises: it
 * lifts off, loops over the dance floor trailing embers for the Fire Drop, then glides home to its perch.
 */

const URL = "/models/phoenix/phoenix.glb";
/** Where the wing starts, and where the shoulder it turns about sits, in the model's units. */
const SHOULDER_X = 0.2;
const SHOULDER_Y = 0.42;

export const PERCH: [number, number, number] = [0, 5.95, -6.6];
const SCALE = 1.55;
const EMBERS = ["#ffd166", "#ff8c42", "#ff5d73", "#ffe8a3"];

type Flap = { value: number };
type Glow = { value: number };

/** The bird's material: toon over its own colour map, warmed from within by `glow`, and the wing bend. */
function phoenixMaterial(src: MeshStandardMaterial, flap: Flap, glow: Glow) {
	const m = new MeshToonMaterial({ map: src.map, color: new Color("#ffffff"), gradientMap: toonGradient() });
	m.emissive = new Color("#ff6a2a");
	m.emissiveMap = src.map;
	m.emissiveIntensity = 0.35;
	m.onBeforeCompile = (shader) => {
		shader.uniforms.uFlap = flap;
		shader.uniforms.uGlow = glow;
		const bend = /* glsl */ `
			float side = sign(position.x);
			float ax = abs(position.x);
			float w = clamp((ax - ${SHOULDER_X.toFixed(2)}) / 0.8, 0.0, 1.0);
			float on = smoothstep(${SHOULDER_X.toFixed(2)}, ${(SHOULDER_X + 0.12).toFixed(2)}, ax);
			float ang = uFlap * on * (0.7 + 0.6 * w);
			float c = cos(ang), s = sin(ang);
		`;
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nuniform float uFlap;")
			.replace(
				"#include <beginnormal_vertex>",
				`#include <beginnormal_vertex>
				{
					${bend}
					vec2 n = vec2(objectNormal.x * side, objectNormal.y);
					objectNormal.x = (n.x * c - n.y * s) * side;
					objectNormal.y = n.x * s + n.y * c;
				}`,
			)
			.replace(
				"#include <begin_vertex>",
				`#include <begin_vertex>
				{
					${bend}
					vec2 p = vec2(ax - ${SHOULDER_X.toFixed(2)}, transformed.y - ${SHOULDER_Y.toFixed(2)});
					vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
					if (ax > ${SHOULDER_X.toFixed(2)}) {
						transformed.x = side * (${SHOULDER_X.toFixed(2)} + r.x);
						transformed.y = ${SHOULDER_Y.toFixed(2)} + r.y;
					}
				}`,
			);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", "#include <common>\nuniform float uGlow;")
			.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uGlow;");
	};
	return m;
}

/** A soft round glow for behind the bird. */
let halo: CanvasTexture | null = null;
function haloTexture() {
	if (halo) return halo;
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const ctx = c.getContext("2d")!;
	const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
	g.addColorStop(0, "rgba(255,220,140,1)");
	g.addColorStop(0.35, "rgba(255,130,60,0.55)");
	g.addColorStop(1, "rgba(255,60,90,0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 128, 128);
	halo = new CanvasTexture(c);
	return halo;
}

function Loaded({ flap, glow }: { flap: Flap; glow: Glow }) {
	const gltf = useLoader(GLTFLoader, URL, withMeshopt);
	const object = useMemo(() => {
		const o: Object3D = gltf.scene.clone(true);
		o.traverse((x) => {
			const mesh = x as Mesh;
			if (!mesh.isMesh) return;
			mesh.material = phoenixMaterial(mesh.material as MeshStandardMaterial, flap, glow);
			// The wings move in the shader, so the box three.js culls by is the still pose's: never cull it.
			mesh.frustumCulled = false;
		});
		return o;
	}, [gltf, flap, glow]);
	// The toon materials are this clone's own (the geometry and map stay the loader's cache's): free them on leaving.
	useEffect(
		() => () =>
			object.traverse((x) => {
				const mesh = x as Mesh;
				if (mesh.isMesh) (mesh.material as MeshToonMaterial).dispose();
			}),
		[object],
	);
	return <primitive object={object} />;
}

/** While the model loads, or if it can't: a little code-built firebird. */
function Stand({ flap }: { flap: Flap }) {
	const left = useRef<Group>(null);
	const right = useRef<Group>(null);
	useFrame(() => {
		if (left.current) left.current.rotation.z = -flap.value;
		if (right.current) right.current.rotation.z = flap.value;
	});
	return (
		<group>
			<mesh position={[0, 0.3, 0]} scale={[0.2, 0.26, 0.24]}>
				<sphereGeometry args={[1, 16, 12]} />
				<meshToonMaterial color="#b0203a" gradientMap={toonGradient()} />
			</mesh>
			<mesh position={[0, 0.5, 0.14]}>
				<sphereGeometry args={[0.13, 14, 10]} />
				<meshToonMaterial color="#c42a44" gradientMap={toonGradient()} />
			</mesh>
			{[left, right].map((r, i) => (
				<group key={i} ref={r} position={[(i ? 1 : -1) * SHOULDER_X, SHOULDER_Y, 0]}>
					<mesh position={[(i ? 1 : -1) * 0.4, 0.05, 0]} scale={[0.42, 0.04, 0.2]}>
						<sphereGeometry args={[1, 12, 8]} />
						<meshToonMaterial color="#ff8a3d" gradientMap={toonGradient()} />
					</mesh>
				</group>
			))}
		</group>
	);
}

/** Where the bird is in its flight, eased between perched and flying. */
type Flight = { up: number; since: number; pos: [number, number, number]; yaw: number; bank: number; lastEmber: number };

export function Phoenix({ fx, reduced }: { fx: RefObject<Fx | null>; reduced: boolean }) {
	const beat = useBeat();
	const root = useRef<Group>(null);
	const body = useRef<Group>(null);
	const glowSprite = useRef<Sprite>(null);
	const flap = useMemo<Flap>(() => ({ value: 0.25 }), []);
	const glow = useMemo<Glow>(() => ({ value: 1 }), []);
	const flight = useRef<Flight>({ up: 0, since: 0, pos: [...PERCH], yaw: 0, bank: 0, lastEmber: 0 });

	useFrame(() => {
		const b = beat.current;
		const f = flight.current;
		const g = root.current;
		if (!g) return;
		const want = b.rise ? 1 : 0;
		if (want && f.up === 0) f.since = b.t;
		// Lifting off takes about a second; gliding home a little longer.
		f.up = Math.max(0, Math.min(1, f.up + (want ? 1 : -0.7) * b.dt));
		const ease = f.up * f.up * (3 - 2 * f.up);

		// The loop over the floor: an oval at about 6 up, round once every 4 bars.
		const k = ((b.t - f.since) / (b.spb * 16)) * Math.PI * 2;
		const loop: [number, number, number] = [Math.sin(k) * 4.2, 5.4 + Math.sin(k * 2) * 0.5, 0.2 - Math.cos(k) * 2.8];
		const x = PERCH[0] + (loop[0] - PERCH[0]) * ease;
		const y = PERCH[1] + (loop[1] - PERCH[1]) * ease + Math.sin(ease * Math.PI) * 1.2;
		const z = PERCH[2] + (loop[2] - PERCH[2]) * ease;
		if (reduced) {
			// No flight with reduced motion: it glows and spreads its wings where it is.
			g.position.set(...PERCH);
		} else g.position.set(x, y, z);

		// Facing: toward the camera when perched; along the loop when flying, leaning into the turn.
		const heading = Math.atan2(Math.cos(k) * 4.2, Math.sin(k) * 2.8);
		const yaw = reduced ? 0 : heading * ease;
		g.rotation.y = yaw;
		g.rotation.z = reduced ? 0 : -Math.cos(k) * 0.35 * ease;

		// Wings: a slow breath at rest, opening on the beat as the party warms; strong beats in flight.
		if (reduced) flap.value = b.rise ? 0.1 : 0.35;
		else if (f.up > 0.02) flap.value = Math.sin(b.t * 9) * 0.55 * (0.6 + 0.4 * ease) + 0.05;
		else flap.value = 0.38 - b.energy * 0.3 + Math.sin(b.t * 1.6) * 0.06 - b.pulse * 0.12 * b.energy;

		// It breathes and bobs on its perch, a hop on each beat when the floor's hot.
		if (body.current) body.current.position.y = f.up > 0.02 || reduced ? 0 : Math.sin(b.t * 1.6) * 0.04 + b.pulse * 0.08 * b.energy;

		glow.value = 0.35 + b.energy * 0.6 + f.up * 1.2 + b.pulse * 0.25;
		if (glowSprite.current) {
			const s = 2.2 + b.energy * 1.2 + f.up * 2.4 + b.pulse * 0.4;
			glowSprite.current.scale.set(s, s, 1);
			(glowSprite.current.material as { opacity: number }).opacity = 0.35 + b.energy * 0.3 + f.up * 0.4;
		}

		// Embers trail behind it while it flies.
		if (f.up > 0.1 && fx.current && b.t - f.lastEmber > 0.03) {
			f.lastEmber = b.t;
			fx.current.ember([g.position.x, g.position.y + 0.6, g.position.z], EMBERS[Math.floor(Math.random() * EMBERS.length)]!);
		}
	});

	return (
		<group ref={root} position={PERCH}>
			<sprite ref={glowSprite} position={[0, 0.6, -0.3]} renderOrder={-1}>
				<spriteMaterial map={haloTexture()} blending={AdditiveBlending} transparent depthWrite={false} opacity={0.4} />
			</sprite>
			<group ref={body} scale={SCALE}>
				<Fallback fallback={<Stand flap={flap} />}>
					<Suspense fallback={<Stand flap={flap} />}>
						<Loaded flap={flap} glow={glow} />
					</Suspense>
				</Fallback>
			</group>
		</group>
	);
}
