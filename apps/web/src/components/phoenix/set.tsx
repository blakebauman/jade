import { seeded } from "@jade/core/math";
import { useFrame } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BackSide,
	BoxGeometry,
	BufferGeometry,
	Color,
	DoubleSide,
	Float32BufferAttribute,
	type Group,
	type InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	type Mesh,
	MeshBasicMaterial,
	Object3D,
	RepeatWrapping,
	ShaderMaterial,
} from "three";
import { Static } from "../roxy/world/batch.tsx";
import { B, Ball, Cyl, toonGradient } from "../roxy/world/Furniture.tsx";
import { canvasTexture } from "../roxy/world/stage.tsx";
import { useBeat } from "./live.ts";

/**
 * The rooftop: a timber deck high over the city at sunset, a stage at the back with the DJ's booth, speaker stacks
 * and a light arch with an LED wall, string lights overhead, plants, beanbags and a snack table round the edges, and
 * the city's towers and the setting sun beyond. Everything that never moves is baked into one mesh (`Static`); what
 * moves to the beat (platters, speaker cones, the booth's level bars, the LED wall, bulbs) is drawn on its own.
 */

export const STAGE_Y = 0.6;
export const STAGE_FRONT = -4.6;
export const BOOTH: [number, number, number] = [0, STAGE_Y, -5.3];
const ARCH_X = 4.3;
const ARCH_Z = -6.6;
const ARCH_TOP = 5.6;

const DECK = "#b9825a";
const TRUSS = "#c9ced6";
const BLACK = "#2a2633";
const DARK = "#3b3546";
const BERRY = "#b8326f";

// ── Sky and city ──

const SKY = new ShaderMaterial({
	side: BackSide,
	depthWrite: false,
	fog: false,
	uniforms: {},
	vertexShader: /* glsl */ `
		varying vec3 vDir;
		void main() {
			vDir = normalize(position);
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */ `
		varying vec3 vDir;
		void main() {
			float h = vDir.y;
			vec3 horizon = vec3(1.0, 0.62, 0.38);
			vec3 low = vec3(0.98, 0.42, 0.45);
			vec3 mid = vec3(0.62, 0.30, 0.58);
			vec3 top = vec3(0.20, 0.16, 0.42);
			vec3 c = mix(horizon, low, smoothstep(0.0, 0.08, h));
			c = mix(c, mid, smoothstep(0.08, 0.28, h));
			c = mix(c, top, smoothstep(0.28, 0.75, h));
			// The sun's glow, low behind the stage and a little left.
			vec3 sunDir = normalize(vec3(-0.25, 0.05, -1.0));
			float sun = max(dot(vDir, sunDir), 0.0);
			c += vec3(1.0, 0.75, 0.45) * pow(sun, 24.0) * 0.6 + vec3(1.0, 0.5, 0.3) * pow(sun, 4.0) * 0.25;
			c = mix(c, vec3(1.0, 0.92, 0.7), smoothstep(0.9975, 0.999, sun));
			gl_FragColor = vec4(c, 1.0);
		}`,
});

function Sky() {
	return (
		<mesh material={SKY} renderOrder={-10} frustumCulled={false}>
			<sphereGeometry args={[180, 32, 16]} />
		</mesh>
	);
}

/** Lit windows on a building's face: rows and columns, some warm and on, most dusky. */
function windowsTexture() {
	return canvasTexture(
		64,
		128,
		(ctx) => {
			ctx.fillStyle = "#4a3a6e";
			ctx.fillRect(0, 0, 64, 128);
			const rng = seeded(31);
			for (let y = 6; y < 124; y += 10)
				for (let x = 5; x < 60; x += 11) {
					const on = rng() < 0.38;
					ctx.fillStyle = on ? (rng() < 0.5 ? "#ffd59a" : "#ffb3c8") : "#3b2f5c";
					ctx.fillRect(x, y, 6, 6);
				}
		},
		[1, 1],
	);
}

/** The city round the roof: a ring of towers, nearer ones lower, one instanced draw. */
const City = memo(function City() {
	const ref = useRef<InstancedMesh>(null);
	const { geo, mat, n } = useMemo(() => {
		const geo = new BoxGeometry(1, 1, 1);
		geo.translate(0, 0.5, 0);
		const map = windowsTexture();
		map.wrapS = map.wrapT = RepeatWrapping;
		const mat = new MeshBasicMaterial({ map, color: new Color("#f3d6ff") });
		return { geo, mat, n: 70 };
	}, []);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const rng = seeded(17);
		const o = new Object3D();
		const c = new Color();
		const tones = ["#e7c4f2", "#d6b0e6", "#f2c6d6", "#c7b4ee"];
		for (let i = 0; i < n; i++) {
			// Behind and to the sides; none in front, where the camera is.
			const a = Math.PI * (0.08 + 0.84 * (i / n)) + (rng() - 0.5) * 0.05;
			const r = 34 + rng() * 40;
			const w = 4 + rng() * 6;
			const h = 8 + rng() * (r > 55 ? 34 : 20);
			o.position.set(Math.cos(a) * r * 1.3, -14, -Math.sin(a) * r);
			o.scale.set(w, h, w);
			o.rotation.y = rng() * Math.PI;
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
			m.setColorAt(i, c.set(tones[i % tones.length]!));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [n]);
	return <instancedMesh ref={ref} args={[geo, mat, n]} frustumCulled={false} />;
});

// ── The roof ──

function deckTexture() {
	return canvasTexture(
		256,
		256,
		(ctx) => {
			ctx.fillStyle = DECK;
			ctx.fillRect(0, 0, 256, 256);
			const rng = seeded(5);
			for (let y = 0; y < 256; y += 32) {
				const shade = 0.9 + rng() * 0.2;
				ctx.fillStyle = `rgba(${Math.round(185 * shade)},${Math.round(130 * shade)},${Math.round(90 * shade)},1)`;
				ctx.fillRect(0, y + 1, 256, 30);
				ctx.fillStyle = "rgba(90,55,35,0.55)";
				ctx.fillRect(0, y, 256, 2);
				const join = Math.floor(rng() * 200) + 20;
				ctx.fillRect(join, y, 2, 32);
				ctx.fillStyle = "rgba(255,230,200,0.08)";
				ctx.fillRect(0, y + 3, 256, 3);
			}
		},
		[5, 5],
	);
}

function Deck() {
	const map = useMemo(deckTexture, []);
	return (
		<>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.5]}>
				<planeGeometry args={[20, 17]} />
				<meshToonMaterial map={map} gradientMap={toonGradient()} />
			</mesh>
			{/* The roof's edge: a parapet below the railing, dropping away to the city. */}
			<mesh position={[0, -0.6, -0.5]}>
				<boxGeometry args={[20.4, 1.2, 17.4]} />
				<meshToonMaterial color="#7b5a8c" gradientMap={toonGradient()} />
			</mesh>
		</>
	);
}

/** One truss post or beam: four rails with zig-zag braces, in silver. */
function Truss({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const len = Math.hypot(dx, dy);
	const ang = Math.atan2(dy, dx);
	const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, from[2]];
	const s = 0.18;
	const braces = Math.floor(len / 0.45);
	return (
		<group position={mid} rotation={[0, 0, ang]}>
			{(
				[
					[s, s],
					[s, -s],
					[-s, s],
					[-s, -s],
				] as const
			).map(([y, z], i) => (
				<mesh key={i} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.035, 0.035, len, 6]} />
					<meshToonMaterial color={TRUSS} gradientMap={toonGradient()} />
				</mesh>
			))}
			{Array.from({ length: braces }, (_, i) => (
				<mesh key={`b${i}`} position={[-len / 2 + (i + 0.5) * (len / braces), 0, s]} rotation={[0, 0, i % 2 ? 0.8 : -0.8]}>
					<cylinderGeometry args={[0.02, 0.02, 0.5, 5]} />
					<meshToonMaterial color={TRUSS} gradientMap={toonGradient()} />
				</mesh>
			))}
			{Array.from({ length: braces }, (_, i) => (
				<mesh key={`c${i}`} position={[-len / 2 + (i + 0.5) * (len / braces), 0, -s]} rotation={[0, 0, i % 2 ? -0.8 : 0.8]}>
					<cylinderGeometry args={[0.02, 0.02, 0.5, 5]} />
					<meshToonMaterial color={TRUSS} gradientMap={toonGradient()} />
				</mesh>
			))}
		</group>
	);
}

function Plant({ p, big = false }: { p: [number, number, number]; big?: boolean }) {
	const k = big ? 1.3 : 1;
	return (
		<group position={p} scale={k}>
			<Cyl r={0.42} r2={0.34} h={0.7} p={[0, 0.35, 0]} c="#e07a55" />
			<Cyl r={0.44} h={0.08} p={[0, 0.72, 0]} c="#c9643f" />
			<Cyl r={0.06} h={1.2} p={[0, 1.3, 0]} c="#8a5a3a" />
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<mesh
					key={i}
					position={[Math.cos(i) * 0.45, 1.95 - (i % 2) * 0.1, Math.sin(i) * 0.45]}
					rotation={[Math.sin(i) * 0.7, i, Math.cos(i) * 0.7]}
					scale={[0.75, 0.12, 0.28]}
				>
					<sphereGeometry args={[1, 10, 6]} />
					<meshToonMaterial color={i % 2 ? "#4f9a4a" : "#6cb851"} gradientMap={toonGradient()} />
				</mesh>
			))}
		</group>
	);
}

/** The still parts of the set, baked into one mesh. Module-level, so their identity never changes. */
const SCENERY = (
	<>
		{/* Stage: a dark platform with a berry trim and steps down to the floor. */}
		<B s={[9.4, STAGE_Y, 3.6]} p={[0, STAGE_Y / 2, -6.4]} c={DARK} />
		<B s={[9.5, 0.08, 0.1]} p={[0, STAGE_Y - 0.04, STAGE_FRONT - 0.02]} c={BERRY} />
		<B s={[2.4, 0.3, 0.5]} p={[0, 0.15, STAGE_FRONT + 0.2]} c={DARK} />
		{/* The booth: a desk on a plinth, its front a glowing panel (drawn apart). */}
		<B s={[3.4, 0.8, 1.0]} p={[BOOTH[0], STAGE_Y + 0.4, BOOTH[2]]} c={BLACK} />
		<B s={[3.6, 0.08, 1.15]} p={[BOOTH[0], STAGE_Y + 0.82, BOOTH[2]]} c="#4a4258" />
		{/* The DJ's riser behind it. */}
		<B s={[2.6, 0.35, 1.0]} p={[BOOTH[0], STAGE_Y + 0.175, BOOTH[2] - 0.9]} c="#4a4258" />
		{/* Turntable bodies and the mixer. */}
		<B s={[0.95, 0.1, 0.8]} p={[-0.95, STAGE_Y + 0.9, BOOTH[2]]} c="#d9d4e0" />
		<B s={[0.95, 0.1, 0.8]} p={[0.95, STAGE_Y + 0.9, BOOTH[2]]} c="#d9d4e0" />
		<B s={[0.7, 0.14, 0.7]} p={[0, STAGE_Y + 0.92, BOOTH[2]]} c="#2f2a3a" />
		{/* Speaker stacks either side. */}
		{[-1, 1].map((s) => (
			<group key={s}>
				<B s={[1.2, 1.4, 1.0]} p={[s * 3.5, STAGE_Y + 0.7, -5.6]} c={BLACK} />
				<B s={[1.0, 1.1, 0.9]} p={[s * 3.5, STAGE_Y + 1.95, -5.6]} c={BLACK} />
			</group>
		))}
		{/* String-light poles at the corners. */}
		{[
			[-9.3, -7.8],
			[9.3, -7.8],
			[-9.3, 6.6],
			[9.3, 6.6],
		].map(([x, z]) => (
			<Cyl key={`${x}${z}`} r={0.08} h={4.6} p={[x!, 2.3, z!]} c="#5b5266" />
		))}
		{/* Snack table on the right, beanbags on the left. */}
		<B s={[2.6, 0.12, 1.1]} p={[7.4, 0.95, 1.2]} c="#f6f1e7" />
		<Cyl r={0.08} h={0.9} p={[6.4, 0.45, 1.2]} c="#9a9aa6" />
		<Cyl r={0.08} h={0.9} p={[8.4, 0.45, 1.2]} c="#9a9aa6" />
		<Cyl r={0.36} r2={0.3} h={0.16} p={[6.8, 1.1, 1.2]} c="#ffb84d" />
		<Ball r={0.28} p={[7.6, 1.18, 1.1]} s={[1, 0.5, 1]} c="#ff7aa8" />
		{[0, 1, 2, 3].map((i) => (
			<Cyl
				key={i}
				r={0.08}
				r2={0.06}
				h={0.22}
				p={[8.0 + (i % 2) * 0.22, 1.12, 0.9 + Math.floor(i / 2) * 0.4]}
				c={["#ff6b9a", "#8a5cff", "#22c5b5", "#ffd166"][i]!}
			/>
		))}
		<Ball r={0.62} p={[-7.8, 0.42, 0.6]} s={[1, 0.62, 1]} c="#8a5cff" />
		<Ball r={0.62} p={[-6.8, 0.42, 1.6]} s={[1, 0.62, 1]} c="#ff6b9a" />
		<Ball r={0.62} p={[-8.0, 0.42, 2.4]} s={[1, 0.62, 1]} c="#22c5b5" />
		{/* Railing round the back and sides (none at the front, where we look in). */}
		{Array.from({ length: 11 }, (_, i) => (
			<Cyl key={`rb${i}`} r={0.05} h={1.1} p={[-9.6 + i * 1.92, 0.55, -8.6]} c="#d8d3e4" />
		))}
		<B s={[19.4, 0.08, 0.12]} p={[0, 1.12, -8.6]} c="#d8d3e4" />
		{[-1, 1].map((s) =>
			Array.from({ length: 8 }, (_, i) => <Cyl key={`rs${s}${i}`} r={0.05} h={1.1} p={[s * 9.7, 0.55, -8.6 + i * 2.1]} c="#d8d3e4" />),
		)}
		{[-1, 1].map((s) => (
			<B key={`rt${s}`} s={[0.12, 0.08, 15.4]} p={[s * 9.7, 1.12, -1]} c="#d8d3e4" />
		))}
		{/* The light arch. */}
		<Truss from={[-ARCH_X, STAGE_Y, ARCH_Z]} to={[-ARCH_X, ARCH_TOP, ARCH_Z]} />
		<Truss from={[ARCH_X, STAGE_Y, ARCH_Z]} to={[ARCH_X, ARCH_TOP, ARCH_Z]} />
		<Truss from={[-ARCH_X - 0.2, ARCH_TOP, ARCH_Z]} to={[ARCH_X + 0.2, ARCH_TOP, ARCH_Z]} />
		{/* The Phoenix's perch: a little round platform on the arch. */}
		<Cyl r={0.55} r2={0.45} h={0.16} p={[0, ARCH_TOP + 0.3, ARCH_Z]} c={BERRY} />
		{/* The LED wall's frame. */}
		<B s={[7.6, 4.0, 0.25]} p={[0, STAGE_Y + 2.4, -7.75]} c={BLACK} />
	</>
);

const PLANTS = (
	<>
		<Plant p={[-8.6, 0, -7.4]} big />
		<Plant p={[8.6, 0, -7.4]} big />
		<Plant p={[-8.7, 0, 5.4]} />
		<Plant p={[8.7, 0, 5.6]} />
		<Plant p={[-5.6, 0, -4.4]} />
		<Plant p={[5.6, 0, -4.4]} />
	</>
);

// ── What moves ──

/** The LED wall behind the DJ: rings pulsing out from a sun on each beat, warmer as the party heats up. */
function LedWall() {
	const beat = useBeat();
	const mat = useMemo(
		() =>
			new ShaderMaterial({
				uniforms: { uBeat: { value: 0 }, uPulse: { value: 0 }, uEnergy: { value: 0 }, uRise: { value: 0 } },
				vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uBeat, uPulse, uEnergy, uRise;
					varying vec2 vUv;
					void main() {
						vec2 p = (vUv - vec2(0.5, 0.42)) * vec2(1.9, 1.0);
						float r = length(p);
						// LED pixels.
						vec2 cell = fract(vUv * vec2(76.0, 40.0)) - 0.5;
						float dot = smoothstep(0.5, 0.3, length(cell));
						vec3 deep = vec3(0.16, 0.06, 0.28);
						vec3 hot = mix(vec3(0.95, 0.25, 0.55), vec3(1.0, 0.55, 0.2), uEnergy);
						float rings = 0.5 + 0.5 * sin((r * 9.0 - uBeat * 3.14159) );
						rings *= smoothstep(1.2, 0.1, r);
						float sun = smoothstep(0.22 + uPulse * 0.04, 0.18, r);
						// Bars rising from the foot, like a level meter.
						float bar = step(vUv.y, 0.12 + 0.35 * uEnergy * (0.5 + 0.5 * sin(floor(vUv.x * 24.0) * 2.3 + uBeat * 3.14159)));
						vec3 c = deep + hot * rings * (0.35 + 0.65 * uEnergy) + vec3(1.0, 0.8, 0.45) * sun * (0.6 + uPulse * 0.4);
						c += vec3(1.0, 0.45, 0.65) * bar * 0.7;
						c += vec3(1.0, 0.6, 0.25) * uRise * 0.35 * (0.5 + 0.5 * sin(uBeat * 6.283 + r * 12.0));
						gl_FragColor = vec4(c * (0.55 + 0.45 * dot), 1.0);
					}`,
			}),
		[],
	);
	useFrame(() => {
		const b = beat.current;
		const u = mat.uniforms;
		u.uBeat!.value = b.beat;
		u.uPulse!.value = b.pulse;
		u.uEnergy!.value = b.energy;
		u.uRise!.value += ((b.rise ? 1 : 0) - u.uRise!.value) * Math.min(1, b.dt * 3);
	});
	return (
		<mesh material={mat} position={[0, STAGE_Y + 2.4, -7.6]}>
			<planeGeometry args={[7.2, 3.6]} />
		</mesh>
	);
}

/** Platters spinning (faster with the party), speaker cones thumping, the booth's front lit with level bars. */
function BoothParts() {
	const beat = useBeat();
	const platters = [useRef<Group>(null), useRef<Group>(null)];
	const cones = useRef<(Mesh | null)[]>([]);
	const bars = useRef<InstancedMesh>(null);
	const o = useMemo(() => new Object3D(), []);
	const c = useMemo(() => new Color(), []);
	const BARS = 14;
	useFrame(() => {
		const b = beat.current;
		for (const p of platters) if (p.current) p.current.rotation.y -= b.dt * (b.playing ? 3.5 : 0.6);
		for (const m of cones.current) if (m) m.scale.setScalar(1 + b.pulse * 0.12 * (0.4 + b.energy));
		const m = bars.current;
		if (!m) return;
		for (let i = 0; i < BARS; i++) {
			const level = b.playing
				? 0.2 + 0.8 * Math.abs(Math.sin(i * 1.7 + b.beat * Math.PI * 0.5)) * (0.35 + 0.65 * b.energy) * (0.6 + 0.4 * b.pulse)
				: 0.15 + 0.1 * Math.sin(b.t * 2 + i);
			o.position.set(-1.45 + (i * 2.9) / (BARS - 1), STAGE_Y + 0.08 + level * 0.26, BOOTH[2] + 0.51);
			o.scale.set(1, level, 1);
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
			m.setColorAt(i, c.setHSL(0.92 - i * 0.012 + b.energy * 0.05, 0.85, 0.55 + b.pulse * 0.15));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	});
	const barGeo = useMemo(() => new BoxGeometry(0.16, 0.52, 0.02), []);
	return (
		<>
			{[-0.95, 0.95].map((x, i) => (
				<group key={x} ref={platters[i]} position={[x, STAGE_Y + 0.97, BOOTH[2]]}>
					<mesh>
						<cylinderGeometry args={[0.34, 0.34, 0.03, 32]} />
						<meshToonMaterial color="#1d1a24" gradientMap={toonGradient()} />
					</mesh>
					<mesh position={[0, 0.02, 0]}>
						<cylinderGeometry args={[0.12, 0.12, 0.012, 20]} />
						<meshToonMaterial color={i ? "#ff6b9a" : "#ffb84d"} gradientMap={toonGradient()} />
					</mesh>
					<mesh position={[0.22, 0.02, 0]}>
						<boxGeometry args={[0.12, 0.012, 0.03]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
				</group>
			))}
			<instancedMesh ref={bars} args={[barGeo, undefined, BARS]} frustumCulled={false}>
				<meshBasicMaterial />
			</instancedMesh>
			{[-1, 1].map((s) =>
				[0.75, 1.95].map((y, j) => (
					<mesh
						key={`${s}${y}`}
						ref={(m) => {
							cones.current[(s + 1) * 1 + j] = m;
						}}
						position={[s * 3.5, STAGE_Y + y, -5.08]}
						rotation={[Math.PI / 2, 0, 0]}
					>
						<cylinderGeometry args={[j ? 0.3 : 0.42, j ? 0.22 : 0.32, 0.06, 24]} />
						<meshToonMaterial color="#4a4258" gradientMap={toonGradient()} />
					</mesh>
				)),
			)}
		</>
	);
}

/** Strands of warm bulbs strung across overhead, sagging between the poles, twinkling on the beat. */
function StringLights() {
	const beat = useBeat();
	const ref = useRef<InstancedMesh>(null);
	const { spots, wires } = useMemo(() => {
		const out: [number, number, number][] = [];
		const wire: number[] = [];
		const strands: [[number, number], [number, number]][] = [
			[
				[-9.3, -7.8],
				[9.3, 6.6],
			],
			[
				[9.3, -7.8],
				[-9.3, 6.6],
			],
			[
				[-9.3, -7.8],
				[-9.3, 6.6],
			],
			[
				[9.3, -7.8],
				[9.3, 6.6],
			],
		];
		for (const [a, b] of strands) {
			const n = 22;
			const at = (k: number): [number, number, number] => [
				a[0] + (b[0] - a[0]) * k,
				4.55 - Math.sin(k * Math.PI) * 1.1,
				a[1] + (b[1] - a[1]) * k,
			];
			for (let i = 1; i < n; i++) out.push(at(i / n));
			// The wire the bulbs hang from, a segment per bulb.
			for (let i = 0; i < n * 2; i++) wire.push(...at(i / (n * 2)), ...at((i + 1) / (n * 2)));
		}
		const geo = new BufferGeometry();
		geo.setAttribute("position", new Float32BufferAttribute(wire, 3));
		const wires = new LineSegments(geo, new LineBasicMaterial({ color: "#3b3048" }));
		wires.frustumCulled = false;
		return { spots: out, wires };
	}, []);
	const o = useMemo(() => new Object3D(), []);
	const c = useMemo(() => new Color(), []);
	const tones = useMemo(() => ["#ffd59a", "#ff9ec4", "#c7a6ff", "#9df0e3"].map((x) => new Color(x)), []);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		spots.forEach((p, i) => {
			o.position.set(...p);
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
		});
		m.instanceMatrix.needsUpdate = true;
	}, [spots, o]);
	useFrame(() => {
		const b = beat.current;
		const m = ref.current;
		if (!m) return;
		const bar = Math.floor(b.beat / 4);
		for (let i = 0; i < spots.length; i++) {
			const lit = 0.7 + 0.3 * Math.sin(b.t * 2 + i * 0.7) + (b.playing && (i + Math.floor(b.beat)) % 4 === 0 ? b.pulse * 0.6 : 0);
			c.copy(tones[(i + bar) % tones.length]!).multiplyScalar(lit);
			m.setColorAt(i, c);
		}
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	});
	return (
		<>
			<primitive object={wires} />
			<instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
				<sphereGeometry args={[0.1, 8, 6]} />
				<meshBasicMaterial />
			</instancedMesh>
		</>
	);
}

/** The booth's front: a panel lit from within, with the party's flame mark. */
function BoothFront() {
	const map = useMemo(
		() =>
			canvasTexture(
				256,
				80,
				(ctx) => {
					const g = ctx.createLinearGradient(0, 0, 256, 0);
					g.addColorStop(0, "#5b1d6e");
					g.addColorStop(0.5, "#b8326f");
					g.addColorStop(1, "#5b1d6e");
					ctx.fillStyle = g;
					ctx.fillRect(0, 0, 256, 80);
					// A flame drawn with curves: the party's mark.
					ctx.save();
					ctx.translate(128, 40);
					ctx.fillStyle = "#ffcf7a";
					ctx.beginPath();
					ctx.moveTo(0, -30);
					ctx.bezierCurveTo(14, -12, 22, 0, 16, 16);
					ctx.bezierCurveTo(12, 28, -12, 28, -16, 16);
					ctx.bezierCurveTo(-20, 4, -10, -6, -6, -14);
					ctx.bezierCurveTo(-2, -4, 2, 0, 4, 4);
					ctx.bezierCurveTo(6, -6, 2, -18, 0, -30);
					ctx.fill();
					ctx.restore();
				},
				[1, 1],
			),
		[],
	);
	return (
		<mesh position={[BOOTH[0], STAGE_Y + 0.5, BOOTH[2] + 0.505]}>
			<planeGeometry args={[1.2, 0.36]} />
			<meshBasicMaterial map={map} />
		</mesh>
	);
}

/** A soft glow on the floor round the speakers' feet and the stage edge (additive, so it reads as light). */
function StageGlow() {
	const beat = useBeat();
	const mat = useMemo(
		() =>
			new MeshBasicMaterial({
				color: "#ff5fa2",
				transparent: true,
				opacity: 0.25,
				blending: AdditiveBlending,
				depthWrite: false,
				side: DoubleSide,
			}),
		[],
	);
	useFrame(() => {
		const b = beat.current;
		mat.opacity = 0.12 + b.energy * 0.2 + b.pulse * 0.12;
		mat.color.setHSL(b.rise ? 0.07 : 0.92, 0.9, 0.6);
	});
	return (
		<mesh material={mat} position={[0, STAGE_Y * 0.5, STAGE_FRONT + 0.06]}>
			<planeGeometry args={[9.4, STAGE_Y]} />
		</mesh>
	);
}

export function RooftopSet() {
	return (
		<>
			<Sky />
			<City />
			<Deck />
			<Static>{SCENERY}</Static>
			<Static>{PLANTS}</Static>
			<LedWall />
			<BoothFront />
			<BoothParts />
			<StringLights />
			<StageGlow />
		</>
	);
}
