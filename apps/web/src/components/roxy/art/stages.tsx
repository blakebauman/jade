import type { ReactNode } from "react";
import { INK, LINE, VIEW } from "../geometry.ts";
import { heart, star } from "./patterns.tsx";
import type { Art } from "./types.ts";

const W = VIEW.w;
const H = VIEW.h;
const FLOOR = 560;

/** A sky that fades between two colours, and the ground the character stands on. */
function scene(uid: string, key: string, sky: [string, string], ground: string, extra?: ReactNode, groundY = FLOOR) {
	const id = `${uid}-${key}`;
	return (
		<g>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={sky[0]} />
					<stop offset="1" stopColor={sky[1]} />
				</linearGradient>
			</defs>
			<rect width={W} height={H} fill={`url(#${id})`} />
			<rect y={groundY} width={W} height={H - groundY} fill={ground} />
			{extra}
			<ellipse cx={W / 2} cy={614} rx={100} ry={14} fill={INK} fillOpacity={0.18} />
		</g>
	);
}

const stars = (n: number, seed = 1, maxY = 300) =>
	Array.from({ length: n }, (_, i) => {
		const x = (i * 97 + seed * 31) % W;
		const y = 20 + ((i * 53 + seed * 17) % maxY);
		return <path key={i} d={star(x, y, 3 + (i % 3) * 1.5)} fill="#fff8d6" fillOpacity={0.85} />;
	});

const flower = (x: number, y: number, color: string, r = 6) => (
	<g key={`${x}-${y}`}>
		{[0, 72, 144, 216, 288].map((a) => (
			<circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r * 0.7} fill={color} />
		))}
		<circle cx={x} cy={y} r={r * 0.5} fill="#f4cd4b" />
	</g>
);

const lantern = (x: number, y: number, color = "#d8413c", glow = "#f4cd4b") => (
	<g key={`${x}-${y}`}>
		<path d={`M ${x},${y - 20} L ${x},${y - 12}`} stroke={INK} strokeOpacity={0.5} strokeWidth={2} />
		<ellipse cx={x} cy={y + 4} rx={18} ry={16} fill={color} {...LINE} />
		<rect x={x - 10} y={y - 14} width={20} height={5} fill={glow} />
		<rect x={x - 10} y={y + 17} width={20} height={5} fill={glow} />
		<path d={`M ${x},${y + 22} L ${x},${y + 34}`} stroke={glow} strokeWidth={2} />
	</g>
);

const string = (y: number) => (
	<path d={`M -10,${y - 30} Q ${W / 2},${y + 10} ${W + 10},${y - 30}`} stroke={INK} strokeOpacity={0.4} strokeWidth={2} fill="none" />
);

/** A candle with a still flame. */
const candle = (x: number, y: number, h: number, color: string, lit = true) => (
	<g key={`${x}-${y}`}>
		<rect x={x - 5} y={y - h} width={10} height={h} rx={2} fill={color} {...LINE} strokeWidth={1.5} />
		{lit && <path d={`M ${x},${y - h - 16} q 7,9 0,14 q -7,-5 0,-14 Z`} fill="#f4cd4b" />}
	</g>
);

const table = (y: number, color = "#8a5a3c") => <rect x={-10} y={y} width={W + 20} height={H - y} fill={color} />;

const STAGES: Record<string, Art> = {
	"stage-felt": ({ uid }) => ({
		main: scene(
			uid,
			"felt",
			["#135c4e", "#093a31"],
			"#0e4f43",
			<ellipse cx={W / 2} cy={330} rx={190} ry={280} fill="#1a6a5a" fillOpacity={0.35} />,
		),
	}),
	"stage-meadow": ({ uid }) => ({
		main: scene(
			uid,
			"meadow",
			["#bfe3f0", "#f0f8ec"],
			"#8cc152",
			<g>
				<circle cx={330} cy={80} r={34} fill="#f4cd4b" />
				<path d={`M 0,520 Q 100,460 200,510 T ${W},500 L ${W},${FLOOR + 10} L 0,${FLOOR + 10} Z`} fill="#6faa3c" />
				{[30, 90, 300, 360, 60, 340].map((x, i) => flower(x, 590 + (i % 3) * 14, ["#e66fb0", "#f7f3ea", "#a873d9"][i % 3]!))}
			</g>,
		),
	}),
	"stage-beach": ({ uid }) => ({
		main: scene(
			uid,
			"beach",
			["#7cc8e8", "#d8f0f8"],
			"#f1d9a6",
			<g>
				<rect y={470} width={W} height={90} fill="#3cb6c9" />
				<path
					d={`M 0,${FLOOR} Q 50,${FLOOR - 12} 100,${FLOOR} T 200,${FLOOR} T 300,${FLOOR} T ${W},${FLOOR} L ${W},${FLOOR + 6} L 0,${FLOOR + 6} Z`}
					fill="#f7f3ea"
				/>
				<circle cx={70} cy={90} r={30} fill="#f4cd4b" />
			</g>,
		),
	}),
	"stage-night": ({ uid }) => ({
		main: scene(
			uid,
			"night",
			["#141c3d", "#2b3f7a"],
			"#1f3a33",
			<g>
				{stars(26)}
				<path d="M 330,60 a 30,30 0 1 0 22,52 a 24,24 0 1 1 -22,-52 Z" fill="#fff8d6" />
			</g>,
		),
	}),
	"stage-city": ({ uid }) => ({
		main: scene(
			uid,
			"city",
			["#f6b6c8", "#fbe3c8"],
			"#9aa3ad",
			<g>
				{[
					[0, 300, 70],
					[60, 220, 60],
					[110, 340, 80],
					[250, 260, 70],
					[310, 200, 90],
				].map(([x, y, w]) => (
					<g key={x}>
						<rect x={x} y={y} width={w} height={FLOOR - y!} fill="#6b7a93" />
						{Array.from({ length: 6 }, (_, i) => (
							<rect key={i} x={x! + 10 + (i % 2) * (w! / 2)} y={y! + 20 + Math.floor(i / 2) * 40} width={14} height={18} fill="#fbe9a8" />
						))}
					</g>
				))}
			</g>,
		),
	}),
	"stage-castle": ({ uid }) => ({
		main: scene(
			uid,
			"castle",
			["#e8d9f7", "#f6b6c8"],
			"#8cc152",
			<g fill="#f7c6d9" {...LINE}>
				<rect x={40} y={260} width={320} height={300} />
				{[40, 300].map((x) => (
					<g key={x}>
						<rect x={x} y={170} width={60} height={390} />
						<path d={`M ${x - 8},${172} L ${x + 30},${100} L ${x + 68},${172} Z`} fill="#a873d9" />
					</g>
				))}
				<path d="M 160,560 L 160,440 Q 200,400 240,440 L 240,560 Z" fill="#a873d9" />
			</g>,
		),
	}),
	// Holiday stages.
	"stage-newyear": ({ uid }) => ({
		main: scene(
			uid,
			"ny",
			["#10183a", "#2b2f6b"],
			"#1f2440",
			<g>
				{stars(14, 3)}
				{(
					[
						[90, 120, "#f4cd4b"],
						[300, 90, "#e66fb0"],
						[220, 220, "#5fc9a3"],
					] as const
				).map(([x, y, c]) => (
					<g key={x} stroke={c} strokeWidth={3} strokeLinecap="round">
						{Array.from({ length: 12 }, (_, i) => {
							const a = (i / 12) * Math.PI * 2;
							return (
								<path key={i} d={`M ${x + Math.cos(a) * 14},${y + Math.sin(a) * 14} L ${x + Math.cos(a) * 40},${y + Math.sin(a) * 40}`} />
							);
						})}
					</g>
				))}
			</g>,
		),
	}),
	"stage-lunar": ({ uid }) => ({
		main: scene(
			uid,
			"lunar",
			["#8f1d1d", "#d8413c"],
			"#5c1414",
			<g>
				{string(80)}
				{[40, 120, 200, 280, 360].map((x, i) => lantern(x, 70 + Math.abs(2 - i) * -8 + 20))}
				{[60, 340].map((x) => (
					<path key={x} d={`M ${x - 30},${300} q 30,-40 60,0 q -30,40 -60,0 Z`} fill="#e8b93c" fillOpacity={0.35} />
				))}
			</g>,
		),
	}),
	"stage-valentines": ({ uid }) => ({
		main: scene(
			uid,
			"val",
			["#f6b6c8", "#fbe3ec"],
			"#e66fb0",
			<g>
				{[
					[60, 90, 22],
					[330, 140, 28],
					[90, 300, 16],
					[320, 360, 18],
					[200, 50, 14],
				].map(([x, y, s]) => (
					<path key={x} d={heart(x!, y!, s!)} fill="#e85d75" fillOpacity={0.55} />
				))}
			</g>,
		),
	}),
	"stage-holi": ({ uid }) => ({
		main: scene(
			uid,
			"holi",
			["#fdf2d8", "#fbe3ec"],
			"#f2c94c",
			<g>
				{(
					[
						[60, 120, "#e85d75"],
						[320, 90, "#5fa3e0"],
						[200, 200, "#5fc9a3"],
						[90, 380, "#a873d9"],
						[330, 360, "#f08a3c"],
					] as const
				).map(([x, y, c]) => (
					<g key={x} fill={c} fillOpacity={0.45}>
						<circle cx={x} cy={y} r={50} />
						<circle cx={x + 40} cy={y + 20} r={30} />
						<circle cx={x - 30} cy={y + 30} r={26} />
					</g>
				))}
			</g>,
		),
	}),
	"stage-eid": ({ uid }) => ({
		main: scene(
			uid,
			"eid",
			["#16224a", "#3d5aa8"],
			"#26386b",
			<g>
				{stars(18, 5, 260)}
				<path d="M 300,60 a 40,40 0 1 0 30,70 a 32,32 0 1 1 -30,-70 Z" fill="#f4cd4b" />
				{string(70)}
				{[50, 130, 210].map((x) => lantern(x, 90, "#e8b93c", "#fbe9a8"))}
			</g>,
		),
	}),
	"stage-passover": ({ uid }) => ({
		main: scene(
			uid,
			"passover",
			["#e3f3ec", "#fdf6e3"],
			"#c9b28c",
			<g>
				{table(520, "#f7f3ea")}
				<rect y={500} width={W} height={22} fill="#bfe3f0" />
				<ellipse cx={80} cy={512} rx={46} ry={12} fill="#f7f3ea" {...LINE} />
				{[-24, -8, 8, 24].map((dx, i) => (
					<circle key={dx} cx={80 + dx} cy={507} r={6} fill={["#8cc152", "#f7f3ea", "#c9a26b", "#b5452a"][i]} />
				))}
				{[310, 340].map((x) => (
					<g key={x}>
						<path d={`M ${x - 9},${470} L ${x + 9},${470} L ${x + 5},${492} L ${x - 5},${492} Z`} fill="#d9e8f0" {...LINE} />
						<rect x={x - 1.5} y={492} width={3} height={10} fill="#d9e8f0" />
					</g>
				))}
				{[40, 200, 360].map((x) => (
					<g key={x}>
						<path d={`M ${x},${300} L ${x},${380}`} stroke="#2f9e6b" strokeWidth={3} />
						{flower(x, 296, "#f6b6c8", 9)}
					</g>
				))}
			</g>,
		),
	}),
	"stage-easter": ({ uid }) => ({
		main: scene(
			uid,
			"easter",
			["#e8d9f7", "#f0f8ec"],
			"#8cc152",
			<g>
				{[
					[50, 580, "#f6b6c8"],
					[100, 600, "#bfe3f0"],
					[300, 585, "#f4cd4b"],
					[350, 604, "#e8d9f7"],
				].map(([x, y, c]) => (
					<g key={x}>
						<ellipse cx={x as number} cy={y as number} rx={14} ry={18} fill={c as string} {...LINE} />
						<path d={`M ${(x as number) - 13},${y} q 13,-8 26,0`} stroke="#fff" strokeWidth={3} fill="none" />
					</g>
				))}
				{[40, 160, 260, 380].map((x) => flower(x, 548, "#f7f3ea"))}
			</g>,
		),
	}),
	"stage-earth": ({ uid }) => ({
		main: scene(
			uid,
			"earth",
			["#7cc8e8", "#e3f3ec"],
			"#6faa3c",
			<g>
				<circle cx={310} cy={110} r={56} fill="#3d74c9" {...LINE} />
				<path d="M 280,80 q 20,-12 34,4 q 6,20 -14,26 q -20,4 -20,-30 Z M 320,120 q 24,-10 30,10 q -10,20 -30,10 Z" fill="#8cc152" />
				{[50, 120].map((x) => (
					<g key={x}>
						<rect x={x - 8} y={420} width={16} height={140} fill="#8a5a3c" />
						<circle cx={x} cy={400} r={44} fill="#2f9e6b" {...LINE} />
					</g>
				))}
			</g>,
		),
	}),
	"stage-eidaladha": ({ uid }) => ({
		main: scene(
			uid,
			"adha",
			["#2b2650", "#c77d5e"],
			"#5c3a21",
			<g>
				{stars(12, 9, 200)}
				<path d="M 80,70 a 34,34 0 1 0 26,60 a 27,27 0 1 1 -26,-60 Z" fill="#f4cd4b" />
				{[0, 1, 2, 3].map((i) => (
					<path
						key={i}
						d={`M ${i * 110 - 20},${FLOOR} L ${i * 110 + 20},${470} L ${i * 110 + 60},${FLOOR} Z`}
						fill="#8a5a3c"
						fillOpacity={0.6}
					/>
				))}
				{[260, 340].map((x) => lantern(x, 160, "#2f9e6b", "#f4cd4b"))}
			</g>,
		),
	}),
	"stage-halloween": ({ uid }) => ({
		main: scene(
			uid,
			"hallow",
			["#2b1f45", "#5c3a7a"],
			"#2b2b33",
			<g>
				<circle cx={310} cy={100} r={50} fill="#f08a3c" />
				{stars(10, 7, 220)}
				{[60, 340].map((x) => (
					<g key={x}>
						<ellipse cx={x} cy={584} rx={34} ry={26} fill="#f08a3c" {...LINE} />
						{[-14, 14].map((dx) => (
							<path key={dx} d={`M ${x + dx - 6},${578} l 6,-8 l 6,8 Z`} fill="#2b1f45" />
						))}
						<path d={`M ${x - 12},${592} q 12,8 24,0`} stroke="#2b1f45" strokeWidth={3} fill="none" />
						<rect x={x - 3} y={552} width={6} height={10} fill="#2f9e6b" />
					</g>
				))}
			</g>,
		),
	}),
	"stage-dia": ({ uid }) => ({
		main: scene(
			uid,
			"dia",
			["#5c2a5c", "#d9692e"],
			"#5c3a21",
			<g>
				{[40, 110].map((y, row) => (
					<g key={y}>
						{string(y)}
						{Array.from({ length: 6 }, (_, i) => (
							<path
								key={i}
								d={`M ${i * 70 + row * 35},${y - 24 + Math.abs(2.5 - i) * -3} h 44 v 40 l -8,-6 l -7,6 l -7,-6 l -7,6 l -7,-6 l -8,6 Z`}
								fill={["#e85d75", "#f4cd4b", "#5fc9a3", "#5fa3e0", "#a873d9", "#f08a3c"][(i + row) % 6]}
							/>
						))}
					</g>
				))}
				{[20, 70, 120, 280, 330, 380].map((x, i) => flower(x, 552 + (i % 2) * 10, i % 2 ? "#f08a3c" : "#f4cd4b", 9))}
				{[60, 340].map((x) => candle(x, 540, 40, "#f7f3ea"))}
			</g>,
		),
	}),
	"stage-diwali": ({ uid }) => ({
		main: scene(
			uid,
			"diwali",
			["#1f1442", "#5c2a5c"],
			"#3b2650",
			<g>
				{stars(16, 11, 260)}
				{[30, 90, 150, 250, 310, 370].map((x) => (
					<g key={x}>
						<path d={`M ${x - 18},${548} Q ${x},${572} ${x + 18},${548} Z`} fill="#c77d5e" {...LINE} />
						<path d={`M ${x},${528} q 8,10 0,18 q -8,-8 0,-18 Z`} fill="#f4cd4b" />
					</g>
				))}
				<g transform="translate(200 600)">
					{[0, 45, 90, 135].map((a) => (
						<ellipse
							key={a}
							rx={70}
							ry={10}
							fill="none"
							stroke={["#e85d75", "#f4cd4b", "#5fc9a3", "#5fa3e0"][a / 45]}
							strokeWidth={4}
							transform={`rotate(${a}) scale(1 1)`}
						/>
					))}
				</g>
			</g>,
		),
	}),
	"stage-autumn": ({ uid }) => ({
		main: scene(
			uid,
			"autumn",
			["#fbe3c8", "#f0a07a"],
			"#8a5a3c",
			<g>
				{[
					[60, 80, "#d9692e"],
					[150, 160, "#b5452a"],
					[320, 60, "#f4cd4b"],
					[280, 220, "#d9692e"],
					[40, 320, "#f4cd4b"],
					[360, 380, "#b5452a"],
					[100, 580, "#d9692e"],
					[300, 590, "#f4cd4b"],
				].map(([x, y, c], i) => (
					<ellipse
						key={i}
						cx={x as number}
						cy={y as number}
						rx={12}
						ry={20}
						fill={c as string}
						transform={`rotate(${i * 40} ${x} ${y})`}
						{...LINE}
					/>
				))}
			</g>,
		),
	}),
	"stage-hanukkah": ({ uid }) => ({
		main: scene(
			uid,
			"hanukkah",
			["#1c2f6b", "#3d74c9"],
			"#26386b",
			<g>
				{stars(14, 13, 240)}
				{table(500, "#e8e2f0")}
				<g transform="translate(330 500)">
					<rect x={-4} y={-50} width={8} height={50} fill="#e8b93c" />
					<rect x={-24} y={-4} width={48} height={8} rx={4} fill="#e8b93c" />
					<path d="M -60,-50 Q 0,-10 60,-50" stroke="#e8b93c" strokeWidth={4} fill="none" />
					{[-60, -45, -30, -15, 15, 30, 45, 60].map((x) => candle(x, -48 + Math.abs(x) * 0.02, 22, "#bfe3f0"))}
					{candle(0, -60, 26, "#bfe3f0")}
				</g>
			</g>,
		),
	}),
	"stage-christmas": ({ uid }) => ({
		main: scene(
			uid,
			"xmas",
			["#1c3a5c", "#5f8fb8"],
			"#f7f3ea",
			<g>
				{Array.from({ length: 24 }, (_, i) => (
					<circle key={i} cx={(i * 71) % W} cy={20 + ((i * 47) % 500)} r={3 + (i % 3)} fill="#fff" fillOpacity={0.85} />
				))}
				<g transform="translate(330 560)">
					<rect x={-10} y={-20} width={20} height={22} fill="#8a5a3c" />
					{[0, 1, 2].map((i) => (
						<path
							key={i}
							d={`M ${-60 + i * 12},${-18 - i * 50} L 0,${-90 - i * 50} L ${60 - i * 12},${-18 - i * 50} Z`}
							fill="#2f9e6b"
							{...LINE}
						/>
					))}
					<path d={star(0, -200, 16)} fill="#f4cd4b" />
					{[
						[-30, -40, "#d8413c"],
						[24, -60, "#f4cd4b"],
						[-12, -100, "#3cb6c9"],
						[18, -130, "#d8413c"],
					].map(([x, y, c]) => (
						<circle key={`${x}${y}`} cx={x as number} cy={y as number} r={6} fill={c as string} />
					))}
				</g>
			</g>,
		),
	}),
	"stage-kwanzaa": ({ uid }) => ({
		main: scene(
			uid,
			"kwanzaa",
			["#2b1d14", "#7d4f2c"],
			"#5c3a21",
			<g>
				{table(500, "#8a5a3c")}
				{Array.from({ length: 10 }, (_, i) => (
					<rect key={i} x={i * 40} y={500} width={40} height={14} fill={["#2f9e6b", "#e0a526", "#b3263f", "#2b2b33"][i % 4]} />
				))}
				<g transform="translate(320 500)">
					<rect x={-64} y={-12} width={128} height={12} rx={4} fill="#5c3a21" {...LINE} />
					{[-54, -36, -18, 0, 18, 36, 54].map((x, i) => candle(x, -12, 34, i < 3 ? "#b3263f" : i === 3 ? "#2b2b33" : "#2f9e6b"))}
				</g>
			</g>,
		),
	}),
};

export const STAGE_ART: Record<string, Art> = STAGES;
