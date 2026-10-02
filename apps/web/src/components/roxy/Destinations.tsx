import { PLACE_INFO, PLACES, type PlaceId } from "@jade/core/roxy";
import { Link } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import { useRef } from "react";

/** Where Roxy is now: the studio, her home, or a place in town. */
export type Here = "studio" | "home" | PlaceId;

/**
 * "Go to…": every place in Roxy's world from wherever she is, so a kid can hop from the park to the pet shop without
 * going back through Town. The one she's in is marked "here".
 */
export function Destinations({ childId, here }: { childId: string; here: Here }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const close = () => dialog.current?.close();
	const row = "key w-full !justify-between";
	const mark = (id: Here) =>
		id === here ? (
			<span className="font-body text-sm font-normal text-page-muted" aria-hidden>
				· here
			</span>
		) : null;
	return (
		<>
			<button
				type="button"
				className="orb glass"
				aria-label="Go to…"
				title="Go to…"
				aria-haspopup="dialog"
				onClick={() => dialog.current?.showModal()}
			>
				<MapPinned aria-hidden />
			</button>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: only a tap on the backdrop; the keyboard closes it with Esc or Cancel. */}
			<dialog
				ref={dialog}
				aria-labelledby="destinations-title"
				className="glass m-auto w-[min(22rem,calc(100vw-2rem))] rounded-[1.4rem] p-6 text-page-ink backdrop:bg-black/35 backdrop:backdrop-blur-sm"
				onClick={(e) => {
					// A tap on the backdrop (outside the card) closes it.
					if (e.target === e.currentTarget) close();
				}}
			>
				<h2 id="destinations-title" className="mb-4 font-display text-xl font-semibold">
					Where to?
				</h2>
				<nav aria-label="Places in Roxy’s world" className="grid gap-2">
					<Link
						to="/play/$childId/games/roxy"
						params={{ childId }}
						activeOptions={{ exact: true }}
						className={row}
						aria-current={here === "studio" ? "page" : undefined}
						onClick={close}
					>
						Studio {mark("studio")}
					</Link>
					<Link
						to="/play/$childId/games/roxy/home"
						params={{ childId }}
						activeOptions={{ exact: true }}
						className={row}
						aria-current={here === "home" ? "page" : undefined}
						onClick={close}
					>
						Roxy’s home {mark("home")}
					</Link>
					{PLACES.map((p) => (
						<Link
							key={p}
							to="/play/$childId/games/roxy/place/$placeId"
							params={{ childId, placeId: p }}
							activeOptions={{ exact: true }}
							className={row}
							aria-current={here === p ? "page" : undefined}
							onClick={close}
						>
							{PLACE_INFO[p].label} {mark(p)}
						</Link>
					))}
				</nav>
				<button type="button" className="mt-3 w-full py-2 text-center text-sm text-page-muted" onClick={close}>
					Cancel
				</button>
			</dialog>
		</>
	);
}
