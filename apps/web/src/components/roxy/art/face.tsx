import type { ReactNode } from "react";
import { BROW_Y, CX, EYE_DX, EYE_Y, HEAD, INK, MOUTH_Y, NOSE_Y, shade } from "../geometry.ts";
import type { Art, ArtProps } from "./types.ts";

const both = (draw: (x: number, s: 1 | -1) => ReactNode) => (
	<>
		{draw(CX - EYE_DX, -1)}
		{draw(CX + EYE_DX, 1)}
	</>
);

/** A classic cartoon eye: white, iris, pupil and two catch-lights. */
function eye(x: number, iris: string, { rx = 15, ry = 17, r = 11 } = {}) {
	return (
		<g>
			<ellipse cx={x} cy={EYE_Y} rx={rx} ry={ry} fill="#fffdf9" stroke={INK} strokeOpacity={0.55} strokeWidth={2.5} />
			<circle cx={x} cy={EYE_Y + 2} r={r} fill={iris} />
			<circle cx={x} cy={EYE_Y + 3} r={r * 0.52} fill={INK} />
			<circle cx={x + r * 0.35} cy={EYE_Y - r * 0.3} r={r * 0.32} fill="#fff" />
			<circle cx={x - r * 0.35} cy={EYE_Y + r * 0.45} r={r * 0.16} fill="#fff" />
		</g>
	);
}

const star = (x: number, y: number, r: number) => {
	const pts = Array.from({ length: 10 }, (_, i) => {
		const a = (Math.PI / 5) * i - Math.PI / 2;
		const rr = i % 2 === 0 ? r : r * 0.45;
		return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
	});
	return `M ${pts.join(" L ")} Z`;
};

const heart = (x: number, y: number, s: number) =>
	`M ${x},${y + s * 0.9} C ${x - s * 1.4},${y} ${x - s * 0.9},${y - s * 1.1} ${x},${y - s * 0.35} C ${x + s * 0.9},${y - s * 1.1} ${x + s * 1.4},${y} ${x},${y + s * 0.9} Z`;

const EYES: Record<string, Art> = {
	"eyes-round": ({ c1 }) => ({ main: both((x) => eye(x, c1)) }),
	"eyes-almond": ({ c1 }) => ({
		main: both((x, s) => (
			<g>
				{eye(x, c1, { rx: 17, ry: 12, r: 9.5 })}
				<path
					d={`M ${x - 18},${EYE_Y - 2} Q ${x},${EYE_Y - 18} ${x + 18},${EYE_Y - 2 + s * -2}`}
					stroke={INK}
					strokeWidth={3.5}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		)),
	}),
	"eyes-big": ({ c1 }) => ({ main: both((x) => eye(x, c1, { rx: 18, ry: 21, r: 14 })) }),
	"eyes-sleepy": ({ c1, skin }) => ({
		main: both((x) => (
			<g>
				{eye(x, c1)}
				<path d={`M ${x - 17},${EYE_Y - 1} Q ${x},${EYE_Y - 22} ${x + 17},${EYE_Y - 1} Z`} fill={skin} />
				<path d={`M ${x - 17},${EYE_Y - 1} L ${x + 17},${EYE_Y - 1}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
			</g>
		)),
	}),
	"eyes-lashes": ({ c1 }) => ({
		main: both((x, s) => (
			<g>
				{eye(x, c1)}
				{[0, 1, 2].map((i) => (
					<path
						key={i}
						d={`M ${x + s * (6 + i * 5)},${EYE_Y - 14 + i * 4} l ${s * 7},${-6 + i * 1}`}
						stroke={INK}
						strokeWidth={3}
						strokeLinecap="round"
					/>
				))}
			</g>
		)),
	}),
	"eyes-happy": () => ({
		main: both((x) => (
			<path
				d={`M ${x - 14},${EYE_Y + 4} Q ${x},${EYE_Y - 14} ${x + 14},${EYE_Y + 4}`}
				stroke={INK}
				strokeWidth={4.5}
				fill="none"
				strokeLinecap="round"
			/>
		)),
	}),
	"eyes-wide": ({ c1 }) => ({ main: both((x) => eye(x, c1, { rx: 17, ry: 19, r: 8 })) }),
	"eyes-star": ({ c1 }) => ({
		main: both((x) => (
			<g>
				<ellipse cx={x} cy={EYE_Y} rx={17} ry={19} fill="#fffdf9" stroke={INK} strokeOpacity={0.55} strokeWidth={2.5} />
				<path d={star(x, EYE_Y + 2, 14)} fill={c1} />
				<circle cx={x + 4} cy={EYE_Y - 3} r={3} fill="#fff" />
			</g>
		)),
	}),
};

const brow =
	(d: (x: number, s: 1 | -1) => string, width: number): Art =>
	({ c1 }) => ({ main: both((x, s) => <path d={d(x, s)} stroke={c1} strokeWidth={width} fill="none" strokeLinecap="round" />) });

const BROWS: Record<string, Art> = {
	"brows-soft": brow((x) => `M ${x - 14},${BROW_Y + 3} Q ${x},${BROW_Y - 5} ${x + 14},${BROW_Y + 3}`, 5),
	"brows-arched": brow((x, s) => `M ${x - s * 15},${BROW_Y + 4} Q ${x - s * 2},${BROW_Y - 10} ${x + s * 16},${BROW_Y}`, 5),
	"brows-straight": brow((x) => `M ${x - 14},${BROW_Y} L ${x + 14},${BROW_Y}`, 5.5),
	"brows-bold": brow((x, s) => `M ${x - s * 15},${BROW_Y + 2} Q ${x},${BROW_Y - 6} ${x + s * 15},${BROW_Y - 1}`, 8.5),
	"brows-thin": brow((x) => `M ${x - 13},${BROW_Y + 2} Q ${x},${BROW_Y - 6} ${x + 13},${BROW_Y + 2}`, 3),
};

const NOSES: Record<string, Art> = {
	"nose-button": ({ skin }) => ({ main: <ellipse cx={CX} cy={NOSE_Y} rx={9} ry={7} fill={shade(skin, -0.16)} /> }),
	"nose-dot": ({ skin }) => ({
		main: (
			<>
				<circle cx={CX - 5} cy={NOSE_Y + 2} r={2.6} fill={shade(skin, -0.45)} />
				<circle cx={CX + 5} cy={NOSE_Y + 2} r={2.6} fill={shade(skin, -0.45)} />
			</>
		),
	}),
	"nose-round": ({ skin }) => ({
		main: (
			<path
				d={`M ${CX - 10},${NOSE_Y + 2} Q ${CX},${NOSE_Y + 12} ${CX + 10},${NOSE_Y + 2}`}
				stroke={shade(skin, -0.38)}
				strokeWidth={3.5}
				fill="none"
				strokeLinecap="round"
			/>
		),
	}),
	"nose-line": ({ skin }) => ({
		main: (
			<path
				d={`M ${CX + 2},${NOSE_Y - 16} Q ${CX - 6},${NOSE_Y + 2} ${CX + 5},${NOSE_Y + 5}`}
				stroke={shade(skin, -0.38)}
				strokeWidth={3}
				fill="none"
				strokeLinecap="round"
			/>
		),
	}),
};

/** Mouths draw their lip line in the lip colour when lips are on. */
function lipLine(p: ArtProps) {
	return p.lips ? { stroke: p.lips.color, width: p.lips.item === "lips-bold" ? 7 : 5 } : { stroke: INK, width: 4 };
}

const MOUTH_INNER = "#7a2b2b";
const mouth =
	(draw: (p: ArtProps, line: { stroke: string; width: number }) => ReactNode): Art =>
	(p) => {
		if (p.lips?.item === "lips-heart") return { main: <path d={heart(CX, MOUTH_Y, 12)} fill={p.lips.color} /> };
		const line = lipLine(p);
		return {
			main: (
				<g>
					{draw(p, line)}
					{p.lips?.item === "lips-gloss" && <ellipse cx={CX + 7} cy={MOUTH_Y + 4} rx={4} ry={2} fill="#fff" fillOpacity={0.8} />}
				</g>
			),
		};
	};

const MOUTHS: Record<string, Art> = {
	"mouth-smile": mouth((_, l) => (
		<path
			d={`M ${CX - 18},${MOUTH_Y - 2} Q ${CX},${MOUTH_Y + 16} ${CX + 18},${MOUTH_Y - 2}`}
			stroke={l.stroke}
			strokeWidth={l.width}
			fill="none"
			strokeLinecap="round"
		/>
	)),
	"mouth-grin": mouth((_, l) => (
		<path
			d={`M ${CX - 22},${MOUTH_Y - 4} Q ${CX},${MOUTH_Y + 22} ${CX + 22},${MOUTH_Y - 4} Z`}
			fill={MOUTH_INNER}
			stroke={l.stroke}
			strokeWidth={l.width - 1}
			strokeLinejoin="round"
		/>
	)),
	"mouth-open": mouth((_, l) => (
		<g>
			<path
				d={`M ${CX - 20},${MOUTH_Y - 4} Q ${CX},${MOUTH_Y + 30} ${CX + 20},${MOUTH_Y - 4} Z`}
				fill={MOUTH_INNER}
				stroke={l.stroke}
				strokeWidth={l.width - 1}
				strokeLinejoin="round"
			/>
			<path
				d={`M ${CX - 10},${MOUTH_Y + 12} Q ${CX},${MOUTH_Y + 4} ${CX + 10},${MOUTH_Y + 12} Q ${CX},${MOUTH_Y + 20} ${CX - 10},${MOUTH_Y + 12}`}
				fill="#ef7f8f"
			/>
		</g>
	)),
	"mouth-o": mouth((_, l) => (
		<ellipse cx={CX} cy={MOUTH_Y + 4} rx={8} ry={10} fill={MOUTH_INNER} stroke={l.stroke} strokeWidth={l.width - 1} />
	)),
	"mouth-tongue": mouth((_, l) => (
		<g>
			<path d={`M ${CX + 2},${MOUTH_Y + 4} q 7,18 14,0`} fill="#ef7f8f" stroke={INK} strokeOpacity={0.5} strokeWidth={2} />
			<path
				d={`M ${CX - 18},${MOUTH_Y} Q ${CX},${MOUTH_Y + 12} ${CX + 20},${MOUTH_Y - 2}`}
				stroke={l.stroke}
				strokeWidth={l.width}
				fill="none"
				strokeLinecap="round"
			/>
		</g>
	)),
	"mouth-smirk": mouth((_, l) => (
		<path
			d={`M ${CX - 14},${MOUTH_Y + 4} Q ${CX + 6},${MOUTH_Y + 10} ${CX + 18},${MOUTH_Y - 4}`}
			stroke={l.stroke}
			strokeWidth={l.width}
			fill="none"
			strokeLinecap="round"
		/>
	)),
	"mouth-teeth": mouth((_, l) => (
		<g>
			<path
				d={`M ${CX - 22},${MOUTH_Y - 4} Q ${CX},${MOUTH_Y + 24} ${CX + 22},${MOUTH_Y - 4} Z`}
				fill={MOUTH_INNER}
				stroke={l.stroke}
				strokeWidth={l.width - 1}
				strokeLinejoin="round"
			/>
			<path
				d={`M ${CX - 19},${MOUTH_Y - 2} L ${CX + 19},${MOUTH_Y - 2} L ${CX + 15},${MOUTH_Y + 5} L ${CX - 15},${MOUTH_Y + 5} Z`}
				fill="#fff"
			/>
		</g>
	)),
	"mouth-cat": mouth((_, l) => (
		<path
			d={`M ${CX - 18},${MOUTH_Y} Q ${CX - 9},${MOUTH_Y + 10} ${CX},${MOUTH_Y} Q ${CX + 9},${MOUTH_Y + 10} ${CX + 18},${MOUTH_Y}`}
			stroke={l.stroke}
			strokeWidth={l.width}
			fill="none"
			strokeLinecap="round"
		/>
	)),
};

const cheeks = (draw: (x: number, s: 1 | -1) => ReactNode) => (
	<>
		{draw(CX - 58, -1)}
		{draw(CX + 58, 1)}
	</>
);
const CHEEK_Y = 218;

const MARKS: Record<string, Art> = {
	"marks-freckles": ({ skin }) => ({
		main: cheeks((x) =>
			[
				[-10, -4],
				[0, -8],
				[9, -2],
				[-4, 5],
				[6, 7],
			].map(([dx, dy]) => <circle key={`${dx}${dy}`} cx={x + dx!} cy={CHEEK_Y - 10 + dy!} r={2.4} fill={shade(skin, -0.38)} />),
		),
	}),
	"marks-beauty": ({ skin }) => ({ main: <circle cx={CX + 40} cy={MOUTH_Y - 6} r={3.2} fill={shade(skin, -0.6)} /> }),
	"marks-dimples": ({ skin }) => ({
		main: (
			<>
				<path d={`M ${CX - 30},${MOUTH_Y - 4} q -3,5 0,9`} stroke={shade(skin, -0.3)} strokeWidth={2.5} fill="none" strokeLinecap="round" />
				<path d={`M ${CX + 30},${MOUTH_Y - 4} q 3,5 0,9`} stroke={shade(skin, -0.3)} strokeWidth={2.5} fill="none" strokeLinecap="round" />
			</>
		),
	}),
};

const BLUSH: Record<string, Art> = {
	"blush-round": ({ c1 }) => ({ main: cheeks((x) => <ellipse cx={x} cy={CHEEK_Y} rx={16} ry={11} fill={c1} fillOpacity={0.55} />) }),
	"blush-soft": ({ c1 }) => ({ main: cheeks((x) => <ellipse cx={x} cy={CHEEK_Y} rx={22} ry={13} fill={c1} fillOpacity={0.3} />) }),
	"blush-stripes": ({ c1 }) => ({
		main: cheeks((x) =>
			[-7, 0, 7].map((dx) => (
				<path
					key={dx}
					d={`M ${x + dx - 3},${CHEEK_Y + 6} l 6,-12`}
					stroke={c1}
					strokeWidth={3.5}
					strokeOpacity={0.8}
					strokeLinecap="round"
				/>
			)),
		),
	}),
	"blush-hearts": ({ c1 }) => ({ main: cheeks((x) => <path d={heart(x, CHEEK_Y, 9)} fill={c1} fillOpacity={0.75} />) }),
};

const lid = (x: number, s: 1 | -1, wing: boolean) =>
	`M ${x - 18},${EYE_Y - 4} Q ${x},${EYE_Y - 28} ${x + 18},${EYE_Y - 4}${wing ? ` L ${x + s * 26},${EYE_Y - 14}` : ""} Q ${x},${EYE_Y - 16} ${x - 18},${EYE_Y - 4} Z`;

const SHADOW: Record<string, Art> = {
	"shadow-soft": ({ c1 }) => ({ main: both((x, s) => <path d={lid(x, s, false)} fill={c1} fillOpacity={0.6} />) }),
	"shadow-wing": ({ c1 }) => ({ main: both((x, s) => <path d={lid(x, s, true)} fill={c1} fillOpacity={0.8} />) }),
	"shadow-glitter": ({ c1 }) => ({
		main: both((x, s) => (
			<g>
				<path d={lid(x, s, false)} fill={c1} fillOpacity={0.65} />
				{[-9, 0, 9].map((dx) => (
					<circle key={dx} cx={x + dx} cy={EYE_Y - 17 + Math.abs(dx) / 3} r={1.8} fill="#fff" />
				))}
			</g>
		)),
	}),
	"shadow-rainbow": ({ uid }) => ({
		main: (
			<>
				<defs>
					<linearGradient id={`${uid}-rainbow`} x1="0" x2="1">
						{["#e85d75", "#f2c94c", "#5fc9a3", "#5fa3e0", "#a873d9"].map((c, i) => (
							<stop key={c} offset={i / 4} stopColor={c} />
						))}
					</linearGradient>
				</defs>
				{both((x, s) => (
					<path d={lid(x, s, true)} fill={`url(#${uid}-rainbow)`} fillOpacity={0.8} />
				))}
			</>
		),
	}),
};

/** Lips draw nothing themselves; the mouth uses them. */
const LIPS: Record<string, Art> = Object.fromEntries(["lips-gloss", "lips-bold", "lips-ombre", "lips-heart"].map((id) => [id, () => ({})]));

const PAINT: Record<string, Art> = {
	"paint-star": ({ c1 }) => ({ main: <path d={star(CX + 58, CHEEK_Y - 4, 13)} fill={c1} stroke="#fff" strokeWidth={2} /> }),
	"paint-flower": ({ c1 }) => ({
		main: (
			<g>
				{[0, 72, 144, 216, 288].map((a) => (
					<ellipse key={a} cx={CX - 58} cy={CHEEK_Y - 13} rx={5.5} ry={9} fill={c1} transform={`rotate(${a} ${CX - 58} ${CHEEK_Y - 4})`} />
				))}
				<circle cx={CX - 58} cy={CHEEK_Y - 4} r={4.5} fill="#f2c94c" />
			</g>
		),
	}),
	"paint-hearts": ({ c1 }) => ({
		main: (
			<>
				<path d={heart(CX + 54, CHEEK_Y - 6, 8)} fill={c1} />
				<path d={heart(CX + 68, CHEEK_Y + 8, 5)} fill={c1} />
			</>
		),
	}),
	"paint-lightning": ({ c1 }) => ({
		main: (
			<path
				d={`M ${CX + 52},${EYE_Y - 30} l -12,30 h 10 l -8,24 l 20,-32 h -10 l 8,-22 Z`}
				fill={c1}
				stroke="#fff"
				strokeWidth={1.5}
				transform={`translate(10 ${CHEEK_Y - EYE_Y - 4})`}
			/>
		),
	}),
	"paint-rainbow": () => ({
		main: (
			<g fill="none" strokeLinecap="round" strokeWidth={4}>
				{["#e85d75", "#f2c94c", "#5fc9a3", "#5fa3e0"].map((c, i) => (
					<path key={c} d={`M ${CX + 40 + i * 4},${CHEEK_Y + 4} a ${22 - i * 4},${20 - i * 4} 0 0 1 ${44 - i * 8},0`} stroke={c} />
				))}
			</g>
		),
	}),
	"paint-butterfly": ({ c1 }) => ({
		main: (
			<g>
				{([-1, 1] as const).map((s) => (
					<g key={s}>
						<ellipse
							cx={CX + s * 40}
							cy={EYE_Y - 4}
							rx={30}
							ry={22}
							fill={c1}
							fillOpacity={0.45}
							transform={`rotate(${s * -18} ${CX + s * 40} ${EYE_Y - 4})`}
						/>
						<ellipse cx={CX + s * 40} cy={CHEEK_Y + 6} rx={18} ry={14} fill={c1} fillOpacity={0.45} />
					</g>
				))}
				<path d={`M ${CX},${EYE_Y - 30} L ${CX},${NOSE_Y - 6}`} stroke={shade(c1, -0.3)} strokeWidth={4} strokeLinecap="round" />
			</g>
		),
	}),
	// Holiday face paint.
	"paint-holi": () => ({
		main: (
			<g>
				{[
					["#e85d75", -60, -8, 15],
					["#f2c94c", 54, -12, 13],
					["#5fc9a3", 66, 10, 9],
					["#a873d9", -48, 12, 10],
					["#5fa3e0", 30, -86, 11],
				].map(([c, dx, dy, r]) => (
					<circle
						key={c as string}
						cx={CX + (dx as number)}
						cy={CHEEK_Y + (dy as number)}
						r={r as number}
						fill={c as string}
						fillOpacity={0.7}
					/>
				))}
			</g>
		),
	}),
	"paint-skeleton": () => ({
		main: (
			<g>
				{both((x) => (
					<circle cx={x} cy={EYE_Y} r={24} fill={INK} fillOpacity={0.25} />
				))}
				<path d={`M ${CX - 6},${NOSE_Y - 4} L ${CX},${NOSE_Y + 8} L ${CX + 6},${NOSE_Y - 4} Z`} fill={INK} fillOpacity={0.6} />
				{[-16, -8, 0, 8, 16].map((dx) => (
					<path key={dx} d={`M ${CX + dx},${MOUTH_Y + 6} l 0,10`} stroke={INK} strokeOpacity={0.55} strokeWidth={2} />
				))}
			</g>
		),
	}),
	"paint-catrina": () => ({
		main: (
			<g>
				{both((x) => (
					<g>
						<circle cx={x} cy={EYE_Y} r={25} fill="none" stroke="#e85d75" strokeWidth={4} />
						{[0, 60, 120, 180, 240, 300].map((a) => (
							<circle
								key={a}
								cx={x + Math.cos((a * Math.PI) / 180) * 30}
								cy={EYE_Y + Math.sin((a * Math.PI) / 180) * 30}
								r={3.5}
								fill="#5fa3e0"
							/>
						))}
					</g>
				))}
				<path d={heart(CX, NOSE_Y + 2, 7)} fill={INK} fillOpacity={0.7} />
				<path d={`M ${CX - 6},${HEAD.y - 70} l 6,-10 l 6,10 l -6,10 Z`} fill="#f2c94c" />
			</g>
		),
	}),
	"paint-bindi": () => ({
		main: (
			<g>
				<circle cx={CX} cy={BROW_Y - 2} r={6} fill="#b3263f" />
				<circle cx={CX} cy={BROW_Y - 2} r={2.5} fill="#f2c94c" />
				{[0, 1, 2].map((i) => (
					<circle key={i} cx={CX} cy={BROW_Y - 14 - i * 7} r={2} fill="#f2c94c" />
				))}
			</g>
		),
	}),
};

export const FACE_ART: Record<string, Art> = { ...EYES, ...BROWS, ...NOSES, ...MOUTHS, ...MARKS, ...BLUSH, ...SHADOW, ...LIPS, ...PAINT };
