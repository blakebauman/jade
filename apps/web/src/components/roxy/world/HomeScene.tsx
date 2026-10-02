import { FURNITURE_BY_ID, footprint, type Home, hex, type Look, type Placed, ROOM } from "@jade/core/roxy";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, DoubleSide, type Group, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { PET_VIEW } from "../RoxyFigure.tsx";
import { FurnitureMesh, Toon } from "./Furniture.tsx";
import { figureTexture } from "./texture.ts";

/**
 * Roxy's home in three.js: one room seen from the front-right corner with a fixed, slightly-above camera (picture-book,
 * not a flight simulator). Roxy and her pet are the studio's 2D art standing in the room on upright cards that turn to
 * face the camera, so every outfit carries over.
 */

const WALL_H = 3;
const CENTRE = new Vector3(ROOM.w / 2, 0.6, ROOM.d / 2);
const CAMERA_OFFSET = new Vector3(8, 9, 10.5);
/** Roxy is chunky and nearly three squares tall, like a toy in a dolls' house. */
const FIGURE_H = 2.9;
const UNITS_PER_PX = FIGURE_H / 640;
/** Pets are drawn bigger than life next to Roxy, as toys are, so they read at a glance. */
const PET_SCALE = 1.6;

export type Spot = { x: number; z: number };

type Props = {
	home: Home;
	look: Look;
	/** The furniture picked for moving or turning, outlined in the room. */
	selected?: string | null;
	onFloor: (spot: Spot) => void;
	onWall: (wall: "back" | "left", at: number) => void;
	onFurniture: (uid: string) => void;
	/** Where Roxy should walk to. */
	walkTo: Spot | null;
	label: string;
};

export function HomeScene(props: Props) {
	return (
		<Canvas
			orthographic
			flat
			dpr={[1, 2]}
			camera={{ position: CENTRE.clone().add(CAMERA_OFFSET).toArray(), near: 0.1, far: 100, zoom: 50 }}
			gl={{ alpha: true, antialias: true }}
			aria-label={props.label}
			role="img"
		>
			<CameraRig />
			<hemisphereLight args={["#fffaf0", "#d8cbb8", 2.1]} />
			<directionalLight position={[12, 16, 10]} intensity={1.2} />
			<Room home={props.home} onFloor={props.onFloor} onWall={props.onWall} />
			{props.home.items.map((p) => (
				<PlacedThing key={p.uid} placed={p} selected={p.uid === props.selected} onPick={props.onFurniture} />
			))}
			<Walkers look={props.look} walkTo={props.walkTo} />
		</Canvas>
	);
}

/** Keeps the camera on the room and zooms so the whole room fits whatever the screen shape. */
function CameraRig() {
	const { camera, size } = useThree();
	useEffect(() => {
		camera.position.copy(CENTRE.clone().add(CAMERA_OFFSET));
		camera.lookAt(CENTRE);
		camera.zoom = Math.min(size.width / 13.6, size.height / 10.4);
		camera.updateProjectionMatrix();
	}, [camera, size]);
	return null;
}

// ── The room ──

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number]) {
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

const tint = (hexColour: string, amount: number) => {
	const n = Number.parseInt(hexColour.slice(1), 16);
	const mix = (c: number) => Math.round(c + (255 - c) * amount);
	return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
};

function wallpaper(pattern: Home["wall"]["pattern"], c1: string) {
	const base = tint(c1, 0.55);
	const ink = tint(c1, 0.15);
	return canvasTexture(
		128,
		128,
		(ctx) => {
			ctx.fillStyle = base;
			ctx.fillRect(0, 0, 128, 128);
			ctx.fillStyle = ink;
			if (pattern === "stripes") for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 14, 128);
			if (pattern === "dots")
				for (const [x, y] of [
					[32, 32],
					[96, 96],
				] as const) {
					ctx.beginPath();
					ctx.arc(x, y, 9, 0, Math.PI * 2);
					ctx.fill();
				}
			if (pattern === "stars" || pattern === "hearts") {
				ctx.font = "44px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				// Plain shapes, drawn as paths so no emoji or font is needed.
				const shape = (x: number, y: number, r: number) => {
					ctx.beginPath();
					if (pattern === "stars") {
						for (let i = 0; i < 10; i++) {
							const a = (Math.PI / 5) * i - Math.PI / 2;
							const rr = i % 2 === 0 ? r : r * 0.45;
							ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
						}
					} else {
						ctx.moveTo(x, y + r * 0.9);
						ctx.bezierCurveTo(x - r * 1.4, y, x - r * 0.9, y - r * 1.1, x, y - r * 0.35);
						ctx.bezierCurveTo(x + r * 0.9, y - r * 1.1, x + r * 1.4, y, x, y + r * 0.9);
					}
					ctx.closePath();
					ctx.fill();
				};
				shape(32, 32, 14);
				shape(96, 96, 14);
			}
		},
		[ROOM.w / 1.5, WALL_H / 1.5],
	);
}

function flooring(style: Home["floor"]["style"], c1?: string) {
	return canvasTexture(
		256,
		256,
		(ctx) => {
			if (style === "checker") {
				for (let y = 0; y < 2; y++)
					for (let x = 0; x < 2; x++) {
						ctx.fillStyle = (x + y) % 2 ? "#f6f1e7" : "#9ccfc0";
						ctx.fillRect(x * 128, y * 128, 128, 128);
					}
				return;
			}
			if (style === "carpet") {
				ctx.fillStyle = tint(c1 ?? "#8a5bd1", 0.35);
				ctx.fillRect(0, 0, 256, 256);
				ctx.fillStyle = "rgba(255,255,255,0.12)";
				for (let i = 0; i < 300; i++) ctx.fillRect((i * 73) % 256, (i * 151) % 256, 2, 2);
				return;
			}
			const [a, b] = style === "darkwood" ? ["#9c6b3f", "#8a5c33"] : ["#e2b27a", "#d6a46c"];
			for (let row = 0; row < 4; row++) {
				ctx.fillStyle = row % 2 ? a : b;
				ctx.fillRect(0, row * 64, 256, 64);
				ctx.fillStyle = "rgba(60,30,10,0.25)";
				ctx.fillRect(0, row * 64, 256, 2);
				ctx.fillRect(((row * 97) % 200) + 30, row * 64, 2, 64);
			}
		},
		[ROOM.w / 2, ROOM.d / 2],
	);
}

function Room({ home, onFloor, onWall }: { home: Home; onFloor: Props["onFloor"]; onWall: Props["onWall"] }) {
	const wallColour = hex("fabric", home.wall.c1);
	const wallTexture = useMemo(() => wallpaper(home.wall.pattern, wallColour), [home.wall.pattern, wallColour]);
	const floorTexture = useMemo(
		() => flooring(home.floor.style, home.floor.c1 && hex("fabric", home.floor.c1)),
		[home.floor.style, home.floor.c1],
	);
	useEffect(() => () => wallTexture.dispose(), [wallTexture]);
	useEffect(() => () => floorTexture.dispose(), [floorTexture]);

	const floorClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		onFloor({ x: e.point.x, z: e.point.z });
	};
	return (
		<group>
			{/* Floor: a slab, so the room reads as a toy box rather than a flat sheet. */}
			<mesh position={[ROOM.w / 2, -0.15, ROOM.d / 2]} onClick={floorClick}>
				<boxGeometry args={[ROOM.w, 0.3, ROOM.d]} />
				<meshToonMaterial map={floorTexture} />
			</mesh>
			<mesh
				position={[ROOM.w / 2, WALL_H / 2, -0.1]}
				onClick={(e) => {
					e.stopPropagation();
					onWall("back", e.point.x);
				}}
			>
				<boxGeometry args={[ROOM.w, WALL_H, 0.2]} />
				<meshToonMaterial map={wallTexture} />
			</mesh>
			<mesh
				position={[-0.1, WALL_H / 2, ROOM.d / 2]}
				rotation={[0, Math.PI / 2, 0]}
				onClick={(e) => {
					e.stopPropagation();
					onWall("left", e.point.z);
				}}
			>
				<boxGeometry args={[ROOM.d, WALL_H, 0.2]} />
				<meshToonMaterial map={wallTexture} color="#e8e2d8" />
			</mesh>
			{/* Skirting boards. */}
			<mesh position={[ROOM.w / 2, 0.08, 0.02]}>
				<boxGeometry args={[ROOM.w, 0.16, 0.06]} />
				<Toon color="#f6f1e7" />
			</mesh>
			<mesh position={[0.02, 0.08, ROOM.d / 2]}>
				<boxGeometry args={[0.06, 0.16, ROOM.d]} />
				<Toon color="#f6f1e7" />
			</mesh>
		</group>
	);
}

function PlacedThing({ placed, selected, onPick }: { placed: Placed; selected: boolean; onPick: (uid: string) => void }) {
	const item = FURNITURE_BY_ID.get(placed.item);
	if (!item) return null;
	const colour = placed.c1 ? hex("fabric", placed.c1) : undefined;
	const pick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		onPick(placed.uid);
	};
	if (item.kind === "wall") {
		const left = placed.wall === "left";
		const at = (left ? placed.z : placed.x) + item.w / 2;
		return (
			<group position={left ? [0.03, 0, at] : [at, 0, 0.03]} rotation={[0, left ? Math.PI / 2 : 0, 0]} onClick={pick}>
				<FurnitureMesh item={item} colour={colour} />
				{selected && <Outline w={item.w} d={0.1} y={1.7} upright />}
			</group>
		);
	}
	const f = footprint(placed, item);
	return (
		<group position={[f.x0 + f.w / 2, 0, f.z0 + f.d / 2]} onClick={pick}>
			<group rotation={[0, (-placed.rot * Math.PI) / 2, 0]}>
				<FurnitureMesh item={item} colour={colour} />
			</group>
			{selected && <Outline w={f.w} d={f.d} y={0.04} />}
		</group>
	);
}

/** A chalk-white frame around the picked furniture. */
function Outline({ w, d, y, upright }: { w: number; d: number; y: number; upright?: boolean }) {
	const t = 0.07;
	const bars: [number, number, number, number][] = upright
		? [
				[0, 0.7, w, t],
				[0, -0.7, w, t],
				[-w / 2, 0, t, 1.4],
				[w / 2, 0, t, 1.4],
			]
		: [
				[0, -d / 2, w, t],
				[0, d / 2, w, t],
				[-w / 2, 0, t, d],
				[w / 2, 0, t, d],
			];
	return (
		<group position={[0, y, upright ? 0.12 : 0]}>
			{bars.map(([x, z, bw, bd]) => (
				<mesh key={`${x}${z}`} position={upright ? [x, z, 0] : [x, 0, z]}>
					<boxGeometry args={upright ? [bw, bd, 0.02] : [bw, 0.02, bd]} />
					<meshBasicMaterial color="#ffffff" />
				</mesh>
			))}
		</group>
	);
}

// ── Roxy and the pet ──

const yaw = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
const pitch = Math.atan2(CAMERA_OFFSET.y, Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z));
/** Upright cards look shorter from above; stretch them back so Roxy keeps her proportions on screen. */
const UPRIGHT = 1 / Math.cos(pitch);
const RIGHT = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

/** A card standing on the floor, its bottom edge at the feet, turned to face the camera. */
function Card({ map, w, h, feet }: { map: CanvasTexture; w: number; h: number; feet: number }) {
	return (
		<mesh position={[0, (h / 2 - feet) * UPRIGHT, 0]} scale={[1, UPRIGHT, 1]} rotation={[0, yaw, 0]}>
			<planeGeometry args={[w, h]} />
			<meshBasicMaterial map={map} transparent alphaTest={0.02} side={DoubleSide} />
		</mesh>
	);
}

function Shadow({ r }: { r: number }) {
	return (
		<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
			<circleGeometry args={[r, 24]} />
			<meshBasicMaterial color="#2b1d14" transparent opacity={0.18} />
		</mesh>
	);
}

function Walkers({ look, walkTo }: { look: Look; walkTo: Spot | null }) {
	const key = JSON.stringify(look);
	const figure = useMemo(() => figureTexture(look, { x: 0, y: 0, w: 400, h: 640 }, { omit: ["background", "pet", "petwear"] }), [key]);
	const pet = useMemo(() => (look.slots.pet ? figureTexture(look, PET_VIEW, { only: ["pet", "petwear"] }) : null), [key]);
	useEffect(() => () => figure.texture.dispose(), [figure]);
	useEffect(() => () => pet?.texture.dispose(), [pet]);

	const roxy = useRef<Group>(null);
	const roxyCard = useRef<Group>(null);
	const petRef = useRef<Group>(null);
	const petCard = useRef<Group>(null);
	const target = useRef(new Vector3(ROOM.w / 2 + 0.5, 0, ROOM.d / 2 + 1.5));
	const reduced = useMemo(() => prefersReducedMotion(), []);

	useEffect(() => {
		if (!walkTo) return;
		target.current.set(Math.min(ROOM.w - 0.4, Math.max(0.4, walkTo.x)), 0, Math.min(ROOM.d - 0.3, Math.max(0.5, walkTo.z)));
		if (reduced && roxy.current) roxy.current.position.copy(target.current);
	}, [walkTo, reduced]);

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
			const facing = toTarget.dot(RIGHT) < 0 ? -1 : 1;
			if (roxyCard.current) roxyCard.current.scale.x = facing;
		} else if (reduced) {
			r.position.copy(target.current);
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
