/**
 * The wordmark: "jade's world" in white on one brand-red plate, with a white star dotting the j, as on the app icon.
 * The red and white are fixed, so it reads the same on the shell in either light.
 */
export function Brand({ size = 34 }: { size?: number }) {
	return (
		<span className="brand-plate" role="img" aria-label="Jade's World" style={{ fontSize: size }}>
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
						<path
							d="M0 -10.5 L3.1 -3.6 L10.5 -3 L4.9 1.9 L6.6 9.3 L0 5.4 L-6.6 9.3 L-4.9 1.9 L-10.5 -3 L-3.1 -3.6 Z"
							fill="currentColor"
							stroke="currentColor"
							strokeWidth={1.6}
							strokeLinejoin="round"
						/>
					</svg>
				</span>
				ade’s world
			</span>
		</span>
	);
}
