import { Static } from "../batch.tsx";
import { Cyl, GOLD, LEAF, LEAF_LIGHT, lighter, POT, Toon, toonGradient, WHITE, WOOD, WOOD_DARK } from "../Furniture.tsx";
import { Model } from "../Model.tsx";
import { canvasTexture, Shadow } from "../stage.tsx";
import { B, Ball, baked, door, floorBoards, lamp, Spin, starGeometry, WindowView, walls, windowFrame } from "./indoorKit.tsx";
import { Bunting, books, desk, PAINTINGS, type Place, pottedPlant, shelf } from "./kit.tsx";

/**
 * The school classroom: six desks facing the big chalkboard, the teacher's desk, a reading corner with beanbags by the
 * bookshelf, cubbies and coat hooks, the class hamster on his wheel, and a window with bunting over it. Sage walls
 * with butter-yellow panelling and honey floorboards.
 */

const AREA = { w: 12, d: 9 };
const SAGE = "#d9f0c8";
const TRIM = "#fbf6ea";
const PANEL = "#f2dc9a";

const ROOM = walls(AREA, {
	paint: SAGE,
	panel: PANEL,
	trim: TRIM,
	tile: 0.8,
	paper: (ctx) => {
		ctx.fillStyle = SAGE;
		ctx.fillRect(0, 0, 128, 128);
		// Little sprigs of leaves, scattered on a half-drop.
		ctx.fillStyle = "rgba(95,160,74,0.28)";
		for (const [x, y] of [
			[32, 32],
			[96, 96],
		]) {
			for (const a of [-0.6, 0.6, 0]) {
				ctx.beginPath();
				ctx.ellipse(x! + Math.sin(a) * 9, y! - Math.cos(a) * 9, 4, 8, a, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		for (const [x, y] of [
			[96, 30],
			[30, 96],
		]) {
			ctx.beginPath();
			ctx.arc(x!, y!, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	},
});

const BACK_LAMP = lamp([8.72, 2.2, 0], "#7cc8e8", { light: true });
const SIDE_LAMP = lamp([0, 2.25, 6.5], "#7cc8e8", { onLeft: true });

/** The chalkboard's chalk: a sum, a sun, a house and a flower, a little smudged. */
const CHALK = canvasTexture(
	256,
	88,
	(ctx) => {
		ctx.fillStyle = "#2f5d4f";
		ctx.fillRect(0, 0, 256, 88);
		ctx.fillStyle = "rgba(255,255,255,0.06)";
		for (const [x, y, r] of [
			[60, 50, 30],
			[170, 30, 26],
			[220, 70, 20],
		]) {
			ctx.beginPath();
			ctx.ellipse(x!, y!, r! * 1.8, r!, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.strokeStyle = "rgba(255,255,255,0.88)";
		ctx.fillStyle = "rgba(255,255,255,0.88)";
		ctx.lineWidth = 2.5;
		ctx.lineCap = "round";
		ctx.font = "bold 22px Fredoka, sans-serif";
		ctx.fillText("2 + 3 = 5", 16, 36);
		ctx.fillText("4 × 2 = 8", 16, 70);
		// A sun.
		ctx.beginPath();
		ctx.arc(150, 26, 9, 0, Math.PI * 2);
		ctx.stroke();
		for (let i = 0; i < 8; i++) {
			const a = (i * Math.PI) / 4;
			ctx.beginPath();
			ctx.moveTo(150 + Math.cos(a) * 13, 26 + Math.sin(a) * 13);
			ctx.lineTo(150 + Math.cos(a) * 18, 26 + Math.sin(a) * 18);
			ctx.stroke();
		}
		// A house.
		ctx.strokeStyle = "rgba(255,214,120,0.9)";
		ctx.strokeRect(178, 44, 30, 28);
		ctx.beginPath();
		ctx.moveTo(174, 46);
		ctx.lineTo(193, 28);
		ctx.lineTo(212, 46);
		ctx.stroke();
		ctx.strokeRect(189, 58, 8, 14);
		// A flower.
		ctx.strokeStyle = "rgba(246,182,200,0.95)";
		for (let i = 0; i < 5; i++) {
			const a = (i * Math.PI * 2) / 5;
			ctx.beginPath();
			ctx.arc(236 + Math.cos(a) * 6, 30 + Math.sin(a) * 6, 4, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(160,220,140,0.9)";
		ctx.beginPath();
		ctx.moveTo(236, 38);
		ctx.lineTo(236, 76);
		ctx.stroke();
	},
	[1, 1],
);

/** The map over the globe shelf: sea, and blobs of land. */
const MAP = canvasTexture(
	128,
	80,
	(ctx) => {
		ctx.fillStyle = "#9fd8f0";
		ctx.fillRect(0, 0, 128, 80);
		ctx.fillStyle = "#7dbf52";
		for (const [x, y, rx, ry] of [
			[26, 26, 16, 12],
			[34, 52, 8, 16],
			[66, 24, 12, 9],
			[72, 46, 10, 14],
			[100, 30, 18, 12],
			[110, 60, 8, 6],
		]) {
			ctx.beginPath();
			ctx.ellipse(x!, y!, rx!, ry!, 0.3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#f2c94c";
		ctx.beginPath();
		ctx.arc(72, 44, 3, 0, Math.PI * 2);
		ctx.fill();
	},
	[1, 1],
);

const CARD_COLOURS = ["#e85d75", "#f08a3c", "#f2c94c", "#7dbf52", "#3cb6c9", "#3d74c9", "#8a5bd1", "#f6b6c8", "#5fc9a3"];
/** A row of picture cards along the top of the chalkboard, each with a white shape. */
const cards = CARD_COLOURS.map((c, i) => {
	const x = 4.1 + i * 0.475;
	const shape = i % 3;
	return (
		<group key={c} position={[x, 2.74, 0.04]}>
			<B s={[0.4, 0.34, 0.03]} p={[0, 0, 0]} c={c} />
			{shape === 0 && <Ball r={0.08} p={[0, 0, 0.02]} c={WHITE} s={[1, 1, 0.3]} />}
			{shape === 1 && <B s={[0.15, 0.15, 0.02]} p={[0, 0, 0.025]} c={WHITE} />}
			{shape === 2 && <Cyl r={0.1} h={0.02} p={[0, -0.01, 0.025]} rot={[Math.PI / 2, 0, 0]} c={WHITE} seg={3} />}
		</group>
	);
});

const TRAYS = ["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b", "#8a5bd1", "#f08a3c"];
/** Cubbies against the left wall, a coloured tray in each, and coat hooks above with backpacks. */
const cubbies = (
	<group position={[0, 0, 5.4]}>
		<B s={[0.55, 1.0, 1.1]} p={[0.3, 0.5, 0]} c={WOOD} />
		{[0.33, 0.66].map((y) => (
			<B key={y} s={[0.5, 0.04, 1.06]} p={[0.32, y, 0]} c={lighter(WOOD, 0.25)} />
		))}
		<B s={[0.5, 0.96, 0.04]} p={[0.32, 0.5, 0]} c={lighter(WOOD, 0.25)} />
		{TRAYS.map((c, i) => (
			<B key={c} s={[0.42, 0.22, 0.44]} p={[0.36, 0.15 + Math.floor(i / 2) * 0.33, i % 2 ? 0.26 : -0.26]} c={c} />
		))}
		<B s={[0.05, 0.08, 1.2]} p={[0.04, 1.6, 0]} c={WOOD_DARK} />
		{[
			[-0.4, "#e85d75"],
			[0, "#3d74c9"],
			[0.4, "#f2c94c"],
		].map(([z, c]) => (
			<group key={z as number} position={[0.14, 1.32, z as number]}>
				<Cyl r={0.02} h={0.12} p={[-0.06, 0.26, 0]} rot={[0, 0, Math.PI / 2]} c={GOLD} seg={5} />
				<B s={[0.16, 0.38, 0.3]} p={[0, 0.02, 0]} c={c as string} />
				<B s={[0.06, 0.16, 0.24]} p={[0.1, -0.06, 0]} c={lighter(c as string, 0.25)} />
			</group>
		))}
	</group>
);

/** The class hamster's cage on a low cupboard: wood shavings, a house, and a wheel (`WHEEL`, it turns). */
const hamster = (
	<group position={[3.25, 0, 0.45]}>
		<B s={[1.3, 0.7, 0.55]} p={[0, 0.35, 0]} c={WOOD} />
		{[-0.32, 0.32].map((x) => (
			<group key={x}>
				<B s={[0.56, 0.5, 0.03]} p={[x, 0.36, 0.28]} c={lighter(WOOD, 0.2)} />
				<Ball r={0.03} p={[x + (x < 0 ? 0.2 : -0.2), 0.4, 0.3]} c={GOLD} />
			</group>
		))}
		<B s={[0.94, 0.08, 0.48]} p={[0, 0.74, 0]} c="#3d74c9" />
		<B s={[0.86, 0.04, 0.42]} p={[0, 0.79, 0]} c="#f2d3a0" />
		<B s={[0.22, 0.16, 0.2]} p={[-0.3, 0.88, -0.05]} c="#f6b6c8" />
		<Ball r={0.05} p={[-0.3, 0.86, 0.06]} c="#5a3a24" s={[1, 1, 0.3]} />
		<Ball r={0.1} p={[-0.05, 0.86, 0.08]} c="#d9a066" s={[1.3, 0.85, 1]} />
		<Ball r={0.035} p={[0.07, 0.88, 0.14]} c="#f6b6c8" />
		<Cyl r={0.03} h={0.24} p={[0.28, 0.9, -0.08]} c="#c9ccd4" seg={6} />
	</group>
);
const WHEEL = (
	<Spin p={[3.53, 0.97, 0.47]} speed={2.2}>
		<Static>
			<mesh>
				<torusGeometry args={[0.13, 0.014, 5, 18]} />
				<Toon color="#e85d75" />
			</mesh>
			{[0, 1, 2].map((i) => (
				<group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
					<B s={[0.26, 0.015, 0.015]} p={[0, 0, 0]} c="#f6b6c8" />
				</group>
			))}
		</Static>
	</Spin>
);

/** The reading corner: a big round rug and two beanbags by the bookshelf. */
const reading = (
	<>
		<Cyl r={1.3} h={0.02} p={[1.9, 0.01, 7.1]} c="#8a5bd1" seg={36} />
		<Cyl r={1.15} h={0.022} p={[1.9, 0.012, 7.1]} c="#f6e7c4" seg={36} />
		<Cyl r={0.8} h={0.024} p={[1.9, 0.014, 7.1]} c="#c7b3f0" seg={36} />
		<Cyl r={0.4} h={0.026} p={[1.9, 0.016, 7.1]} c="#f6e7c4" seg={36} />
		{[
			[1.5, 6.55, "#3d74c9"],
			[2.4, 7.6, "#e85d75"],
		].map(([x, z, c]) => (
			<group key={c as string} position={[x as number, 0, z as number]}>
				<Ball r={0.38} p={[0, 0.2, 0]} c={c as string} s={[1, 0.6, 1]} />
				<Ball r={0.26} p={[0.05, 0.36, -0.12]} c={lighter(c as string, 0.15)} s={[1, 0.55, 0.8]} />
			</group>
		))}
		<group position={[2.1, 0.03, 6.75]} rotation={[0, 0.5, 0]}>
			<B s={[0.36, 0.05, 0.26]} p={[0, 0, 0]} c="#e85d75" />
			<B s={[0.33, 0.03, 0.23]} p={[0.01, 0.035, 0]} c={WHITE} />
		</group>
	</>
);

/** Carpet squares at the front, where the class sits for a story by the board. */
const carpet = [0, 1, 2, 3, 4, 5].map((i) => (
	<B
		key={i}
		s={[0.56, 0.02, 0.56]}
		p={[5.4 + (i % 3) * 0.6, 0.01, 1.45 + Math.floor(i / 3) * 0.6]}
		c={["#e85d75", "#f2c94c", "#3cb6c9", "#7dbf52", "#8a5bd1", "#f08a3c"][i]!}
	/>
));

/** On the desks: books and pencil pots on some, and a tray of pencils and a plant on the teacher's desk. */
const deskThings = (
	<>
		{[
			[2.5, 3.2],
			[8.5, 3.2],
			[5.5, 5.6],
			[2.5, 5.6],
		].map(([x, z], i) => (
			<group key={`dk${x}${z}`} position={[x!, 0.74, z!]}>
				<B s={[0.32, 0.07, 0.24]} p={[-0.25, 0.04, 0]} c={["#e85d75", "#2f9e6b", "#8a5bd1", "#3d74c9"][i]!} />
				<B s={[0.3, 0.02, 0.22]} p={[-0.25, 0.085, 0]} c={WHITE} />
				<Cyl r={0.06} h={0.14} p={[0.3, 0.07, -0.05]} c={["#f2c94c", "#e85d75", "#3d74c9", "#f08a3c"][i]!} seg={10} />
				{[-0.02, 0.02].map((dx) => (
					<Cyl key={dx} r={0.012} h={0.12} p={[0.3 + dx, 0.17, -0.05]} c={dx < 0 ? "#3d74c9" : "#e85d75"} seg={5} />
				))}
			</group>
		))}
		<B s={[0.4, 0.08, 0.3]} p={[10.15, 0.84, 1.4]} c="#3d74c9" />
		<B s={[0.36, 0.08, 0.28]} p={[10.17, 0.92, 1.38]} c="#f2c94c" />
		<Cyl r={0.07} r2={0.06} h={0.12} p={[9.95, 0.86, 1.15]} c={POT} seg={10} />
		<Ball r={0.11} p={[9.95, 0.98, 1.15]} c={LEAF} />
	</>
);

/** The globe shelf under the map, a pot of crayons beside where the globe stands. */
const globeShelf = (
	<group position={[1.6, 0, 0.4]}>
		<B s={[1.6, 1, 0.5]} p={[0, 0.5, 0]} c={WOOD} />
		{[-0.4, 0.4].map((x) => (
			<group key={x}>
				<B s={[0.7, 0.75, 0.03]} p={[x, 0.45, 0.26]} c={lighter(WOOD, 0.2)} />
				<Ball r={0.03} p={[x + (x < 0 ? 0.28 : -0.28), 0.55, 0.28]} c={GOLD} />
			</group>
		))}
		<Cyl r={0.1} r2={0.08} h={0.16} p={[-0.4, 1.08, 0]} c={POT} seg={10} />
		{["#e85d75", "#3d74c9", "#f2c94c", "#2f9e6b"].map((c, i) => (
			<Cyl key={c} r={0.014} h={0.16} p={[-0.43 + i * 0.022, 1.2, (i % 2) * 0.02]} c={c} seg={5} />
		))}
		{/* The map, framed, on the wall above. */}
		<B s={[1.32, 0.86, 0.04]} p={[0, 2.05, -0.38]} c={WOOD_DARK} />
	</group>
);

/** The art table at the front: paint pots, a jar of brushes, paper, two stools; and an easel beside it. */
const art = (
	<>
		<group position={[10.5, 0, 5.0]}>
			<Cyl r={0.5} h={0.06} p={[0, 0.6, 0]} c="#f6e7c4" seg={20} />
			<Cyl r={0.06} h={0.58} p={[0, 0.29, 0]} c={WOOD_DARK} seg={8} />
			<Cyl r={0.28} h={0.04} p={[0, 0.02, 0]} c={WOOD_DARK} seg={14} />
			{["#e85d75", "#f2c94c", "#3d74c9", "#7dbf52"].map((c, i) => (
				<group key={c} position={[-0.2 + i * 0.13, 0.63, -0.15 + (i % 2) * 0.08]}>
					<Cyl r={0.05} h={0.08} p={[0, 0.04, 0]} c={WHITE} seg={10} />
					<Cyl r={0.045} h={0.01} p={[0, 0.085, 0]} c={c} seg={10} />
				</group>
			))}
			<Cyl r={0.06} h={0.14} p={[0.25, 0.7, 0.05]} c="#bfe3f0" seg={10} />
			{[-0.02, 0.02].map((d) => (
				<Cyl key={d} r={0.01} h={0.22} p={[0.25 + d, 0.8, 0.05]} rot={[0, 0, d * 6]} c={WOOD} seg={4} />
			))}
			<group position={[-0.05, 0.64, 0.2]} rotation={[0, 0.3, 0]}>
				<B s={[0.36, 0.01, 0.26]} p={[0, 0, 0]} c={WHITE} />
			</group>
			{[
				[-0.55, 0.3],
				[0.45, 0.5],
			].map(([x, z]) => (
				<group key={x} position={[x!, 0, z!]}>
					<Cyl r={0.17} h={0.06} p={[0, 0.38, 0]} c="#e85d75" seg={14} />
					<Cyl r={0.04} h={0.36} p={[0, 0.18, 0]} c={WOOD_DARK} seg={6} />
				</group>
			))}
		</group>
		<group position={[10.8, 0, 7.5]} rotation={[0, -0.5, 0]}>
			{[-0.3, 0.3].map((x) => (
				<group key={x} position={[x, 0.75, 0]} rotation={[-0.12, 0, x < 0 ? 0.1 : -0.1]}>
					<B s={[0.05, 1.5, 0.05]} p={[0, 0, 0]} c={WOOD} />
				</group>
			))}
			<group position={[0, 0.7, -0.3]} rotation={[0.35, 0, 0]}>
				<B s={[0.05, 1.4, 0.05]} p={[0, 0, 0]} c={WOOD} />
			</group>
			<B s={[0.75, 0.05, 0.12]} p={[0, 0.72, 0.06]} c={WOOD_DARK} />
			<B s={[0.66, 0.66, 0.03]} p={[0, 1.08, 0.02]} c={WHITE} />
		</group>
	</>
);

/** The wall clock. */
const clock = (
	<group position={[3.25, 2.25, 0.04]}>
		<Cyl r={0.32} h={0.05} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c="#3d74c9" seg={28} />
		<Cyl r={0.27} h={0.06} p={[0, 0, 0.01]} rot={[Math.PI / 2, 0, 0]} c={WHITE} seg={28} />
		{Array.from({ length: 12 }, (_, i) => (
			<Ball key={i} r={0.016} p={[Math.sin((i * Math.PI) / 6) * 0.21, Math.cos((i * Math.PI) / 6) * 0.21, 0.045]} c="#2b2b33" />
		))}
		<B s={[0.03, 0.18, 0.02]} p={[0, 0.08, 0.05]} c="#2b2b33" />
		<B s={[0.14, 0.03, 0.02]} p={[0.06, 0, 0.05]} c="#2b2b33" />
	</group>
);

const STAR = starGeometry(0.17, 0.035);

export const school: Place = {
	board: "indoor",
	ground: floorBoards(["#e2b27a", "#d9a56c", "#e8bb86", "#d4a068"]),
	start: { x: 6, z: 7.5 },
	blocks: [
		...[2.5, 5.5, 8.5].flatMap((x) => [3.2, 5.6].map((z) => ({ x0: x - 0.6, z0: z - 0.35, x1: x + 0.6, z1: z + 0.95 }))),
		{ x0: 9.1, z0: 0.9, x1: 10.5, z1: 1.9 },
		{ x0: 0.1, z0: 6, x1: 0.95, z1: 8 },
		{ x0: 0.8, z0: 0.15, x1: 2.4, z1: 0.65 },
		{ x0: 2.6, z0: 0.15, x1: 3.9, z1: 0.75 },
		{ cx: 1.1, cz: 4.4, r: 0.35 },
		{ x0: 0.1, z0: 4.8, x1: 0.62, z1: 6 },
		{ cx: 1.5, cz: 6.55, r: 0.35 },
		{ cx: 2.4, cz: 7.6, r: 0.35 },
		{ cx: 10.5, cz: 5.1, r: 0.75 },
		{ x0: 10.4, z0: 7.15, x1: 11.25, z1: 7.85 },
	],
	props: (
		<>
			{ROOM}
			<Static>
				{windowFrame(10, 2.05, 1.5, 1.0, TRIM, "#7cc8e8")}
				{BACK_LAMP.still}
				{SIDE_LAMP.still}
				{door(1.5, "#e85d75", TRIM, "#3d74c9")}
				{cards}
				{cubbies}
				{hamster}
				{reading}
				{carpet}
				{deskThings}
				{globeShelf}
				{clock}
				{art}
				{pottedPlant(1.1, 4.4, 1.2)}
			</Static>
			<WindowView x={10} y={2.05} w={1.5} h={1.0} />
			{BACK_LAMP.bulb}
			{SIDE_LAMP.bulb}
			{WHEEL}
			<B s={[0.9, 0.42, 0.45]} p={[3.25, 0.98, 0.45]} c="#bfe3f0" o={0.3} />
			<mesh position={[1.6, 2.05, 0.05]}>
				<planeGeometry args={[1.18, 0.72]} />
				<meshToonMaterial map={MAP} gradientMap={toonGradient()} />
			</mesh>
			<Bunting x0={8.9} x1={11.6} y={2.95} />
			<mesh position={[10.78, 1.08, 7.54]} rotation={[0, -0.5, 0]}>
				<planeGeometry args={[0.56, 0.56]} />
				<meshToonMaterial map={PAINTINGS[1]} gradientMap={toonGradient()} />
			</mesh>
			{PAINTINGS.map((map, i) => (
				<mesh key={map.uuid} position={[0.06, 1.95 + (i % 2) * 0.15, 2.65 + i * 0.8]} rotation={[0, Math.PI / 2, 0]}>
					<planeGeometry args={[0.5, 0.66]} />
					<meshToonMaterial map={map} gradientMap={toonGradient()} />
				</mesh>
			))}
			{[2.5, 5.5, 8.5].flatMap((x) => [3.2, 5.6].map((z) => desk(x, z)))}
			{/* The teacher's desk, its drawers to the class. */}
			<group position={[9.8, 0, 1.4]}>
				<Shadow r={0.8} s={[1, 0.7, 1]} />
			</group>
			<Model
				id="school-teacher-desk"
				height={0.8}
				at={[9.8, 0, 1.4]}
				fallback={<B s={[2, 0.8, 0.9]} p={[9.8, 0.4, 1.4]} c={WOOD_DARK} />}
			/>
			{/* The bookshelf against the left wall, its open side to the room. */}
			<group position={[0.52, 0, 7]}>
				<Shadow r={1.1} s={[0.4, 1, 1]} />
			</group>
			<Model
				id="school-bookshelf"
				height={1.08}
				at={[0.52, 0, 7]}
				fallback={shelf(
					0.4,
					7,
					2.4,
					[0.55, 1.15].map((y) => books(2.2, y)),
					Math.PI / 2,
				)}
			/>
		</>
	),
	hotspots: [
		{
			id: "chalkboard",
			at: [6, 1.7, 0.08],
			node: (
				<>
					{baked(
						<>
							<B s={[4.2, 1.6, 0.08]} p={[0, 0, 0]} c={WOOD} />
							<B s={[4.0, 0.06, 0.18]} p={[0, -0.78, 0.08]} c={WOOD_DARK} />
							{[
								[-1.4, WHITE],
								[-1.25, "#f6b6c8"],
								[-1.1, "#f2e38a"],
							].map(([x, c]) => (
								<Cyl key={x as number} r={0.018} h={0.12} p={[x as number, -0.73, 0.1]} rot={[0, 0, Math.PI / 2]} c={c as string} seg={5} />
							))}
							<B s={[0.26, 0.07, 0.1]} p={[1.3, -0.72, 0.1]} c="#3d74c9" />
							<B s={[0.24, 0.03, 0.09]} p={[1.3, -0.76, 0.1]} c="#e8d9b0" />
						</>,
					)}
					<mesh position={[0, 0.02, 0.045]}>
						<planeGeometry args={[3.9, 1.34]} />
						<meshToonMaterial map={CHALK} gradientMap={toonGradient()} />
					</mesh>
				</>
			),
		},
	],
	finds: {
		"school-pencil": {
			at: [5.8, 0, 6.05],
			node: baked(
				<group position={[0, 0.035, 0]} rotation={[0, 0.5, 0]}>
					<Cyl r={0.035} h={0.26} p={[0, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#f2c94c" seg={6} />
					<Cyl r={0.035} r2={0.001} h={0.08} p={[0.17, 0, 0]} rot={[0, 0, -Math.PI / 2]} c="#f2d3a0" seg={6} />
					<Cyl r={0.012} r2={0.001} h={0.03} p={[0.2, 0, 0]} rot={[0, 0, -Math.PI / 2]} c="#2b2b33" seg={6} />
					<Cyl r={0.037} h={0.04} p={[-0.15, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#c9ccd4" seg={8} />
					<Cyl r={0.035} h={0.05} p={[-0.19, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#f6b6c8" seg={8} />
				</group>,
			),
		},
		"school-star": {
			at: [11.35, 2.1, 0.06],
			node: (
				<mesh geometry={STAR} rotation={[0, 0, 0.25]}>
					<Toon color={GOLD} emissive={0.4} />
				</mesh>
			),
		},
		"school-apple": {
			at: [9.5, 0.92, 1.3],
			node: baked(
				<>
					<Ball r={0.12} p={[0, 0, 0]} c="#d8413c" s={[1.05, 0.92, 1.05]} />
					<Cyl r={0.012} h={0.08} p={[0.01, 0.12, 0]} rot={[0, 0, -0.2]} c={WOOD_DARK} seg={5} />
					<Ball r={0.04} p={[0.06, 0.13, 0]} c={LEAF_LIGHT} s={[1.6, 0.5, 0.9]} />
					<Ball r={0.04} p={[-0.05, 0.05, 0.08]} c="#f08a8a" s={[1, 1, 0.4]} />
				</>,
			),
		},
		"school-book": {
			at: [0.75, 1.12, 7.7],
			node: baked(
				<group rotation={[0, 0.3, 0]}>
					<B s={[0.3, 0.07, 0.24]} p={[0, 0, 0]} c="#8a5bd1" />
					<B s={[0.28, 0.05, 0.215]} p={[0.012, 0.002, 0]} c="#fff6e0" />
					<B s={[0.03, 0.005, 0.12]} p={[0.05, 0.036, 0.15]} c="#e85d75" />
					<Ball r={0.035} p={[-0.05, 0.036, 0]} c={GOLD} s={[1, 0.3, 1]} />
				</group>,
			),
		},
		"school-globe": {
			at: [2.1, 1.25, 0.4],
			node: baked(
				<>
					<Cyl r={0.09} r2={0.1} h={0.04} p={[0, -0.23, 0]} c={WOOD_DARK} seg={12} />
					<Cyl r={0.015} h={0.08} p={[0, -0.19, 0]} c={GOLD} seg={6} />
					<group rotation={[0, 0, 0.4]}>
						<mesh rotation={[0, Math.PI / 2, 0]}>
							<torusGeometry args={[0.2, 0.012, 4, 18, Math.PI]} />
							<Toon color={GOLD} />
						</mesh>
						<Ball r={0.17} p={[0, 0, 0]} c="#3d74c9" />
						<Ball r={0.08} p={[0.1, 0.06, 0.1]} c="#7dbf52" s={[1, 1, 0.6]} />
						<Ball r={0.06} p={[-0.11, -0.05, 0.1]} c="#7dbf52" s={[0.9, 1.2, 0.6]} />
						<Ball r={0.05} p={[0.02, 0.12, -0.12]} c="#7dbf52" s={[1.2, 0.8, 0.6]} />
					</group>
				</>,
			),
		},
	},
};
