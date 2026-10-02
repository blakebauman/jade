import type { ReactNode } from "react";
import { ANKLE_Y, armPath, CX, type Dims, dims, HIP_Y, halfWidth, LINE, legPath, SHOULDER_Y, shade, torso, WAIST_Y } from "../geometry.ts";
import { dots, heart, star, stripes, zigzag } from "./patterns.tsx";
import type { Art, ArtProps } from "./types.ts";

const EXTRA = 3;
const NECK = { w: 17, depth: 7 };

/** Sleeves along each arm, `to` of the way down (0–1). */
function sleeves(d: Dims, color: string, to: number, width = 9) {
	if (to <= 0) return null;
	return ([-1, 1] as const).map((s) => (
		<g key={s}>
			<path
				d={armPath(d, s, to)}
				stroke={shade(color, -0.3)}
				strokeOpacity={0.6}
				strokeWidth={d.arm + width + 4}
				strokeLinecap="round"
				fill="none"
			/>
			<path d={armPath(d, s, to)} stroke={color} strokeWidth={d.arm + width} strokeLinecap="round" fill="none" />
		</g>
	));
}

/** Clip children to a path. */
export function Clip({ id, d, children }: { id: string; d: string; children: ReactNode }) {
	return (
		<>
			<defs>
				<clipPath id={id}>
					<path d={d} />
				</clipPath>
			</defs>
			<g clipPath={`url(#${id})`}>{children}</g>
		</>
	);
}

type ShirtOpts = { sleeve?: number; neck?: { w: number; depth: number }; bottom?: number; pattern?: ReactNode; trim?: ReactNode };

/** A top: sleeves, then the body of the shirt over their shoulder ends, then any pattern clipped to it. */
function shirt(p: ArtProps, color: string, key: string, { sleeve = 0.34, neck = NECK, bottom = HIP_Y + 8, pattern, trim }: ShirtOpts = {}) {
	const d = dims(p.shape);
	const path = torso(d, bottom, neck, EXTRA);
	return (
		<g>
			{sleeves(d, color, sleeve)}
			<path d={path} fill={color} {...LINE} />
			{pattern && (
				<Clip id={`${p.uid}-${key}`} d={path}>
					{pattern}
				</Clip>
			)}
			{trim}
		</g>
	);
}

// ── Tops ──

const collar = (color: string) =>
	([-1, 1] as const).map((s) => (
		<path
			key={s}
			d={`M ${CX + s * 30},${SHOULDER_Y - 3} L ${CX},${SHOULDER_Y + 18} L ${CX + s * 6},${SHOULDER_Y + 26} L ${CX + s * 34},${SHOULDER_Y + 12} Z`}
			fill={color}
			{...LINE}
		/>
	));

const TOPS: Record<string, Art> = {
	"top-tee": (p) => ({ main: shirt(p, p.c1, "tee") }),
	"top-stripes": (p) => ({ main: shirt(p, p.c1, "stripes", { pattern: stripes(p.c2, SHOULDER_Y + 12, HIP_Y + 10) }) }),
	"top-tank": (p) => ({ main: shirt(p, p.c1, "tank", { sleeve: 0, neck: { w: 28, depth: 13 } }) }),
	"top-long": (p) => ({ main: shirt(p, p.c1, "long", { sleeve: 1 }) }),
	"top-crop": (p) => ({ main: shirt(p, p.c1, "crop", { bottom: WAIST_Y - 10, neck: { w: 26, depth: 10 } }) }),
	"top-polo": (p) => ({
		main: shirt(p, p.c1, "polo", {
			neck: { w: 14, depth: 5 },
			trim: (
				<g>
					{collar(p.c2)}
					{[34, 50].map((y) => (
						<circle key={y} cx={CX} cy={SHOULDER_Y + y} r={3} fill={p.c2} />
					))}
				</g>
			),
		}),
	}),
	"top-ruffle": (p) => ({
		main: shirt(p, p.c1, "ruffle", {
			sleeve: 0,
			neck: { w: 28, depth: 12 },
			trim: (
				<g fill={shade(p.c1, 0.3)} {...LINE}>
					{[-2, -1, 0, 1, 2].map((i) => (
						<circle key={i} cx={CX + i * 14} cy={SHOULDER_Y + 26 - Math.abs(i) * 6} r={9} />
					))}
				</g>
			),
		}),
	}),
	"top-star": (p) => ({ main: shirt(p, p.c1, "star", { trim: <path d={star(CX, SHOULDER_Y + 62, 30)} fill={p.c2} {...LINE} /> }) }),
	"top-heart": (p) => ({ main: shirt(p, p.c1, "heart", { trim: <path d={heart(CX, SHOULDER_Y + 60, 24)} fill={p.c2} {...LINE} /> }) }),
	"top-hoodie": (p) => {
		const d = dims(p.shape);
		return {
			back: <ellipse cx={CX} cy={SHOULDER_Y - 6} rx={d.shoulder - 6} ry={26} fill={shade(p.c1, -0.15)} {...LINE} />,
			main: shirt(p, p.c1, "hoodie", {
				sleeve: 1,
				neck: { w: 20, depth: 9 },
				trim: (
					<g>
						<path
							d={`M ${CX - 32},${HIP_Y - 44} L ${CX + 32},${HIP_Y - 44} L ${CX + 40},${HIP_Y - 4} L ${CX - 40},${HIP_Y - 4} Z`}
							fill={shade(p.c1, -0.12)}
							{...LINE}
						/>
						{[-1, 1].map((s) => (
							<path key={s} d={`M ${CX + s * 10},${SHOULDER_Y + 10} l ${s * 2},40`} stroke={p.c2} strokeWidth={3.5} strokeLinecap="round" />
						))}
					</g>
				),
			}),
		};
	},
	"top-sweater": (p) => ({
		main: shirt(p, p.c1, "sweater", {
			sleeve: 1,
			pattern: (
				<g>
					{zigzag(p.c2, SHOULDER_Y + 50)}
					{zigzag(p.c2, SHOULDER_Y + 78)}
					<rect x={0} y={HIP_Y - 6} width={400} height={20} fill={shade(p.c1, -0.15)} />
				</g>
			),
		}),
	}),
	"top-sequin": (p) => ({
		main: shirt(p, p.c1, "sequin", {
			sleeve: 0,
			neck: { w: 26, depth: 12 },
			pattern: dots(shade(p.c1, 0.45), SHOULDER_Y + 10, HIP_Y + 10, 3.5, 13),
		}),
	}),
	// Holiday tops.
	"top-lunar": (p) => ({
		main: shirt(p, p.c1, "lunar", {
			sleeve: 1,
			neck: { w: 12, depth: 3 },
			trim: (
				<g>
					<rect x={CX - 16} y={SHOULDER_Y - 10} width={32} height={12} rx={4} fill={p.c1} stroke={p.c2} strokeWidth={3} />
					{[30, 56, 82].map((y) => (
						<g key={y}>
							<path
								d={`M ${CX - 14},${SHOULDER_Y + y} L ${CX + 14},${SHOULDER_Y + y}`}
								stroke={p.c2}
								strokeWidth={3.5}
								strokeLinecap="round"
							/>
							<circle cx={CX} cy={SHOULDER_Y + y} r={4} fill={p.c2} />
						</g>
					))}
				</g>
			),
		}),
	}),
	"top-holi": (p) => ({
		main: shirt(p, p.c1, "holi", {
			sleeve: 1,
			bottom: HIP_Y + 46,
			neck: { w: 12, depth: 14 },
			pattern: (
				<g>
					{(
						[
							["#e85d75", 150, 340],
							["#f2c94c", 240, 330],
							["#5fc9a3", 180, 420],
							["#a873d9", 236, 450],
							["#5fa3e0", 160, 470],
						] as const
					).map(([c, x, y]) => (
						<circle key={c} cx={x} cy={y} r={18} fill={c} fillOpacity={0.65} />
					))}
				</g>
			),
		}),
	}),
	"top-passover": (p) => ({
		main: shirt(p, p.c1, "passover", {
			neck: { w: 14, depth: 4 },
			trim: (
				<g>
					{collar(p.c2)}
					{[36, 58, 80].map((y) => (
						<circle key={y} cx={CX} cy={SHOULDER_Y + y} r={3} fill={shade(p.c1, -0.4)} />
					))}
				</g>
			),
		}),
	}),
	"top-earth": (p) => ({
		main: shirt(p, "#3d74c9", "earth", {
			trim: (
				<g>
					<circle cx={CX} cy={SHOULDER_Y + 62} r={30} fill="#5fa3e0" {...LINE} />
					<path
						d={`M ${CX - 22},${SHOULDER_Y + 48} q 14,-8 22,4 q 4,12 -10,16 q -10,4 -12,-20 Z M ${CX + 6},${SHOULDER_Y + 70} q 16,-10 20,6 q -6,14 -20,6 Z`}
						fill="#8cc152"
					/>
				</g>
			),
		}),
	}),
	"top-flannel": (p) => ({
		main: shirt(p, "#b5452a", "flannel", {
			sleeve: 1,
			neck: { w: 14, depth: 5 },
			pattern: (
				<g>
					{stripes("#2b2b33", SHOULDER_Y, HIP_Y + 10, 26, 7)}
					{Array.from({ length: 16 }, (_, i) => (
						<rect key={i} x={i * 26} y={0} width={7} height={640} fill="#2b2b33" fillOpacity={0.55} />
					))}
				</g>
			),
			trim: collar("#8f3420"),
		}),
	}),
	"top-hanukkah": (p) => ({
		main: shirt(p, "#3d74c9", "hanukkah", {
			sleeve: 1,
			pattern: (
				<g>
					{zigzag("#e8e2f0", SHOULDER_Y + 44)}
					{zigzag("#e8e2f0", SHOULDER_Y + 96)}
					{dots("#e8e2f0", SHOULDER_Y + 70, SHOULDER_Y + 74, 3, 20)}
				</g>
			),
		}),
	}),
	"top-xmas": (p) => ({
		main: shirt(p, p.c1, "xmas", {
			sleeve: 1,
			pattern: (
				<g>
					{zigzag(p.c2, SHOULDER_Y + 40)}
					{[-34, 0, 34].map((dx) => (
						<g key={dx} stroke="#fff" strokeWidth={3} strokeLinecap="round">
							{[0, 60, 120].map((a) => {
								const c = Math.cos((a * Math.PI) / 180) * 9;
								const s = Math.sin((a * Math.PI) / 180) * 9;
								return <path key={a} d={`M ${CX + dx - c},${SHOULDER_Y + 80 - s} L ${CX + dx + c},${SHOULDER_Y + 80 + s}`} />;
							})}
						</g>
					))}
					{zigzag(p.c2, SHOULDER_Y + 112)}
				</g>
			),
		}),
	}),
	"top-kente": (p) => ({
		main: shirt(p, "#e0a526", "kente", {
			pattern: (
				<g>
					{Array.from({ length: 8 }, (_, row) =>
						Array.from({ length: 10 }, (_, col) => (
							<rect
								key={`${row}-${col}`}
								x={100 + col * 22}
								y={SHOULDER_Y + row * 20}
								width={22}
								height={10}
								fill={["#2f9e6b", "#b3263f", "#2b2b33", "#e0a526"][(row + col) % 4]}
							/>
						)),
					)}
				</g>
			),
		}),
	}),
};

// ── Bottoms ──

/** Hips from the waistband down, plus a leg each down to `to`. */
function pants(p: ArtProps, color: string, to: number, width = 10) {
	const d = dims(p.shape);
	const top = WAIST_Y - 6;
	const hips = `M ${CX - halfWidth(d, top, EXTRA)},${top} L ${CX + halfWidth(d, top, EXTRA)},${top} L ${CX + halfWidth(d, HIP_Y, EXTRA)},${HIP_Y + 4} L ${CX + 4},${HIP_Y + 18} L ${CX - 4},${HIP_Y + 18} L ${CX - halfWidth(d, HIP_Y, EXTRA)},${HIP_Y + 4} Z`;
	return (
		<g>
			{([-1, 1] as const).map((s) => (
				<g key={s}>
					<path
						d={legPath(d, s, HIP_Y - 10, to)}
						stroke={shade(color, -0.3)}
						strokeOpacity={0.6}
						strokeWidth={d.leg + width + 4}
						fill="none"
					/>
					<path d={legPath(d, s, HIP_Y - 10, to)} stroke={color} strokeWidth={d.leg + width} fill="none" />
				</g>
			))}
			<path d={hips} fill={color} stroke={shade(color, -0.3)} strokeOpacity={0.6} strokeWidth={2} strokeLinejoin="round" />
			<path d={hips} fill={color} />
		</g>
	);
}

function skirt(p: ArtProps, hem: number, flare = 28, top = WAIST_Y - 6) {
	const d = dims(p.shape);
	const w = halfWidth(d, top, EXTRA);
	const h = halfWidth(d, Math.min(hem, HIP_Y), EXTRA) + flare;
	return `M ${CX - w},${top} L ${CX + w},${top} Q ${CX + h - 6},${(top + hem) / 2} ${CX + h},${hem} Q ${CX},${hem + 12} ${CX - h},${hem} Q ${CX - h + 6},${(top + hem) / 2} ${CX - w},${top} Z`;
}

const BOTTOMS: Record<string, Art> = {
	"bottom-jeans": (p) => ({
		main: (
			<g>
				{pants(p, p.c1, ANKLE_Y - 8)}
				{([-1, 1] as const).map((s) => (
					<path
						key={s}
						d={legPath(dims(p.shape), s, HIP_Y + 10, ANKLE_Y - 10)}
						stroke={shade(p.c1, 0.25)}
						strokeWidth={2}
						strokeDasharray="5 4"
						transform={`translate(${s * 8} 0)`}
					/>
				))}
			</g>
		),
	}),
	"bottom-leggings": (p) => ({ main: pants(p, p.c1, ANKLE_Y - 4, 3) }),
	"bottom-shorts": (p) => ({ main: pants(p, p.c1, HIP_Y + 46, 12) }),
	"bottom-cargo": (p) => ({
		main: (
			<g>
				{pants(p, p.c1, ANKLE_Y - 8, 14)}
				{([-1, 1] as const).map((s) => (
					<rect
						key={s}
						x={CX + s * dims(p.shape).legX - 14}
						y={HIP_Y + 50}
						width={28}
						height={30}
						rx={4}
						fill={shade(p.c1, -0.12)}
						{...LINE}
					/>
				))}
			</g>
		),
	}),
	"bottom-overalls": (p) => {
		const d = dims(p.shape);
		return {
			main: (
				<g>
					{pants(p, p.c1, ANKLE_Y - 8)}
					<rect x={CX - 34} y={SHOULDER_Y + 34} width={68} height={WAIST_Y - SHOULDER_Y - 28} rx={6} fill={p.c1} {...LINE} />
					{([-1, 1] as const).map((s) => (
						<g key={s}>
							<path
								d={`M ${CX + s * 30},${SHOULDER_Y + 38} L ${CX + s * (d.shoulder - 16)},${SHOULDER_Y - 2}`}
								stroke={p.c1}
								strokeWidth={10}
								strokeLinecap="round"
							/>
							<circle cx={CX + s * 26} cy={SHOULDER_Y + 42} r={4} fill="#f2c94c" />
						</g>
					))}
					<rect x={CX - 16} y={SHOULDER_Y + 52} width={32} height={22} rx={3} fill={shade(p.c1, -0.12)} />
				</g>
			),
		};
	},
	"bottom-skirt": (p) => ({ main: <path d={skirt(p, HIP_Y + 52)} fill={p.c1} {...LINE} /> }),
	"bottom-pleated": (p) => ({
		main: (
			<g>
				<path d={skirt(p, HIP_Y + 50, 22)} fill={p.c1} {...LINE} />
				{[-36, -18, 0, 18, 36].map((dx) => (
					<path key={dx} d={`M ${CX + dx * 0.7},${WAIST_Y} L ${CX + dx * 1.2},${HIP_Y + 52}`} stroke={shade(p.c1, -0.25)} strokeWidth={2} />
				))}
			</g>
		),
	}),
	"bottom-tutu": (p) => ({
		main: (
			<g>
				<path d={skirt(p, HIP_Y + 34, 44)} fill={shade(p.c1, -0.1)} {...LINE} />
				<path d={skirt(p, HIP_Y + 22, 34)} fill={p.c1} fillOpacity={0.9} {...LINE} />
				<rect x={CX - 60} y={WAIST_Y - 8} width={120} height={10} fill={shade(p.c1, 0.3)} />
			</g>
		),
	}),
};

// ── Dresses: a bodice and a skirt in one ──

type DressOpts = {
	color: string;
	hem: number;
	flare?: number;
	sleeve?: number;
	neck?: { w: number; depth: number };
	skirtPattern?: ReactNode;
	trim?: ReactNode;
};

function dress(p: ArtProps, key: string, o: DressOpts) {
	const s = skirt(p, o.hem, o.flare ?? 34, WAIST_Y - 8);
	return (
		<g>
			{shirt(p, o.color, `${key}-b`, { sleeve: o.sleeve ?? 0.3, neck: o.neck ?? { w: 22, depth: 9 }, bottom: WAIST_Y + 4 })}
			<path d={s} fill={o.color} {...LINE} />
			{o.skirtPattern && (
				<Clip id={`${p.uid}-${key}`} d={s}>
					{o.skirtPattern}
				</Clip>
			)}
			{o.trim}
		</g>
	);
}

const flowers = (n: number, y0: number) =>
	Array.from({ length: n }, (_, i) => (
		<g key={i}>
			{[0, 72, 144, 216, 288].map((a) => (
				<circle
					key={a}
					cx={140 + i * 30 + 6 * Math.cos((a * Math.PI) / 180)}
					cy={y0 + (i % 2) * 34 + 6 * Math.sin((a * Math.PI) / 180)}
					r={5}
					fill="#f6b6c8"
				/>
			))}
			<circle cx={140 + i * 30} cy={y0 + (i % 2) * 34} r={3} fill="#f2c94c" />
		</g>
	));

const DRESSES: Record<string, Art> = {
	"dress-simple": (p) => ({ main: dress(p, "simple", { color: p.c1, hem: 500 }) }),
	"dress-sun": (p) => ({
		main: dress(p, "sun", {
			color: p.c1,
			hem: 510,
			sleeve: 0,
			neck: { w: 30, depth: 12 },
			skirtPattern: <rect x={0} y={488} width={400} height={30} fill={p.c2} />,
		}),
	}),
	"dress-stripe": (p) => ({ main: dress(p, "stripe", { color: p.c1, hem: 505, skirtPattern: stripes(p.c2, WAIST_Y, 520, 20, 9) }) }),
	"dress-dots": (p) => ({ main: dress(p, "dots", { color: p.c1, hem: 505, skirtPattern: dots(p.c2, WAIST_Y + 10, 520) }) }),
	"dress-tiered": (p) => ({
		main: dress(p, "tiered", {
			color: p.c1,
			hem: 520,
			flare: 44,
			sleeve: 0,
			skirtPattern: (
				<>
					<rect x={0} y={430} width={400} height={44} fill={p.c2} />
					<rect x={0} y={500} width={400} height={30} fill={shade(p.c1, -0.08)} />
				</>
			),
		}),
	}),
	"dress-jumpsuit": (p) => ({
		main: (
			<g>
				{pants(p, p.c1, ANKLE_Y - 8, 14)}
				{shirt(p, p.c1, "jump", { sleeve: 0, neck: { w: 26, depth: 11 }, bottom: WAIST_Y + 6 })}
				<rect x={CX - 60} y={WAIST_Y - 4} width={120} height={10} fill={shade(p.c1, -0.25)} />
			</g>
		),
	}),
	"dress-party": (p) => ({
		main: dress(p, "party", {
			color: p.c1,
			hem: 520,
			flare: 52,
			sleeve: 0.22,
			skirtPattern: dots(p.c2, WAIST_Y + 14, 530, 2.5, 16),
			trim: <rect x={CX - 58} y={WAIST_Y - 8} width={116} height={12} rx={6} fill={p.c2} {...LINE} />,
		}),
	}),
	"dress-gown": (p) => ({
		main: dress(p, "gown", {
			color: p.c1,
			hem: 600,
			flare: 80,
			sleeve: 0,
			neck: { w: 30, depth: 10 },
			skirtPattern: <path d={`M 80,600 Q 140,470 200,${WAIST_Y} Q 260,470 320,600 Z`} fill={p.c2} fillOpacity={0.45} />,
			trim: <path d={star(CX, WAIST_Y - 2, 9)} fill="#f2c94c" />,
		}),
	}),
	// Holiday dresses.
	"dress-newyear": (p) => ({
		main: dress(p, "ny", {
			color: p.c1,
			hem: 510,
			flare: 40,
			sleeve: 0,
			neck: { w: 26, depth: 11 },
			skirtPattern: dots(p.c2, WAIST_Y, 520, 3, 14),
		}),
	}),
	"dress-qipao": (p) => ({
		main: dress(p, "qipao", {
			color: p.c1,
			hem: 530,
			flare: 6,
			sleeve: 0.22,
			neck: { w: 12, depth: 2 },
			trim: (
				<g>
					<rect x={CX - 15} y={SHOULDER_Y - 12} width={30} height={13} rx={4} fill={p.c1} stroke={p.c2} strokeWidth={3} />
					<path
						d={`M ${CX + 2},${SHOULDER_Y + 2} Q ${CX + 30},${SHOULDER_Y + 14} ${CX + 36},${SHOULDER_Y + 36}`}
						stroke={p.c2}
						strokeWidth={3}
						fill="none"
					/>
					<circle cx={CX + 36} cy={SHOULDER_Y + 40} r={5} fill={p.c2} />
					{[0, 1, 2].map((i) => (
						<path key={i} d={`M ${CX - 30 + i * 10},${WAIST_Y + 40 + i * 16} q 14,-12 28,0 q -14,12 -28,0`} fill={p.c2} fillOpacity={0.8} />
					))}
				</g>
			),
		}),
	}),
	"dress-valentine": (p) => ({
		main: dress(p, "val", {
			color: p.c1,
			hem: 505,
			flare: 40,
			skirtPattern: (
				<g>
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<path key={i} d={heart(130 + (i % 3) * 70 + (i > 2 ? 35 : 0), 430 + (i > 2 ? 44 : 0), 10)} fill={p.c2} />
					))}
				</g>
			),
		}),
	}),
	"dress-abaya": (p) => ({
		main: dress(p, "abaya", {
			color: p.c1,
			hem: 600,
			flare: 30,
			sleeve: 1,
			neck: { w: 14, depth: 5 },
			trim: (
				<g stroke={p.c2} strokeWidth={4} fill="none">
					<path d={`M ${CX - 14},${SHOULDER_Y} Q ${CX},${SHOULDER_Y + 16} ${CX + 14},${SHOULDER_Y}`} />
					<path d={`M ${CX},${SHOULDER_Y + 10} L ${CX},${590}`} strokeDasharray="10 8" />
				</g>
			),
		}),
	}),
	"dress-spring": (p) => ({ main: dress(p, "spring", { color: p.c1, hem: 505, flare: 36, skirtPattern: <g>{flowers(5, 440)}</g> }) }),
	"dress-easter": (p) => ({
		main: dress(p, "easter", {
			color: p.c1,
			hem: 505,
			flare: 40,
			sleeve: 0.22,
			skirtPattern: (
				<>
					{zigzag(p.c2, 470, 10, 14)}
					{dots("#bfe3f0", 432, 440, 4, 22)}
				</>
			),
		}),
	}),
	"dress-kaftan": (p) => ({
		main: dress(p, "kaftan", {
			color: p.c1,
			hem: 592,
			flare: 40,
			sleeve: 0.7,
			neck: { w: 14, depth: 14 },
			trim: (
				<path
					d={`M ${CX - 16},${SHOULDER_Y} L ${CX},${SHOULDER_Y + 40} L ${CX + 16},${SHOULDER_Y}`}
					stroke={p.c2}
					strokeWidth={5}
					fill="none"
					strokeLinejoin="round"
				/>
			),
			skirtPattern: <rect x={0} y={566} width={400} height={20} fill={p.c2} />,
		}),
	}),
	"dress-pumpkin": (p) => ({
		main: dress(p, "pumpkin", {
			color: p.c1,
			hem: 495,
			flare: 56,
			sleeve: 0,
			skirtPattern: (
				<g>
					{[-40, -14, 14, 40].map((dx) => (
						<path
							key={dx}
							d={`M ${CX + dx * 0.6},${WAIST_Y} Q ${CX + dx * 1.8},${450} ${CX + dx * 1.2},${500}`}
							stroke={shade(p.c1, -0.25)}
							strokeWidth={3}
							fill="none"
						/>
					))}
				</g>
			),
			trim: <path d={`M ${CX - 8},${WAIST_Y - 6} q 8,-16 22,-12 q -10,6 -10,14 Z`} fill={p.c2} />,
		}),
	}),
	"dress-dia": (p) => ({
		main: dress(p, "dia", {
			color: p.c1,
			hem: 520,
			flare: 46,
			sleeve: 0.22,
			neck: { w: 28, depth: 10 },
			skirtPattern: (
				<g>
					{[468, 500].map((y, row) =>
						[0, 1, 2, 3, 4, 5].map((i) => (
							<circle
								key={`${y}${i}`}
								cx={120 + i * 32 + row * 16}
								cy={y}
								r={8}
								fill={["#e85d75", "#5fa3e0", "#f2c94c", "#5fc9a3"][(i + row) % 4]}
							/>
						)),
					)}
				</g>
			),
			trim: (
				<g>
					{["#e85d75", "#f2c94c", "#5fa3e0"].map((c, i) => (
						<circle key={c} cx={CX - 16 + i * 16} cy={SHOULDER_Y + 24} r={5} fill={c} />
					))}
				</g>
			),
		}),
	}),
	"dress-lehenga": (p) => {
		const d = dims(p.shape);
		const s = skirt(p, 596, 70, WAIST_Y - 2);
		return {
			main: (
				<g>
					<path d={s} fill={p.c1} {...LINE} />
					<Clip id={`${p.uid}-leh`} d={s}>
						<rect x={0} y={560} width={400} height={40} fill={p.c2} />
						{dots(p.c2, WAIST_Y + 30, 540, 3, 20)}
					</Clip>
					{shirt(p, shade(p.c1, -0.2), "leh-b", { sleeve: 0.3, neck: { w: 22, depth: 10 }, bottom: WAIST_Y - 14 })}
					<path
						d={`M ${CX - d.shoulder},${SHOULDER_Y + 4} Q ${CX},${WAIST_Y + 10} ${CX + d.shoulder + 10},${HIP_Y + 60}`}
						stroke={p.c2}
						strokeOpacity={0.75}
						strokeWidth={16}
						fill="none"
						strokeLinecap="round"
					/>
				</g>
			),
		};
	},
};

// ── Jackets ──

/** An open jacket: two front panels, sleeves, and an optional collar. */
function jacket(p: ArtProps, color: string, o: { hem?: number; lapel?: boolean; puffy?: boolean; sleeve?: number } = {}) {
	const d = dims(p.shape);
	const hem = o.hem ?? HIP_Y + 10;
	const e = EXTRA + 3;
	const panel = (s: 1 | -1) => {
		const x = (n: number) => CX + s * n;
		return `M ${x(d.shoulder + e)},${SHOULDER_Y + 22} Q ${x(d.shoulder + e)},${SHOULDER_Y - e / 2} ${x(d.shoulder + e - 22)},${SHOULDER_Y - e / 2} L ${x(18)},${SHOULDER_Y - 4} L ${x(14)},${hem} L ${x(halfWidth(d, hem, e))},${hem} L ${x(halfWidth(d, WAIST_Y, e))},${WAIST_Y} Z`;
	};
	return (
		<g>
			{sleeves(d, color, o.sleeve ?? 1, 14)}
			{([-1, 1] as const).map((s) => (
				<g key={s}>
					<path d={panel(s)} fill={color} {...LINE} />
					{o.lapel && (
						<path
							d={`M ${CX + s * 18},${SHOULDER_Y - 4} L ${CX + s * 36},${SHOULDER_Y + 40} L ${CX + s * 16},${SHOULDER_Y + 70}`}
							fill={shade(color, -0.15)}
							{...LINE}
						/>
					)}
					{o.puffy &&
						[0, 1, 2].map((i) => {
							const y = SHOULDER_Y + 40 + i * 34;
							return (
								<path
									key={i}
									d={`M ${CX + s * 16},${y} L ${CX + s * (halfWidth(d, y, e) - 2)},${y}`}
									stroke={shade(color, -0.25)}
									strokeWidth={2.5}
								/>
							);
						})}
				</g>
			))}
		</g>
	);
}

function cape(p: ArtProps, color: string, clasp: string, lining?: string) {
	const d = dims(p.shape);
	return {
		back: (
			<g>
				<path
					d={`M ${CX - d.shoulder},${SHOULDER_Y + 4} L ${CX + d.shoulder},${SHOULDER_Y + 4} L ${CX + d.shoulder + 60},${560} Q ${CX},${580} ${CX - d.shoulder - 60},${560} Z`}
					fill={color}
					{...LINE}
				/>
				{lining && (
					<path
						d={`M ${CX - d.shoulder + 10},${SHOULDER_Y + 14} L ${CX + d.shoulder - 10},${SHOULDER_Y + 14} L ${CX + d.shoulder + 40},${546} L ${CX - d.shoulder - 40},${546} Z`}
						fill={lining}
						fillOpacity={0.6}
					/>
				)}
			</g>
		),
		main: (
			<g>
				{([-1, 1] as const).map((s) => (
					<path
						key={s}
						d={`M ${CX + s * 16},${SHOULDER_Y - 2} L ${CX + s * (d.shoulder + 8)},${SHOULDER_Y + 6}`}
						stroke={color}
						strokeWidth={14}
						strokeLinecap="round"
					/>
				))}
				<circle cx={CX} cy={SHOULDER_Y + 4} r={8} fill={clasp} {...LINE} />
			</g>
		),
	};
}

const OUTER: Record<string, Art> = {
	"outer-denim": (p) => ({
		main: (
			<g>
				{jacket(p, p.c1, { lapel: true })}
				{([-1, 1] as const).map((s) => (
					<rect key={s} x={CX + s * 38 - 12} y={SHOULDER_Y + 34} width={24} height={18} rx={3} fill={shade(p.c1, -0.12)} {...LINE} />
				))}
			</g>
		),
	}),
	"outer-cardigan": (p) => ({
		main: (
			<g>
				{jacket(p, p.c1, { hem: HIP_Y + 24 })}
				{[40, 70, 100].map((y) => (
					<circle key={y} cx={CX - 20} cy={SHOULDER_Y + y} r={4} fill={shade(p.c1, -0.35)} />
				))}
			</g>
		),
	}),
	"outer-raincoat": (p) => ({
		main: (
			<g>
				{shirt(p, p.c1, "rain", { sleeve: 1, neck: { w: 16, depth: 4 }, bottom: HIP_Y + 54 })}
				{[40, 76, 112].map((y) => (
					<circle key={y} cx={CX} cy={SHOULDER_Y + y} r={5} fill={shade(p.c1, -0.4)} />
				))}
				<path
					d={`M ${CX - 34},${SHOULDER_Y - 6} Q ${CX},${SHOULDER_Y + 20} ${CX + 34},${SHOULDER_Y - 6}`}
					stroke={shade(p.c1, -0.2)}
					strokeWidth={8}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		),
	}),
	"outer-puffer": (p) => ({ main: jacket(p, p.c1, { puffy: true }) }),
	"outer-blazer": (p) => ({ main: jacket(p, p.c1, { lapel: true, hem: HIP_Y + 18 }) }),
	"outer-cape": (p) => cape(p, p.c1, "#f2c94c"),
	"outer-bat": (p) => cape(p, p.c1, "#8a5bd1", "#8a5bd1"),
	"outer-vest": (p) => ({ main: jacket(p, p.c1, { puffy: true, sleeve: 0 }) }),
};

// ── Socks ──

function sock(p: ArtProps, from: number, color: string, pattern?: string) {
	const d = dims(p.shape);
	return (
		<g>
			{([-1, 1] as const).map((s) => (
				<g key={s}>
					<path
						d={legPath(d, s, from, ANKLE_Y)}
						stroke={shade(color, -0.3)}
						strokeOpacity={0.5}
						strokeWidth={d.leg + 6}
						strokeLinecap="round"
						fill="none"
					/>
					<path d={legPath(d, s, from, ANKLE_Y)} stroke={color} strokeWidth={d.leg + 2} strokeLinecap="round" fill="none" />
					{pattern && (
						<path d={legPath(d, s, from + 6, ANKLE_Y - 4)} stroke={pattern} strokeWidth={d.leg + 2} strokeDasharray="8 8" fill="none" />
					)}
				</g>
			))}
		</g>
	);
}

const SOCKS: Record<string, Art> = {
	"socks-ankle": (p) => ({ main: sock(p, ANKLE_Y - 22, p.c1) }),
	"socks-knee": (p) => ({ main: sock(p, HIP_Y + 64, p.c1) }),
	"socks-stripe": (p) => ({ main: sock(p, HIP_Y + 64, p.c1, p.c2) }),
	"socks-tights": (p) => ({ main: pants(p, p.c1, ANKLE_Y, 2) }),
};

export const CLOTHES_ART: Record<string, Art> = { ...TOPS, ...BOTTOMS, ...DRESSES, ...OUTER, ...SOCKS };
