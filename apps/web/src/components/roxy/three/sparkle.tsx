import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, type Points, PointsMaterial } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { useWake } from "../world/pace.tsx";

/**
 * A ring of twinkles that blooms out from Roxy when something new is tried on, in step with her hop, and fades.
 * One draw call while it shows, none otherwise; nothing at all under reduced motion.
 */

const N = 14;
const LIFE = 0.7;
const COLOURS = ["#ffd166", "#ff8fab", "#8fd3ff", "#ffffff"];

let sprite: CanvasTexture | undefined;
/** A soft four-pointed twinkle, drawn once. */
function twinkle() {
	if (sprite) return sprite;
	const c = document.createElement("canvas");
	c.width = c.height = 64;
	const g = c.getContext("2d")!;
	const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	glow.addColorStop(0, "rgba(255,255,255,1)");
	glow.addColorStop(0.25, "rgba(255,255,255,0.55)");
	glow.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = glow;
	g.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (Math.PI / 4) * i;
		const r = i % 2 ? 7 : 32;
		g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
	}
	g.closePath();
	g.fill();
	sprite = new CanvasTexture(c);
	return sprite;
}

export function Sparkle({ burst }: { burst: MutableRefObject<{ tryOn: number }> }) {
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const points = useRef<Points>(null);
	const wake = useWake();
	// Each twinkle's direction out from her middle, its height and colour; positions are written per frame.
	const { geometry, dirs } = useMemo(() => {
		const dirs = Array.from({ length: N }, (_, i) => {
			const a = (i / N) * Math.PI * 2 + (i % 2) * 0.2;
			return { x: Math.cos(a), z: Math.sin(a), y: 1.1 + ((i * 5) % N) / N, speed: 0.8 + ((i * 3) % 4) * 0.15 };
		});
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(N * 3), 3));
		const colour = new Float32Array(N * 3);
		const c = new Color();
		for (let i = 0; i < N; i++) c.set(COLOURS[i % COLOURS.length]!).toArray(colour, i * 3);
		geometry.setAttribute("color", new Float32BufferAttribute(colour, 3));
		return { geometry, dirs };
	}, []);
	const material = useMemo(
		() =>
			new PointsMaterial({
				size: 0.8,
				map: twinkle(),
				vertexColors: true,
				transparent: true,
				depthWrite: false,
				blending: AdditiveBlending,
			}),
		[],
	);
	useEffect(
		() => () => {
			geometry.dispose();
			material.dispose();
		},
		[geometry, material],
	);

	useFrame(() => {
		const p = points.current;
		if (!p) return;
		const since = burst.current.tryOn < 0 || reduced ? LIFE : (performance.now() - burst.current.tryOn) / 1000;
		p.visible = since < LIFE;
		if (!p.visible) return;
		wake();
		const t = since / LIFE;
		// Out fast, then easing; up a little as they go; fading in the last half.
		const out = 0.45 + (1 - (1 - t) ** 3) * 0.95;
		const pos = geometry.attributes.position!;
		dirs.forEach((d, i) => {
			pos.setXYZ(i, d.x * out * d.speed, d.y + t * 0.35, d.z * out * d.speed * 0.8);
		});
		pos.needsUpdate = true;
		material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
		material.size = 0.8 * (t < 0.15 ? t / 0.15 : 1);
	});

	return (
		<points ref={points} geometry={geometry} material={material} visible={false} frustumCulled={false} userData={{ noShadow: true }} />
	);
}
