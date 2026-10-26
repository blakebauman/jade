import { at, cellKey, sizeOf, TURTLE } from "@jade/core/code";
import { type BoardViewProps, tuckAt } from "./view.ts";

const S = 10;
/** Garden colours: scenes are always daylit, whatever the theme, and never use the four law colours. */
const C = {
	grass: "#a5d47f",
	grass2: "#99cb72",
	hedge: "#3e7d3b",
	hedgeHi: "#5a9c4c",
	pond: "#4a9fb4",
	pondHi: "#8fd0de",
	soil: "#8a5a35",
	soilHi: "#a87148",
	seed: "#5b3a1e",
	shell: "#5f8f3e",
	shellHi: "#86b257",
	skin: "#9fc46a",
	chalk: "#fbfaf4",
	post: "#6b5844",
	glass: "#e9ecef",
	glow: "#fff3c4",
	flag: "#f7f7f2",
	flower: "#e98bc0",
	ink: "#24302a",
};

/** The garden from above, in SVG. It takes the same props as the 3D board and stands in for it. */
export function FlatBoard({ board, garden, playing, onCell, chosen, answer, label }: BoardViewProps) {
	const { w, h } = sizeOf(board);
	const tuck = tuckAt(garden, playing);
	const said = playing?.ev.t === "say" ? playing.ev.text : (garden.said.at(-1) ?? null);
	const picking = playing && (playing.ev.t === "pick" || playing.ev.t === "light" || playing.ev.t === "plant") ? playing : null;
	const cells: { x: number; y: number; ch: string }[] = [];
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y, ch: at(board, { x, y }) });

	return (
		<div className="relative" style={{ aspectRatio: `${w} / ${h}` }}>
			<svg viewBox={`-1 -1 ${w * S + 2} ${h * S + 2}`} className="block size-full" role="img" aria-label={label}>
				<rect x={-1} y={-1} width={w * S + 2} height={h * S + 2} rx={3} fill={C.soil} />
				{cells.map(({ x, y, ch }) => {
					const k = cellKey({ x, y });
					const px = x * S;
					const py = y * S;
					const grass = (x + y) % 2 ? C.grass : C.grass2;
					return (
						<g key={k}>
							<rect x={px} y={py} width={S} height={S} fill={ch === "~" ? C.pond : grass} />
							{ch === "~" && (
								<path
									d={`M${px + 2} ${py + 4} q2 -1.5 4 0 M${px + 4} ${py + 7} q2 -1.5 4 0`}
									stroke={C.pondHi}
									strokeWidth={0.7}
									fill="none"
								/>
							)}
							{ch === "#" && (
								<g>
									<rect x={px + 0.6} y={py + 0.6} width={S - 1.2} height={S - 1.2} rx={3.2} fill={C.hedge} />
									<circle cx={px + 3.6} cy={py + 3.6} r={1.6} fill={C.hedgeHi} />
									<circle cx={px + 6.6} cy={py + 5.4} r={1.2} fill={C.hedgeHi} />
								</g>
							)}
							{ch === "o" && !garden.painted.includes(k) && (
								<rect
									x={px + 1.2}
									y={py + 1.2}
									width={S - 2.4}
									height={S - 2.4}
									rx={1.5}
									fill="none"
									stroke={C.chalk}
									strokeWidth={0.7}
									strokeDasharray="1.6 1.2"
								/>
							)}
							{garden.painted.includes(k) && (
								<rect x={px + 1} y={py + 1} width={S - 2} height={S - 2} rx={1.5} fill={C.chalk} opacity={ch === "o" ? 0.92 : 0.6} />
							)}
							{ch === "s" && !garden.picked.includes(k) && (
								<g opacity={picking?.ev.t === "pick" && cellKey(picking.ev.at) === k ? 1 - picking.t : 1}>
									<ellipse cx={px + 5} cy={py + 5.6} rx={2.6} ry={1.6} fill={C.soilHi} />
									<ellipse cx={px + 5} cy={py + 5} rx={1.1} ry={1.6} fill={C.seed} />
								</g>
							)}
							{ch === "b" && (
								<g>
									<rect x={px + 1.5} y={py + 1.5} width={S - 3} height={S - 3} rx={1.2} fill={C.soil} />
									{garden.planted.includes(k) || (picking?.ev.t === "plant" && cellKey(picking.ev.at) === k) ? (
										<g transform={`translate(${px + 5} ${py + 5}) scale(${garden.planted.includes(k) ? 1 : (picking?.t ?? 1)})`}>
											{[0, 72, 144, 216, 288].map((a) => (
												<circle
													key={a}
													cx={Math.cos((a * Math.PI) / 180) * 1.6}
													cy={Math.sin((a * Math.PI) / 180) * 1.6}
													r={1.2}
													fill={C.flower}
												/>
											))}
											<circle r={0.9} fill={C.glow} />
										</g>
									) : (
										<path d={`M${px + 3} ${py + 4} h4 M${px + 3} ${py + 6} h4`} stroke={C.soilHi} strokeWidth={0.6} />
									)}
								</g>
							)}
							{ch === "L" && (
								<Lantern x={px} y={py} lit={garden.lit.includes(k) || (picking?.ev.t === "light" && cellKey(picking.ev.at) === k)} />
							)}
							{ch === "F" && (
								<g>
									<line x1={px + 4} y1={py + 1.5} x2={px + 4} y2={py + 8.6} stroke={C.post} strokeWidth={0.8} strokeLinecap="round" />
									<path d={`M${px + 4.3} ${py + 1.8} l4 1.6 l-4 1.6 z`} fill={C.flag} stroke={C.ink} strokeWidth={0.3} />
								</g>
							)}
						</g>
					);
				})}
				{chosen && <Ring c={chosen} dashed={!!answer} />}
				{answer && <Ring c={answer} />}
				<g transform={`translate(${tuck.x * S + S / 2} ${tuck.y * S + S / 2 - tuck.hop * 0.8}) rotate(${tuck.angle})`} aria-hidden>
					<ellipse cx={0} cy={0.3} rx={3.6} ry={3.9} fill="rgb(0 0 0 / 0.12)" />
					{[-1, 1].map((sx) =>
						[-1, 1].map((sy) => <ellipse key={`${sx}${sy}`} cx={sx * 2.9} cy={sy * 2.2} rx={1.1} ry={0.8} fill={C.skin} />),
					)}
					<ellipse cx={0} cy={-3.9} rx={1.4} ry={1.6} fill={C.skin} />
					<circle cx={-0.6} cy={-4.4} r={0.3} fill={C.ink} />
					<circle cx={0.6} cy={-4.4} r={0.3} fill={C.ink} />
					<ellipse cx={0} cy={0} rx={3.2} ry={3.6} fill={C.shell} />
					<path d="M0 -2.2 l1.8 1.1 v2.2 l-1.8 1.1 l-1.8 -1.1 v-2.2 z" fill={C.shellHi} />
					{garden.pen && <circle cx={0} cy={3.4} r={0.7} fill={C.chalk} stroke={C.ink} strokeWidth={0.25} />}
				</g>
				{onCell &&
					cells.map(({ x, y, ch }) =>
						ch === "#" || ch === "~" ? null : (
							// biome-ignore lint/a11y/useSemanticElements: an SVG square can't be a <button>; it takes the button role and keys.
							<rect
								key={`hit-${x}-${y}`}
								x={x * S}
								y={y * S}
								width={S}
								height={S}
								fill="transparent"
								role="button"
								tabIndex={0}
								aria-label={`Row ${y + 1}, square ${x + 1}`}
								className="cursor-pointer outline-none focus-visible:stroke-[var(--color-page-ink)] focus-visible:[stroke-width:0.8]"
								onClick={() => onCell({ x, y })}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onCell({ x, y });
									}
								}}
							/>
						),
					)}
			</svg>
			{said && (
				<p
					className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-2xl bg-white px-3 py-1.5 font-display text-lg text-[#24302a] shadow-md"
					style={{ left: `${((tuck.x + 0.5) / w) * 100}%`, top: `${(tuck.y / h) * 100}%` }}
				>
					<span className="sr-only">{TURTLE} says </span>
					{said}
				</p>
			)}
		</div>
	);
}

function Lantern({ x, y, lit }: { x: number; y: number; lit: boolean }) {
	return (
		<g>
			{lit && <circle cx={x + 5} cy={y + 4} r={4.2} fill={C.glow} opacity={0.55} />}
			<line x1={x + 5} y1={y + 5} x2={x + 5} y2={y + 8.8} stroke={C.post} strokeWidth={0.8} />
			<rect x={x + 3.4} y={y + 2.2} width={3.2} height={3.4} rx={0.7} fill={lit ? C.glow : C.glass} stroke={C.post} strokeWidth={0.5} />
		</g>
	);
}

/** A chosen square: an ink ring (dashed once the real answer is shown beside it). */
function Ring({ c, dashed }: { c: { x: number; y: number }; dashed?: boolean }) {
	return (
		<rect
			x={c.x * S + 0.5}
			y={c.y * S + 0.5}
			width={S - 1}
			height={S - 1}
			rx={2}
			fill="none"
			stroke={C.ink}
			strokeWidth={0.9}
			strokeDasharray={dashed ? "1.5 1" : undefined}
		/>
	);
}
