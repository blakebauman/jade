import { Maximize, Minimize, PanelRightClose, PanelRightOpen } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

/**
 * A game screen: the 3D scene is the screen, and everything else floats small in its corners on frosted glass.
 * - Top-left: the way back (a round key) and the masthead, a tiny eyebrow over a big title.
 * - Top-right: round icon keys (`orbs`, then Full screen and Show/Hide panel).
 * - Bottom-left: keyboard hints on a mouse-and-keyboard screen, or the touch controls on a touch one.
 * - Bottom-centre: a prompt ("Press E to…") over the action row (Undo, Save look…).
 * - Bottom-right: the status line ("2 of 5 found"); on a phone it sits under the title.
 * The panel floats as a glass sheet: on the right on wide screens, along the bottom on narrow ones, and the scene
 * shrinks to what it leaves. Whether it's open is remembered per screen. Edges keep clear of the notch and home bar.
 */
export function GameScreen({
	scene,
	back,
	eyebrow,
	title,
	orbs,
	status,
	hints,
	touch,
	prompt,
	actions,
	panel,
	panelLabel,
	panelKey,
	panelOpen = true,
	reveal,
}: {
	scene: ReactNode;
	/** The way back: a round `.orb.glass` link named by its aria-label ("Back to Town"). */
	back: ReactNode;
	eyebrow: string;
	/** The title. Wrap the accent word in a <span>: it's printed berry. */
	title: ReactNode;
	/** Top-right, before Full screen: stars, links to other screens, Go to…. */
	orbs?: ReactNode;
	status?: ReactNode;
	/** Keyboard hints (shown with a mouse and keyboard). */
	hints?: ReactNode;
	/** Touch controls (shown on a touch screen or a narrow window, while the bottom sheet is closed). */
	touch?: ReactNode;
	prompt?: ReactNode;
	actions?: ReactNode;
	panel?: ReactNode;
	panelLabel: string;
	/** Remembers the panel open or closed per screen (`jade.roxy.panel.{key}`). */
	panelKey?: string;
	/** Whether the panel starts open the first time. */
	panelOpen?: boolean;
	/** Opens the panel whenever it changes to something new (a hotspot tapped in the scene). */
	reveal?: string | null;
}) {
	const id = useId();
	const [open, setOpen] = usePanelOpen(panelKey, panelOpen);
	const full = useFullscreen();
	const sheet = open && !!panel;
	useEffect(() => {
		if (reveal) setOpen(true);
	}, [reveal]);
	return (
		<main className="scene-backdrop fixed inset-0 h-dvh w-full overflow-hidden text-page-ink">
			{/* The scene fills what the panel leaves: beside it on wide screens, above it on narrow ones. */}
			<div className={`absolute inset-0 ${sheet ? SCENE_BESIDE_PANEL : ""}`}>{scene}</div>

			<header
				className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 ${GUTTER_TOP} ${sheet ? "lg:right-[29.5rem]" : ""}`}
			>
				<div className="flex min-w-0 items-start gap-3">
					<div className="pointer-events-auto">{back}</div>
					<div className="min-w-0 select-none pt-0.5">
						<p className="eyebrow">{eyebrow}</p>
						<h1 className="mt-1 font-display text-[clamp(1.6rem,4vw,2.75rem)] font-semibold leading-[0.95] tracking-tight [&>span]:text-roxy">
							{title}
						</h1>
					</div>
				</div>
				<div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
					{orbs}
					{full.supported && (
						<button
							type="button"
							className="orb glass max-md:hidden"
							onClick={full.toggle}
							aria-pressed={full.on}
							aria-label={full.on ? "Exit full screen" : "Full screen"}
							title={full.on ? "Exit full screen" : "Full screen"}
						>
							{full.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
						</button>
					)}
					{panel && (
						<button
							type="button"
							className="orb glass"
							aria-expanded={open}
							aria-controls={`${id}-panel`}
							onClick={() => setOpen(!open)}
							aria-label={`${open ? "Hide" : "Show"} ${panelLabel.toLowerCase()}`}
							title={`${open ? "Hide" : "Show"} ${panelLabel.toLowerCase()}`}
						>
							{open ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
						</button>
					)}
				</div>
			</header>

			<div
				className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col gap-3 ${sheet ? `${GUTTER_ABOVE_PANEL} ${BAR_BESIDE_PANEL}` : `bottom-0 ${GUTTER_BOTTOM}`}`}
			>
				<div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
					{/* Hints only where there's room beside the actions (a container query on this corner). */}
					<div className="@container flex min-w-0 items-end">
						{hints && (
							<div className={`${FINE_ONLY} flex-wrap items-center gap-x-3 gap-y-1.5 text-xs whitespace-nowrap text-page-muted`}>
								{hints}
							</div>
						)}
					</div>
					<div className="flex flex-col items-center gap-2">
						{prompt && <div className="pointer-events-auto">{prompt}</div>}
						{actions && (
							<div className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-[1.4rem] p-1.5 max-md:text-sm">
								{actions}
							</div>
						)}
					</div>
					<div className="flex items-end justify-end">
						{/* One status, moved up under the title on a phone, where the bottom belongs to the stick. */}
						{status && (
							<div className="max-md:fixed max-md:top-[calc(max(0.75rem,env(safe-area-inset-top))+3.6rem)] max-md:left-[calc(max(0.75rem,env(safe-area-inset-left))+3.75rem)]">
								{status}
							</div>
						)}
					</div>
				</div>
				{/* The stick and Hop get their own row on a touch screen, under the actions. */}
				{touch && !sheet && <div className={`${TOUCH_ONLY} pointer-events-auto`}>{touch}</div>}
			</div>

			{sheet && (
				<section id={`${id}-panel`} aria-label={panelLabel} className={`glass ${PANEL}`}>
					{panel}
				</section>
			)}
		</main>
	);
}

/** The status line: a berry dot and a few words ("2 of 5 found"). */
export function GameStatus({ children }: { children: ReactNode }) {
	return (
		<p className="glass glass-pill !min-h-0 py-1.5 text-sm">
			<span
				className="size-1.5 rounded-full bg-roxy shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-roxy)_20%,transparent)]"
				aria-hidden
			/>
			{children}
		</p>
	);
}

/** A place's name as a masthead title: its last word is the accent ("The **park**", "Pet **shop**"). */
export function accent(label: string) {
	const at = label.lastIndexOf(" ");
	return at < 0 ? (
		<span>{label}</span>
	) : (
		<>
			{label.slice(0, at + 1)}
			<span>{label.slice(at + 1)}</span>
		</>
	);
}

/** One keyboard hint: the keys, then what they do. */
export function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			{keys.map((k) => (
				<kbd key={k} className="kbd">
					{k}
				</kbd>
			))}
			<span>{children}</span>
		</span>
	);
}

const GUTTER_TOP =
	"pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:pt-[max(1.5rem,env(safe-area-inset-top))] md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))]";
const GUTTER_BOTTOM =
	"pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))]";
/** Narrow: the sheet is 46dvh tall, 0.75rem off the bottom. Wide: a 28rem column, 0.75rem off the right. */
const SCENE_BESIDE_PANEL = "max-lg:bottom-[calc(46dvh+0.75rem)] lg:right-[29.5rem]";
const BAR_BESIDE_PANEL = "max-lg:bottom-[calc(46dvh+0.75rem)] lg:bottom-0 lg:right-[29.5rem]";
const GUTTER_ABOVE_PANEL = "px-3 pb-3 md:px-6 lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]";
const PANEL =
	"absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 h-[46dvh] overflow-y-auto overscroll-contain rounded-[1.25rem] p-4 lg:inset-x-auto lg:top-[max(0.75rem,env(safe-area-inset-top))] lg:right-[max(0.75rem,env(safe-area-inset-right))] lg:h-auto lg:w-[28rem] lg:p-6";
/** A mouse and keyboard on a window wide enough for hints; otherwise touch controls. */
const FINE_ONLY = "hidden [@media(pointer:fine)_and_(min-width:701px)]:@min-[10rem]:flex";
const TOUCH_ONLY = "[@media(pointer:fine)_and_(min-width:701px)]:hidden";

/** The panel open or closed, remembered on this device per screen (and fine without storage). */
function usePanelOpen(key: string | undefined, initial: boolean): [boolean, (open: boolean) => void] {
	const storeKey = key && `jade.roxy.panel.${key}`;
	const [open, setOpen] = useState(() => {
		if (!storeKey) return initial;
		try {
			const v = localStorage.getItem(storeKey);
			return v === null ? initial : v === "open";
		} catch {
			return initial;
		}
	});
	return [
		open,
		(next) => {
			setOpen(next);
			if (!storeKey) return;
			try {
				localStorage.setItem(storeKey, next ? "open" : "closed");
			} catch {
				// Storage blocked: it just isn't remembered.
			}
		},
	];
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
