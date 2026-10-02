import type { ReactNode } from "react";
import {
	ANKLE_Y,
	CX,
	dims,
	EAR_Y,
	EYE_DX,
	EYE_Y,
	footAt,
	HEAD,
	HIP_Y,
	handAt,
	INK,
	LINE,
	legPath,
	SHOULDER_Y,
	shade,
	WAIST_Y,
} from "../geometry.ts";
import { heart, star } from "./patterns.tsx";
import type { Art, ArtProps } from "./types.ts";

const TOP = HEAD.y - HEAD.ry - 14;
const GOLD = "#e8b93c";

// ── Shoes ──

/** A front-on shoe around the foot at (x, ANKLE_Y + 10), `w` wide, from `top` down to the sole. */
const shoe = (x: number, w: number, top = 582) =>
	`M ${x - w / 2},${top + 8} Q ${x - w / 2},${top} ${x - w / 2 + 8},${top} L ${x + w / 2 - 8},${top} Q ${x + w / 2},${top} ${x + w / 2},${top + 8} L ${x + w / 2 + 4},${604} Q ${x + w / 2 + 4},${614} ${x + w / 2 - 6},${614} L ${x - w / 2 + 6},${614} Q ${x - w / 2 - 4},${614} ${x - w / 2 - 4},${604} Z`;

function feet(p: ArtProps, draw: (x: number, w: number, s: 1 | -1) => ReactNode) {
	const d = dims(p.shape);
	return (
		<g>
			{([-1, 1] as const).map((s) => (
				<g key={s}>{draw(footAt(d, s).x, d.leg + 16, s)}</g>
			))}
		</g>
	);
}

/** A boot's shaft up the leg from the ankle to `top`. */
function shaft(p: ArtProps, s: 1 | -1, top: number, color: string) {
	const d = dims(p.shape);
	return (
		<>
			<path d={legPath(d, s, top, ANKLE_Y)} stroke={shade(color, -0.3)} strokeOpacity={0.6} strokeWidth={d.leg + 12} fill="none" />
			<path d={legPath(d, s, top, ANKLE_Y)} stroke={color} strokeWidth={d.leg + 8} fill="none" />
		</>
	);
}

const sole = (x: number, w: number, color: string) => <rect x={x - w / 2 - 4} y={606} width={w + 8} height={8} rx={4} fill={color} />;

const SHOES: Record<string, Art> = {
	"shoes-sneakers": (p) => ({
		main: feet(p, (x, w) => (
			<g>
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				{sole(x, w, p.c2)}
				<path d={`M ${x - 7},${588} L ${x + 7},${592} M ${x - 7},${596} L ${x + 7},${592}`} stroke={shade(p.c1, -0.4)} strokeWidth={2} />
			</g>
		)),
	}),
	"shoes-hightops": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				{shaft(p, s, 552, p.c1)}
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				{sole(x, w, "#f7f3ea")}
				<path d={star(x - s * 2, 568, 6)} fill={p.c2} />
			</g>
		)),
	}),
	"shoes-flats": (p) => ({ main: feet(p, (x, w) => <path d={shoe(x, w, 594)} fill={p.c1} {...LINE} />) }),
	"shoes-sandals": (p) => ({
		main: feet(p, (x, w) => (
			<g>
				{sole(x, w, shade(p.c1, -0.2))}
				<path
					d={`M ${x - w / 2},${592} L ${x + w / 2},${592} M ${x - w / 2 + 2},${601} L ${x + w / 2 - 2},${601}`}
					stroke={p.c1}
					strokeWidth={5}
					strokeLinecap="round"
				/>
			</g>
		)),
	}),
	"shoes-boots": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				{shaft(p, s, 520, p.c1)}
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				{sole(x, w, shade(p.c1, -0.45))}
				<path d={legPath(dims(p.shape), s, 520, 530)} stroke={shade(p.c1, -0.2)} strokeWidth={dims(p.shape).leg + 10} />
			</g>
		)),
	}),
	"shoes-rainboots": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				{shaft(p, s, 528, p.c1)}
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				<path
					d={legPath(dims(p.shape), s, 536, 572)}
					stroke="#fff"
					strokeOpacity={0.45}
					strokeWidth={4}
					transform={`translate(${-s * 8} 0)`}
				/>
			</g>
		)),
	}),
	"shoes-maryjanes": (p) => ({
		main: feet(p, (x, w) => (
			<g>
				<path d={shoe(x, w, 592)} fill={p.c1} {...LINE} />
				<path d={`M ${x - w / 2 + 2},${590} L ${x + w / 2 - 2},${590}`} stroke={p.c1} strokeWidth={5} strokeLinecap="round" />
				<circle cx={x + w / 2 - 6} cy={590} r={2.5} fill={GOLD} />
			</g>
		)),
	}),
	"shoes-cowboy": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				{shaft(p, s, 522, p.c1)}
				<path d={`M ${x - 8},${534} q 8,14 16,0`} stroke={shade(p.c1, 0.4)} strokeWidth={2.5} fill="none" />
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				{sole(x, w, shade(p.c1, -0.45))}
			</g>
		)),
	}),
	"shoes-slippers": (p) => ({
		main: feet(p, (x, w) => (
			<g>
				{[-1, 1].map((e) => (
					<ellipse key={e} cx={x + e * 8} cy={574} rx={6} ry={14} fill={p.c1} {...LINE} />
				))}
				<path d={shoe(x, w + 10, 580)} fill={p.c1} {...LINE} />
				{[-1, 1].map((e) => (
					<circle key={e} cx={x + e * 6} cy={594} r={2.5} fill={INK} />
				))}
				<circle cx={x} cy={601} r={3} fill="#e98a9c" />
			</g>
		)),
	}),
	"shoes-skates": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				{shaft(p, s, 554, p.c1)}
				<path d={shoe(x, w)} fill={p.c1} {...LINE} />
				{sole(x, w, "#f7f3ea")}
				{[-1, 1].map((e) => (
					<circle key={e} cx={x + e * (w / 2 - 4)} cy={622} r={8} fill={p.c2} {...LINE} />
				))}
			</g>
		)),
	}),
	"shoes-elf": (p) => ({
		main: feet(p, (x, w, s) => (
			<g>
				<path d={`${shoe(x, w)} M ${x + s * (w / 2)},${600} q ${s * 22},4 ${s * 18},-20`} fill={p.c1} {...LINE} />
				<circle cx={x + s * (w / 2 + 18)} cy={580} r={4.5} fill={GOLD} {...LINE} />
			</g>
		)),
	}),
};

// ── Hats ──

const dome = (bottom: number, w = 104, top = TOP - 6) => `M ${CX - w},${bottom} C ${CX - w},${top} ${CX + w},${top} ${CX + w},${bottom} Z`;
const band = (w = 102) => `M ${CX - w},${150} C ${CX - w},${TOP - 30} ${CX + w},${TOP - 30} ${CX + w},${150}`;

function flowerAt(x: number, y: number, color: string, r = 7) {
	return (
		<g key={`${x}${y}`}>
			{[0, 72, 144, 216, 288].map((a) => (
				<circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r * 0.75} fill={color} />
			))}
			<circle cx={x} cy={y} r={r * 0.55} fill="#f2c94c" />
		</g>
	);
}
/** Points along the headband arc, for flower and leaf crowns. */
const arc = (n: number) =>
	Array.from({ length: n }, (_, i) => {
		const a = Math.PI + (Math.PI * (i + 0.5)) / n;
		return { x: CX + Math.cos(a) * 100, y: 148 + Math.sin(a) * 90 };
	});

/** Wraps that cover the hair; the figure leaves the hair off under them. */
export const HIDES_HAIR = new Set(["hat-hijab", "hat-hijab-gold"]);

function hijab(p: ArtProps, color: string, trim?: string): { back: ReactNode; front: ReactNode } {
	const d = dims(p.shape);
	const face = `M ${CX},${HEAD.y - 82} C ${CX + 52},${HEAD.y - 82} ${CX + 78},${HEAD.y - 40} ${CX + 78},${HEAD.y + 6} C ${CX + 78},${HEAD.y + 62} ${CX + 44},${HEAD.y + 92} ${CX},${HEAD.y + 92} C ${CX - 44},${HEAD.y + 92} ${CX - 78},${HEAD.y + 62} ${CX - 78},${HEAD.y + 6} C ${CX - 78},${HEAD.y - 40} ${CX - 52},${HEAD.y - 82} ${CX},${HEAD.y - 82} Z`;
	const outer = `M ${CX},${TOP - 4} C ${CX + 80},${TOP - 4} ${CX + 112},${HEAD.y - 40} ${CX + 112},${HEAD.y + 30} C ${CX + 112},${HEAD.y + 90} ${CX + d.shoulder + 12},${SHOULDER_Y - 10} ${CX + d.shoulder + 6},${SHOULDER_Y + 40} L ${CX - d.shoulder - 6},${SHOULDER_Y + 40} C ${CX - d.shoulder - 12},${SHOULDER_Y - 10} ${CX - 112},${HEAD.y + 90} ${CX - 112},${HEAD.y + 30} C ${CX - 112},${HEAD.y - 40} ${CX - 80},${TOP - 4} ${CX},${TOP - 4} Z`;
	return {
		back: (
			<path
				d={`M ${CX - 112},${HEAD.y} L ${CX + 112},${HEAD.y} L ${CX + d.shoulder + 10},${SHOULDER_Y + 60} L ${CX - d.shoulder - 10},${SHOULDER_Y + 60} Z`}
				fill={shade(color, -0.12)}
			/>
		),
		front: (
			<g>
				<path d={`${outer} ${face}`} fillRule="evenodd" fill={color} {...LINE} />
				{trim && <path d={face} fill="none" stroke={trim} strokeWidth={5} />}
			</g>
		),
	};
}

const HATS: Record<string, Art> = {
	"hat-cap": (p) => ({
		front: (
			<g>
				<path d={dome(118, 102)} fill={p.c1} {...LINE} />
				<ellipse cx={CX} cy={118} rx={118} ry={13} fill={shade(p.c1, -0.18)} {...LINE} />
				<circle cx={CX} cy={TOP + 4} r={6} fill={shade(p.c1, -0.25)} />
			</g>
		),
	}),
	"hat-beanie": (p) => ({
		front: (
			<g>
				<path d={dome(132, 104, TOP - 20)} fill={p.c1} {...LINE} />
				<rect x={CX - 106} y={110} width={212} height={26} rx={12} fill={shade(p.c1, -0.15)} {...LINE} />
				{Array.from({ length: 13 }, (_, i) => (
					<path key={i} d={`M ${CX - 96 + i * 16},${113} l 0,20`} stroke={shade(p.c1, -0.3)} strokeWidth={2} />
				))}
			</g>
		),
	}),
	"hat-bow": (p) => ({
		front: (
			<g transform={`translate(${CX + 58} ${TOP + 26}) rotate(14)`}>
				<path d="M 0,0 L -34,-20 Q -42,0 -34,20 Z M 0,0 L 34,-20 Q 42,0 34,20 Z" fill={p.c1} {...LINE} />
				<circle r={8} fill={shade(p.c1, -0.15)} {...LINE} />
			</g>
		),
	}),
	"hat-headband": (p) => ({ front: <path d={band()} stroke={p.c1} strokeWidth={12} fill="none" strokeLinecap="round" /> }),
	"hat-hijab": (p) => hijab(p, p.c1),
	"hat-hijab-gold": (p) => hijab(p, p.c1, GOLD),
	"hat-headwrap": (p) => ({
		front: (
			<g>
				<path d={dome(130, 104, TOP - 30)} fill={p.c1} {...LINE} />
				{[0, 1, 2].map((i) => (
					<path
						key={i}
						d={`M ${CX - 96},${118 - i * 20} Q ${CX},${70 - i * 22} ${CX + 96},${118 - i * 20}`}
						stroke={p.c2}
						strokeWidth={6}
						fill="none"
					/>
				))}
				<circle cx={CX + 18} cy={TOP - 10} r={22} fill={p.c1} {...LINE} />
			</g>
		),
	}),
	"hat-flowers": () => ({ front: <g>{arc(7).map(({ x, y }, i) => flowerAt(x, y, ["#e66fb0", "#f6b6c8", "#a873d9"][i % 3]!))}</g> }),
	"hat-crown": () => ({
		front: (
			<g>
				<path
					d={`M ${CX - 54},${TOP + 22} L ${CX - 58},${TOP - 30} L ${CX - 28},${TOP - 4} L ${CX},${TOP - 40} L ${CX + 28},${TOP - 4} L ${CX + 58},${TOP - 30} L ${CX + 54},${TOP + 22} Z`}
					fill={GOLD}
					{...LINE}
				/>
				{[-30, 0, 30].map((dx, i) => (
					<circle key={dx} cx={CX + dx} cy={TOP + 8} r={6} fill={["#e85d75", "#5fa3e0", "#5fc9a3"][i]} />
				))}
			</g>
		),
	}),
	// Holiday hats.
	"hat-newyear": () => ({
		front: (
			<g>
				<path d={band(100)} stroke={GOLD} strokeWidth={8} fill="none" />
				{[-36, 0, 36].map((dx) => (
					<path key={dx} d={star(CX + dx, TOP + 14 - (dx === 0 ? 14 : 0), dx === 0 ? 18 : 12)} fill={GOLD} {...LINE} />
				))}
			</g>
		),
	}),
	"hat-hearts": () => ({
		front: (
			<g>
				<path d={band()} stroke="#e85d75" strokeWidth={10} fill="none" />
				{[-1, 1].map((s) => (
					<g key={s}>
						<path d={`M ${CX + s * 40},${TOP + 24} L ${CX + s * 52},${TOP - 16}`} stroke="#e85d75" strokeWidth={3} />
						<path d={heart(CX + s * 52, TOP - 22, 13)} fill="#e85d75" {...LINE} />
					</g>
				))}
			</g>
		),
	}),
	"hat-springflowers": () => ({ front: <g>{arc(3).map(({ x, y }) => flowerAt(x + 30, y + 8, "#bfe3f0", 9))}</g> }),
	"hat-bunnyears": () => ({
		front: (
			<g>
				<path d={band()} stroke="#f7f3ea" strokeWidth={9} fill="none" />
				{[-1, 1].map((s) => (
					<g key={s} transform={`rotate(${s * 10} ${CX + s * 40} ${TOP + 20})`}>
						<ellipse cx={CX + s * 40} cy={TOP - 34} rx={18} ry={50} fill="#f7f3ea" {...LINE} />
						<ellipse cx={CX + s * 40} cy={TOP - 30} rx={8} ry={36} fill="#f6b6c8" />
					</g>
				))}
			</g>
		),
	}),
	"hat-leaves": () => ({
		front: (
			<g>
				{arc(9).map(({ x, y }, i) => (
					<ellipse
						key={i}
						cx={x}
						cy={y}
						rx={9}
						ry={16}
						fill={i % 2 ? "#8cc152" : "#2f9e6b"}
						transform={`rotate(${(i - 4) * 18} ${x} ${y})`}
						{...LINE}
					/>
				))}
			</g>
		),
	}),
	"hat-witch": () => ({
		front: (
			<g>
				<path
					d={`M ${CX - 66},${TOP + 34} Q ${CX - 10},${TOP - 30} ${CX + 20},${TOP - 110} Q ${CX + 30},${TOP - 40} ${CX + 66},${TOP + 34} Z`}
					fill="#2b2b33"
					{...LINE}
				/>
				<rect x={CX - 60} y={TOP + 14} width={120} height={14} fill="#8a5bd1" />
				<ellipse cx={CX} cy={TOP + 34} rx={130} ry={16} fill="#2b2b33" {...LINE} />
			</g>
		),
	}),
	"hat-marigolds": () => ({ front: <g>{arc(8).map(({ x, y }, i) => flowerAt(x, y, i % 2 ? "#f08a3c" : "#f4cd4b", 8))}</g> }),
	"hat-autumnbeanie": (p) => ({
		front: (
			<g>
				<path d={dome(132, 104, TOP - 20)} fill={p.c1} {...LINE} />
				<rect x={CX - 106} y={110} width={212} height={26} rx={12} fill={shade(p.c1, -0.18)} {...LINE} />
				<path d={`M ${CX + 40},${TOP + 4} q 10,-26 30,-20 q -4,24 -30,20 Z`} fill="#b5452a" />
			</g>
		),
	}),
	"hat-pompom": (p) => ({
		front: (
			<g>
				<path d={dome(132, 104, TOP - 20)} fill={p.c1} {...LINE} />
				<rect x={CX - 106} y={110} width={212} height={26} rx={12} fill="#e8e2f0" {...LINE} />
				<circle cx={CX} cy={TOP - 22} r={18} fill="#e8e2f0" {...LINE} />
			</g>
		),
	}),
	"hat-santa": () => ({
		front: (
			<g>
				<path
					d={`M ${CX - 100},${126} C ${CX - 90},${TOP - 30} ${CX + 40},${TOP - 50} ${CX + 120},${TOP + 20} L ${CX + 100},${126} Z`}
					fill="#d8413c"
					{...LINE}
				/>
				<rect x={CX - 108} y={112} width={216} height={26} rx={13} fill="#f7f3ea" {...LINE} />
				<circle cx={CX + 122} cy={TOP + 24} r={16} fill="#f7f3ea" {...LINE} />
			</g>
		),
	}),
	"hat-gele": () => ({
		front: (
			<g>
				<path d={dome(128, 108, TOP - 50)} fill="#f4cd4b" {...LINE} />
				{[0, 1, 2, 3].map((i) => (
					<path
						key={i}
						d={`M ${CX - 110 + i * 10},${120 - i * 18} Q ${CX},${TOP - 30 - i * 10} ${CX + 120 - i * 6},${90 - i * 24}`}
						stroke="#d9692e"
						strokeWidth={5}
						fill="none"
					/>
				))}
				<path d={`M ${CX + 60},${TOP - 20} q 60,-30 70,20 q -30,0 -70,-20 Z`} fill="#f4cd4b" {...LINE} />
			</g>
		),
	}),
};

// ── Glasses ──

const frames = (color: string, lens: (x: number) => string) => (
	<g>
		{[-1, 1].map((s) => (
			<path key={s} d={lens(CX + s * EYE_DX)} fill="#bfe3f0" fillOpacity={0.25} stroke={color} strokeWidth={5} strokeLinejoin="round" />
		))}
		<path d={`M ${CX - 13},${EYE_Y - 4} Q ${CX},${EYE_Y - 12} ${CX + 13},${EYE_Y - 4}`} stroke={color} strokeWidth={4} fill="none" />
		{[-1, 1].map((s) => (
			<path key={s} d={`M ${CX + s * (EYE_DX + 24)},${EYE_Y - 6} L ${CX + s * 90},${EYE_Y - 10}`} stroke={color} strokeWidth={4} />
		))}
	</g>
);
const circle = (x: number, r = 23) => `M ${x - r},${EYE_Y} a ${r},${r} 0 1 0 ${r * 2},0 a ${r},${r} 0 1 0 ${-r * 2},0 Z`;

const GLASSES: Record<string, Art> = {
	"glasses-round": (p) => ({ main: frames(p.c1, (x) => circle(x)) }),
	"glasses-square": (p) => ({ main: frames(p.c1, (x) => `M ${x - 24},${EYE_Y - 18} h 48 v 34 h -48 Z`) }),
	"glasses-heart": (p) => ({ main: frames(p.c1, (x) => heart(x, EYE_Y - 2, 22)) }),
	"glasses-star": (p) => ({ main: frames(p.c1, (x) => star(x, EYE_Y + 2, 28, 0.55)) }),
	"glasses-newyear": (p) => ({ main: frames(p.c1, (x) => star(x, EYE_Y + 2, 30, 0.6, 6)) }),
};

// ── Earrings, at each earlobe ──

const lobes = (draw: (x: number, y: number) => ReactNode) => (
	<g>
		{[-1, 1].map((s) => (
			<g key={s}>{draw(HEAD.x + s * (HEAD.rx - 2), EAR_Y + 20)}</g>
		))}
	</g>
);

const EARRINGS: Record<string, Art> = {
	"earrings-studs": () => ({ main: lobes((x, y) => <circle cx={x} cy={y} r={4.5} fill="#bfe3f0" stroke="#fff" strokeWidth={1.5} />) }),
	"earrings-hoops": () => ({ main: lobes((x, y) => <circle cx={x} cy={y + 12} r={12} fill="none" stroke={GOLD} strokeWidth={3.5} />) }),
	"earrings-stars": () => ({ main: lobes((x, y) => <path d={star(x, y + 8, 9)} fill={GOLD} {...LINE} />) }),
	"earrings-drops": () => ({
		main: lobes((x, y) => (
			<g>
				<path d={`M ${x},${y} L ${x},${y + 10}`} stroke={GOLD} strokeWidth={2} />
				<path d={`M ${x},${y + 8} q 8,12 0,18 q -8,-6 0,-18 Z`} fill="#8a5bd1" />
			</g>
		)),
	}),
	"earrings-pearls": () => ({ main: lobes((x, y) => <circle cx={x} cy={y + 4} r={6} fill="#f7f3ea" {...LINE} />) }),
	"earrings-lantern": () => ({
		main: lobes((x, y) => (
			<g>
				<path d={`M ${x},${y} L ${x},${y + 8}`} stroke={GOLD} strokeWidth={2} />
				<ellipse cx={x} cy={y + 18} rx={8} ry={10} fill="#d8413c" {...LINE} />
				<path d={`M ${x - 4},${y + 30} L ${x + 4},${y + 30} M ${x},${y + 28} L ${x},${y + 38}`} stroke={GOLD} strokeWidth={2} />
			</g>
		)),
	}),
	"earrings-crescent": () => ({
		main: lobes((x, y) => <path d={`M ${x + 2},${y + 2} a 10,10 0 1 0 0,20 a 7,7 0 1 1 0,-20 Z`} fill={GOLD} {...LINE} />),
	}),
	"earrings-jhumka": () => ({
		main: lobes((x, y) => (
			<g>
				<circle cx={x} cy={y + 2} r={4} fill={GOLD} />
				<path d={`M ${x - 10},${y + 24} Q ${x},${y + 4} ${x + 10},${y + 24} Z`} fill={GOLD} {...LINE} />
				{[-6, 0, 6].map((dx) => (
					<circle key={dx} cx={x + dx} cy={y + 28} r={2.2} fill="#f7f3ea" />
				))}
			</g>
		)),
	}),
};

// ── Necklaces ──

const chain = (depth: number) => `M ${CX - 22},${SHOULDER_Y - 6} Q ${CX},${SHOULDER_Y + depth} ${CX + 22},${SHOULDER_Y - 6}`;
const beadsOn = (depth: number, n: number, color: (i: number) => string, r = 4.5) =>
	Array.from({ length: n }, (_, i) => {
		const t = i / (n - 1);
		const x = (1 - t) * (1 - t) * (CX - 22) + 2 * (1 - t) * t * CX + t * t * (CX + 22);
		const y = (1 - t) * (1 - t) * (SHOULDER_Y - 6) + 2 * (1 - t) * t * (SHOULDER_Y + depth) + t * t * (SHOULDER_Y - 6);
		return <circle key={i} cx={x} cy={y} r={r} fill={color(i)} {...LINE} strokeWidth={1} />;
	});

const NECKLACES: Record<string, Art> = {
	"necklace-heart": () => ({
		main: (
			<g>
				<path d={chain(34)} stroke={GOLD} strokeWidth={2.5} fill="none" />
				<path d={heart(CX, SHOULDER_Y + 16, 9)} fill={GOLD} {...LINE} />
			</g>
		),
	}),
	"necklace-beads": (p) => ({ main: <g>{beadsOn(30, 9, (i) => (i % 2 ? p.c1 : shade(p.c1, 0.4)))}</g> }),
	"necklace-pearls": () => ({ main: <g>{beadsOn(30, 11, () => "#f7f3ea", 4)}</g> }),
	"necklace-choker": (p) => ({ main: <path d={chain(6)} stroke={p.c1} strokeWidth={7} fill="none" strokeLinecap="round" /> }),
	"necklace-marigold": () => ({ main: <g>{beadsOn(70, 13, (i) => (i % 2 ? "#f08a3c" : "#f4cd4b"), 8)}</g> }),
	"necklace-crescent": () => ({
		main: (
			<g>
				<path d={chain(34)} stroke={GOLD} strokeWidth={2.5} fill="none" />
				<path d={`M ${CX + 2},${SHOULDER_Y + 6} a 11,11 0 1 0 0,22 a 8,8 0 1 1 0,-22 Z`} fill={GOLD} {...LINE} />
			</g>
		),
	}),
	"necklace-scarf": (p) => ({
		main: (
			<g>
				<path
					d={`M ${CX - 44},${SHOULDER_Y - 16} Q ${CX},${SHOULDER_Y + 12} ${CX + 44},${SHOULDER_Y - 16} L ${CX + 46},${SHOULDER_Y + 6} Q ${CX},${SHOULDER_Y + 34} ${CX - 46},${SHOULDER_Y + 6} Z`}
					fill={p.c1}
					{...LINE}
				/>
				<rect x={CX + 14} y={SHOULDER_Y + 10} width={22} height={70} rx={6} fill={p.c1} {...LINE} />
				{[0, 1].map((i) => (
					<rect key={i} x={CX + 14} y={SHOULDER_Y + 30 + i * 24} width={22} height={7} fill="#f7f3ea" />
				))}
			</g>
		),
	}),
	"necklace-kwanzaa": () => ({ main: <g>{beadsOn(36, 11, (i) => ["#d8413c", "#2b2b33", "#2f9e6b"][i % 3]!, 5)}</g> }),
};

// ── Bags ──

function strapped(p: ArtProps, color: string, body: (x: number, y: number) => ReactNode) {
	const d = dims(p.shape);
	const x = CX + d.hip + 12;
	return (
		<g>
			<path
				d={`M ${CX - d.shoulder + 14},${SHOULDER_Y + 2} L ${x - 6},${HIP_Y - 30}`}
				stroke={shade(color, -0.2)}
				strokeWidth={6}
				strokeLinecap="round"
			/>
			{body(x, HIP_Y - 26)}
		</g>
	);
}

function carried(p: ArtProps, body: (x: number, y: number) => ReactNode) {
	const h = handAt(dims(p.shape), 1);
	return body(h.x, h.y);
}

const BAGS: Record<string, Art> = {
	"bag-backpack": (p) => {
		const d = dims(p.shape);
		return {
			back: (
				<rect
					x={CX - d.shoulder - 10}
					y={SHOULDER_Y + 10}
					width={(d.shoulder + 10) * 2}
					height={130}
					rx={24}
					fill={shade(p.c1, -0.1)}
					{...LINE}
				/>
			),
			main: (
				<g>
					{[-1, 1].map((s) => (
						<path
							key={s}
							d={`M ${CX + s * (d.shoulder - 18)},${SHOULDER_Y - 2} L ${CX + s * (d.waist - 8)},${WAIST_Y + 10}`}
							stroke={p.c1}
							strokeWidth={10}
							strokeLinecap="round"
						/>
					))}
				</g>
			),
		};
	},
	"bag-purse": (p) => ({
		main: strapped(p, p.c1, (x, y) => <rect x={x - 22} y={y} width={44} height={34} rx={8} fill={p.c1} {...LINE} />),
	}),
	"bag-tote": (p) => ({
		main: carried(p, (x, y) => (
			<g>
				<path d={`M ${x - 14},${y + 10} Q ${x},${y - 18} ${x + 14},${y + 10}`} stroke={shade(p.c1, -0.25)} strokeWidth={4} fill="none" />
				<path d={`M ${x - 26},${y + 10} L ${x + 26},${y + 10} L ${x + 30},${y + 70} L ${x - 30},${y + 70} Z`} fill={p.c1} {...LINE} />
			</g>
		)),
	}),
	"bag-fan": (p) => ({
		main: carried(p, (x, y) => (
			<g transform={`translate(${x} ${y}) rotate(-30)`}>
				<path d="M 0,0 L -40,-46 A 60,60 0 0 1 40,-46 Z" fill="#d8413c" {...LINE} />
				{[-28, -10, 10, 28].map((dx) => (
					<path key={dx} d={`M 0,0 L ${dx},-52`} stroke={GOLD} strokeWidth={2} />
				))}
			</g>
		)),
	}),
	"bag-heart": (p) => ({ main: strapped(p, p.c1, (x, y) => <path d={heart(x, y + 14, 20)} fill={p.c1} {...LINE} />) }),
	"bag-lantern": (p) => ({
		main: carried(p, (x, y) => (
			<g>
				<path d={`M ${x},${y} L ${x},${y + 14}`} stroke={GOLD} strokeWidth={3} />
				<path
					d={`M ${x - 16},${y + 26} L ${x},${y + 14} L ${x + 16},${y + 26} L ${x + 16},${y + 60} L ${x - 16},${y + 60} Z`}
					fill={GOLD}
					{...LINE}
				/>
				<rect x={x - 9} y={y + 30} width={18} height={24} rx={4} fill="#fbe9a8" />
			</g>
		)),
	}),
	"bag-basket": (p) => ({
		main: carried(p, (x, y) => (
			<g>
				<path d={`M ${x - 22},${y + 18} Q ${x},${y - 20} ${x + 22},${y + 18}`} stroke="#b0894f" strokeWidth={5} fill="none" />
				{[
					["#f6b6c8", -12],
					["#bfe3f0", 2],
					["#f4cd4b", 14],
				].map(([c, dx]) => (
					<ellipse key={c} cx={x + Number(dx)} cy={y + 14} rx={8} ry={10} fill={c as string} {...LINE} />
				))}
				<path d={`M ${x - 28},${y + 18} L ${x + 28},${y + 18} L ${x + 22},${y + 52} L ${x - 22},${y + 52} Z`} fill="#c9a26b" {...LINE} />
			</g>
		)),
	}),
	"bag-earthtote": (p) => ({
		main: carried(p, (x, y) => (
			<g>
				<path d={`M ${x - 14},${y + 10} Q ${x},${y - 18} ${x + 14},${y + 10}`} stroke={shade(p.c1, -0.25)} strokeWidth={4} fill="none" />
				<path d={`M ${x - 26},${y + 10} L ${x + 26},${y + 10} L ${x + 30},${y + 70} L ${x - 30},${y + 70} Z`} fill={p.c1} {...LINE} />
				<ellipse cx={x} cy={y + 42} rx={8} ry={14} fill="#2f9e6b" transform={`rotate(30 ${x} ${y + 42})`} />
			</g>
		)),
	}),
};

export const EXTRAS_ART: Record<string, Art> = { ...SHOES, ...HATS, ...GLASSES, ...EARRINGS, ...NECKLACES, ...BAGS };
