import { FURNITURE_BY_ID, footprint, type Home, hex, type Look, type Placed, ROOM } from "@jade/core/roxy";
import type { ThreeEvent } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo } from "react";
import type { DriveInput } from "./drive.ts";
import { FurnitureMesh, Toon } from "./Furniture.tsx";
import type { Block } from "./path.ts";
import { canvasTexture, type Spot, tint, Walkers, WorldCanvas } from "./stage.tsx";

/** Roxy's home: one room on a grid (see `HomeSchema`), with Roxy and her pet walking about in it. */

const WALL_H = 3;

export type { Spot };

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
	/** Walks Roxy directly (keys or the touch stick), while playing. */
	drive?: RefObject<DriveInput>;
	label: string;
};

export function HomeScene(props: Props) {
	const blocks = useMemo(() => furnitureBlocks(props.home), [props.home]);
	return (
		<WorldCanvas area={ROOM} label={props.label}>
			<Room home={props.home} onFloor={props.onFloor} onWall={props.onWall} />
			{props.home.items.map((p) => (
				<PlacedThing key={p.uid} placed={p} selected={p.uid === props.selected} onPick={props.onFurniture} />
			))}
			<Walkers look={props.look} walkTo={props.walkTo} area={ROOM} blocks={blocks} drive={props.drive} />
		</WorldCanvas>
	);
}

/** Floor furniture is in Roxy's way; rugs and wall things aren't. */
function furnitureBlocks(home: Home): Block[] {
	return home.items.flatMap((p) => {
		const item = FURNITURE_BY_ID.get(p.item);
		if (item?.kind !== "floor") return [];
		const f = footprint(p, item);
		return [{ x0: f.x0, z0: f.z0, x1: f.x0 + f.w, z1: f.z0 + f.d }];
	});
}

// ── The room ──

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
