import { PLACE_INFO } from "@jade/core/roxy";
import { Static } from "../batch.tsx";
import { B, Toon } from "../Furniture.tsx";
import { Model } from "../Model.tsx";
import type { Block } from "../path.ts";
import { Shadow } from "../stage.tsx";
import { Butterfly, bench, bush, flowers, type Place, picnicCloth, tree } from "./kit.tsx";
import {
	acorn,
	bin,
	birdBath,
	borderBed,
	CobblePath,
	DuckFamily,
	feather,
	flowerBed,
	HoppingBird,
	hedge,
	kite,
	LampPost,
	Lawn,
	ladybug,
	lily,
	PicketFence,
	Pond,
	parkGrass,
	picnicSpread,
	reeds,
	shell,
	signpost,
} from "./parkKit.tsx";
import { STREET_EXTEND, Street } from "./street.tsx";

const AREA = PLACE_INFO.park.area;
const POND = { at: [11, 7.6] as [number, number], r: 2 };

/** What Roxy walks round: footprints of the props, matching where they're drawn. */
const BLOCKS: Block[] = [
	// Tree trunks (the canopies are over her head).
	...[
		[2, 2, 1],
		[6, 1.4, 0.9],
		[12.5, 1.5, 1.1],
		[1.4, 8.4, 0.8],
	].map(([cx, cz, s]) => ({ cx: cx!, cz: cz!, r: 0.25 * s! })),
	...[
		[3.6, 2.6],
		[9, 1.2],
		[4.5, 8.8],
	].map(([cx, cz]) => ({ cx: cx!, cz: cz!, r: 0.5 })),
	{ x0: 8.25, z0: 3.35, x1: 9.75, z1: 4.25 },
	{ cx: POND.at[0], cz: POND.at[1], r: POND.r },
	{ cx: 10.4, cz: 4.1, r: 0.15 },
	{ x0: 6.1, z0: 7.4, x1: 6.9, z1: 9.4 },
	// Hedges along the back, the flower beds, the bin, the bird bath and the signpost.
	{ x0: 3.1, z0: 0.3, x1: 4.9, z1: 0.8 },
	{ x0: 7.2, z0: 0.3, x1: 8.4, z1: 0.8 },
	{ x0: 9.95, z0: 0.3, x1: 11.25, z1: 0.8 },
	{ cx: 7.4, cz: 2.85, r: 0.6 },
	{ x0: 0.2, z0: 2.9, x1: 0.85, z1: 4.25 },
	{ cx: 7.85, cz: 3.85, r: 0.2 },
	{ cx: 1.2, cz: 6.7, r: 0.35 },
	{ cx: 4.9, cz: 4.05, r: 0.1 },
];

/** Where the grass tufts and daisies don't go: everything above, the picnic and the bit round the pond. */
const LAWN_AVOID: Block[] = [...BLOCKS, { x0: 2.15, z0: 5.6, x1: 3.85, z1: 7 }, { cx: POND.at[0], cz: POND.at[1], r: POND.r + 0.35 }];

/** Everything in the park that stays put, baked into one mesh (see `Static`). */
const scenery = (
	<>
		{bush(3.6, 2.6)}
		{bush(9, 1.2)}
		{bush(4.5, 8.8)}
		{hedge(4, 0.55, 1.8)}
		{hedge(7.8, 0.55, 1.2)}
		{hedge(10.6, 0.55, 1.3)}
		{bin(7.85, 3.85)}
		{birdBath(1.2, 6.7)}
		{signpost(4.9, 4.05)}
		<group position={[3, 0, 6.3]} rotation={[0, 0.2, 0]}>
			{picnicSpread}
			<B s={[0.4, 0.26, 0.28]} p={[0.35, 0.14, -0.2]} c="#c9965f" />
			<B s={[0.42, 0.04, 0.3]} p={[0.35, 0.28, -0.2]} c="#9c6b3f" />
		</group>
		<LampPost at={[10.4, 0, 4.1]} />
	</>
);

/** Low ground detail (flowers, reeds, lily pads): baked too, but kept out of the sun's shadow pass, where it would only add cost. */
const lowDetail = (
	<>
		{flowerBed(7.4, 2.85, 0.55, ["#e85d75", "#f2c94c", "#f6b6c8"])}
		{borderBed(0.25, 2.95, 4.2, ["#8a5bd1", "#f6b6c8", "#ffffff"])}
		{flowers(3.8, 7.6, "#e85d75")}
		{flowers(7.5, 8.6, "#f2c94c")}
		{flowers(13, 4.2, "#8a5bd1")}
		{flowers(13.3, 3.4, "#f6b6c8")}
		{flowers(5.4, 3.3, "#ffffff")}
		{/* Round the pond: bulrushes at the back, lily pads (one in flower). */}
		{reeds(9.25, 6.75, 6, 3)}
		{reeds(9.75, 6.05, 5, 5)}
		{reeds(12.75, 6.6, 4, 7)}
		{lily(10.35, 8.15, 0.3, true)}
		{lily(11.75, 8.45, 0.24)}
		{lily(11.4, 6.85, 0.2)}
		{lily(10.1, 7.2, 0.17)}
	</>
);

export const park: Place = {
	board: "outdoor",
	backdrop: { node: <Street />, extend: STREET_EXTEND },
	ground: parkGrass,
	// On the path, clear of the slide.
	start: { x: 6, z: 5.2 },
	blocks: BLOCKS,
	props: (
		<>
			<Static>{scenery}</Static>
			<Static cast={false}>{lowDetail}</Static>
			<CobblePath w={AREA.w} />
			<Pond at={POND.at} r={POND.r} />
			<DuckFamily at={POND.at} r={1.15} />
			<Lawn area={AREA} avoid={LAWN_AVOID} />
			<PicketFence area={AREA} />
			{tree(2, 2)}
			{tree(6, 1.4, 0.9)}
			{tree(12.5, 1.5, 1.1)}
			{tree(1.4, 8.4, 0.8)}
			{bench(9, 3.8)}
			{/* The picnic blanket (gingham) and the basket's handle. */}
			<group position={[3, 0, 6.3]} rotation={[0, 0.2, 0]}>
				<mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<planeGeometry args={[1.5, 1.1]} />
					<meshToonMaterial map={picnicCloth} />
				</mesh>
				<mesh position={[0.35, 0.3, -0.2]}>
					<torusGeometry args={[0.14, 0.02, 6, 16, Math.PI]} />
					<Toon color="#9c6b3f" />
				</mesh>
			</group>
			<Butterfly at={[4.4, 1, 7.2]} c="#f2a7c3" />
			<Butterfly at={[9.6, 1.3, 2.4]} c="#8ec5f2" phase={1.7} />
			<Butterfly at={[7.4, 0.9, 2.9]} c="#f2c94c" phase={3.1} />
			<HoppingBird
				spots={[
					[8.4, 6.9],
					[8.9, 7.6],
					[8.1, 8.1],
				]}
			/>
			{/* The slide, its ladder at the back and the chute running toward the front. */}
			<group position={[6.5, 0, 8.4]}>
				<Shadow r={1} s={[0.6, 1.1, 1]} />
			</group>
			<Model
				id="park-slide"
				height={1.55}
				at={[6.5, 0, 8.4]}
				rot={-Math.PI / 2}
				fallback={
					<group position={[6.5, 0, 8]}>
						<B s={[0.1, 1.6, 0.1]} p={[-0.4, 0.8, -0.3]} c="#e85d75" />
						<B s={[0.1, 1.6, 0.1]} p={[0.4, 0.8, -0.3]} c="#e85d75" />
						<B s={[0.9, 0.08, 0.6]} p={[0, 1.6, -0.3]} c="#f2c94c" />
						<mesh position={[0, 0.85, 0.55]} rotation={[0.85, 0, 0]}>
							<boxGeometry args={[0.8, 0.06, 2]} />
							<Toon color="#3cb6c9" />
						</mesh>
					</group>
				}
			/>
		</>
	),
	finds: {
		"park-acorn": { at: [3.9, 0, 3.05], node: <Static>{acorn}</Static> },
		"park-shell": { at: [12.9, 0, 8.6], node: <Static>{shell}</Static> },
		"park-kite": { at: [12.2, 2.7, 2], node: <Static>{kite}</Static> },
		"park-ladybug": {
			at: [7.7, 0.34, 8.75],
			node: (
				<Static>
					<group position={[0, 0.07, 0]}>{ladybug}</group>
				</Static>
			),
		},
		"park-feather": { at: [9.6, 0.5, 3.9], node: <Static>{feather}</Static> },
	},
};
