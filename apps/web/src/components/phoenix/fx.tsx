import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from "three";

/**
 * Every spark in the party in one draw: firework bursts in the sky, embers trailing the Phoenix, confetti puffs from
 * the stage's cannons. A fixed pool of soft additive points, each with its own colour, size, life and pull of gravity,
 * stepped on the CPU (a few hundred at most). Reduced motion keeps them few and short.
 */

const POOL = 900;

export type Fx = {
	/** A round burst at `p`: `n` sparks flying out at about `speed`. */
	burst: (
		p: [number, number, number],
		colours: string[],
		n: number,
		speed: number,
		opts?: { gravity?: number; life?: number; size?: number },
	) => void;
	/** One ember dropped at `p` (call every frame along a path). */
	ember: (p: [number, number, number], colour: string) => void;
	/** A spray from `p` up and toward `dir`. */
	spray: (p: [number, number, number], dir: [number, number, number], colours: string[], n: number) => void;
};

const VERT = /* glsl */ `
attribute vec3 tint;
attribute float size;
attribute float alpha;
varying vec3 vTint;
varying float vAlpha;
void main() {
	vTint = tint;
	vAlpha = alpha;
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = size * (300.0 / -mv.z);
	gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec3 vTint;
varying float vAlpha;
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float d = length(c);
	if (d > 0.5) discard;
	float core = smoothstep(0.5, 0.0, d);
	gl_FragColor = vec4(vTint * (0.6 + core), core * core * vAlpha);
}`;

export const Sparks = forwardRef<Fx, { reduced: boolean }>(function Sparks({ reduced }, ref) {
	const s = useMemo(() => {
		const pos = new Float32Array(POOL * 3);
		const vel = new Float32Array(POOL * 3);
		const tint = new Float32Array(POOL * 3);
		const size = new Float32Array(POOL);
		const alpha = new Float32Array(POOL);
		const life = new Float32Array(POOL);
		const age = new Float32Array(POOL).fill(1e9);
		const grav = new Float32Array(POOL);
		const base = new Float32Array(POOL);
		const geo = new BufferGeometry();
		geo.setAttribute("position", new BufferAttribute(pos, 3));
		geo.setAttribute("tint", new BufferAttribute(tint, 3));
		geo.setAttribute("size", new BufferAttribute(size, 1));
		geo.setAttribute("alpha", new BufferAttribute(alpha, 1));
		const mat = new ShaderMaterial({
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
			blending: AdditiveBlending,
		});
		const points = new Points(geo, mat);
		points.frustumCulled = false;
		return { pos, vel, tint, size, alpha, life, age, grav, base, geo, points, next: 0, c: new Color() };
	}, []);

	const spawn = (p: readonly number[], v: readonly number[], colour: string, lifeS: number, sz: number, g: number) => {
		const i = s.next;
		s.next = (s.next + 1) % POOL;
		s.pos.set(p, i * 3);
		s.vel.set(v, i * 3);
		s.c.set(colour);
		s.tint[i * 3] = s.c.r;
		s.tint[i * 3 + 1] = s.c.g;
		s.tint[i * 3 + 2] = s.c.b;
		s.life[i] = lifeS;
		s.age[i] = 0;
		s.base[i] = sz;
		s.grav[i] = g;
	};

	useImperativeHandle(
		ref,
		(): Fx => ({
			burst(p, colours, n, speed, opts = {}) {
				const count = reduced ? Math.ceil(n / 4) : n;
				for (let k = 0; k < count; k++) {
					// Even-ish over a sphere, with a little jitter in speed so it's a shell, not a ball.
					const u = Math.random() * 2 - 1;
					const a = Math.random() * Math.PI * 2;
					const r = Math.sqrt(1 - u * u);
					const sp = speed * (0.75 + Math.random() * 0.35);
					spawn(
						p,
						[Math.cos(a) * r * sp, u * sp, Math.sin(a) * r * sp],
						colours[k % colours.length]!,
						(opts.life ?? 1.4) * (0.8 + Math.random() * 0.4),
						opts.size ?? 0.35,
						opts.gravity ?? 2.2,
					);
				}
			},
			ember(p, colour) {
				if (reduced) return;
				spawn(
					[p[0] + (Math.random() - 0.5) * 0.3, p[1] + (Math.random() - 0.5) * 0.3, p[2] + (Math.random() - 0.5) * 0.3],
					[(Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6],
					colour,
					0.7 + Math.random() * 0.5,
					0.3 + Math.random() * 0.25,
					-0.6,
				);
			},
			spray(p, dir, colours, n) {
				const count = reduced ? Math.ceil(n / 4) : n;
				for (let k = 0; k < count; k++) {
					const j = () => (Math.random() - 0.5) * 2.2;
					spawn(p, [dir[0] + j(), dir[1] + j() * 0.6, dir[2] + j()], colours[k % colours.length]!, 1.6 + Math.random() * 0.8, 0.22, 4);
				}
			},
		}),
		[reduced],
	);

	useFrame((_, dt) => {
		const step = Math.min(dt, 0.05);
		let live = 0;
		for (let i = 0; i < POOL; i++) {
			if (s.age[i]! >= s.life[i]!) {
				if (s.alpha[i] !== 0) s.alpha[i] = 0;
				continue;
			}
			live++;
			s.age[i]! += step;
			const k = s.age[i]! / s.life[i]!;
			const j = i * 3;
			s.vel[j + 1]! -= s.grav[i]! * step;
			// A little air drag, so bursts bloom then hang.
			const drag = 1 - step * 1.2;
			s.vel[j]! *= drag;
			s.vel[j + 1]! *= drag;
			s.vel[j + 2]! *= drag;
			s.pos[j]! += s.vel[j]! * step;
			s.pos[j + 1]! += s.vel[j + 1]! * step;
			s.pos[j + 2]! += s.vel[j + 2]! * step;
			s.alpha[i] = k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9;
			s.size[i] = s.base[i]! * (1 - k * 0.5);
		}
		if (live || s.points.visible) {
			s.points.visible = live > 0;
			for (const name of ["position", "tint", "size", "alpha"]) s.geo.getAttribute(name).needsUpdate = true;
		}
	});

	useEffect(
		() => () => {
			s.geo.dispose();
			(s.points.material as ShaderMaterial).dispose();
		},
		[s],
	);

	return <primitive object={s.points} />;
});
