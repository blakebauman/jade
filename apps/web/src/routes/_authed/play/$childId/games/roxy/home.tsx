import {
	FLOORS,
	FURNITURE,
	FURNITURE_BY_ID,
	type Furniture,
	fits,
	footprint,
	type Home,
	MAX_FURNITURE,
	PALETTES,
	type Placed,
	ROOM,
	WALLPAPERS,
} from "@jade/core/roxy";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Footprints, Lock, Paintbrush, RotateCw, Trash2 } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useId, useState } from "react";
import { BuyChoice, CornerWallet } from "#/components/play/BuyChoice.tsx";
import { Destinations } from "#/components/roxy/Destinations.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { GameScreen, GameStatus, Hint } from "#/components/roxy/GameScreen.tsx";
import { TouchControls } from "#/components/roxy/TouchControls.tsx";
import { useDrive } from "#/components/roxy/world/useDrive.ts";
import { ApiError } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { useOnline } from "#/lib/hooks.ts";
import { type Pay, roxyApi, roxyQuery, type Studio, shownLook, useHomeDraft, useRevealed, useSendFinds } from "#/lib/roxy.ts";

// three.js only loads here, never on the practice screens.
const HomeScene = lazy(() => import("#/components/roxy/world/HomeScene.tsx").then((m) => ({ default: m.HomeScene })));

/** If this device can't draw 3D, say so and keep the rest of the screen (decorating still saves). */
class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		if (this.state.failed)
			return (
				<p className="grid size-full place-items-center p-6 text-center text-page-muted">
					This device can’t show the 3D room, but you can still decorate it below.
				</p>
			);
		return this.props.children;
	}
}

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/home")({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: RoxyHome,
});

function RoxyHome() {
	const child = useChild();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	return <HomeScreen key={child.id} childId={child.id} data={data} />;
}

const ROOM_LABEL: Record<Furniture["room"], string> = {
	bedroom: "Bedroom",
	living: "Living room",
	music: "Music room",
	gym: "Gym",
	art: "Art and science",
	pets: "For pets",
	holiday: "Holidays",
};
const PATTERN_LABEL: Record<Home["wall"]["pattern"], string> = {
	plain: "Plain",
	stripes: "Stripes",
	dots: "Dots",
	stars: "Stars",
	hearts: "Hearts",
};
const FLOOR_LABEL: Record<Home["floor"]["style"], string> = {
	wood: "Light wood",
	darkwood: "Dark wood",
	checker: "Checks",
	carpet: "Carpet",
};

const newUid = () => Math.random().toString(36).slice(2, 10);

/** The first spot in the room where this piece fits, scanning from the back-left corner. */
function freeSpot(home: Home, item: Furniture): Pick<Placed, "x" | "z" | "rot" | "wall"> | null {
	if (item.kind === "wall") {
		for (const wall of ["back", "left"] as const)
			for (let at = 0; at < (wall === "back" ? ROOM.w : ROOM.d); at++) {
				const p = { x: wall === "back" ? at : 0, z: wall === "left" ? at : 0, rot: 0, wall };
				if (fits(home, p, item)) return p;
			}
		return null;
	}
	for (let z = 0; z < ROOM.d; z++)
		for (let x = 0; x < ROOM.w; x++)
			for (const rot of [0, 1]) {
				if (fits(home, { x, z, rot }, item)) return { x, z, rot };
			}
	return null;
}

function HomeScreen({ childId, data }: { childId: string; data: Studio }) {
	const qc = useQueryClient();
	const online = useOnline();
	const id = useId();
	const draft = useHomeDraft(childId, data.home);
	useSendFinds(childId);
	const home = draft.home;
	const look = shownLook(childId, data);
	const [mode, setMode] = useState<"play" | "decorate">("play");
	const [walkTo, setWalkTo] = useState<{ x: number; z: number } | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const [unlocking, setUnlocking] = useState<Furniture | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const unlocked = new Set(data.unlocked);
	const off = new Set<string>(data.holidaysOff);
	const owned = (f: Furniture) => f.cost === 0 || unlocked.has(f.id);
	const picked = home.items.find((p) => p.uid === selected);
	const pickedItem = picked && FURNITURE_BY_ID.get(picked.item);

	const update = (items: Placed[]) => draft.set({ ...home, items });
	const others = (uid: string) => ({ ...home, items: home.items.filter((p) => p.uid !== uid) });

	/** Move or turn the picked piece, if it fits there. */
	function shift(change: Partial<Placed>) {
		if (!picked || !pickedItem) return;
		const next = { ...picked, ...change };
		if (!fits(others(picked.uid), next, pickedItem)) {
			setMessage("It doesn’t fit there. Try another spot.");
			return;
		}
		setMessage(null);
		update(home.items.map((p) => (p.uid === picked.uid ? next : p)));
	}

	function add(item: Furniture) {
		setMessage(null);
		if (!owned(item)) {
			setUnlocking(item);
			return;
		}
		place(item, home);
	}

	/** Put a piece in the first spot it fits in `room`. Says why not, and returns false, when it can't go in. */
	function place(item: Furniture, room: Home): boolean {
		if (room.items.length >= MAX_FURNITURE) {
			setMessage(`The room holds ${MAX_FURNITURE} things. Take one out first.`);
			return false;
		}
		const spot = freeSpot(room, item);
		if (!spot) {
			setMessage(`There’s no room for the ${item.label.toLowerCase()}. Move something first.`);
			return false;
		}
		const placed: Placed = { uid: newUid(), item: item.id, ...spot, ...(item.colour && { c1: item.colour }) };
		draft.set({ ...room, items: [...room.items, placed] });
		setSelected(placed.uid);
		return true;
	}

	async function unlock(item: Furniture, pay: Pay) {
		setBusy(true);
		try {
			await roxyApi.unlock(childId, item.id, pay);
			await qc.invalidateQueries({ queryKey: roxyQuery(childId).queryKey });
			await qc.invalidateQueries({ queryKey: ["progress", childId] });
			setUnlocking(null);
			// Unlocked to be used: it goes straight into the room, like tapping a piece already owned.
			if (place(item, draft.current())) setMessage(`The ${item.label.toLowerCase()} is yours, and it’s in the room!`);
		} catch (err) {
			setMessage(
				err instanceof ApiError && err.status === 409
					? "That costs a bit more than you have right now."
					: "Couldn’t unlock that. Check the connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	const palette = FURNITURE.filter((f) => !(f.holiday && off.has(f.holiday)));
	const rooms = [...new Set(palette.map((f) => f.room))];
	// Walking with the keys or the stick is for playing; decorating keeps the keys for the panel.
	const drive = useDrive(mode === "play");

	return (
		<GameScreen
			panelLabel="Decorating panel"
			panelKey="home"
			scene={
				<NoWebGL>
					<Suspense fallback={<GameLoading label="Opening the door…" />}>
						<HomeScene
							home={home}
							look={look}
							walkTo={walkTo}
							drive={drive}
							selected={mode === "decorate" ? selected : null}
							label={`Roxy’s home: ${home.items.length} things in the room`}
							onFloor={(spot) => {
								if (mode === "decorate" && picked && pickedItem && pickedItem.kind !== "wall") {
									const turned = picked.rot % 2 === 1;
									const w = turned ? pickedItem.d : pickedItem.w;
									const d = turned ? pickedItem.w : pickedItem.d;
									shift({ x: Math.round(spot.x - w / 2), z: Math.round(spot.z - d / 2) });
								} else setWalkTo(spot);
							}}
							onWall={(wall, at) => {
								if (mode === "decorate" && picked && pickedItem?.kind === "wall") {
									const start = Math.round(at - pickedItem.w / 2);
									shift(wall === "left" ? { wall, x: 0, z: start } : { wall, x: start, z: 0 });
								}
							}}
							onFurniture={(uid) => {
								if (mode === "decorate") return setSelected(uid);
								// Playing: walk over to it (she stops beside it, never on it).
								const p = home.items.find((x) => x.uid === uid);
								const item = p && FURNITURE_BY_ID.get(p.item);
								if (!p || !item) return;
								if (item.kind === "wall") {
									const at = p.wall === "left" ? { x: 0.6, z: p.z + item.w / 2 } : { x: p.x + item.w / 2, z: 0.8 };
									setWalkTo(at);
								} else {
									const f = footprint(p, item);
									setWalkTo({ x: f.x0 + f.w / 2, z: f.z0 + f.d / 2 });
								}
							}}
						/>
					</Suspense>
				</NoWebGL>
			}
			back={
				<Link
					to="/play/$childId/games/roxy"
					params={{ childId }}
					className="orb glass"
					aria-label="Back to the studio"
					title="Back to the studio"
				>
					<ArrowLeft aria-hidden />
				</Link>
			}
			eyebrow="Roxy’s world"
			title={
				<>
					Roxy’s <span>home</span>
				</>
			}
			orbs={
				<>
					<CornerWallet wallet={data.wallet} />
					<fieldset aria-label="What to do" className="glass flex gap-1 rounded-full p-1">
						<button
							type="button"
							className="orb !size-11"
							aria-pressed={mode === "play"}
							aria-label="Play"
							title="Play"
							onClick={() => setMode("play")}
						>
							<Footprints aria-hidden />
						</button>
						<button
							type="button"
							className="orb !size-11"
							aria-pressed={mode === "decorate"}
							aria-label="Decorate"
							title="Decorate"
							onClick={() => setMode("decorate")}
						>
							<Paintbrush aria-hidden />
						</button>
					</fieldset>
					<Destinations childId={childId} here="home" />
				</>
			}
			status={<GameStatus>{mode === "play" ? `${home.items.length} things in the room` : "Decorating"}</GameStatus>}
			hints={
				mode === "play" && (
					<>
						<Hint keys={["W", "A", "S", "D"]}>walk</Hint>
						<Hint keys={["Space"]}>hop</Hint>
						<Hint keys={["Click"]}>walk there</Hint>
					</>
				)
			}
			touch={mode === "play" && <TouchControls drive={drive} />}
			prompt={
				<div className="glass max-w-md rounded-[1.25rem] px-4 py-2 text-center">
					<p role="status" className="text-sm">
						{message ??
							(mode === "play"
								? "Tap the floor and Roxy walks there."
								: picked
									? "Tap the floor (or a wall) to move it there, or use the keys."
									: "Pick something to add, or tap a piece in the room to move it.")}
					</p>
					{draft.saving && !online && <p className="text-sm text-page-muted">Saved on this device. It’ll sync when you’re back online.</p>}
				</div>
			}
			{...(mode === "decorate" && {
				panel: (
					<div className="space-y-8">
						{unlocking && (
							<Revealed key={unlocking.id}>
								<BuyChoice
									name={`the ${unlocking.label.toLowerCase()}`}
									cost={unlocking.cost}
									wallet={data.wallet}
									online={online}
									busy={busy}
									onBuy={(pay) => void unlock(unlocking, pay)}
									onCancel={() => setUnlocking(null)}
								/>
							</Revealed>
						)}

						{/* Keyed by piece, so picking another (or adding one) brings its keys into view. */}
						{picked && pickedItem && (
							<Revealed key={picked.uid}>
								<section aria-labelledby={`${id}-picked`} className="patch space-y-3 p-4">
									<h2 id={`${id}-picked`} className="font-display text-xl font-semibold">
										{pickedItem.label}
									</h2>
									<div className="flex flex-wrap gap-2">
										{pickedItem.kind !== "wall" && (
											<button type="button" className="key" onClick={() => shift({ rot: (picked.rot + 1) % 4 })}>
												<RotateCw className="size-5" aria-hidden /> Turn
											</button>
										)}
										<MoveKeys picked={picked} kind={pickedItem.kind} onMove={shift} />
										<button
											type="button"
											className="key"
											onClick={() => {
												update(home.items.filter((p) => p.uid !== picked.uid));
												setSelected(null);
											}}
										>
											<Trash2 className="size-5" aria-hidden /> Put away
										</button>
									</div>
									{pickedItem.colour && (
										<Swatches
											value={picked.c1}
											label={`${pickedItem.label} colour`}
											onPick={(c1) => update(home.items.map((p) => (p.uid === picked.uid ? { ...p, c1 } : p)))}
										/>
									)}
								</section>
							</Revealed>
						)}

						<section aria-labelledby={`${id}-walls`} className="space-y-3">
							<h2 id={`${id}-walls`} className="font-display text-xl font-semibold">
								Walls and floor
							</h2>
							<fieldset aria-label="Wallpaper" className="flex flex-wrap gap-2">
								{WALLPAPERS.map((w) => (
									<button
										key={w}
										type="button"
										className="key !min-h-11"
										data-toggle
										aria-pressed={home.wall.pattern === w}
										data-pressed={home.wall.pattern === w}
										onClick={() => draft.set({ ...home, wall: { ...home.wall, pattern: w } })}
									>
										{PATTERN_LABEL[w]}
									</button>
								))}
							</fieldset>
							<Swatches value={home.wall.c1} label="Wall colour" onPick={(c1) => draft.set({ ...home, wall: { ...home.wall, c1 } })} />
							<fieldset aria-label="Floor" className="flex flex-wrap gap-2">
								{FLOORS.map((fl) => (
									<button
										key={fl}
										type="button"
										className="key !min-h-11"
										data-toggle
										aria-pressed={home.floor.style === fl}
										data-pressed={home.floor.style === fl}
										onClick={() =>
											draft.set({ ...home, floor: fl === "carpet" ? { style: fl, c1: home.floor.c1 ?? "f11" } : { style: fl } })
										}
									>
										{FLOOR_LABEL[fl]}
									</button>
								))}
							</fieldset>
							{home.floor.style === "carpet" && (
								<Swatches
									value={home.floor.c1}
									label="Carpet colour"
									onPick={(c1) => draft.set({ ...home, floor: { style: "carpet", c1 } })}
								/>
							)}
						</section>

						{rooms.map((room) => (
							<section key={room} aria-labelledby={`${id}-${room}`} className="space-y-3">
								<h2 id={`${id}-${room}`} className="font-display text-xl font-semibold">
									{ROOM_LABEL[room]}
								</h2>
								<ul className="flex flex-wrap gap-2">
									{palette
										.filter((f) => f.room === room)
										.map((f) => (
											<li key={f.id}>
												<button
													type="button"
													className="key !min-h-11 !px-3"
													onClick={() => add(f)}
													aria-label={`Add ${f.label}${owned(f) ? "" : `, ${f.cost} tickets`}`}
												>
													{f.label}
													{!owned(f) && (
														<span className="inline-flex items-center gap-0.5 text-sm text-page-muted">
															<Lock className="size-3.5" aria-hidden /> {f.cost}
														</span>
													)}
												</button>
											</li>
										))}
								</ul>
							</section>
						))}

						{home.items.length > 0 && (
							<section aria-labelledby={`${id}-in-room`} className="space-y-3">
								<h2 id={`${id}-in-room`} className="font-display text-xl font-semibold">
									In the room
								</h2>
								<ul className="flex flex-wrap gap-2">
									{home.items.map((p) => (
										<li key={p.uid}>
											<button
												type="button"
												className="key !min-h-11 !px-3"
												aria-pressed={p.uid === selected}
												data-pressed={p.uid === selected}
												onClick={() => setSelected(p.uid)}
											>
												{FURNITURE_BY_ID.get(p.item)?.label}
											</button>
										</li>
									))}
								</ul>
							</section>
						)}
					</div>
				),
			})}
		/>
	);
}

/** Scrolls into view when it opens (each `key` is a new opening): on a phone the furniture lists may be far below. */
function Revealed({ children }: { children: ReactNode }) {
	const ref = useRevealed<HTMLDivElement>();
	return (
		<div ref={ref} className="scroll-mt-6">
			{children}
		</div>
	);
}

/** Arrow keys for moving the picked piece one square, for anyone not tapping the room. */
function MoveKeys({ picked, kind, onMove }: { picked: Placed; kind: Furniture["kind"]; onMove: (c: Partial<Placed>) => void }) {
	if (kind === "wall") {
		const left = picked.wall === "left";
		const at = left ? picked.z : picked.x;
		const set = (n: number) => onMove(left ? { z: n } : { x: n });
		return (
			<>
				<button type="button" className="key" aria-label="Move along the wall, back" onClick={() => set(at - 1)}>
					<ArrowLeft className="size-5" aria-hidden />
				</button>
				<button type="button" className="key" aria-label="Move along the wall, forward" onClick={() => set(at + 1)}>
					<ArrowRight className="size-5" aria-hidden />
				</button>
				<button
					type="button"
					className="key"
					onClick={() => onMove(left ? { wall: "back", x: picked.z, z: 0 } : { wall: "left", z: picked.x, x: 0 })}
				>
					Other wall
				</button>
			</>
		);
	}
	return (
		<>
			<button type="button" className="key" aria-label="Move left" onClick={() => onMove({ x: picked.x - 1 })}>
				<ArrowLeft className="size-5" aria-hidden />
			</button>
			<button type="button" className="key" aria-label="Move right" onClick={() => onMove({ x: picked.x + 1 })}>
				<ArrowRight className="size-5" aria-hidden />
			</button>
			<button type="button" className="key" aria-label="Move back" onClick={() => onMove({ z: picked.z - 1 })}>
				<ArrowUp className="size-5" aria-hidden />
			</button>
			<button type="button" className="key" aria-label="Move forward" onClick={() => onMove({ z: picked.z + 1 })}>
				<ArrowDown className="size-5" aria-hidden />
			</button>
		</>
	);
}

function Swatches({ value, label, onPick }: { value: string | undefined; label: string; onPick: (key: string) => void }) {
	const colours = PALETTES.fabric as Record<string, string>;
	return (
		<fieldset aria-label={label} className="flex flex-wrap gap-2">
			{Object.keys(colours).map((k, i) => (
				<button
					key={k}
					type="button"
					aria-pressed={value === k}
					aria-label={`${label} ${i + 1}`}
					onClick={() => onPick(k)}
					className="size-10 rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] transition-transform active:translate-y-px aria-pressed:ring-4 aria-pressed:ring-page-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-page"
					style={{ background: colours[k] }}
				/>
			))}
		</fieldset>
	);
}
