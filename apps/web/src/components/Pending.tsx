/**
 * Shown when a route's data takes longer than a moment (the router waits ~1s before showing it): three stickers are
 * placed beside an empty slot. One placing, no looping spinner.
 */
export function Pending() {
	return (
		<main className="grid min-h-dvh place-items-center p-safe-6 text-center" aria-busy="true">
			<div className="flex flex-col items-center gap-5">
				<span className="flex items-center gap-2" aria-hidden>
					{[0, 1, 2].map((i) => (
						<span key={i} className="vinyl-disc size-10 animate-sticker-place" style={{ animationDelay: `${i * 120}ms` }} />
					))}
					<span className="slot size-10 !rounded-full" />
				</span>
				<p className="text-page-muted" role="status">
					Getting things ready…
				</p>
			</div>
		</main>
	);
}
