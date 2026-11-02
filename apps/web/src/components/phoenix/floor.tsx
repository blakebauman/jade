import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BoxGeometry,
	Color,
	ConeGeometry,
	DoubleSide,
	type InstancedMesh,
	MeshBasicMaterial,
	Object3D,
	ShaderMaterial,
	Vector3,
} from "three";
import { useBeat } from "./live.ts";

/**
 * The dance floor: a grid of lit tiles that change pattern each bar (a checker, rings from the middle, a sweep, the
 * columns in turn) and pulse on every beat, brighter the hotter the party. During a Fire Drop they burn orange and
 * gold. Above it, six beams of light hang from the arch and swing to the music, each with a pool where it lands.
 */

export const COLS = 7;
export const ROWS = 5;
export const TILE = 1.2;
export const FLOOR_Z = 0.7;
const N = COLS * ROWS;

export const tileCentre = (col: number, row: number): [number, number] => [
	(col - (COLS - 1) / 2) * TILE,
	FLOOR_Z + (row - (ROWS - 1) / 2) * TILE,
];

const PARTY = ["#ff3d9a", "#8a5cff", "#22d3c5", "#ff8a3d"].map((c) => new Color(c));
const FIRE = ["#ff7a1a", "#ffb02e", "#ff3d5a", "#ffd166"].map((c) => new Color(c));
const UNLIT = new Color("#2a2238");

function pattern(kind: number, col: number, row: number, beat: number) {
	const cx = col - (COLS - 1) / 2;
	const cy = row - (ROWS - 1) / 2;
	const b = Math.floor(beat);
	switch (kind % 4) {
		case 0:
			return (col + row + b) % 2 === 0;
		case 1:
			return Math.round(Math.hypot(cx, cy)) % 3 === b % 3;
		case 2:
			return (col + b) % 4 === 0 || (row + b) % 4 === 0;
		default:
			return Math.abs(cx) === b % 4 || Math.abs(cy) === b % 3;
	}
}

export function DanceFloor() {
	const beat = useBeat();
	const ref = useRef<InstancedMesh>(null);
	const geo = useMemo(() => new BoxGeometry(TILE - 0.06, 0.08, TILE - 0.06), []);
	const c = useMemo(() => new Color(), []);
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const o = new Object3D();
		for (let row = 0; row < ROWS; row++)
			for (let col = 0; col < COLS; col++) {
				const [x, z] = tileCentre(col, row);
				o.position.set(x, 0.04, z);
				o.updateMatrix();
				m.setMatrixAt(row * COLS + col, o.matrix);
				m.setColorAt(row * COLS + col, UNLIT);
			}
		m.instanceMatrix.needsUpdate = true;
	}, []);
	useFrame(() => {
		const b = beat.current;
		const m = ref.current;
		if (!m) return;
		const bar = Math.floor(b.beat / 4);
		const palette = b.rise ? FIRE : PARTY;
		const level = 0.25 + b.energy * 0.75;
		for (let row = 0; row < ROWS; row++)
			for (let col = 0; col < COLS; col++) {
				const on = pattern(bar, col, row, b.beat);
				const hue = palette[(col + row + bar) % palette.length]!;
				const k = on ? level * (0.55 + 0.45 * b.pulse) : 0.12 + 0.08 * b.energy;
				c.copy(UNLIT).lerp(hue, Math.min(1, k));
				if (on) c.multiplyScalar(0.8 + 0.5 * b.pulse * b.energy);
				m.setColorAt(row * COLS + col, c);
			}
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	});
	return (
		<>
			{/* A dark frame the tiles sit in. */}
			<mesh position={[0, 0.02, FLOOR_Z]}>
				<boxGeometry args={[COLS * TILE + 0.3, 0.05, ROWS * TILE + 0.3]} />
				<meshBasicMaterial color="#1c1726" />
			</mesh>
			<instancedMesh ref={ref} args={[geo, undefined, N]} frustumCulled={false}>
				<meshBasicMaterial />
			</instancedMesh>
		</>
	);
}

const BEAM_TOP = 5.35;
const BEAMS = 6;

/** The beams: soft cones of light, brightest at the lamp and fading to nothing near the floor. */
export function Beams() {
	const beat = useBeat();
	const cones = useRef<InstancedMesh>(null);
	const pools = useRef<InstancedMesh>(null);
	const { coneGeo, coneMat, poolMat } = useMemo(() => {
		const h = BEAM_TOP;
		const coneGeo = new ConeGeometry(1.0, h, 24, 1, true);
		// Hang from the tip: the cone's point at the lamp, its open end on the floor.
		coneGeo.translate(0, -h / 2, 0);
		const coneMat = new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: AdditiveBlending,
			side: DoubleSide,
			vertexShader: /* glsl */ `
				varying float vH;
				varying vec3 vColor;
				void main() {
					vH = clamp(-position.y / ${h.toFixed(2)}, 0.0, 1.0);
					vColor = instanceColor;
					gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				varying float vH;
				varying vec3 vColor;
				void main() {
					float a = pow(1.0 - vH, 1.4) * 0.3 + 0.02;
					gl_FragColor = vec4(vColor, a);
				}`,
		});
		const poolMat = new MeshBasicMaterial({ transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false });
		return { coneGeo, coneMat, poolMat };
	}, []);
	const o = useMemo(() => new Object3D(), []);
	const c = useMemo(() => new Color(), []);
	const down = useMemo(() => new Vector3(), []);
	useFrame(() => {
		const b = beat.current;
		const cm = cones.current;
		const pm = pools.current;
		if (!cm || !pm) return;
		const palette = b.rise ? FIRE : PARTY;
		const swing = b.playing ? 0.25 + b.energy * 0.3 : 0.12;
		const bright = 0.35 + b.energy * 0.65 + b.pulse * 0.25;
		for (let i = 0; i < BEAMS; i++) {
			const x = -3.0 + (i * 6) / (BEAMS - 1);
			const phase = b.beat * (Math.PI / 4) + i * 0.9;
			const rx = 0.95 + Math.sin(phase) * swing * 0.5;
			const rz = Math.cos(phase * 0.75 + i) * swing;
			o.position.set(x, BEAM_TOP, -6.6);
			o.rotation.set(-rx, 0, rz);
			o.scale.set(0.55, 1, 0.55);
			o.updateMatrix();
			cm.setMatrixAt(i, o.matrix);
			c.copy(palette[(i + Math.floor(b.beat / 4)) % palette.length]!).multiplyScalar(bright);
			cm.setColorAt(i, c);
			// Where it lands: follow the cone's axis down to the floor.
			down.set(0, -1, 0).applyEuler(o.rotation);
			const reach = BEAM_TOP / -down.y;
			o.position.set(x + down.x * reach, 0.1, -6.6 + down.z * reach);
			o.rotation.set(-Math.PI / 2, 0, 0);
			const s = 0.9 + b.pulse * 0.2;
			o.scale.set(s, s, s);
			o.updateMatrix();
			pm.setMatrixAt(i, o.matrix);
			pm.setColorAt(i, c.multiplyScalar(0.6));
		}
		cm.instanceMatrix.needsUpdate = true;
		pm.instanceMatrix.needsUpdate = true;
		if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
		if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
	});
	return (
		<>
			<instancedMesh ref={cones} args={[coneGeo, coneMat, BEAMS]} frustumCulled={false} renderOrder={2} />
			<instancedMesh ref={pools} args={[undefined, poolMat, BEAMS]} frustumCulled={false} renderOrder={1}>
				<circleGeometry args={[0.9, 24]} />
			</instancedMesh>
			{/* The lamps themselves, little dark cans under the arch. */}
			{Array.from({ length: BEAMS }, (_, i) => (
				<mesh key={i} position={[-3.0 + (i * 6) / (BEAMS - 1), BEAM_TOP + 0.08, -6.6]}>
					<cylinderGeometry args={[0.13, 0.17, 0.26, 12]} />
					<meshBasicMaterial color="#2a2633" />
				</mesh>
			))}
		</>
	);
}
