import { Square, Tile } from "@jade/ui/components/tile";

/**
 * Shown when a route's data takes longer than a moment (the router waits ~1s before showing it): three tiles settle
 * onto the board beside an empty square. One drop, no looping spinner.
 */
export function Pending() {
	return (
		<main className="grid min-h-dvh place-items-center p-6 text-center" aria-busy="true">
			<div className="flex flex-col items-center gap-5">
				<span className="flex items-center gap-1.5" aria-hidden>
					{[0, 1, 2].map((i) => (
						<Tile key={i} size={40} grain={i} className="animate-tile-drop" style={{ animationDelay: `${i * 120}ms` }} />
					))}
					<Square size={40} active />
				</span>
				<p className="text-felt-muted" role="status">
					Setting up the board…
				</p>
			</div>
		</main>
	);
}
