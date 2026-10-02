import type { Look } from "@jade/core/roxy";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { CanvasTexture, DoubleSide, type Group, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { PET_VIEW } from "../RoxyFigure.tsx";
import { figureTexture } from "./texture.ts";

/**
 * What every place in Roxy's world shares: a fixed, slightly-raised corner camera (picture-book, not a flight
 * simulator), soft light, and Roxy and her pet as the studio's 2D art on upright cards that turn to face the camera.
 * An area is measured in grid squares, from (0, 0) at the back-left corner.
 */

export type Area = { w: number; d: number };
export type Spot = { x: number; z: number };

const CAMERA_OFFSET = new Vector3(8, 9, 10.5);
/** Roxy is chunky and nearly three squares tall, like a toy in a dolls' house. */
const FIGURE_H = 2.9;
const UNITS_PER_PX = FIGURE_H / 640;
/** Pets are drawn bigger than life next to Roxy, as toys are, so they read at a glance. */
const PET_SCALE = 1.6;

const centre = (area: Area) => new Vector3(area.w / 2, 0.6, area.d / 2);

/** The canvas for one place: camera, light and whatever the place puts in it. */
export function WorldCanvas({ area, label, children }: { area: Area; label: string; children: ReactNode }) {
	return (
		<Canvas
			orthographic
			flat
			dpr={[1, 2]}
			camera={{ position: centre(area).add(CAMERA_OFFSET).toArray(), near: 0.1, far: 200, zoom: 50 }}
			gl={{ alpha: true, antialias: true }}
			aria-label={label}
			role="img"
		>
			<CameraRig area={area} />
			<hemisphereLight args={["#fffaf0", "#d8cbb8", 2.1]} />
			<directionalLight position={[12, 16, 10]} intensity={1.2} />
			{children}
		</Canvas>
	);
}

/** Keeps the camera on the area and zooms so all of it fits whatever the screen shape. */
function CameraRig({ area }: { area: Area }) {
	const { camera, size } = useThree();
	useEffect(() => {
		const c = centre(area);
		camera.position.copy(c.clone().add(CAMERA_OFFSET));
		camera.lookAt(c);
		// Sized from the 10×8 room; bigger places zoom out to match.
		const scale = Math.max(area.w / 10, area.d / 8);
		camera.zoom = Math.min(size.width / (13.6 * scale), size.height / (10.4 * scale));
		camera.updateProjectionMatrix();
	}, [camera, size, area]);
	return null;
}

/** A canvas texture drawn in code, repeated across a surface. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number]) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (ctx) draw(ctx);
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	t.wrapS = RepeatWrapping;
	t.wrapT = RepeatWrapping;
	t.repeat.set(...repeat);
	return t;
}

/** A hex colour mixed toward white, as a CSS colour. */
export const tint = (hexColour: string, amount: number) => {
	const n = Number.parseInt(hexColour.slice(1), 16);
	const mix = (c: number) => Math.round(c + (255 - c) * amount);
	return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
};

// ── Roxy and the pet ──

const yaw = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
const pitch = Math.atan2(CAMERA_OFFSET.y, Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z));
/** Upright cards look shorter from above; stretch them back so Roxy keeps her proportions on screen. */
const UPRIGHT = 1 / Math.cos(pitch);
/** The camera's right, along the floor: which way "left" and "right" are on screen. */
export const RIGHT = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

/** A card standing on the floor, its bottom edge at the feet, turned to face the camera. */
export function Card({ map, w, h, feet }: { map: CanvasTexture; w: number; h: number; feet: number }) {
	return (
		<mesh position={[0, (h / 2 - feet) * UPRIGHT, 0]} scale={[1, UPRIGHT, 1]} rotation={[0, yaw, 0]}>
			<planeGeometry args={[w, h]} />
			<meshBasicMaterial map={map} transparent alphaTest={0.02} side={DoubleSide} />
		</mesh>
	);
}

export function Shadow({ r }: { r: number }) {
	return (
		<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
			<circleGeometry args={[r, 24]} />
			<meshBasicMaterial color="#2b1d14" transparent opacity={0.18} />
		</mesh>
	);
}

/**
 * Roxy walks to `walkTo` (kept inside the area), her pet trotting after. `onArrive` fires once each time she gets
 * where she was going, so a place can hand her what she walked over to pick up.
 */
export function Walkers({
	look,
	walkTo,
	area,
	start,
	onArrive,
}: {
	look: Look;
	walkTo: Spot | null;
	area: Area;
	start?: Spot;
	onArrive?: (spot: Spot) => void;
}) {
	const key = JSON.stringify(look);
	// Keyed on `key` (the look as text): the look itself is a new object every render.
	const figure = useMemo(() => figureTexture(look, { x: 0, y: 0, w: 400, h: 640 }, { omit: ["background", "pet", "petwear"] }), [key]);
	const pet = useMemo(() => (look.slots.pet ? figureTexture(look, PET_VIEW, { only: ["pet", "petwear"] }) : null), [key]);
	useEffect(() => () => figure.texture.dispose(), [figure]);
	useEffect(() => () => pet?.texture.dispose(), [pet]);

	const roxy = useRef<Group>(null);
	const roxyCard = useRef<Group>(null);
	const petRef = useRef<Group>(null);
	const petCard = useRef<Group>(null);
	const first = start ?? { x: area.w / 2 + 0.5, z: area.d / 2 + 1.5 };
	const target = useRef(new Vector3(first.x, 0, first.z));
	const arriving = useRef<Spot | null>(null);
	const arrive = useRef(onArrive);
	arrive.current = onArrive;
	const reduced = useMemo(() => prefersReducedMotion(), []);

	useEffect(() => {
		if (!walkTo) return;
		target.current.set(Math.min(area.w - 0.4, Math.max(0.4, walkTo.x)), 0, Math.min(area.d - 0.3, Math.max(0.5, walkTo.z)));
		arriving.current = walkTo;
		if (reduced && roxy.current) roxy.current.position.copy(target.current);
	}, [walkTo, reduced, area]);

	useFrame((state, dt) => {
		const r = roxy.current;
		const p = petRef.current;
		if (!r || !p) return;
		const step = Math.min(dt, 0.05);
		const t = state.clock.elapsedTime;
		const toTarget = target.current.clone().sub(r.position);
		const dist = toTarget.length();
		const walking = dist > 0.05 && !reduced;
		if (walking) {
			r.position.add(toTarget.normalize().multiplyScalar(Math.min(dist, 2.6 * step)));
			// Face the way she's walking, as seen on screen.
			if (roxyCard.current) roxyCard.current.scale.x = toTarget.dot(RIGHT) < 0 ? -1 : 1;
		} else {
			if (reduced) r.position.copy(target.current);
			if (arriving.current) {
				const spot = arriving.current;
				arriving.current = null;
				arrive.current?.(spot);
			}
		}
		if (roxyCard.current) {
			roxyCard.current.position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.08 : 0;
			// A slow breath while standing.
			roxyCard.current.scale.y = reduced ? 1 : 1 + Math.sin(t * 2) * 0.012;
		}
		// The pet trots to a spot beside Roxy, a little behind.
		const spot = r.position
			.clone()
			.add(RIGHT.clone().multiplyScalar(1.05))
			.add(new Vector3(0, 0, -0.25));
		const toSpot = spot.sub(p.position);
		const petDist = toSpot.length();
		const petMoving = petDist > 0.08 && !reduced;
		if (petMoving) p.position.add(toSpot.normalize().multiplyScalar(Math.min(petDist, 2.3 * step)));
		else if (reduced) p.position.copy(r.position.clone().add(RIGHT.clone().multiplyScalar(1.05)));
		if (petCard.current) {
			petCard.current.position.y = petMoving ? Math.abs(Math.sin(t * 14)) * 0.07 : 0;
			if (petMoving) petCard.current.scale.x = toSpot.dot(RIGHT) < 0 ? -1 : 1;
		}
	});

	return (
		<>
			<group ref={roxy} position={target.current.toArray()}>
				<Shadow r={0.42} />
				<group ref={roxyCard}>
					<Card map={figure.texture} w={400 * UNITS_PER_PX} h={FIGURE_H} feet={(26 / 640) * FIGURE_H} />
				</group>
			</group>
			<group ref={petRef} position={target.current.clone().add(RIGHT.clone().multiplyScalar(1.05)).toArray()}>
				{pet && (
					<>
						<Shadow r={0.3} />
						<group ref={petCard}>
							<Card
								map={pet.texture}
								w={PET_VIEW.w * UNITS_PER_PX * PET_SCALE}
								h={PET_VIEW.h * UNITS_PER_PX * PET_SCALE}
								feet={6 * UNITS_PER_PX * PET_SCALE}
							/>
						</group>
					</>
				)}
			</group>
		</>
	);
}
