import { type Look, PLACE_INFO, type PlaceId } from "@jade/core/roxy";
import type { ThreeEvent } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo } from "react";
import { B, Ball, Cyl, GOLD, LEAF, lighter, POT, Toon, WHITE, WOOD, WOOD_DARK } from "./Furniture.tsx";
import { type Area, canvasTexture, type Spot, Walkers, WorldCanvas } from "./stage.tsx";

/**
 * The places in Roxy's town. Each is built from the same soft toy shapes as the furniture, and hides five finds
 * that are drawn small and tucked under or behind things. Hotspots are things to tap that do something (the
 * school's chalkboard, the pet shop's adoption sign).
 */

type V3 = [number, number, number];
type FindSpot = { at: V3; node: ReactNode };
export type Hotspot = "chalkboard" | "adopt";
type Place = {
	ground: (area: Area) => ReturnType<typeof canvasTexture>;
	walls?: { colour: string };
	props: ReactNode;
	finds: Record<string, FindSpot>;
	hotspots?: { id: Hotspot; at: V3; node: ReactNode }[];
	start: Spot;
};

// ── Small shapes ──

const tree = (x: number, z: number, s = 1) => (
	<group key={`t${x}${z}`} position={[x, 0, z]} scale={s}>
		<Cyl r={0.16} r2={0.22} h={1.4} p={[0, 0.7, 0]} c={WOOD_DARK} seg={10} />
		<Ball r={0.9} p={[0, 1.9, 0]} c={LEAF} />
		<Ball r={0.6} p={[0.5, 2.4, 0.2]} c={lighter(LEAF, 0.15)} />
		<Ball r={0.55} p={[-0.5, 2.3, -0.1]} c="#4f8f3c" />
	</group>
);
const bush = (x: number, z: number) => (
	<group key={`b${x}${z}`} position={[x, 0, z]}>
		<Ball r={0.45} p={[0, 0.35, 0]} c="#4f8f3c" s={[1.3, 0.8, 1]} />
		<Ball r={0.3} p={[0.35, 0.45, 0.1]} c={LEAF} />
	</group>
);
const flowers = (x: number, z: number, c: string) => (
	<group key={`f${x}${z}`} position={[x, 0, z]}>
		{[
			[0, 0],
			[0.25, 0.15],
			[-0.2, 0.2],
		].map(([dx, dz]) => (
			<group key={`${dx}${dz}`}>
				<Cyl r={0.02} h={0.3} p={[dx!, 0.15, dz!]} c={LEAF} seg={6} />
				<Ball r={0.08} p={[dx!, 0.32, dz!]} c={c} />
			</group>
		))}
	</group>
);
const bench = (x: number, z: number, rot = 0) => (
	<group key={`be${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<B s={[1.6, 0.1, 0.5]} p={[0, 0.45, 0]} c={WOOD} />
		<B s={[1.6, 0.4, 0.08]} p={[0, 0.75, -0.22]} c={WOOD} />
		{[-0.65, 0.65].map((dx) => (
			<B key={dx} s={[0.08, 0.45, 0.45]} p={[dx, 0.22, 0]} c="#6b7a93" />
		))}
	</group>
);
const desk = (x: number, z: number) => (
	<group key={`d${x}${z}`} position={[x, 0, z]}>
		<B s={[1.2, 0.07, 0.7]} p={[0, 0.7, 0]} c={WOOD} />
		{[-0.5, 0.5].map((dx) => (
			<B key={dx} s={[0.07, 0.68, 0.6]} p={[dx, 0.34, 0]} c="#6b7a93" />
		))}
		<B s={[0.5, 0.06, 0.5]} p={[0, 0.42, 0.65]} c="#3cb6c9" />
		<B s={[0.5, 0.45, 0.06]} p={[0, 0.65, 0.9]} c="#3cb6c9" />
	</group>
);
const shelf = (x: number, z: number, w: number, items: ReactNode, rot = 0) => (
	<group key={`s${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
		<B s={[w, 1.6, 0.45]} p={[0, 0.8, 0]} c={WOOD} />
		{[0.55, 1.15].map((y) => (
			<B key={y} s={[w - 0.1, 0.05, 0.4]} p={[0, y, 0.03]} c={lighter(WOOD)} />
		))}
		{items}
	</group>
);
const books = (w: number, y: number) =>
	Array.from({ length: Math.floor(w / 0.22) }, (_, i) => (
		<B
			key={`${y}${i}`}
			s={[0.16, 0.36 - (i % 3) * 0.05, 0.3]}
			p={[-w / 2 + 0.2 + i * 0.22, y + 0.2, 0.05]}
			c={["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b", "#8a5bd1"][i % 5]!}
		/>
	));
const cage = (x: number, z: number, critter: ReactNode) => (
	<group key={`c${x}${z}`} position={[x, 0, z]}>
		<B s={[1.1, 0.7, 0.8]} p={[0, 0.85, 0]} c="#bfe3f0" o={0.35} />
		<B s={[1.2, 0.5, 0.9]} p={[0, 0.25, 0]} c={WOOD} />
		{critter}
	</group>
);

// ── The places ──

const grass = (area: Area) =>
	canvasTexture(
		256,
		256,
		(ctx) => {
			ctx.fillStyle = "#9fd27a";
			ctx.fillRect(0, 0, 256, 256);
			ctx.fillStyle = "rgba(60,120,40,0.18)";
			for (let i = 0; i < 220; i++) ctx.fillRect((i * 67) % 256, (i * 139) % 256, 3, 6);
		},
		[area.w / 3, area.d / 3],
	);
const tiles = (a: string, b: string) => (area: Area) =>
	canvasTexture(
		128,
		128,
		(ctx) => {
			for (let y = 0; y < 2; y++)
				for (let x = 0; x < 2; x++) {
					ctx.fillStyle = (x + y) % 2 ? a : b;
					ctx.fillRect(x * 64, y * 64, 64, 64);
				}
		},
		[area.w / 2, area.d / 2],
	);

const PLACES: Record<PlaceId, Place> = {
	park: {
		ground: grass,
		start: { x: 6, z: 7 },
		props: (
			<>
				{/* A path across, and the pond. */}
				<B s={[14, 0.02, 1.4]} p={[7, 0.01, 5.2]} c="#e8d9b0" />
				<Cyl r={2} h={0.05} p={[11, 0.02, 7.6]} c="#5fa3e0" seg={40} />
				<Cyl r={2.2} h={0.04} p={[11, 0.01, 7.6]} c="#c9b28c" seg={40} />
				{tree(2, 2)}
				{tree(6, 1.4, 0.9)}
				{tree(12.5, 1.5, 1.1)}
				{tree(1.4, 8.4, 0.8)}
				{bush(3.6, 2.6)}
				{bush(9, 1.2)}
				{bush(4.5, 8.8)}
				{bench(9, 3.8)}
				{flowers(3.8, 7.6, "#e85d75")}
				{flowers(7.5, 8.6, "#f2c94c")}
				{flowers(13, 4.2, "#8a5bd1")}
				{/* The slide. */}
				<group position={[6.5, 0, 8]}>
					<B s={[0.1, 1.6, 0.1]} p={[-0.4, 0.8, -0.3]} c="#e85d75" />
					<B s={[0.1, 1.6, 0.1]} p={[0.4, 0.8, -0.3]} c="#e85d75" />
					<B s={[0.9, 0.08, 0.6]} p={[0, 1.6, -0.3]} c="#f2c94c" />
					<mesh position={[0, 0.85, 0.55]} rotation={[0.85, 0, 0]}>
						<boxGeometry args={[0.8, 0.06, 2]} />
						<Toon color="#3cb6c9" />
					</mesh>
				</group>
			</>
		),
		finds: {
			"park-acorn": { at: [3.9, 0, 3.05], node: <Ball r={0.13} p={[0, 0.13, 0]} c={GOLD} s={[1, 1.2, 1]} e={0.3} /> },
			"park-shell": { at: [12.9, 0, 8.6], node: <Ball r={0.14} p={[0, 0.07, 0]} c="#f6b6c8" s={[1.2, 0.5, 1]} /> },
			"park-kite": {
				at: [12.2, 2.7, 2],
				node: (
					<mesh rotation={[0, 0.6, Math.PI / 4]}>
						<boxGeometry args={[0.5, 0.5, 0.03]} />
						<Toon color="#e85d75" />
					</mesh>
				),
			},
			"park-ladybug": { at: [7.7, 0.34, 8.75], node: <Ball r={0.08} p={[0, 0, 0]} c="#d8413c" s={[1, 0.6, 1.2]} /> },
			"park-feather": { at: [9.6, 0.5, 3.9], node: <B s={[0.08, 0.03, 0.4]} p={[0, 0, 0]} c="#3d74c9" /> },
		},
	},
	petshop: {
		ground: tiles("#f6f1e7", "#bfe3f0"),
		walls: { colour: "#f6d7a8" },
		start: { x: 5, z: 6 },
		props: (
			<>
				{shelf(
					2,
					0.4,
					3,
					<>
						{[0.6, 1.2].map((y) =>
							[-1, 0, 1].map((i) => (
								<B key={`${y}${i}`} s={[0.5, 0.35, 0.3]} p={[i * 0.9, y + 0.2, 0.05]} c={["#f08a3c", "#5fc9a3", "#e85d75"][(i + 1) % 3]!} />
							)),
						)}
					</>,
				)}
				{cage(
					6.5,
					0.9,
					<>
						<Ball r={0.22} p={[0, 0.72, 0]} c="#f7f4ee" s={[1.2, 0.9, 1]} />
						<Ball r={0.06} p={[-0.1, 1.05, 0]} c="#f7f4ee" s={[0.7, 2, 0.7]} />
					</>,
				)}
				{cage(8.4, 0.9, <Ball r={0.2} p={[0, 0.7, 0]} c="#d9a066" s={[1.3, 0.9, 1]} />)}
				{/* Fish tanks along the left wall. */}
				<group position={[0.6, 0, 4]}>
					<B s={[0.9, 0.7, 2.2]} p={[0, 0.35, 0]} c={WOOD} />
					<B s={[0.85, 0.8, 2.1]} p={[0, 1.1, 0]} c="#7cc8e8" o={0.5} />
					{[
						[0.2, 1.0, -0.5, "#e8822e"],
						[-0.1, 1.2, 0.4, "#f2c94c"],
					].map(([x, y, z, c]) => (
						<Ball key={c as string} r={0.08} p={[x as number, y as number, z as number]} c={c as string} s={[0.6, 1, 1.5]} />
					))}
				</group>
				{/* The counter, and the cat's scratching post. */}
				<B s={[2.6, 1, 0.8]} p={[7, 0.5, 6.4]} c="#3cb6c9" />
				<B s={[2.7, 0.08, 0.9]} p={[7, 1.04, 6.4]} c={WHITE} />
				<group position={[3.2, 0, 6.8]}>
					<B s={[0.8, 0.08, 0.8]} p={[0, 0.04, 0]} c="#c9b28c" />
					<Cyl r={0.1} h={1.3} p={[0, 0.65, 0]} c="#e8d9b0" seg={10} />
					<Ball r={0.22} p={[0, 1.4, 0]} c="#f08a3c" s={[1.2, 0.8, 1]} />
				</group>
				<Cyl r={0.4} h={0.18} p={[4.6, 0.09, 2.6]} c="#e85d75" />
			</>
		),
		hotspots: [
			{
				id: "adopt",
				at: [4.6, 1.9, 0.12],
				node: (
					<>
						<B s={[1.6, 0.8, 0.06]} p={[0, 0, 0]} c="#f2c94c" />
						<Ball r={0.16} p={[0, 0, 0.05]} c="#e85d75" s={[1, 1, 0.3]} />
					</>
				),
			},
		],
		finds: {
			"petshop-bone": { at: [6.2, 0, 7.05], node: <B s={[0.4, 0.08, 0.12]} p={[0, 0.06, 0]} c={WHITE} /> },
			"petshop-yarn": { at: [3.55, 0, 7.25], node: <Ball r={0.15} p={[0, 0.15, 0]} c="#8a5bd1" /> },
			"petshop-carrot": {
				at: [6.9, 0, 1.55],
				node: <Cyl r={0.01} r2={0.07} h={0.35} p={[0, 0.06, 0]} rot={[0, 0, Math.PI / 2]} c="#f08a3c" />,
			},
			"petshop-fishfood": { at: [0.75, 0.75, 5.3], node: <Cyl r={0.1} h={0.2} p={[0, 0, 0]} c="#2f9e6b" /> },
			"petshop-collar": { at: [4.6, 0.2, 2.6], node: <Cyl r={0.15} h={0.05} p={[0, 0, 0]} c={GOLD} e={0.3} /> },
		},
	},
	school: {
		ground: tiles("#e2b27a", "#d6a46c"),
		walls: { colour: "#d9f0c8" },
		start: { x: 6, z: 7.5 },
		props: (
			<>
				{[2.5, 5.5, 8.5].flatMap((x) => [3.2, 5.6].map((z) => desk(x, z)))}
				{/* The teacher's desk. */}
				<B s={[2, 0.8, 0.9]} p={[9.8, 0.4, 1.4]} c={WOOD_DARK} />
				{shelf(0.4, 7, 2.4, <>{[0.55, 1.15].map((y) => books(2.2, y))}</>, Math.PI / 2)}
				{/* A globe on the shelf by the window. */}
				<B s={[1.6, 1, 0.5]} p={[1.6, 0.5, 0.4]} c={WOOD} />
				<Cyl r={0.25} h={0.06} p={[1.2, 1.03, 0.4]} c={POT} />
			</>
		),
		hotspots: [
			{
				id: "chalkboard",
				at: [6, 1.7, 0.08],
				node: (
					<>
						<B s={[4.2, 1.6, 0.08]} p={[0, 0, 0]} c={WOOD} />
						<B s={[3.9, 1.35, 0.04]} p={[0, 0, 0.04]} c="#2f5d4f" />
						{[-1.2, -0.3, 0.6].map((x, i) => (
							<B key={x} s={[0.6 - i * 0.1, 0.06, 0.02]} p={[x, 0.3 - i * 0.3, 0.07]} c={WHITE} />
						))}
					</>
				),
			},
		],
		finds: {
			"school-pencil": { at: [5.8, 0, 6.05], node: <B s={[0.35, 0.05, 0.05]} p={[0, 0.04, 0]} c="#f2c94c" /> },
			"school-star": {
				at: [10.5, 2.3, 0.1],
				node: (
					<mesh rotation={[0, 0, 0.3]}>
						<circleGeometry args={[0.18, 5]} />
						<Toon color={GOLD} emissive={0.4} />
					</mesh>
				),
			},
			"school-apple": { at: [9.5, 0.92, 1.3], node: <Ball r={0.13} p={[0, 0, 0]} c="#d8413c" /> },
			"school-book": { at: [0.75, 1.55, 8.1], node: <B s={[0.3, 0.06, 0.24]} p={[0, 0, 0]} c="#8a5bd1" e={0.2} /> },
			"school-globe": { at: [2.1, 1.25, 0.4], node: <Ball r={0.2} p={[0, 0, 0]} c="#3d74c9" /> },
		},
	},
};

/** Where Roxy stands to pick up each find: on the ground in front of it. */
export function findSpot(place: PlaceId, findId: string): Spot | null {
	const f = PLACES[place].finds[findId];
	return f ? { x: f.at[0], z: f.at[2] + 0.6 } : null;
}
export const FIND_SPOTS_FOR = (place: PlaceId) => Object.keys(PLACES[place].finds);

type Props = {
	place: PlaceId;
	look: Look;
	found: ReadonlySet<string>;
	walkTo: Spot | null;
	onGround: (spot: Spot) => void;
	onFind: (findId: string) => void;
	onHotspot: (id: Hotspot) => void;
	onArrive: (spot: Spot) => void;
	label: string;
};

export function PlaceScene({ place, look, found, walkTo, onGround, onFind, onHotspot, onArrive, label }: Props) {
	const def = PLACES[place];
	const area = PLACE_INFO[place].area;
	const ground = useMemo(() => def.ground(area), [def, area]);
	useEffect(() => () => ground.dispose(), [ground]);
	const tap = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		fn();
	};
	return (
		<WorldCanvas area={area} label={label}>
			<mesh position={[area.w / 2, -0.15, area.d / 2]} onClick={(e) => tap(() => onGround({ x: e.point.x, z: e.point.z }))(e)}>
				<boxGeometry args={[area.w, 0.3, area.d]} />
				<meshToonMaterial map={ground} />
			</mesh>
			{def.walls && (
				<>
					<mesh position={[area.w / 2, 1.5, -0.1]}>
						<boxGeometry args={[area.w, 3, 0.2]} />
						<Toon color={def.walls.colour} />
					</mesh>
					<mesh position={[-0.1, 1.5, area.d / 2]}>
						<boxGeometry args={[0.2, 3, area.d]} />
						<Toon color={lighter(def.walls.colour, 0.15)} />
					</mesh>
				</>
			)}
			{def.props}
			{def.hotspots?.map((h) => (
				<group key={h.id} position={h.at} onClick={tap(() => onHotspot(h.id))}>
					{h.node}
				</group>
			))}
			{Object.entries(def.finds)
				.filter(([id]) => !found.has(id))
				.map(([id, f]) => (
					<group key={id} position={f.at} onClick={tap(() => onFind(id))}>
						{f.node}
					</group>
				))}
			<Walkers look={look} walkTo={walkTo} area={area} start={def.start} onArrive={onArrive} />
		</WorldCanvas>
	);
}
