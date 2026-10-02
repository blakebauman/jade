import type { ReactNode } from "react";
import { CX, HEAD, LINE, shade } from "../geometry.ts";
import type { Art } from "./types.ts";

type Fringe = "straight" | "part" | "swept" | "high";
const TOP = HEAD.y - HEAD.ry - 14;

/** The hair over the top of the head, down to `side` at the temples, cut along the face by the fringe. */
function crown(fringe: Fringe, w = 100, side = 200) {
	const outer = `M ${CX - w},${side} C ${CX - w - 4},${TOP + 34} ${CX - 58},${TOP} ${CX},${TOP} C ${CX + 58},${TOP} ${CX + w + 4},${TOP + 34} ${CX + w},${side}`;
	const ins = w - 17;
	const inner = {
		straight: `L ${CX + ins},${side} Q ${CX + ins - 2},${132} ${CX + ins - 18},${130} L ${CX - ins + 18},${130} Q ${CX - ins + 2},${132} ${CX - ins},${side}`,
		part: `L ${CX + ins},${side} C ${CX + ins - 4},${120} ${CX + 34},${98} ${CX + 2},${104} L ${CX - 2},${104} C ${CX - 34},${98} ${CX - ins + 4},${120} ${CX - ins},${side}`,
		swept: `L ${CX + ins},${side} C ${CX + ins - 2},${118} ${CX + 40},${98} ${CX},${106} C ${CX - 46},${116} ${CX - ins + 6},${138} ${CX - ins},${side}`,
		high: `L ${CX + ins},${side} C ${CX + ins - 6},${104} ${CX + 40},${92} ${CX},${94} C ${CX - 40},${92} ${CX - ins + 6},${104} ${CX - ins},${side}`,
	}[fringe];
	return `${outer} ${inner} Z`;
}

/** Long strands falling in front of the shoulders. */
const locks = (w: number, len: number, wave = false) =>
	([-1, 1] as const).map((s) => {
		const x = CX + s * w;
		const tip = `${x - s * -6},${len}`;
		return wave
			? `M ${x},${170} C ${x + s * 18},${220} ${x - s * 8},${260} ${x + s * 12},${300} C ${x + s * 26},${340} ${x + s * 4},${len - 20} ${tip} L ${x - s * 26},${len - 30} C ${x - s * 10},${330} ${x - s * 30},${280} ${x - s * 16},${230} C ${x - s * 8},${200} ${x - s * 18},${186} ${x - s * 18},${176} Z`
			: `M ${x},${170} C ${x + s * 12},${250} ${x + s * 8},${330} ${tip} L ${x - s * 24},${len - 24} C ${x - s * 14},${320} ${x - s * 16},${240} ${x - s * 18},${176} Z`;
	});

/** A big shape behind the head and shoulders. */
const longBack = (len: number, w = 108) =>
	`M ${CX - w + 4},${150} C ${CX - w - 6},${TOP - 4} ${CX + w + 6},${TOP - 4} ${CX + w - 4},${150} L ${CX + w + 10},${len - 16} Q ${CX + w - 10},${len + 6} ${CX + 50},${len - 4} L ${CX - 50},${len - 4} Q ${CX - w + 10},${len + 6} ${CX - w - 10},${len - 16} Z`;

const wavyBack = (len: number, w = 112) => {
	const n = 5;
	const step = (len - 170) / n;
	const ys = Array.from({ length: n }, (_, i) => 170 + step * (i + 1));
	const right = ys.map((y, i) => `Q ${CX + w + (i % 2 ? -14 : 18)},${y - step / 2} ${CX + w + 2},${y}`).join(" ");
	const up = [...ys.slice(0, -1).reverse(), 170];
	const left = up.map((y, i) => `Q ${CX - w - (i % 2 ? 18 : -14)},${y + step / 2} ${CX - w - 2},${y}`).join(" ");
	return `M ${CX - w + 6},${150} C ${CX - w - 6},${TOP - 4} ${CX + w + 6},${TOP - 4} ${CX + w - 6},${150} L ${CX + w + 2},${170} ${right} Q ${CX},${len + 18} ${CX - w - 2},${len} ${left} Z`;
};

/** A bumpy outline from circles, for curls and coils. */
const cloud = (cx: number, cy: number, rx: number, ry: number, n: number, r: number) =>
	Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, r };
	});

type Style = (c: { hair: string; dark: string; light: string; uid: string }) => { back?: ReactNode; front?: ReactNode };
const fill = (color: string) => ({ fill: color, ...LINE });

const STYLES: Record<string, Style> = {
	"hair-buzz": ({ hair }) => ({
		front: <path d={crown("high", 94, 168)} fill={hair} fillOpacity={0.88} />,
	}),
	"hair-pixie": ({ hair, light }) => ({
		front: (
			<g>
				<path d={crown("swept", 100, 192)} {...fill(hair)} />
				<path
					d={`M ${CX + 30},${TOP + 16} C ${CX - 10},${TOP + 30} ${CX - 40},${TOP + 46} ${CX - 64},${TOP + 70}`}
					stroke={light}
					strokeWidth={5}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		),
	}),
	"hair-bob": ({ hair, dark }) => ({
		back: <path d={longBack(272, 110)} {...fill(dark)} />,
		front: (
			<g>
				<path d={crown("straight", 104, 230)} {...fill(hair)} />
				{([-1, 1] as const).map((s) => (
					<path
						key={s}
						d={`M ${CX + s * 104},${210} L ${CX + s * 108},${266} Q ${CX + s * 96},${276} ${CX + s * 82},${266} L ${CX + s * 86},${200} Z`}
						{...fill(hair)}
					/>
				))}
			</g>
		),
	}),
	"hair-long": ({ hair, dark }) => ({
		back: <path d={longBack(420)} {...fill(dark)} />,
		front: (
			<g>
				<path d={crown("part", 102, 210)} {...fill(hair)} />
				{locks(102, 400).map((d) => (
					<path key={d} d={d} {...fill(hair)} />
				))}
			</g>
		),
	}),
	"hair-wavy": ({ hair, dark }) => ({
		back: <path d={wavyBack(420)} {...fill(dark)} />,
		front: (
			<g>
				<path d={crown("part", 102, 210)} {...fill(hair)} />
				{locks(104, 396, true).map((d) => (
					<path key={d} d={d} {...fill(hair)} />
				))}
			</g>
		),
	}),
	"hair-curly": ({ hair, dark }) => {
		const back = [...cloud(CX, 190, 118, 120, 18, 34), ...cloud(CX, 290, 100, 30, 8, 30)];
		const fringe = Array.from({ length: 7 }, (_, i) => ({ x: CX - 72 + i * 24, y: TOP + 46 + Math.abs(i - 3) * 6, r: 22 }));
		return {
			back: (
				<g>
					{back.map((c) => (
						<circle key={`${c.x}${c.y}`} cx={c.x} cy={c.y} r={c.r} fill={dark} />
					))}
					<ellipse cx={CX} cy={210} rx={118} ry={110} fill={dark} />
				</g>
			),
			front: (
				<g>
					<path d={crown("high", 100, 200)} fill={hair} />
					{fringe.map((c) => (
						<circle key={c.x} cx={c.x} cy={c.y} r={c.r} fill={hair} />
					))}
					{([-1, 1] as const).map((s) =>
						[0, 1, 2].map((i) => <circle key={`${s}${i}`} cx={CX + s * (98 + (i % 2) * 6)} cy={190 + i * 26} r={18} fill={hair} />),
					)}
				</g>
			),
		};
	},
	"hair-coily": ({ hair, dark }) => ({
		back: (
			<g>
				{cloud(CX, 150, 132, 118, 22, 30).map((c) => (
					<circle key={`${c.x}${c.y}`} cx={c.x} cy={c.y} r={c.r} fill={dark} />
				))}
				<ellipse cx={CX} cy={150} rx={134} ry={120} fill={dark} />
			</g>
		),
		front: (
			<g>
				<path d={crown("high", 98, 186)} fill={hair} />
				{cloud(CX, 98, 86, 36, 12, 16)
					.filter((c) => c.y < 104)
					.map((c) => (
						<circle key={`${c.x}${c.y}`} cx={c.x} cy={c.y} r={c.r} fill={hair} />
					))}
			</g>
		),
	}),
	"hair-puffs": ({ hair, dark }) => ({
		back: (
			<g>
				{([-1, 1] as const).map((s) => (
					<g key={s}>
						{cloud(CX + s * 98, 82, 46, 44, 12, 14).map((c) => (
							<circle key={`${c.x}${c.y}`} cx={c.x} cy={c.y} r={c.r} fill={dark} />
						))}
						<circle cx={CX + s * 98} cy={82} r={50} fill={dark} />
					</g>
				))}
			</g>
		),
		front: (
			<g>
				<path d={crown("high", 96, 182)} fill={hair} />
				<path d={`M ${CX},${TOP + 2} L ${CX},${96}`} stroke={dark} strokeWidth={3} />
			</g>
		),
	}),
	"hair-locs": ({ hair, dark }) => {
		const strands = Array.from({ length: 11 }, (_, i) => CX - 110 + i * 22);
		return {
			back: (
				<g>
					<path d={longBack(240, 106)} fill={dark} />
					{strands.map((x) => (
						<path
							key={x}
							d={`M ${x},${150} L ${x + (x < CX ? -6 : 6)},${380 + (Math.abs(x - CX) < 50 ? 30 : 0)}`}
							stroke={dark}
							strokeWidth={17}
							strokeLinecap="round"
							{...{ strokeOpacity: 1 }}
						/>
					))}
				</g>
			),
			front: (
				<g>
					<path d={crown("part", 100, 190)} fill={hair} />
					{([-1, 1] as const).flatMap((s) =>
						[0, 1].map((i) => (
							<path
								key={`${s}${i}`}
								d={`M ${CX + s * (92 + i * 14)},${160} L ${CX + s * (100 + i * 16)},${360 - i * 30}`}
								stroke={hair}
								strokeWidth={16}
								strokeLinecap="round"
							/>
						)),
					)}
				</g>
			),
		};
	},
	"hair-braids": ({ hair, dark }) => {
		const braid = (x0: number, y0: number, x1: number, y1: number, color: string, key: string) => (
			<g key={key}>
				<path d={`M ${x0},${y0} L ${x1},${y1}`} stroke={color} strokeWidth={15} strokeLinecap="round" />
				<path d={`M ${x0},${y0} L ${x1},${y1}`} stroke={shade(color, -0.3)} strokeWidth={15} strokeDasharray="3 9" />
			</g>
		);
		return {
			back: (
				<g>
					<path d={longBack(250, 106)} fill={dark} />
					{Array.from({ length: 10 }, (_, i) => CX - 100 + i * 22).map((x) => braid(x, 160, x + (x < CX ? -8 : 8), 430, dark, `${x}`))}
				</g>
			),
			front: (
				<g>
					<path d={crown("part", 100, 190)} fill={hair} />
					{([-1, 1] as const).flatMap((s) =>
						[0, 1].map((i) => braid(CX + s * (90 + i * 14), 170, CX + s * (100 + i * 18), 420 - i * 30, hair, `${s}${i}`)),
					)}
				</g>
			),
		};
	},
	"hair-cornrows": ({ hair, dark }) => ({
		front: (
			<g>
				<path d={crown("high", 96, 176)} fill={hair} />
				{[-54, -32, -11, 11, 32, 54].map((dx) => (
					<path
						key={dx}
						d={`M ${CX + dx},${100} Q ${CX + dx * 1.1},${TOP + 26} ${CX + dx * 0.8},${TOP + 10}`}
						stroke={dark}
						strokeWidth={3}
						strokeDasharray="5 4"
						fill="none"
					/>
				))}
			</g>
		),
		back: (
			<g>
				{([-1, 1] as const).map((s) => (
					<path
						key={s}
						d={`M ${CX + s * 70},${230} L ${CX + s * 90},${330}`}
						stroke={dark}
						strokeWidth={12}
						strokeLinecap="round"
						strokeDasharray="6 4"
					/>
				))}
			</g>
		),
	}),
	"hair-pigtails": ({ hair, dark }) => ({
		back: (
			<g>
				{([-1, 1] as const).map((s) => (
					<path
						key={s}
						d={`M ${CX + s * 100},${140} C ${CX + s * 168},${150} ${CX + s * 172},${260} ${CX + s * 140},${330} C ${CX + s * 128},${290} ${CX + s * 108},${230} ${CX + s * 96},${180} Z`}
						{...fill(dark)}
					/>
				))}
			</g>
		),
		front: (
			<g>
				<path d={crown("part", 102, 200)} {...fill(hair)} />
				{([-1, 1] as const).map((s) => (
					<circle key={s} cx={CX + s * 108} cy={146} r={10} fill="#e85d75" {...LINE} />
				))}
			</g>
		),
	}),
	"hair-ponytail": ({ hair, dark }) => ({
		back: (
			<path
				d={`M ${CX + 60},${TOP + 20} C ${CX + 170},${TOP + 10} ${CX + 160},${300} ${CX + 120},${380} C ${CX + 116},${300} ${CX + 100},${200} ${CX + 70},${TOP + 70} Z`}
				{...fill(dark)}
			/>
		),
		front: (
			<g>
				<path d={crown("swept", 100, 188)} {...fill(hair)} />
				<circle cx={CX + 82} cy={TOP + 34} r={10} fill="#3cb6c9" {...LINE} />
			</g>
		),
	}),
	"hair-bun": ({ hair, dark }) => ({
		back: <circle cx={CX} cy={TOP - 8} r={40} {...fill(dark)} />,
		front: <path d={crown("high", 98, 184)} {...fill(hair)} />,
	}),
	"hair-spacebuns": ({ hair, dark }) => ({
		back: (
			<g>
				{([-1, 1] as const).map((s) => (
					<circle key={s} cx={CX + s * 66} cy={TOP + 6} r={36} {...fill(dark)} />
				))}
			</g>
		),
		front: (
			<g>
				<path d={crown("part", 100, 196)} {...fill(hair)} />
			</g>
		),
	}),
	"hair-side": ({ hair, dark, light }) => ({
		back: <path d={longBack(400)} {...fill(dark)} />,
		front: (
			<g>
				<path
					d={`M ${CX - 102},${230} C ${CX - 108},${TOP + 30} ${CX - 50},${TOP} ${CX + 10},${TOP} C ${CX + 64},${TOP} ${CX + 108},${TOP + 34} ${CX + 102},${210} L ${CX + 86},${200} C ${CX + 80},${130} ${CX + 40},${110} ${CX - 30},${150} C ${CX - 60},${168} ${CX - 76},${200} ${CX - 84},${236} Z`}
					{...fill(hair)}
				/>
				{locks(104, 380)
					.slice(0, 1)
					.map((d) => (
						<path key={d} d={d} {...fill(hair)} />
					))}
				<path
					d={`M ${CX + 50},${TOP + 14} C ${CX},${TOP + 30} ${CX - 40},${120} ${CX - 70},${190}`}
					stroke={light}
					strokeWidth={5}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		),
	}),
	"hair-mohawk": ({ hair, dark }) => ({
		front: (
			<g>
				<path d={crown("high", 94, 168)} fill={dark} fillOpacity={0.6} />
				<path
					d={`M ${CX - 22},${110} L ${CX - 30},${TOP - 30} L ${CX - 10},${TOP - 4} L ${CX},${TOP - 46} L ${CX + 10},${TOP - 4} L ${CX + 30},${TOP - 30} L ${CX + 22},${110} Z`}
					{...fill(hair)}
				/>
			</g>
		),
	}),
	"hair-princess": ({ hair, dark, light }) => ({
		back: <path d={wavyBack(560, 118)} {...fill(dark)} />,
		front: (
			<g>
				<path d={crown("part", 102, 210)} {...fill(hair)} />
				{locks(106, 470, true).map((d) => (
					<path key={d} d={d} {...fill(hair)} />
				))}
				<path
					d={`M ${CX - 40},${TOP + 14} Q ${CX - 80},${TOP + 40} ${CX - 92},${170}`}
					stroke={light}
					strokeWidth={5}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		),
	}),
};

export const HAIR_ART: Record<string, Art> = Object.fromEntries(
	Object.entries(STYLES).map(([id, style]) => [
		id,
		({ c1, uid }) => {
			const parts = style({ hair: c1, dark: shade(c1, -0.18), light: shade(c1, 0.3), uid });
			return { back: parts.back, front: parts.front };
		},
	]),
);
