import { Static } from "../batch.tsx";
import { Cyl, GOLD, LEAF, LEAF_LIGHT, lighter, Toon, WHITE, WOOD, WOOD_DARK } from "../Furniture.tsx";
import { Model } from "../Model.tsx";
import { Shadow } from "../stage.tsx";
import {
	B,
	Ball,
	baked,
	door,
	Fish,
	floorPaw,
	floorTiles,
	heartGeometry,
	lamp,
	paw,
	WindowView,
	walls,
	windowFrame,
} from "./indoorKit.tsx";
import { Bubbles, type Place, pottedPlant, puppy } from "./kit.tsx";

/**
 * The pet shop: shelves of food and toys, a fish tank, a bunny's hutch and a budgie's cage, puppies asleep in their
 * pen, a cat on her tree, and the counter. Peach striped walls with mint panelling, a window on the street.
 */

const AREA = { w: 10, d: 8 };
const MINT = "#9fd9c4";
const TRIM = "#fff6e6";
const PEACH = "#f6d7a8";

const ROOM = walls(AREA, {
	paint: PEACH,
	panel: MINT,
	trim: TRIM,
	tile: 1,
	paper: (ctx) => {
		ctx.fillStyle = PEACH;
		ctx.fillRect(0, 0, 128, 128);
		ctx.fillStyle = "#fbe6c6";
		ctx.fillRect(0, 0, 40, 128);
		ctx.fillRect(64, 0, 40, 128);
		ctx.fillStyle = "rgba(232,140,110,0.35)";
		for (const [x, y] of [
			[20, 30],
			[84, 94],
		]) {
			ctx.beginPath();
			ctx.arc(x!, y!, 5, 0, Math.PI * 2);
			for (const [dx, dy] of [
				[-6, -8],
				[-2, -11],
				[2, -11],
				[6, -8],
			]) {
				ctx.moveTo(x! + dx!, y! + dy!);
				ctx.arc(x! + dx!, y! + dy!, 2.2, 0, Math.PI * 2);
			}
			ctx.fill();
		}
	},
});

const BACK_LAMP = lamp([5.9, 2.3, 0], "#e88a76", { light: true });
const SIDE_LAMP = lamp([0, 2.3, 7.4], "#e88a76", { onLeft: true });

const BAG_COLOURS = ["#f6b6c8", "#7cc8e8", "#f2c94c", "#9fd9c4", "#e88a76", "#c7b3f0"];
const TIN_COLOURS = ["#e85d75", "#3d74c9", "#f08a3c", "#2f9e6b"];

/** The shelves on the back wall: bags of food along the bottom, tins in the middle, bowls and balls on top. */
const shelving = (
	<group position={[2, 0, 0.27]}>
		<B s={[3.04, 1.74, 0.04]} p={[0, 0.87, -0.2]} c={lighter(WOOD, 0.2)} />
		{[-1.5, 1.5].map((x) => (
			<B key={x} s={[0.07, 1.74, 0.46]} p={[x, 0.87, 0]} c={WOOD} />
		))}
		{[0.06, 0.6, 1.14, 1.7].map((y) => (
			<B key={y} s={[3, 0.05, 0.46]} p={[0, y, 0]} c={WOOD} />
		))}
		{BAG_COLOURS.map((c, i) => (
			<group key={c} position={[-1.2 + i * 0.48, 0.09, 0.02]}>
				<B s={[0.38, 0.44, 0.22]} p={[0, 0.22, 0]} c={c} />
				<B s={[0.24, 0.16, 0.02]} p={[0, 0.24, 0.115]} c={WHITE} />
				<Ball r={0.035} p={[0, 0.24, 0.13]} c={WOOD_DARK} s={[1, 1, 0.3]} />
			</group>
		))}
		{Array.from({ length: 10 }, (_, i) => (
			<group key={i} position={[-1.3 + i * 0.29, 0.63, 0.04]}>
				<Cyl r={0.095} h={0.2} p={[0, 0.1, 0]} c={TIN_COLOURS[Math.floor(i / 3) % 4]!} seg={12} />
				<Cyl r={0.1} h={0.08} p={[0, 0.1, 0]} c={WHITE} seg={12} />
				<Cyl r={0.098} h={0.025} p={[0, 0.205, 0]} c="#c9ccd4" seg={12} />
			</group>
		))}
		{[-1.15, -0.4, 0.35].map((x, i) => (
			<group key={x} position={[x, 1.17, 0.02]}>
				{[0, 1, 2].map((k) => (
					<Cyl
						key={k}
						r={0.17}
						r2={0.12}
						h={0.07}
						p={[0, 0.04 + k * 0.06, 0]}
						c={["#5fc9a3", "#f6b6c8", "#f2c94c"][(i + k) % 3]!}
						seg={14}
					/>
				))}
			</group>
		))}
		{[
			[0.95, "#e85d75"],
			[1.2, "#3d74c9"],
			[1.07, "#f2c94c"],
		].map(([x, c], i) => (
			<Ball key={c as string} r={0.1} p={[x as number, 1.27 + (i === 2 ? 0.14 : 0), i === 2 ? 0 : 0.05]} c={c as string} />
		))}
		{/* On top: a little plant and a box of chews. */}
		<Cyl r={0.12} r2={0.1} h={0.18} p={[-1.1, 1.82, 0]} c="#d9734a" seg={10} />
		<Ball r={0.17} p={[-1.1, 2.0, 0]} c={LEAF} s={[1, 0.8, 1]} />
		<B s={[0.5, 0.28, 0.3]} p={[0.9, 1.87, 0]} c="#f08a3c" />
		<B s={[0.52, 0.06, 0.32]} p={[0.9, 2.02, 0]} c={lighter("#f08a3c", 0.3)} />
	</group>
);

/** Portraits of the shop's animals over the shelves. */
const portraits = [
	[1.0, "#f7f4ee", "#d9a066"],
	[2.0, "#d9a066", "#9c6b3f"],
	[3.0, "#8a8f9c", "#f6b6c8"],
].map(([x, coat, ear], i) => (
	<group key={x as number} position={[x as number, 2.4 + (i === 1 ? 0.08 : 0), 0.03]}>
		<B s={[0.52, 0.46, 0.04]} p={[0, 0, 0]} c={i === 1 ? WOOD : TRIM} />
		<B s={[0.42, 0.36, 0.02]} p={[0, 0, 0.025]} c={["#bfe3f0", "#fbe6c6", "#d9f0c8"][i]!} />
		<Ball r={0.1} p={[0, -0.03, 0.04]} c={coat as string} s={[1, 0.95, 0.4]} />
		<Ball r={0.045} p={[-0.08, 0.06, 0.04]} c={ear as string} s={[0.8, 1.3, 0.4]} />
		<Ball r={0.045} p={[0.08, 0.06, 0.04]} c={ear as string} s={[0.8, 1.3, 0.4]} />
	</group>
));

/** The fish tank on its stand along the left wall: sand, rocks, weed, a little castle, and fish (see `FISH`). */
const tank = (
	<group position={[0.6, 0, 4]}>
		<B s={[0.9, 0.7, 2.3]} p={[0, 0.35, 0]} c="#5f9fae" />
		{[-0.56, 0.56].map((z) => (
			<group key={z}>
				<B s={[0.03, 0.5, 1.0]} p={[0.46, 0.36, z]} c={lighter("#5f9fae", 0.25)} />
				<Ball r={0.035} p={[0.49, 0.36, z + (z < 0 ? 0.38 : -0.38)]} c={GOLD} />
			</group>
		))}
		<B s={[0.8, 0.1, 1.98]} p={[0, 0.76, 0]} c="#f2dcae" />
		{[
			[-0.15, -0.7, 0.1],
			[0.2, -0.45, 0.07],
			[-0.2, 0.55, 0.09],
			[0.15, 0.8, 0.06],
		].map(([x, z, r]) => (
			<Ball key={`${x}${z}`} r={r!} p={[x!, 0.82, z!]} c="#a9a6b8" s={[1.3, 0.8, 1]} />
		))}
		{[
			[-0.25, -0.95],
			[0.25, -0.2],
			[-0.25, 0.2],
			[0.2, 0.98],
			[0, -0.05],
		].map(([x, z], i) => (
			<Ball key={`${x}${z}`} r={0.07} p={[x!, 1.0 + (i % 2) * 0.06, z!]} c={i % 2 ? LEAF : LEAF_LIGHT} s={[0.6, 3, 0.6]} />
		))}
		<group position={[-0.1, 0.8, 0.35]}>
			<Cyl r={0.1} h={0.24} p={[0, 0.12, 0]} c="#e8c9a8" seg={8} />
			<Cyl r={0.001} r2={0.12} h={0.14} p={[0, 0.31, 0]} c="#e85d75" seg={8} />
		</group>
		<B s={[0.9, 0.05, 0.08]} p={[0, 1.52, -1.03]} c="#5f9fae" />
		<B s={[0.9, 0.05, 0.08]} p={[0, 1.52, 1.03]} c="#5f9fae" />
		<B s={[0.08, 0.05, 2.06]} p={[0.42, 1.52, 0]} c="#5f9fae" />
		<B s={[0.08, 0.05, 2.06]} p={[-0.42, 1.52, 0]} c="#5f9fae" />
	</group>
);
const FISH = (
	<Fish
		at={[0.6, 0, 4]}
		len={1.5}
		fish={[
			{ x: 0.12, y: 1.02, c: "#f08a3c", speed: 0.55, phase: 0 },
			{ x: -0.12, y: 1.22, c: "#f2c94c", speed: 0.42, phase: 2 },
			{ x: 0.05, y: 1.35, c: "#e85d75", speed: 0.68, phase: 4.1 },
		]}
	/>
);

/** The bunny's hutch: a sleeping box on the left, a wire front on the right, and a pitched roof. */
const hutch = (
	<group position={[6.5, 0, 0.9]}>
		{[-0.55, 0.55].flatMap((x) => [-0.35, 0.35].map((z) => <B key={`${x}${z}`} s={[0.08, 0.3, 0.08]} p={[x, 0.15, z]} c={WOOD_DARK} />))}
		<B s={[1.2, 0.08, 0.85]} p={[0, 0.32, 0]} c={WOOD} />
		<B s={[1.1, 0.04, 0.78]} p={[0, 0.37, 0]} c="#f2d38a" />
		<B s={[1.2, 0.62, 0.06]} p={[0, 0.66, -0.4]} c={WOOD} />
		{[-0.58, 0.58].map((x) => (
			<B key={x} s={[0.06, 0.62, 0.85]} p={[x, 0.66, 0]} c={WOOD} />
		))}
		<B s={[0.5, 0.62, 0.05]} p={[-0.32, 0.66, 0.4]} c={lighter(WOOD, 0.15)} />
		<Ball r={0.13} p={[-0.32, 0.6, 0.42]} c="#5a3a24" s={[1, 1.2, 0.3]} />
		{[0.02, 0.13, 0.24, 0.35, 0.46].map((x) => (
			<Cyl key={x} r={0.012} h={0.58} p={[x, 0.66, 0.41]} c="#c9ccd4" seg={5} />
		))}
		<B s={[0.56, 0.04, 0.04]} p={[0.25, 0.95, 0.41]} c={WOOD_DARK} />
		{/* The bunny, and her bowl. */}
		<Ball r={0.16} p={[0.22, 0.5, 0.05]} c="#f7f4ee" s={[1.2, 0.9, 1]} />
		<Ball r={0.11} p={[0.36, 0.6, 0.12]} c="#f7f4ee" />
		<Ball r={0.045} p={[0.33, 0.78, 0.1]} c="#f7f4ee" s={[0.7, 2.2, 0.6]} />
		<Ball r={0.045} p={[0.41, 0.77, 0.1]} c="#f6b6c8" s={[0.6, 2, 0.5]} />
		<Cyl r={0.08} r2={0.06} h={0.05} p={[0.0, 0.41, 0.2]} c="#e85d75" seg={10} />
		{/* The roof: two slopes meeting along the top. */}
		{[-1, 1].map((side) => (
			<group key={side} position={[0, 1.08, side * 0.22]} rotation={[side * 0.55, 0, 0]}>
				<B s={[1.36, 0.07, 0.58]} p={[0, 0, 0]} c="#c95d6b" />
			</group>
		))}
		<B s={[1.4, 0.07, 0.08]} p={[0, 1.22, 0]} c="#a94a58" />
	</group>
);

/** The budgie's cage on a little cupboard: a ring of bars, a perch, a pointed top. */
const BARS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
const birdcage = (
	<group position={[8.4, 0, 0.9]}>
		<B s={[0.95, 0.55, 0.75]} p={[0, 0.275, 0]} c={MINT} />
		<B s={[0.8, 0.03, 0.02]} p={[0, 0.3, 0.38]} c={lighter(MINT, 0.3)} />
		<Ball r={0.035} p={[0, 0.42, 0.39]} c={GOLD} />
		<Cyl r={0.36} h={0.08} p={[0, 0.59, 0]} c={GOLD} seg={18} />
		{BARS.map((a) => (
			<Cyl key={a} r={0.011} h={0.7} p={[Math.cos(a) * 0.33, 0.98, Math.sin(a) * 0.33]} c={GOLD} seg={4} />
		))}
		<Cyl r={0.34} h={0.035} p={[0, 0.95, 0]} c={GOLD} seg={18} />
		<Cyl r={0.04} r2={0.35} h={0.28} p={[0, 1.47, 0]} c={GOLD} seg={18} />
		<Ball r={0.05} p={[0, 1.64, 0]} c={GOLD} />
		<Cyl r={0.015} h={0.5} p={[0, 0.88, 0]} rot={[0, 0, Math.PI / 2]} c={WOOD} seg={5} />
		<group position={[0.05, 0.98, 0]}>
			<Ball r={0.08} p={[0, 0, 0]} c="#7cc8e8" s={[1, 1.3, 1]} />
			<Ball r={0.06} p={[0, 0.11, 0.02]} c="#f2e38a" />
			<Ball r={0.02} p={[0, 0.1, 0.07]} c="#f08a3c" />
			<Ball r={0.035} p={[0, -0.08, -0.07]} c="#3d74c9" s={[0.6, 1.8, 0.6]} />
		</group>
	</group>
);

/** The puppy pen: a low wooden fence round a cushion, two puppies asleep on it, a water bowl and a chew. */
const pen = (
	<group position={[3.4, 0, 1.75]}>
		<B s={[1.5, 0.06, 1.05]} p={[0, 0.03, 0]} c="#c9a07a" />
		<B s={[1.2, 0.14, 0.8]} p={[0, 0.1, 0]} c="#7cc8e8" />
		<B s={[1.1, 0.06, 0.7]} p={[0, 0.18, 0]} c="#bfe3f0" />
		{[-0.8, 0.8].flatMap((x) => [-0.55, 0.55].map((z) => <B key={`${x}${z}`} s={[0.09, 0.52, 0.09]} p={[x, 0.26, z]} c={WOOD} />))}
		{[0.2, 0.42].map((y) => (
			<group key={y}>
				<B s={[1.68, 0.06, 0.05]} p={[0, y, -0.55]} c={WOOD} />
				<B s={[1.68, 0.06, 0.05]} p={[0, y, 0.55]} c={WOOD} />
				<B s={[0.05, 0.06, 1.18]} p={[-0.8, y, 0]} c={WOOD} />
				<B s={[0.05, 0.06, 1.18]} p={[0.8, y, 0]} c={WOOD} />
			</group>
		))}
		{puppy(-0.22, 0, 0.3, "#d9a066", "#9c6b3f")}
		{puppy(0.25, 0.08, 2.6, "#f7f4ee", "#6b4a33")}
		<Cyl r={0.1} r2={0.08} h={0.06} p={[0.55, 0.06, 0.35]} c="#3d74c9" seg={12} />
		<Cyl r={0.075} h={0.02} p={[0.55, 0.09, 0.35]} c="#9fd8f0" seg={12} />
	</group>
);

/** The cat's tree: a rope-wound post, a carpeted top with the shop cat asleep on it, and a pompom on a string. */
const catTree = (
	<group position={[3.2, 0, 6.8]}>
		<B s={[0.8, 0.08, 0.8]} p={[0, 0.04, 0]} c="#c9a5d8" />
		<Cyl r={0.1} h={1.2} p={[0, 0.66, 0]} c="#e8d9b0" seg={10} />
		{[0.25, 0.45, 0.65, 0.85, 1.05].map((y) => (
			<Cyl key={y} r={0.106} h={0.03} p={[0, y, 0]} c="#cbb68c" seg={10} />
		))}
		<Cyl r={0.36} h={0.07} p={[0, 1.28, 0]} c="#c9a5d8" seg={16} />
		<Cyl r={0.25} h={0.05} p={[0.25, 0.65, 0]} c="#c9a5d8" seg={14} />
		<Ball r={0.2} p={[0, 1.43, 0]} c="#f08a3c" s={[1.35, 0.65, 1.05]} />
		<Ball r={0.12} p={[0.2, 1.47, 0.1]} c="#f08a3c" />
		<Cyl r={0.001} r2={0.045} h={0.08} p={[0.16, 1.6, 0.1]} c="#f08a3c" seg={5} />
		<Cyl r={0.001} r2={0.045} h={0.08} p={[0.26, 1.6, 0.08]} c="#f08a3c" seg={5} />
		<Ball r={0.04} p={[-0.22, 1.36, 0.16]} c="#e07a2c" s={[2.2, 0.8, 1]} />
		<Cyl r={0.006} h={0.4} p={[-0.3, 1.05, 0.12]} c="#6b5a4a" seg={4} />
		<Ball r={0.05} p={[-0.3, 0.83, 0.12]} c="#e85d75" />
	</group>
);

/** The parrot on her perch, with a seed cup. */
const parrot = (
	<group position={[1.7, 0, 6.55]}>
		<Cyl r={0.25} r2={0.27} h={0.06} p={[0, 0.03, 0]} c={WOOD} seg={16} />
		<Cyl r={0.04} h={1.3} p={[0, 0.65, 0]} c={WOOD} seg={8} />
		<Cyl r={0.035} h={0.7} p={[0, 1.3, 0]} rot={[0, 0, Math.PI / 2]} c={WOOD} seg={8} />
		<Cyl r={0.07} r2={0.05} h={0.07} p={[-0.3, 1.36, 0]} c="#3d74c9" seg={10} />
		<group position={[0.15, 1.47, 0]}>
			<Ball r={0.11} p={[0, 0, 0]} c="#d8413c" s={[1, 1.4, 1]} />
			<Ball r={0.08} p={[0, 0.17, 0.02]} c="#d8413c" />
			<Ball r={0.07} p={[0.07, 0, 0.04]} c="#2f9e6b" s={[0.5, 1.3, 0.7]} />
			<Ball r={0.07} p={[-0.07, 0, 0.04]} c="#3d74c9" s={[0.5, 1.3, 0.7]} />
			<Cyl r={0.05} r2={0.001} h={0.3} p={[0, -0.22, -0.06]} rot={[-0.3, 0, 0]} c="#3d74c9" seg={6} />
			<Ball r={0.035} p={[0, 0.15, 0.1]} c="#f2c94c" s={[1, 0.8, 1.2]} />
			<Ball r={0.018} p={[0.05, 0.2, 0.06]} c="#2b2b33" />
			<Ball r={0.018} p={[-0.05, 0.2, 0.06]} c="#2b2b33" />
		</group>
	</group>
);

/** A sign hung out from the left wall on a bracket, a paw on it. */
const hangingSign = (
	<group position={[0, 0, 2.05]}>
		<B s={[0.1, 0.24, 0.12]} p={[0.05, 2.68, 0]} c={WOOD_DARK} />
		<B s={[0.7, 0.05, 0.05]} p={[0.38, 2.72, 0]} c={WOOD_DARK} />
		{[0.18, 0.58].map((x) => (
			<Cyl key={x} r={0.008} h={0.16} p={[x, 2.62, 0]} c="#6b5a4a" seg={4} />
		))}
		<Cyl r={0.3} h={0.06} p={[0.38, 2.27, 0]} rot={[Math.PI / 2, 0, 0]} c={WOOD} seg={22} />
		<Cyl r={0.25} h={0.065} p={[0.38, 2.27, 0]} rot={[Math.PI / 2, 0, 0]} c={TRIM} seg={22} />
		{paw([0.38, 2.27, 0.04], 0.33, WOOD_DARK)}
	</group>
);

/** Food bags and a basket of toys beside the counter. */
const bagsAndBasket = (
	<>
		<group position={[9, 0, 6.9]}>
			<B s={[0.36, 0.58, 0.22]} p={[-0.2, 0.29, 0]} c="#f6b6c8" />
			<B s={[0.36, 0.08, 0.2]} p={[-0.2, 0.6, 0]} c={lighter("#f6b6c8", 0.3)} />
			{paw([-0.2, 0.3, 0.115], 0.12, WOOD_DARK)}
			<B s={[0.36, 0.5, 0.22]} p={[0.2, 0.25, 0.1]} c="#7cc8e8" />
			<B s={[0.36, 0.08, 0.2]} p={[0.2, 0.52, 0.1]} c={lighter("#7cc8e8", 0.3)} />
			{paw([0.2, 0.26, 0.215], 0.12, WOOD_DARK)}
		</group>
		<group position={[8.95, 0, 7.55]}>
			<Cyl r={0.26} r2={0.21} h={0.26} p={[0, 0.13, 0]} c="#c9965f" seg={16} />
			<Cyl r={0.27} h={0.04} p={[0, 0.25, 0]} c="#a87a4a" seg={16} />
			<Ball r={0.09} p={[-0.08, 0.28, 0]} c="#5fc9a3" />
			<Ball r={0.08} p={[0.09, 0.29, 0.04]} c="#e85d75" />
			<Ball r={0.08} p={[0.02, 0.3, -0.09]} c="#f2c94c" />
		</group>
	</>
);

/** A display table at the front: leads on a stand, dog beds and a stack of bowls. */
const display = (
	<group position={[9.1, 0, 3.6]}>
		<B s={[1.2, 0.08, 0.8]} p={[0, 0.55, 0]} c={WOOD} />
		{[-0.5, 0.5].flatMap((x) => [-0.32, 0.32].map((z) => <B key={`${x}${z}`} s={[0.07, 0.52, 0.07]} p={[x, 0.27, z]} c={WOOD_DARK} />))}
		<B s={[1.1, 0.04, 0.7]} p={[0, 0.18, 0]} c={WOOD} />
		{[
			[-0.3, "#e85d75"],
			[0.3, "#3d74c9"],
		].map(([x, c]) => (
			<group key={x as number} position={[x as number, 0.2, 0]}>
				<B s={[0.5, 0.12, 0.55]} p={[0, 0.06, 0]} c={c as string} />
				<B s={[0.4, 0.08, 0.45]} p={[0, 0.1, 0]} c={lighter(c as string, 0.45)} />
			</group>
		))}
		{[0, 1, 2].map((k) => (
			<Cyl key={k} r={0.17} r2={0.12} h={0.07} p={[-0.3, 0.63 + k * 0.06, 0.05]} c={["#f2c94c", "#5fc9a3", "#f6b6c8"][k]!} seg={14} />
		))}
		<Cyl r={0.02} h={0.6} p={[0.32, 0.88, -0.1]} c={WOOD_DARK} seg={6} />
		<B s={[0.4, 0.04, 0.04]} p={[0.32, 1.16, -0.1]} c={WOOD_DARK} />
		{[
			[0.17, "#e85d75"],
			[0.32, "#f2c94c"],
			[0.47, "#3cb6c9"],
		].map(([x, c]) => (
			<group key={x as number}>
				<B s={[0.03, 0.34, 0.03]} p={[x as number, 0.98, -0.08]} c={c as string} />
				<Ball r={0.035} p={[x as number, 0.8, -0.08]} c={GOLD} />
			</group>
		))}
		<Ball r={0.07} p={[0.15, 0.66, 0.2]} c="#e85d75" />
		<Ball r={0.06} p={[0.32, 0.65, 0.25]} c="#7dbf52" />
	</group>
);

/** The pet bed by the pen, where someone has left a sparkly collar. */
const petBed = (
	<group position={[4.6, 0, 2.6]}>
		<mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
			<torusGeometry args={[0.32, 0.1, 8, 20]} />
			<Toon color="#e85d75" />
		</mesh>
		<Cyl r={0.33} h={0.1} p={[0, 0.06, 0]} c="#f6b6c8" seg={20} />
	</group>
);

const HEART = heartGeometry(0.28);

export const petshop: Place = {
	board: "indoor",
	ground: floorTiles("#f8f3ea", "#bfe3f0"),
	start: { x: 5, z: 6 },
	blocks: [
		{ x0: 0.45, z0: 0, x1: 3.55, z1: 0.6 },
		{ x0: 5.85, z0: 0.4, x1: 8.95, z1: 1.35 },
		{ x0: 0.15, z0: 2.8, x1: 1.1, z1: 5.2 },
		{ x0: 5.85, z0: 5.85, x1: 8.15, z1: 6.95 },
		{ x0: 2.8, z0: 6.4, x1: 3.6, z1: 7.2 },
		{ cx: 4.6, cz: 2.6, r: 0.4 },
		{ x0: 2.6, z0: 1.2, x1: 4.2, z1: 2.3 },
		{ cx: 1.7, cz: 6.55, r: 0.25 },
		{ cx: 0.6, cz: 7.3, r: 0.4 },
		{ x0: 8.55, z0: 6.75, x1: 9.25, z1: 7.85 },
		{ x0: 8.45, z0: 3.15, x1: 9.75, z1: 4.05 },
	],
	props: (
		<>
			{ROOM}
			<Static>
				{shelving}
				{portraits}
				{windowFrame(7.45, 2.2, 1.8, 1.0, TRIM, "#e88a76")}
				{BACK_LAMP.still}
				{SIDE_LAMP.still}
				{door(6.1, "#7cc8e8", TRIM, "#c95d6b")}
				{hangingSign}
				{tank}
				{hutch}
				{birdcage}
				{pen}
				{petBed}
				{display}
				{catTree}
				{parrot}
				{bagsAndBasket}
				{pottedPlant(0.6, 7.3, 1.4)}
				{/* A round rug in the middle, and paw prints in from the door. */}
				<Cyl r={1.15} h={0.02} p={[5, 0.01, 4.3]} c="#f2c94c" seg={32} />
				<Cyl r={0.95} h={0.024} p={[5, 0.012, 4.3]} c="#fbe6c6" seg={32} />
				<Cyl r={0.55} h={0.028} p={[5, 0.014, 4.3]} c="#9fd9c4" seg={32} />
				{[
					[1.1, 5.95],
					[1.55, 5.7],
					[2.0, 5.95],
					[2.45, 5.7],
					[2.9, 5.95],
					[3.35, 5.7],
				].map(([x, z]) => floorPaw(x!, z!, -Math.PI / 2, "#e2c7a4"))}
			</Static>
			<WindowView x={7.45} y={2.2} w={1.8} h={1.0} />
			{BACK_LAMP.bulb}
			{SIDE_LAMP.bulb}
			{/* The tank's glass and water, the fish, and bubbles. */}
			<B s={[0.84, 0.74, 2.06]} p={[0.6, 1.14, 4]} c="#8fd3ee" o={0.32} />
			{FISH}
			<Bubbles at={[0.6, 0.82, 3.6]} h={0.6} />
			{/* The counter. */}
			<group position={[7, 0, 6.4]}>
				<Shadow r={1.5} s={[1, 0.35, 1]} />
			</group>
			<Model
				id="petshop-counter"
				height={2}
				at={[7, 0, 6.4]}
				rot={Math.PI / 2}
				fallback={
					<>
						<B s={[2.6, 1, 0.8]} p={[7, 0.5, 6.4]} c="#3cb6c9" />
						<B s={[2.7, 0.08, 0.9]} p={[7, 1.04, 6.4]} c={WHITE} />
					</>
				}
			/>
		</>
	),
	hotspots: [
		{
			id: "adopt",
			at: [4.6, 1.9, 0.12],
			node: baked(
				<>
					{/* A board hung from a peg on two cords: a big heart with a paw on it. */}
					<Cyl r={0.006} h={0.5} p={[-0.45, 0.62, -0.02]} rot={[0, 0, -0.75]} c="#6b5a4a" seg={4} />
					<Cyl r={0.006} h={0.5} p={[0.45, 0.62, -0.02]} rot={[0, 0, 0.75]} c="#6b5a4a" seg={4} />
					<Ball r={0.04} p={[0, 0.8, -0.02]} c={GOLD} />
					<B s={[1.62, 0.98, 0.06]} p={[0, 0, -0.01]} c={WOOD} />
					<B s={[1.48, 0.84, 0.05]} p={[0, 0, 0.02]} c="#fff1cf" />
					<mesh geometry={HEART} position={[0, 0.02, 0.07]}>
						<Toon color="#e85d75" />
					</mesh>
					{paw([0, 0, 0.11], 0.26, WHITE)}
					{[-0.56, 0.56].map((x) => (
						<Ball key={x} r={0.05} p={[x, 0.24, 0.06]} c="#f2c94c" s={[1, 1, 0.4]} />
					))}
				</>,
			),
		},
	],
	finds: {
		"petshop-bone": {
			at: [6.2, 0, 7.05],
			node: baked(
				<group position={[0, 0.045, 0]} rotation={[0, 0.4, 0]}>
					<Cyl r={0.035} h={0.3} p={[0, 0, 0]} rot={[0, 0, Math.PI / 2]} c={WHITE} seg={8} />
					{[-0.16, 0.16].flatMap((x) => [-0.04, 0.04].map((z) => <Ball key={`${x}${z}`} r={0.045} p={[x, 0, z]} c={WHITE} />))}
				</group>,
			),
		},
		"petshop-yarn": {
			at: [3.55, 0, 7.25],
			node: baked(
				<>
					<Ball r={0.13} p={[0, 0.13, 0]} c="#8a5bd1" />
					{[0, 1.1, 2.2].map((a) => (
						<mesh key={a} position={[0, 0.13, 0]} rotation={[a, a * 0.7, 0.4]}>
							<torusGeometry args={[0.128, 0.012, 4, 18]} />
							<Toon color="#a883e3" />
						</mesh>
					))}
					<Cyl r={0.01} h={0.35} p={[0.24, 0.01, 0.06]} rot={[0, 0.3, Math.PI / 2]} c="#a883e3" seg={4} />
				</>,
			),
		},
		"petshop-carrot": {
			at: [6.9, 0, 1.55],
			node: baked(
				<group position={[0, 0.06, 0]}>
					<Cyl r={0.06} r2={0.012} h={0.32} p={[0, 0, 0]} rot={[0, 0, -Math.PI / 2]} c="#f08a3c" seg={8} />
					{[-0.05, 0.03].map((x) => (
						<Cyl key={x} r={0.05 - (x + 0.05) * 0.2} h={0.012} p={[x, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#d86f24" seg={8} />
					))}
					{[-0.5, 0, 0.5].map((a) => (
						<Ball key={a} r={0.03} p={[-0.2, 0.02 + Math.cos(a) * 0.02, Math.sin(a) * 0.05]} c={LEAF} s={[2.6, 0.7, 1]} />
					))}
				</group>,
			),
		},
		"petshop-fishfood": {
			at: [0.75, 0.7, 5.0],
			node: baked(
				<>
					<Cyl r={0.09} h={0.17} p={[0, 0.085, 0]} c="#2f9e6b" seg={12} />
					<Cyl r={0.095} h={0.04} p={[0, 0.19, 0]} c="#f2c94c" seg={12} />
					<Ball r={0.035} p={[0.08, 0.09, 0.03]} c="#f08a3c" s={[0.4, 0.9, 1.4]} />
					<Cyl r={0.03} r2={0.001} h={0.04} p={[0.075, 0.09, -0.02]} rot={[Math.PI / 2, 0, 0]} c="#f08a3c" seg={4} />
				</>,
			),
		},
		"petshop-collar": {
			at: [4.6, 0.15, 2.6],
			node: (
				<>
					{baked(
						<>
							<mesh rotation={[Math.PI / 2, 0, 0]}>
								<torusGeometry args={[0.12, 0.025, 6, 18]} />
								<Toon color="#3d74c9" />
							</mesh>
							{[0, 1.57, 3.14, 4.71].map((a) => (
								<Ball key={a} r={0.024} p={[Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12]} c="#fff6cf" />
							))}
						</>,
					)}
					<Cyl r={0.045} h={0.015} p={[0, 0.0, 0.17]} c={GOLD} e={0.4} seg={10} />
				</>
			),
		},
	},
};
