import {
	FLOORS,
	FURNITURE,
	FURNITURE_BY_ID,
	type Furniture,
	fits,
	type Home,
	MAX_FURNITURE,
	PALETTES,
	type Placed,
	ROOM,
	WALLPAPERS,
} from "@jade/core/roxy";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Footprints, Lock, Paintbrush, RotateCw, Star, Trash2 } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useId, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { ApiError } from "#/lib/api.ts";
import { useChild } from "#/lib/child.ts";
import { useOnline } from "#/lib/hooks.ts";
import { roxyApi, roxyQuery, type Studio, shownLook, useHomeDraft } from "#/lib/roxy.ts";

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
				<p className="grid size-full place-items-center p-6 text-center text-felt-muted">
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
		if (home.items.length >= MAX_FURNITURE) {
			setMessage(`The room holds ${MAX_FURNITURE} things. Take one out first.`);
			return;
		}
		const spot = freeSpot(home, item);
		if (!spot) {
			setMessage(`There’s no room for the ${item.label.toLowerCase()}. Move something first.`);
			return;
		}
		const placed: Placed = { uid: newUid(), item: item.id, ...spot, ...(item.colour && { c1: item.colour }) };
		update([...home.items, placed]);
		setSelected(placed.uid);
	}

	async function unlock(item: Furniture) {
		setBusy(true);
		try {
			await roxyApi.unlock(childId, item.id);
			await qc.invalidateQueries({ queryKey: roxyQuery(childId).queryKey });
			await qc.invalidateQueries({ queryKey: ["progress", childId] });
			setUnlocking(null);
		} catch (err) {
			setMessage(
				err instanceof ApiError && err.status === 409
					? "Not enough stars yet. Keep practicing to earn more!"
					: "Couldn’t unlock that. Check the connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	const palette = FURNITURE.filter((f) => !(f.holiday && off.has(f.holiday)));
	const rooms = [...new Set(palette.map((f) => f.room))];

	return (
		<main className="mx-auto min-h-dvh max-w-6xl px-5 py-6 md:px-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Link to="/play/$childId/games/roxy" params={{ childId }} className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> Studio
					</Link>
					<h1 className="font-display text-3xl font-semibold">Roxy’s home</h1>
				</div>
				<div className="flex items-center gap-3">
					<p className="foil gap-1.5 px-3.5 py-1.5" title="Stars to spend">
						<Star className="size-5 fill-current" aria-hidden />
						<span className="font-display text-xl font-semibold tabular-nums">{data.balance}</span>
						<span className="sr-only">stars to spend</span>
					</p>
					<fieldset aria-label="What to do" className="flex gap-2">
						<button
							type="button"
							className="key"
							aria-pressed={mode === "play"}
							data-pressed={mode === "play"}
							onClick={() => setMode("play")}
						>
							<Footprints className="size-5" aria-hidden /> Play
						</button>
						<button
							type="button"
							className="key"
							aria-pressed={mode === "decorate"}
							data-pressed={mode === "decorate"}
							onClick={() => setMode("decorate")}
						>
							<Paintbrush className="size-5" aria-hidden /> Decorate
						</button>
					</fieldset>
				</div>
			</header>

			<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<section aria-label="The room" className="lg:sticky lg:top-6 lg:self-start">
					<div className="rack !p-2">
						<div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#cfe9f4] to-[#f4ead8]">
							<NoWebGL>
								<Suspense fallback={<p className="grid size-full place-items-center text-felt-muted">Opening the door…</p>}>
									<HomeScene
										home={home}
										look={look}
										walkTo={walkTo}
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
											if (mode === "decorate") setSelected(uid);
										}}
									/>
								</Suspense>
							</NoWebGL>
						</div>
					</div>
					<p role="status" className="mt-3 text-felt-muted">
						{message ??
							(mode === "play"
								? "Tap the floor and Roxy walks there."
								: picked
									? "Tap the floor (or a wall) to move it there, or use the keys."
									: "Pick something to add, or tap a piece in the room to move it.")}
					</p>
					{draft.saving && !online && <p className="text-sm text-felt-muted">Saved on this device. It’ll sync when you’re back online.</p>}
				</section>

				{mode === "decorate" && (
					<section aria-label="Decorate" className="space-y-8">
						{unlocking && (
							<UnlockFurniture
								item={unlocking}
								balance={data.balance}
								online={online}
								busy={busy}
								onUnlock={() => void unlock(unlocking)}
								onCancel={() => setUnlocking(null)}
							/>
						)}

						{picked && pickedItem && (
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
													aria-label={`Add ${f.label}${owned(f) ? "" : `, ${f.cost} stars`}`}
												>
													{f.label}
													{!owned(f) && (
														<span className="inline-flex items-center gap-0.5 text-sm text-felt-muted">
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
					</section>
				)}
			</div>
		</main>
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
					className="size-10 rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] transition-transform active:translate-y-px aria-pressed:ring-4 aria-pressed:ring-felt-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-felt"
					style={{ background: colours[k] }}
				/>
			))}
		</fieldset>
	);
}

function UnlockFurniture({
	item,
	balance,
	online,
	busy,
	onUnlock,
	onCancel,
}: {
	item: Furniture;
	balance: number;
	online: boolean;
	busy: boolean;
	onUnlock: () => void;
	onCancel: () => void;
}) {
	if (!online || balance < item.cost)
		return (
			<p role="status" className="patch flex flex-wrap items-center justify-between gap-3 p-4">
				<span>
					{!online ? (
						<>Unlocking the {item.label.toLowerCase()} needs the internet.</>
					) : (
						<>
							<span className="font-display text-lg font-semibold">{item.label}</span> needs {item.cost} stars. Earn {item.cost - balance}{" "}
							more in Spelling or Math!
						</>
					)}
				</span>
				<button type="button" className="key" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	return (
		<Confirm
			message={`Unlock the ${item.label.toLowerCase()} for ${item.cost} stars?`}
			note={`You have ${balance}. It’s yours to keep.`}
			confirmLabel="Unlock"
			cancelLabel="Not now"
			busy={busy}
			onConfirm={onUnlock}
			onCancel={onCancel}
		/>
	);
}
