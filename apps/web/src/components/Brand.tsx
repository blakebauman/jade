import { useId } from "react";

/**
 * The wordmark: "jade’s world" cut from vinyl, dark ink letters on a white cut that follows every letter, lifted off
 * whatever it's stuck to, with a foil star for the apostrophe. It reads the same on the page in either light and on
 * any place's hue, because it brings its own white.
 */
export function Brand({ size = 34 }: { size?: number }) {
	return (
		<span className="vinyl-type" role="img" aria-label="Jade's World" style={{ fontSize: size, transform: "rotate(-2deg)" }}>
			<span aria-hidden className="vinyl-cut">
				<Jay cut />
				ade’s world
			</span>
			<span aria-hidden className="vinyl-ink">
				<Jay />
				ade’s world
			</span>
		</span>
	);
}

/** The j, dotless, with a holographic foil star stuck on where its dot would be, as on the app icon. */
function Jay({ cut }: { cut?: boolean }) {
	return (
		<span className="relative inline-block">
			ȷ
			<FoilStar cut={cut} />
		</span>
	);
}

function FoilStar({ cut }: { cut?: boolean }) {
	const id = useId();
	return (
		<svg
			aria-hidden="true"
			viewBox="-12 -12 24 24"
			overflow="visible"
			className="absolute"
			style={{ width: "0.4em", height: "0.4em", top: "-0.1em", left: "-0.01em" }}
		>
			{!cut && (
				<defs>
					<linearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
						<stop offset="0" stopColor="#e6eaee" />
						<stop offset="0.3" stopColor="#c3cff4" />
						<stop offset="0.55" stopColor="#e6caee" />
						<stop offset="0.8" stopColor="#c3ecda" />
						<stop offset="1" stopColor="#eceff1" />
					</linearGradient>
				</defs>
			)}
			<path
				d="M0 -10.5 L3.1 -3.6 L10.5 -3 L4.9 1.9 L6.6 9.3 L0 5.4 L-6.6 9.3 L-4.9 1.9 L-10.5 -3 L-3.1 -3.6 Z"
				fill={cut ? "#fbfdfb" : `url(#${id})`}
				stroke={cut ? "#fbfdfb" : "#1d2430"}
				strokeWidth={cut ? 14 : 1.6}
				strokeLinejoin="round"
			/>
		</svg>
	);
}
