/** Shapes and fabric patterns shared by Roxy's art. Patterns are meant to be clipped to the garment they're on. */

export const heart = (x: number, y: number, s: number) =>
	`M ${x},${y + s * 0.9} C ${x - s * 1.4},${y} ${x - s * 0.9},${y - s * 1.1} ${x},${y - s * 0.35} C ${x + s * 0.9},${y - s * 1.1} ${x + s * 1.4},${y} ${x},${y + s * 0.9} Z`;

export const star = (x: number, y: number, r: number, inner = 0.45, points = 5) => {
	const pts = Array.from({ length: points * 2 }, (_, i) => {
		const a = (Math.PI / points) * i - Math.PI / 2;
		const rr = i % 2 === 0 ? r : r * inner;
		return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
	});
	return `M ${pts.join(" L ")} Z`;
};

export const stripes = (color: string, from: number, to: number, gap = 18, width = 8) => (
	<g>
		{Array.from({ length: Math.ceil((to - from) / gap) }, (_, i) => (
			<rect key={i} x={0} y={from + i * gap} width={400} height={width} fill={color} />
		))}
	</g>
);

export const dots = (color: string, from: number, to: number, r = 5, gap = 22) => (
	<g>
		{Array.from({ length: Math.max(1, Math.ceil((to - from) / gap)) }, (_, row) =>
			Array.from({ length: Math.ceil(260 / gap) }, (_, col) => (
				<circle key={`${row}-${col}`} cx={70 + col * gap + (row % 2) * (gap / 2)} cy={from + row * gap} r={r} fill={color} />
			)),
		)}
	</g>
);

export const zigzag = (color: string, y: number, h = 12, w = 16) => (
	<polyline
		points={Array.from({ length: 26 }, (_, i) => `${i * w},${y + (i % 2 ? h : 0)}`).join(" ")}
		stroke={color}
		strokeWidth={5}
		fill="none"
		strokeLinejoin="round"
	/>
);
