/** While a game's 3D is loading: a soft berry drop breathing over the scene's backdrop (still under reduced motion). */
export function GameLoading({ label = "Getting Roxy ready…" }: { label?: string }) {
	return (
		<div className="grid h-full w-full place-items-center" role="status">
			<div className="flex flex-col items-center gap-5 text-center">
				<div className="breathe" aria-hidden />
				<p className="font-display text-lg font-semibold">{label}</p>
			</div>
		</div>
	);
}
