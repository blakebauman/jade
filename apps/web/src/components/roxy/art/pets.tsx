import type { ReactNode } from "react";
import { INK, LINE, shade } from "../geometry.ts";
import { heart, star } from "./patterns.tsx";
import type { Art } from "./types.ts";

/** Where a pet stands: on the stage floor, beside the character's left hand (the viewer's right). */
export const PET_AT = { x: 336, y: 616 } as const;

type Anchors = {
	/** Where a collar or bandana goes: centre and width. */
	neck: { x: number; y: number; w: number };
	/** Where a hat sits. */
	head: { x: number; y: number };
};

type Pet = { draw: (c1: string, c2: string) => ReactNode } & Anchors;

const eye = (x: number, y: number, r = 4.2) => (
	<g key={`${x}${y}`}>
		<circle cx={x} cy={y} r={r} fill={INK} />
		<circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#fff" />
	</g>
);
const eyes = (dx: number, y: number, r?: number) => (
	<>
		{eye(-dx, y, r)}
		{eye(dx, y, r)}
	</>
);
const smile = (x: number, y: number, w = 6) => (
	<path
		d={`M ${x - w},${y} q ${w / 2},${w * 0.6} ${w},0 q ${w / 2},${w * 0.6} ${w},0`}
		stroke={INK}
		strokeWidth={2}
		fill="none"
		strokeLinecap="round"
	/>
);

/** Each pet in its own coordinates: origin at its feet, up is negative y. About 90 across. */
const PETS: Record<string, Pet> = {
	"pet-cat": {
		neck: { x: 0, y: -52, w: 30 },
		head: { x: 0, y: -96 },
		draw: (c1, c2) => (
			<g>
				<path d="M 26,-12 C 58,-14 58,-60 40,-70" stroke={c1} strokeWidth={9} fill="none" strokeLinecap="round" />
				<ellipse cx={0} cy={-30} rx={28} ry={31} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-26} rx={15} ry={22} fill={c2} />
				{[-12, 12].map((x) => (
					<ellipse key={x} cx={x} cy={-3} rx={9} ry={5} fill={c1} {...LINE} />
				))}
				{[-1, 1].map((s) => (
					<path key={s} d={`M ${s * 22},-80 L ${s * 20},-104 L ${s * 6},-92 Z`} fill={c1} {...LINE} />
				))}
				<circle cx={0} cy={-74} r={24} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-66} rx={11} ry={7} fill={c2} />
				{eyes(9, -78)}
				<path d="M -3,-70 L 3,-70 L 0,-66 Z" fill="#e98a9c" />
				{smile(0, -64, 4)}
			</g>
		),
	},
	"pet-dog": {
		neck: { x: 0, y: -56, w: 34 },
		head: { x: 0, y: -104 },
		draw: (c1, c2) => (
			<g>
				<path d="M 26,-20 q 22,-6 18,-30" stroke={c1} strokeWidth={9} fill="none" strokeLinecap="round" />
				<ellipse cx={0} cy={-32} rx={30} ry={32} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-28} rx={15} ry={20} fill={shade(c1, 0.35)} />
				{[-12, 12].map((x) => (
					<ellipse key={x} cx={x} cy={-3} rx={10} ry={6} fill={c1} {...LINE} />
				))}
				<ellipse cx={0} cy={-78} rx={27} ry={25} fill={c1} {...LINE} />
				{[-1, 1].map((s) => (
					<path
						key={s}
						d={`M ${s * 20},-96 C ${s * 40},-96 ${s * 40},-66 ${s * 32},-58 C ${s * 26},-56 ${s * 22},-74 ${s * 18},-90 Z`}
						fill={c2}
						{...LINE}
					/>
				))}
				<ellipse cx={0} cy={-68} rx={14} ry={10} fill={shade(c1, 0.45)} />
				{eyes(10, -82)}
				<ellipse cx={0} cy={-73} rx={5} ry={3.5} fill={INK} />
				<path d="M -2,-64 q 2,8 6,0" fill="#ef7f8f" />
			</g>
		),
	},
	"pet-bunny": {
		neck: { x: 0, y: -46, w: 26 },
		head: { x: 0, y: -84 },
		draw: (c1, c2) => (
			<g>
				<circle cx={28} cy={-18} r={9} fill="#fbf7f1" {...LINE} />
				<ellipse cx={0} cy={-26} rx={28} ry={26} fill={c1} {...LINE} />
				{[-1, 1].map((s) => (
					<g key={s} transform={`rotate(${s * 10} ${s * 9} -78)`}>
						<ellipse cx={s * 9} cy={-108} rx={8} ry={24} fill={c1} {...LINE} />
						<ellipse cx={s * 9} cy={-106} rx={4} ry={17} fill={c2 === c1 ? "#f2a7b5" : c2} />
					</g>
				))}
				<circle cx={0} cy={-66} r={21} fill={c1} {...LINE} />
				{eyes(8, -70, 3.8)}
				<path d="M -3,-61 L 3,-61 L 0,-58 Z" fill="#e98a9c" />
				{smile(0, -56, 3.5)}
			</g>
		),
	},
	"pet-hamster": {
		neck: { x: 0, y: -30, w: 40 },
		head: { x: 0, y: -56 },
		draw: (c1, c2) => (
			<g>
				{[-1, 1].map((s) => (
					<circle key={s} cx={s * 20} cy={-50} r={8} fill={c1} {...LINE} />
				))}
				<ellipse cx={0} cy={-26} rx={34} ry={28} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-16} rx={22} ry={16} fill={c2} />
				{[-1, 1].map((s) => (
					<circle key={s} cx={s * 20} cy={-26} r={8} fill="#f2a7b5" fillOpacity={0.6} />
				))}
				{eyes(11, -36, 3.8)}
				<circle cx={0} cy={-29} r={2.5} fill="#e98a9c" />
				{smile(0, -25, 3)}
			</g>
		),
	},
	"pet-goldfish": {
		neck: { x: 0, y: -80, w: 52 },
		head: { x: 0, y: -84 },
		draw: (c1, c2) => (
			<g>
				<ellipse cx={0} cy={-4} rx={30} ry={5} fill={INK} fillOpacity={0.2} />
				<path d="M -26,-80 C -60,-60 -50,-6 -20,-2 L 20,-2 C 50,-6 60,-60 26,-80 Z" fill="#bfe3f0" fillOpacity={0.55} {...LINE} />
				<path d="M -42,-50 Q 0,-56 42,-50 C 46,-20 36,-4 20,-2 L -20,-2 C -36,-4 -46,-20 -42,-50 Z" fill="#5fa3e0" fillOpacity={0.35} />
				<path d="M 14,-30 L 30,-42 L 30,-18 Z" fill={c2} {...LINE} />
				<ellipse cx={0} cy={-30} rx={18} ry={11} fill={c1} {...LINE} />
				{eye(-8, -32, 2.8)}
				<path d="M -4,-40 q 6,-8 10,0" fill={c2} />
				<path d="M -26,-80 L 26,-80" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
			</g>
		),
	},
	"pet-turtle": {
		neck: { x: 30, y: -22, w: 14 },
		head: { x: 38, y: -38 },
		draw: (c1, c2) => (
			<g>
				{[-24, 18].map((x) => (
					<ellipse key={x} cx={x} cy={-4} rx={9} ry={6} fill={shade(c2, -0.1)} {...LINE} />
				))}
				<circle cx={38} cy={-26} r={12} fill={c2} {...LINE} />
				<path d="M -38,-10 C -38,-56 34,-56 34,-10 Z" fill={c1} {...LINE} />
				<path
					d="M -14,-38 L 2,-46 L 16,-38 L 14,-22 L -12,-22 Z M -14,-38 L -30,-16 M 16,-38 L 28,-16 M 2,-46 L 2,-52"
					stroke={shade(c1, -0.35)}
					strokeWidth={2.5}
					fill="none"
				/>
				<rect x={-40} y={-14} width={76} height={6} rx={3} fill={shade(c1, -0.2)} />
				{eye(42, -29, 2.8)}
				<path d="M 40,-21 q 4,3 8,0" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
			</g>
		),
	},
	"pet-frog": {
		neck: { x: 0, y: -30, w: 44 },
		head: { x: 0, y: -62 },
		draw: (c1, c2) => (
			<g>
				{[-1, 1].map((s) => (
					<ellipse key={s} cx={s * 26} cy={-6} rx={14} ry={7} fill={c1} {...LINE} />
				))}
				<ellipse cx={0} cy={-26} rx={34} ry={24} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-16} rx={20} ry={12} fill={c2} />
				{[-1, 1].map((s) => (
					<g key={s}>
						<circle cx={s * 16} cy={-46} r={11} fill={c1} {...LINE} />
						<circle cx={s * 16} cy={-46} r={7} fill="#fff" />
						{eye(s * 16, -46, 4)}
					</g>
				))}
				<path d="M -14,-30 Q 0,-20 14,-30" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
				{[-14, 10, 22].map((x, i) => (
					<circle key={x} cx={x} cy={-36 + i * 4} r={2.6} fill={shade(c1, -0.3)} />
				))}
			</g>
		),
	},
	"pet-hedgehog": {
		neck: { x: -22, y: -26, w: 20 },
		head: { x: -6, y: -54 },
		draw: (c1, c2) => {
			const spikes = Array.from({ length: 11 }, (_, i) => {
				const a = Math.PI + (Math.PI * i) / 10;
				const x0 = 6 + Math.cos(a) * 30;
				const y0 = -14 + Math.sin(a) * 30;
				return `${x0},${y0} ${6 + Math.cos(a + 0.14) * 44},${-14 + Math.sin(a + 0.14) * 44}`;
			});
			return (
				<g>
					<path d={`M -30,-10 L ${spikes.join(" L ")} L 40,-10 Z`} fill={c2} {...LINE} />
					<ellipse cx={4} cy={-14} rx={34} ry={14} fill={c2} />
					<path d="M -40,-10 C -40,-34 -16,-38 -4,-24 L -4,-6 Z" fill={c1} {...LINE} />
					<circle cx={-41} cy={-14} r={4} fill={INK} />
					{eye(-24, -24, 3)}
					{[-24, 14].map((x) => (
						<ellipse key={x} cx={x} cy={-3} rx={7} ry={4} fill={c1} {...LINE} />
					))}
				</g>
			);
		},
	},
	"pet-parrot": {
		neck: { x: 0, y: -118, w: 20 },
		head: { x: 0, y: -146 },
		draw: (c1, c2) => (
			<g>
				<rect x={-3} y={-74} width={6} height={74} fill="#8a5a3c" />
				<ellipse cx={0} cy={-2} rx={22} ry={4} fill="#8a5a3c" />
				<rect x={-30} y={-78} width={60} height={6} rx={3} fill="#8a5a3c" {...LINE} />
				<path d="M -4,-84 L -10,-46 L 2,-48 L 6,-84 Z" fill={c2} {...LINE} />
				<ellipse cx={0} cy={-100} rx={17} ry={26} fill={c1} {...LINE} />
				<path d="M 10,-112 C 26,-100 22,-80 8,-80 Z" fill={c2} {...LINE} />
				<circle cx={0} cy={-132} r={15} fill={c1} {...LINE} />
				<path d="M -14,-130 C -26,-128 -24,-116 -14,-120 Z" fill="#f2c94c" {...LINE} />
				{eye(-4, -136, 3.2)}
				{[-6, 6].map((x) => (
					<path key={x} d={`M ${x},-76 l -3,6 M ${x},-76 l 3,6`} stroke="#e8822e" strokeWidth={2.5} strokeLinecap="round" />
				))}
			</g>
		),
	},
	"pet-gecko": {
		neck: { x: 28, y: -16, w: 14 },
		head: { x: 38, y: -30 },
		draw: (c1, c2) => (
			<g>
				<path
					d="M -14,-12 C -40,-10 -52,-20 -44,-32 C -38,-40 -28,-30 -36,-26"
					stroke={c1}
					strokeWidth={10}
					fill="none"
					strokeLinecap="round"
				/>
				{[-10, 18].map((x) => (
					<path key={x} d={`M ${x},-12 l -8,10 M ${x},-12 l 8,10`} stroke={c1} strokeWidth={5} strokeLinecap="round" />
				))}
				<ellipse cx={4} cy={-14} rx={26} ry={10} fill={c1} {...LINE} />
				<ellipse cx={38} cy={-18} rx={14} ry={10} fill={c1} {...LINE} />
				{[-12, 0, 12, -30].map((x) => (
					<circle key={x} cx={x} cy={-16} r={3} fill={c2} />
				))}
				{eye(42, -21, 3.2)}
				{smile(44, -13, 3)}
			</g>
		),
	},
	"pet-snake": {
		neck: { x: 4, y: -54, w: 20 },
		head: { x: 8, y: -76 },
		draw: (c1, c2) => (
			<g>
				<ellipse cx={0} cy={-10} rx={38} ry={11} fill={c1} {...LINE} />
				<ellipse cx={0} cy={-24} rx={30} ry={10} fill={c1} {...LINE} />
				{[-26, -12, 2, 16].map((x) => (
					<path key={x} d={`M ${x},-18 l 6,0 M ${x + 4},-4 l 6,0`} stroke={c2} strokeWidth={5} strokeLinecap="round" />
				))}
				<path d="M 18,-28 C 24,-44 -6,-46 4,-60" stroke={c1} strokeWidth={14} fill="none" strokeLinecap="round" />
				<ellipse cx={8} cy={-66} rx={15} ry={11} fill={c1} {...LINE} />
				{eyes(5, -68, 3)}
				<path d={`M 8,-56 l 0,6 l -3,4 M 8,-50 l 3,4`} stroke="#e85d75" strokeWidth={1.8} fill="none" strokeLinecap="round" />
			</g>
		),
	},
	"pet-dragon": {
		neck: { x: 28, y: -22, w: 18 },
		head: { x: 38, y: -42 },
		draw: (c1, c2) => (
			<g>
				<path d="M -24,-12 C -52,-10 -60,-4 -66,-2" stroke={c1} strokeWidth={9} fill="none" strokeLinecap="round" />
				{[-12, 18].map((x) => (
					<path key={x} d={`M ${x},-12 l -6,12 M ${x},-12 l 6,12`} stroke={c1} strokeWidth={6} strokeLinecap="round" />
				))}
				<ellipse cx={2} cy={-16} rx={30} ry={13} fill={c1} {...LINE} />
				{[-18, -8, 2, 12].map((x) => (
					<path key={x} d={`M ${x},-28 l 4,-7 l 4,7`} fill={shade(c1, -0.2)} />
				))}
				<path d="M 26,-18 L 30,-4 L 36,-12 L 42,-2 L 46,-14 L 52,-8 L 50,-22 Z" fill={c2} {...LINE} />
				<ellipse cx={38} cy={-26} rx={16} ry={11} fill={c1} {...LINE} />
				{eye(42, -29, 3)}
				<path d="M 44,-20 q 5,2 9,-2" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
			</g>
		),
	},
};

export const PET_IDS = Object.keys(PETS);

const placed = (node: ReactNode) => <g transform={`translate(${PET_AT.x} ${PET_AT.y})`}>{node}</g>;

/** Accessories, placed from the pet's own anchors. */
type Wear = (a: Anchors, c1: string) => ReactNode;
const collar: Wear = ({ neck }, c1) => (
	<g>
		<rect x={neck.x - neck.w / 2} y={neck.y - 3} width={neck.w} height={7} rx={3.5} fill={c1} {...LINE} strokeWidth={1.5} />
		<circle cx={neck.x} cy={neck.y + 7} r={4} fill="#e8b93c" {...LINE} strokeWidth={1.2} />
	</g>
);
const bandana: Wear = ({ neck }, c1) => (
	<path
		d={`M ${neck.x - neck.w / 2 - 2},${neck.y - 3} L ${neck.x + neck.w / 2 + 2},${neck.y - 3} L ${neck.x},${neck.y + neck.w * 0.6} Z`}
		fill={c1}
		{...LINE}
		strokeWidth={1.5}
	/>
);
const hatOn =
	(draw: (x: number, y: number) => ReactNode): Wear =>
	({ head }) =>
		draw(head.x, head.y);

const PET_WEAR: Record<string, Wear> = {
	"petwear-collar": collar,
	"petwear-bow": ({ head }, c1) => (
		<g transform={`translate(${head.x + 10} ${head.y + 8})`}>
			<path d="M 0,0 L -12,-7 Q -15,0 -12,7 Z M 0,0 L 12,-7 Q 15,0 12,7 Z" fill={c1} {...LINE} strokeWidth={1.5} />
			<circle r={3} fill={shade(c1, -0.2)} />
		</g>
	),
	"petwear-bandana": bandana,
	"petwear-scarf": ({ neck }, c1) => (
		<g>
			<rect x={neck.x - neck.w / 2 - 3} y={neck.y - 5} width={neck.w + 6} height={10} rx={5} fill={c1} {...LINE} strokeWidth={1.5} />
			<rect x={neck.x + neck.w / 4} y={neck.y} width={8} height={18} rx={3} fill={c1} {...LINE} strokeWidth={1.5} />
			<rect x={neck.x + neck.w / 4} y={neck.y + 8} width={8} height={3} fill="#f7f3ea" />
		</g>
	),
	"petwear-partyhat": hatOn((x, y) => (
		<g>
			<path d={`M ${x - 11},${y + 4} L ${x},${y - 24} L ${x + 11},${y + 4} Z`} fill="#8a5bd1" {...LINE} strokeWidth={1.5} />
			<circle cx={x} cy={y - 25} r={4} fill="#f2c94c" />
		</g>
	)),
	"petwear-crown": hatOn((x, y) => (
		<path
			d={`M ${x - 13},${y + 4} L ${x - 14},${y - 12} L ${x - 6},${y - 4} L ${x},${y - 16} L ${x + 6},${y - 4} L ${x + 14},${y - 12} L ${x + 13},${y + 4} Z`}
			fill="#e8b93c"
			{...LINE}
			strokeWidth={1.5}
		/>
	)),
	// Holiday accessories.
	"petwear-hearts": (a) => (
		<g>
			{collar(a, "#e85d75")}
			<path d={heart(a.neck.x, a.neck.y + 9, 5)} fill="#e85d75" {...LINE} strokeWidth={1.2} />
		</g>
	),
	"petwear-pumpkin": (a) => (
		<g>
			{bandana(a, "#f08a3c")}
			<path d={star(a.neck.x, a.neck.y + a.neck.w * 0.2, 3.5)} fill="#2b2b33" />
		</g>
	),
	"petwear-santa": hatOn((x, y) => (
		<g>
			<path
				d={`M ${x - 13},${y + 4} C ${x - 10},${y - 18} ${x + 10},${y - 24} ${x + 20},${y - 10} L ${x + 13},${y + 4} Z`}
				fill="#d8413c"
				{...LINE}
				strokeWidth={1.5}
			/>
			<rect x={x - 15} y={y} width={30} height={7} rx={3.5} fill="#f7f3ea" {...LINE} strokeWidth={1.2} />
			<circle cx={x + 20} cy={y - 10} r={4} fill="#f7f3ea" />
		</g>
	)),
};

export const PET_ART: Record<string, Art> = {
	...Object.fromEntries(Object.entries(PETS).map(([id, pet]) => [id, ({ c1, c2 }) => ({ main: placed(pet.draw(c1, c2)) })])),
	...Object.fromEntries(
		Object.entries(PET_WEAR).map(([id, draw]) => [
			id,
			({ c1, pet }) => {
				const p = pet && PETS[pet];
				return p ? { main: placed(draw(p, c1)) } : {};
			},
		]),
	),
};
