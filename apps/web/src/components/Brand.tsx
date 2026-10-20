import { useId } from "react";

/**
 * The wordmark: "jade's world" as a die-cut sticker, red letters with a red star dotting the j, inside one white cut
 * line, as on the app icon. The red and white are fixed, so it reads the same on the shell in either light.
 *
 * The cut line is an SVG filter, not a text stroke: Fredoka's outlines overlap, and a stroke leaves specks of shell where
 * they cross. The filter grows the letters' shape by 0.12em, rounds it, fills it white, and adds the edge and drop
 * shadows under it. Its radii are in pixels, so they are worked out from `size`.
 */
const STAR = "M0 -10.5 L3.1 -3.6 L10.5 -3 L4.9 1.9 L6.6 9.3 L0 5.4 L-6.6 9.3 L-4.9 1.9 L-10.5 -3 L-3.1 -3.6 Z";

export function Brand({ size = 34 }: { size?: number }) {
	const id = `brand-cut-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const em = (n: number) => +(n * size).toFixed(2);
	return (
		<span className="brand-sticker" role="img" aria-label="Jade's World" style={{ fontSize: size, filter: `url(#${id})` }}>
			<svg aria-hidden="true" width="0" height="0" className="absolute">
				<filter id={id} x="-10%" y="-50%" width="120%" height="200%" colorInterpolationFilters="sRGB">
					{/* The cut: the letters grown and rounded off, filled white. */}
					<feMorphology in="SourceAlpha" operator="dilate" radius={em(0.12)} />
					<feGaussianBlur stdDeviation={em(0.04)} />
					<feComponentTransfer result="cut">
						<feFuncA type="linear" slope="6" intercept="-2.5" />
					</feComponentTransfer>
					<feFlood floodColor="#ffffff" />
					<feComposite in2="cut" operator="in" result="white" />
					{/* A faint dark edge, so the white line still shows on Day's pale shell, then a soft drop. */}
					<feDropShadow in="cut" dx="0" dy="0" stdDeviation={em(0.018)} floodColor="#000000" floodOpacity="0.3" result="edge" />
					<feDropShadow in="cut" dx="0" dy={em(0.05)} stdDeviation={em(0.03)} floodColor="#000000" floodOpacity="0.32" result="drop" />
					<feMerge>
						<feMergeNode in="drop" />
						<feMergeNode in="edge" />
						<feMergeNode in="white" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</svg>
			<span aria-hidden>
				<span className="relative inline-block">
					ȷ
					<svg
						aria-hidden="true"
						viewBox="-12 -12 24 24"
						overflow="visible"
						className="absolute"
						style={{ width: "0.36em", height: "0.36em", top: "-0.06em", left: "0.01em" }}
					>
						<path d={STAR} fill="currentColor" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
					</svg>
				</span>
				ade’s world
			</span>
		</span>
	);
}
