import { Maximize, Minimize, PanelRightClose, PanelRightOpen } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

/**
 * A game screen: the 3D scene fills the whole window, the header floats over its top, and the controls sit in a
 * panel that can be tucked away to see the whole scene. On wide screens the panel is on the right; on a phone or an
 * upright iPad it's a sheet along the bottom. "Full screen" hides the browser's own bars where the browser allows it.
 */
export function GameScreen({
	scene,
	start,
	end,
	actions,
	panel,
	panelLabel,
}: {
	scene: ReactNode;
	/** Header, left: the way back and the title. */
	start: ReactNode;
	/** Header, right: stars and links. */
	end?: ReactNode;
	/** Keys that act on the scene (Undo, Save…), floating at its bottom. */
	actions?: ReactNode;
	panel?: ReactNode;
	panelLabel: string;
}) {
	const id = useId();
	const [open, setOpen] = useState(true);
	const full = useFullscreen();
	return (
		<main className="fixed inset-0 h-dvh w-full overflow-hidden bg-gradient-to-b from-[#cfe9f4] to-[#f4ead8]">
			{/* The scene fills what the panel leaves: beside it on wide screens, above it on narrow ones. */}
			<div className={`absolute inset-0 ${open && panel ? "bottom-[46dvh] lg:right-[30rem] lg:bottom-0" : ""}`}>{scene}</div>

			<header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-3 md:p-5">
				<div className="pointer-events-auto flex flex-wrap items-center gap-3">{start}</div>
				<div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
					{end}
					{full.supported && (
						<button type="button" className="key max-md:hidden" onClick={full.toggle} aria-pressed={full.on}>
							{full.on ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
							<span className="sr-only md:not-sr-only">{full.on ? "Exit full screen" : "Full screen"}</span>
						</button>
					)}
					{panel && (
						<button type="button" className="key" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((o) => !o)}>
							{open ? <PanelRightClose className="size-5" aria-hidden /> : <PanelRightOpen className="size-5" aria-hidden />}
							<span className="sr-only md:not-sr-only">
								{open ? "Hide" : "Show"} {panelLabel.toLowerCase()}
							</span>
						</button>
					)}
				</div>
			</header>

			{actions && (
				<div
					className={`pointer-events-none absolute inset-x-0 flex justify-center p-3 md:p-5 ${open && panel ? "bottom-[46dvh] lg:right-[30rem] lg:bottom-0" : "bottom-0"}`}
				>
					<div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 max-md:text-sm">{actions}</div>
				</div>
			)}

			{panel && open && (
				<section
					id={`${id}-panel`}
					aria-label={panelLabel}
					className="patch absolute inset-x-0 bottom-0 h-[46dvh] overflow-y-auto overscroll-contain !rounded-b-none p-4 shadow-2xl lg:inset-x-auto lg:top-0 lg:right-0 lg:h-dvh lg:w-[30rem] lg:!rounded-none lg:p-6 lg:pt-24"
				>
					{panel}
				</section>
			)}
		</main>
	);
}

/** The Fullscreen API, where the browser has it (not iPhone Safari). */
function useFullscreen() {
	const supported = typeof document !== "undefined" && !!document.documentElement.requestFullscreen && document.fullscreenEnabled;
	const [on, setOn] = useState(false);
	useEffect(() => {
		const sync = () => setOn(!!document.fullscreenElement);
		document.addEventListener("fullscreenchange", sync);
		return () => document.removeEventListener("fullscreenchange", sync);
	}, []);
	return {
		supported,
		on,
		toggle: () => {
			if (document.fullscreenElement) void document.exitFullscreen();
			else void document.documentElement.requestFullscreen().catch(() => {});
		},
	};
}
