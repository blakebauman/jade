import { seeded } from "@jade/core/math";
import {
	HOLIDAY_LABEL,
	ITEMS,
	type Item,
	isOwned,
	LOOK_NAME_MAX,
	type Look,
	lockedItemsIn,
	PALETTES,
	type PaletteName,
	PET_NAME_MAX,
	POSE_LABEL,
	POSES,
	REQUIRED_SLOTS,
	randomLook,
	SKIN,
	type SkinId,
	SLOT_LABEL,
	type Slot,
	TABS,
	wear,
} from "@jade/core/roxy";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	CalendarHeart,
	Check,
	Dices,
	Footprints,
	Gem,
	Gift,
	Glasses,
	House,
	Images,
	Mountain,
	Palette,
	PawPrint,
	PersonStanding,
	Save,
	Scissors,
	Shirt,
	Smile,
	Ticket,
	Undo2,
} from "lucide-react";
import { Component, type KeyboardEvent, lazy, type ReactNode, Suspense, useId, useMemo, useRef, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { BuyChoice, CornerWallet } from "#/components/play/BuyChoice.tsx";
import { ApiError } from "#/lib/api.ts";
import { useOnline } from "#/lib/hooks.ts";
import { useGamesFree } from "#/lib/play.ts";
import { questEvent } from "#/lib/quests.ts";
import {
	LOOK_NAMES,
	type OpenHoliday,
	type Pay,
	roxyApi,
	roxyQuery,
	type Studio as StudioData,
	tryOn,
	useRevealed,
	useRoxyDraft,
	useSendFinds,
	type Wallet,
} from "#/lib/roxy.ts";
import { Destinations } from "./Destinations.tsx";
import { GameLoading } from "./GameLoading.tsx";
import { GameScreen, Hint } from "./GameScreen.tsx";
import { RoxyFigure, SLOT_VIEW } from "./RoxyFigure.tsx";

// three.js only loads on game screens.
const StudioStage = lazy(() => import("./three/StudioStage.tsx").then((m) => ({ default: m.StudioStage })));

/**
 * The studio's drawers: the catalog's tabs with Makeup folded into Face and Gems into Extras, so a kid scans eight, not
 * ten. A link to an old tab id still opens the drawer it moved into.
 */
const FOLD: Record<string, string> = { makeup: "face", gems: "extras" };
const DRAWERS = TABS.filter((t) => !(t.id in FOLD)).map((t) => ({
	...t,
	slots: [...t.slots, ...TABS.filter((f) => FOLD[f.id] === t.id).flatMap((f) => f.slots)] as readonly Slot[],
}));

type TabId = (typeof TABS)[number]["id"] | "holiday";
const TAB_ICON: Record<TabId, typeof Shirt> = {
	holiday: CalendarHeart,
	body: PersonStanding,
	face: Smile,
	makeup: Palette,
	hair: Scissors,
	clothes: Shirt,
	shoes: Footprints,
	extras: Glasses,
	gems: Gem,
	pets: PawPrint,
	stage: Mountain,
};

const OPTIONAL = (slot: Slot) => !(REQUIRED_SLOTS as readonly Slot[]).includes(slot);

/** Everything in a slot this family can see: the everyday items, then holiday ones (unless a parent turned that holiday off). */
function itemsFor(slot: Slot, off: ReadonlySet<string>) {
	const all = ITEMS.filter((i) => i.slot === slot && !(i.holiday && off.has(i.holiday)));
	return [...all.filter((i) => !i.holiday), ...all.filter((i) => i.holiday)];
}

export function Studio({ childId, data, initialTab }: { childId: string; data: StudioData; initialTab?: string }) {
	const qc = useQueryClient();
	const online = useOnline();
	const id = useId();
	const draft = useRoxyDraft(childId, data);
	useSendFinds(childId);
	const unlocked = useMemo(() => new Set(data.unlocked), [data.unlocked]);
	const off = useMemo(() => new Set<string>(data.holidaysOff), [data.holidaysOff]);
	const holidays = data.holidays;
	const [tab, setTab] = useState<TabId>(() => {
		const wanted = initialTab && (FOLD[initialTab] ?? initialTab);
		return DRAWERS.some((t) => t.id === wanted) ? (wanted as TabId) : holidays.length > 0 ? "holiday" : "body";
	});
	const [posesOpen, setPosesOpen] = useState(false);
	/** Bumped on each save, so the stage flashes once like a camera. */
	const [flash, setFlash] = useState(0);
	const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());
	/** A locked item being tried on, waiting for "Unlock it?". */
	const [trying, setTrying] = useState<{ slot: Slot; item: Item } | null>(null);
	const gamesFree = useGamesFree(childId);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const shown = trying ? tryOn(draft.look, trying.slot, trying.item) : draft.look;
	const locked = lockedItemsIn(draft.look, unlocked);
	const refresh = () => qc.invalidateQueries({ queryKey: roxyQuery(childId).queryKey });
	const progressRefresh = () => qc.invalidateQueries({ queryKey: ["progress", childId] });

	function pick(slot: Slot, item: Item | null) {
		setMessage(null);
		if (!item) {
			setTrying(null);
			draft.set(wear(draft.look, slot, null));
			return;
		}
		if (!isOwned(item, unlocked)) {
			setTrying({ slot, item });
			return;
		}
		setTrying(null);
		draft.set(tryOn(draft.look, slot, item));
		triedOn(item);
	}

	/** Trying things on counts toward today's studio quest. */
	function triedOn(item: Item) {
		const [done] = questEvent(childId, { game: "studio", item: item.id }, gamesFree.current);
		if (done) setMessage(`Quest done: ${done.label}!`);
	}

	function colour(slot: Slot, which: "c1" | "c2", key: string) {
		const worn = draft.look.slots[slot];
		if (!worn) return;
		draft.set(wear(draft.look, slot, { ...worn, [which]: key }));
	}

	async function unlock(item: Item, slot: Slot, pay: Pay) {
		setBusy(true);
		try {
			await roxyApi.unlock(childId, item.id, pay);
			// The look as it is now, not as it was when "Unlock" was tapped.
			draft.set((look) => tryOn(look, slot, item));
			setTrying(null);
			triedOn(item);
			await Promise.all([refresh(), progressRefresh()]);
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

	async function claim(holiday: OpenHoliday) {
		setBusy(true);
		setMessage(null);
		try {
			await roxyApi.claim(childId, holiday.id);
			const gift = ITEMS.find((i) => i.id === holiday.gift)!;
			draft.set((look) => tryOn(look, gift.slot, gift));
			setTrying(null);
			await refresh();
		} catch (err) {
			// The server says why it refused (say, the device's date is off); anything else is the connection.
			setMessage(
				err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429
					? `Couldn’t open the gift. ${err.message}.`
					: "Couldn’t open the gift. Check the connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	function surprise() {
		setTrying(null);
		setMessage(null);
		draft.set(randomLook(seeded(Date.now() >>> 0), unlocked));
	}

	const tabs: { id: TabId; label: string; slots: readonly Slot[] }[] = [
		...(holidays.length > 0 ? [{ id: "holiday" as const, label: holidays.length === 1 ? holidays[0]!.label : "Holidays", slots: [] }] : []),
		...DRAWERS,
	];
	const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;

	// The tabs are one stop for Tab; arrows, Home and End move between them, as a tablist should.
	function onTabKey(e: KeyboardEvent) {
		const at = tabs.findIndex((t) => t.id === current.id);
		const to =
			e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
		if (to === null) return;
		e.preventDefault();
		const next = tabs[(to + tabs.length) % tabs.length]!;
		setTab(next.id);
		setTrying(null);
		tabRefs.current.get(next.id)?.focus();
	}
	const pose = draft.look.pose ?? "stand";
	function setPose(p: (typeof POSES)[number]) {
		const { pose: _, ...rest } = draft.look;
		draft.set(p === "stand" ? rest : { ...rest, pose: p });
	}

	return (
		<GameScreen
			panelLabel="Dress-up panel"
			panelKey="studio"
			scene={
				<>
					<Suspense fallback={<GameLoading label="Setting up the stage…" />}>
						<NoWebGL fallback={<RoxyFigure look={shown} title={describe(shown)} className="mx-auto block h-full w-auto py-20" />}>
							<StudioStage look={shown} label={describe(shown)} />
						</NoWebGL>
					</Suspense>
					{/* A saved look gets its photo: one white flash over the stage (none with reduced motion). */}
					{flash > 0 && <span key={flash} className="studio-flash" aria-hidden />}
				</>
			}
			back={
				<Link to="/play/$childId/games" params={{ childId }} className="orb glass" aria-label="Back to Games" title="Back to Games">
					<ArrowLeft aria-hidden />
				</Link>
			}
			eyebrow="Roxy’s studio"
			title={<>Roxy{shown.slots.pet && shown.petName && <span> and {shown.petName}</span>}</>}
			orbs={
				<>
					<CornerWallet wallet={data.wallet} />
					<Link
						to="/play/$childId/games/roxy/home"
						params={{ childId }}
						className="orb glass max-md:hidden"
						aria-label="Home"
						title="Roxy’s home"
					>
						<House aria-hidden />
					</Link>
					<Link
						to="/play/$childId/games/roxy/looks"
						params={{ childId }}
						className="orb glass relative"
						aria-label={`My looks (${data.looks.length})`}
						title="My looks"
					>
						<Images aria-hidden />
						{data.looks.length > 0 && (
							<span
								className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-roxy px-1 font-display text-xs font-semibold text-sticker-ink"
								aria-hidden
							>
								{data.looks.length}
							</span>
						)}
					</Link>
					<Destinations childId={childId} here="studio" />
				</>
			}
			hints={<Hint keys={["Drag"]}>turn Roxy round</Hint>}
			actions={
				<>
					{/* One Pose key, with the poses on a small glass row above it, so the bar stays one row and off Roxy's feet. */}
					<span className="relative">
						<button
							type="button"
							className="key"
							aria-expanded={posesOpen}
							aria-controls={`${id}-poses`}
							onClick={() => setPosesOpen(!posesOpen)}
						>
							<PersonStanding className="size-5" aria-hidden /> <span className="max-md:sr-only">Pose: </span>
							<span className="max-md:sr-only">{POSE_LABEL[pose]}</span>
						</button>
						{posesOpen && (
							<fieldset
								id={`${id}-poses`}
								aria-label="Pose"
								className="glass absolute bottom-full left-0 mb-3 flex w-max max-w-[calc(100vw-2rem)] flex-wrap gap-1.5 rounded-[1.4rem] p-1.5"
								onKeyDown={(e) => e.key === "Escape" && setPosesOpen(false)}
							>
								{POSES.map((p) => (
									<button
										key={p}
										type="button"
										className="key !min-h-11 !px-3 text-base"
										data-toggle
										aria-pressed={pose === p}
										data-pressed={pose === p}
										onClick={() => {
											setPose(p);
											setPosesOpen(false);
										}}
									>
										{POSE_LABEL[p]}
									</button>
								))}
							</fieldset>
						)}
					</span>
					<button type="button" className="key" onClick={draft.undo} disabled={!draft.canUndo}>
						<Undo2 className="size-5" aria-hidden /> <span className="max-md:sr-only">Undo</span>
					</button>
					<button type="button" className="key" onClick={surprise}>
						<Dices className="size-5" aria-hidden /> <span className="max-md:sr-only">Surprise me</span>
					</button>
					{!saving && (
						<button
							type="button"
							className="key"
							data-variant="go"
							onClick={() => {
								setTrying(null);
								setMessage(null);
								setSaving(true);
							}}
							// Nothing to save while a locked thing is worn, or while this is already a saved look.
							disabled={locked.length > 0 || !!draft.wornLookId}
						>
							<Save className="size-5" aria-hidden /> Save<span className="max-md:sr-only"> look</span>
						</button>
					)}
				</>
			}
			panel={
				<>
					{/* On an upright phone the tabs are one row that scrolls sideways, so they don't fill the sheet. */}
					<div
						role="tablist"
						aria-label="What to change"
						className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
						onKeyDown={onTabKey}
					>
						{tabs.map((t) => {
							const Icon = TAB_ICON[t.id];
							return (
								<button
									key={t.id}
									type="button"
									role="tab"
									id={`${id}-tab-${t.id}`}
									ref={(el) => {
										if (el) tabRefs.current.set(t.id, el);
									}}
									aria-selected={t.id === current.id}
									aria-controls={`${id}-panel`}
									tabIndex={t.id === current.id ? 0 : -1}
									data-pressed={t.id === current.id}
									className="key !min-h-11 shrink-0 !px-3.5 text-base"
									onClick={() => {
										setTab(t.id);
										setTrying(null);
									}}
								>
									<Icon className="size-5" aria-hidden /> {t.label}
								</button>
							);
						})}
					</div>

					{saving && (
						<SaveLook
							childId={childId}
							look={draft.look}
							online={online}
							onDone={async (saved) => {
								setSaving(false);
								if (saved) {
									draft.settle(saved.look, saved.id);
									setFlash((n) => n + 1);
									setMessage(`Saved “${saved.name}” to your looks. No one else in Jade’s World has this exact Roxy.`);
									await refresh();
								}
							}}
						/>
					)}
					{/* Always mounted, so each message is announced. */}
					<p role="status" className="empty:hidden mt-4 font-medium">
						{message}
					</p>
					<div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current.id}`} className="mt-6 space-y-8">
						{current.id === "holiday" &&
							holidays.map((h) => (
								<HolidayPanel
									key={h.id}
									holiday={h}
									look={draft.look}
									unlocked={unlocked}
									busy={busy}
									online={online}
									onClaim={() => void claim(h)}
									onPick={pick}
								/>
							))}
						{current.id === "body" && <SkinRow skin={draft.look.skin} onPick={(skin) => draft.set({ ...draft.look, skin })} />}
						{current.slots.map((slot) => (
							<SlotPicker
								key={slot}
								slot={slot}
								look={draft.look}
								items={itemsFor(slot, off)}
								unlocked={unlocked}
								trying={trying?.item.id}
								onPick={(item) => pick(slot, item)}
								onColour={(which, key) => colour(slot, which, key)}
							/>
						))}
						{current.id === "pets" && draft.look.slots.pet && (
							<PetName
								name={draft.look.petName}
								onName={(petName) => {
									const { petName: _, ...rest } = draft.look;
									draft.set(petName ? { ...rest, petName } : rest, null, "petName");
								}}
							/>
						)}
					</div>
					{trying && (
						<UnlockPrompt
							key={trying.item.id}
							item={trying.item}
							wallet={data.wallet}
							online={online}
							busy={busy}
							giftOpen={holidays.find((h) => trying.item.gift && h.id === trying.item.holiday)}
							onUnlock={(pay) => void unlock(trying.item, trying.slot, pay)}
							onClaim={(h) => void claim(h)}
							onCancel={() => setTrying(null)}
							childId={childId}
						/>
					)}
				</>
			}
		/>
	);
}

/** If this device can't draw 3D, show the drawing instead. */
class NoWebGL extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

const PET_NAMES = ["Biscuit", "Mochi", "Pepper", "Ziggy", "Noodle", "Sprout", "Pickle", "Luna", "Taco", "Bean"];

/** Name the pet with a tap, or type one. */
function PetName({ name, onName }: { name: string | undefined; onName: (name: string) => void }) {
	const headingId = useId();
	const [typed, setTyped] = useState(name && !PET_NAMES.includes(name) ? name : "");
	return (
		<section aria-labelledby={headingId}>
			<h2 id={headingId} className="font-display text-xl font-semibold">
				Pet’s name
			</h2>
			<fieldset aria-label="Pick a name for your pet" className="mt-3 flex flex-wrap gap-2">
				{PET_NAMES.map((n) => (
					<button
						key={n}
						type="button"
						aria-pressed={name === n}
						data-toggle
						data-pressed={name === n}
						className="key !min-h-11"
						onClick={() => onName(name === n ? "" : n)}
					>
						{n}
					</button>
				))}
			</fieldset>
			<label className="mt-3 block max-w-xs space-y-1.5">
				<span className="text-sm text-page-muted">Or type your own</span>
				<input
					className="field"
					value={typed}
					maxLength={PET_NAME_MAX}
					autoComplete="off"
					onChange={(e) => {
						setTyped(e.target.value);
						onName(e.target.value.trim());
					}}
				/>
			</label>
		</section>
	);
}

/** One line for screen readers: what this Roxy looks like right now. */
function describe(look: Look) {
	const names = (["form", "hair", "dress", "top", "bottom", "outer", "shoes", "hat", "pet"] as const)
		.map((s) => look.slots[s] && ITEMS.find((i) => i.id === look.slots[s]!.item)?.label)
		.filter(Boolean);
	return `Your Roxy: ${names.join(", ")}`;
}

function SkinRow({ skin, onPick }: { skin: SkinId; onPick: (s: SkinId) => void }) {
	return (
		<fieldset>
			<legend className="font-display text-xl font-semibold">Skin tone</legend>
			<Swatches palette="skin" value={skin} onPick={(k) => onPick(k as SkinId)} label="Skin tone" keys={Object.keys(SKIN)} />
		</fieldset>
	);
}

function Swatches({
	palette,
	value,
	onPick,
	label,
	keys,
	shown,
}: {
	palette: PaletteName;
	value?: string;
	onPick: (key: string) => void;
	label: string;
	keys?: string[];
	/** A visible name for the row, so two grids for one item read as main and second colour. */
	shown?: string;
}) {
	const colours = PALETTES[palette] as Record<string, string>;
	return (
		<fieldset aria-label={label} className="mt-3 flex flex-wrap gap-2">
			{shown && (
				<span aria-hidden className="w-full text-sm font-medium text-page-muted">
					{shown}
				</span>
			)}
			{(keys ?? Object.keys(colours)).map((k, i) => (
				<button
					key={k}
					type="button"
					aria-pressed={value === k}
					aria-label={`${label} ${i + 1}`}
					onClick={() => onPick(k)}
					className="size-11 rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] transition-transform active:translate-y-px aria-pressed:ring-4 aria-pressed:ring-page-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-page"
					style={{ background: colours[k] }}
				/>
			))}
		</fieldset>
	);
}

function SlotPicker({
	slot,
	look,
	items,
	unlocked,
	trying,
	onPick,
	onColour,
}: {
	slot: Slot;
	look: Look;
	items: Item[];
	unlocked: ReadonlySet<string>;
	trying: string | undefined;
	onPick: (item: Item | null) => void;
	onColour: (which: "c1" | "c2", key: string) => void;
}) {
	const worn = look.slots[slot];
	const wornItem = worn && items.find((i) => i.id === worn.item);
	const headingId = useId();
	return (
		<section aria-labelledby={headingId}>
			<h2 id={headingId} className="font-display text-xl font-semibold">
				{SLOT_LABEL[slot]}
			</h2>
			{slot === "form" && (
				<p className="text-sm text-page-muted">The moon gem turns your Roxy into an animal. Tap it again to turn back.</p>
			)}
			{slot === "gem" && <p className="text-sm text-page-muted">Each gem gives your Roxy animal ears and a tail.</p>}
			<ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2.5">
				{OPTIONAL(slot) && slot !== "background" && (
					<li>
						<ItemButton label="None" state={!worn ? "worn" : undefined} onClick={() => onPick(null)}>
							<span className="grid size-full place-items-center text-sm text-page-muted">None</span>
						</ItemButton>
					</li>
				)}
				{/* What the kid has first, then what's still to unlock, so the locks don't interleave with their own things. */}
				{[...items.filter((i) => isOwned(i, unlocked)), ...items.filter((i) => !isOwned(i, unlocked))].map((item) => {
					const owned = isOwned(item, unlocked);
					const state = trying === item.id ? "trying" : worn?.item === item.id ? "worn" : undefined;
					return (
						<li key={item.id}>
							<ItemButton
								label={`${item.label}${owned ? "" : item.gift ? ", free gift" : `, ${item.cost} tickets`}${item.holiday ? `, ${HOLIDAY_LABEL[item.holiday]}` : ""}${state === "trying" ? ", trying it on" : ""}`}
								state={state}
								// Tapping the moon gem's form again turns the Roxy back.
								onClick={() => onPick(slot === "form" && worn?.item === item.id ? null : item)}
								// A holiday's gift is never bought, so it shows no price.
								badge={owned ? undefined : item.gift ? "gift" : item.cost}
							>
								<RoxyFigure look={tryOn(look, slot, item)} viewBox={SLOT_VIEW[slot]} className="size-full" title={item.label} />
							</ItemButton>
						</li>
					);
				})}
			</ul>
			{wornItem?.colors?.map((palette, i) => (
				<Swatches
					key={palette + i}
					palette={palette}
					value={i === 0 ? worn?.c1 : worn?.c2}
					onPick={(k) => onColour(i === 0 ? "c1" : "c2", k)}
					label={`${wornItem.label} ${wornItem.colors!.length > 1 ? (i === 0 ? "main colour" : "second colour") : "colour"}`}
					shown={wornItem.colors!.length > 1 ? (i === 0 ? "Main colour" : "Second colour") : "Colour"}
				/>
			))}
		</section>
	);
}

function ItemButton({
	label,
	state,
	onClick,
	badge,
	children,
}: {
	label: string;
	/** Worn: an ink ring and a check. Trying on (locked, on the stage for a look): a dashed ring. */
	state?: "worn" | "trying";
	onClick: () => void;
	/** Locked: its price (tickets, or stars when linked), or "gift" for a holiday's free gift. */
	badge?: number | "gift";
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={state !== undefined}
			aria-label={label}
			onClick={onClick}
			data-state={state}
			className="studio-item relative block aspect-square w-full overflow-hidden rounded-xl bg-page-deep shadow-[inset_0_0.2em_0.5em_rgb(0_0_0/0.45)]"
		>
			{children}
			{state === "worn" && (
				<span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-page-ink text-page" aria-hidden>
					<Check className="size-4" strokeWidth={3} />
				</span>
			)}
			{badge !== undefined && (
				<span
					className="absolute right-1 bottom-1 inline-flex items-center gap-0.5 rounded-full bg-[rgb(20_23_30/0.85)] px-1.5 py-0.5 font-display text-xs font-semibold text-white tabular-nums"
					aria-hidden
				>
					{badge === "gift" ? (
						<Gift className="size-3.5" />
					) : (
						<>
							<Ticket className="size-3.5" /> {badge}
						</>
					)}
				</span>
			)}
		</button>
	);
}

type UnlockProps = {
	item: Item;
	wallet: Wallet;
	online: boolean;
	busy: boolean;
	/** For a holiday's gift: its holiday, while that's open. */
	giftOpen: OpenHoliday | undefined;
	onUnlock: (pay: Pay) => void;
	onClaim: (holiday: OpenHoliday) => void;
	onCancel: () => void;
	childId: string;
};

/** Sticks to the foot of the panel over the grid, so trying a locked thing never scrolls the kid away from where they were. */
function UnlockPrompt(props: UnlockProps) {
	return (
		<div className="sticky bottom-0 z-10 -mx-1 mt-4 rounded-[1.4rem] bg-page-raised p-1 shadow-[0_-0.5rem_1.5rem_-0.5rem_var(--tone-drop-deep)]">
			<UnlockChoice {...props} />
		</div>
	);
}

function UnlockChoice({ item, wallet, online, busy, giftOpen, onUnlock, onClaim, onCancel, childId }: UnlockProps) {
	// A holiday's gift is never bought: it's opened free while the holiday is on, and waits for it otherwise.
	if (item.gift && !giftOpen)
		return (
			<p role="status" className="flex flex-wrap items-center justify-between gap-3 p-4">
				<span>
					<span className="font-display text-lg font-semibold">{item.label}</span> is a free gift for {HOLIDAY_LABEL[item.holiday!]}. It
					opens the week before.
				</span>
				<button type="button" className="key" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	if (item.gift && !online)
		return (
			<p role="status" className="p-4">
				Opening your free {item.label.toLowerCase()} needs the internet.
				<button type="button" className="key ml-3" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	if (item.gift && giftOpen)
		return (
			<Confirm
				message={`Open your free ${item.label.toLowerCase()}?`}
				note={`It’s a ${giftOpen.label} gift. It’s free.`}
				confirmLabel="Open it"
				cancelLabel="Not now"
				busy={busy}
				onConfirm={() => onClaim(giftOpen)}
				onCancel={onCancel}
			/>
		);
	return (
		<BuyChoice
			earnIn={childId}
			name={item.label}
			cost={item.cost}
			wallet={wallet}
			online={online}
			busy={busy}
			onBuy={onUnlock}
			onCancel={onCancel}
		/>
	);
}

function HolidayPanel({
	holiday,
	look,
	unlocked,
	busy,
	online,
	onClaim,
	onPick,
}: {
	holiday: OpenHoliday;
	look: Look;
	unlocked: ReadonlySet<string>;
	busy: boolean;
	online: boolean;
	onClaim: () => void;
	onPick: (slot: Slot, item: Item) => void;
}) {
	const items = ITEMS.filter((i) => i.holiday === holiday.id);
	const gift = items.find((i) => i.gift)!;
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 id={headingId} className="text-2xl font-semibold">
						{holiday.label}
					</h2>
					<p className="text-page-muted">{holiday.note}</p>
				</div>
				{holiday.claimed ? (
					<p className="word-sticker text-sm">
						<Gift className="size-4" aria-hidden /> Gift opened
					</p>
				) : (
					<button type="button" className="key" disabled={busy || !online} onClick={onClaim}>
						<Gift className="size-5" aria-hidden /> Open your free {gift.label.toLowerCase()}
					</button>
				)}
			</div>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2.5">
				{items.map((item) => {
					const owned = isOwned(item, unlocked);
					return (
						<li key={item.id}>
							<ItemButton
								label={`${item.label}${owned ? "" : item.gift ? ", free gift" : `, ${item.cost} tickets`}`}
								state={look.slots[item.slot]?.item === item.id ? "worn" : undefined}
								onClick={() => onPick(item.slot, item)}
								badge={owned || (item.gift && !holiday.claimed) ? undefined : item.cost}
							>
								<RoxyFigure look={tryOn(look, item.slot, item)} viewBox={SLOT_VIEW[item.slot]} className="size-full" title={item.label} />
							</ItemButton>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function SaveLook({
	childId,
	look,
	online,
	onDone,
}: {
	childId: string;
	look: Look;
	online: boolean;
	onDone: (saved: { id: string; name: string; look: Look } | null) => void;
}) {
	const ref = useRevealed<HTMLFormElement>();
	const [name, setName] = useState(LOOK_NAMES[Math.floor(Math.random() * LOOK_NAMES.length)]!);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const id = useId();

	async function save() {
		setBusy(true);
		setError(null);
		try {
			const saved = await roxyApi.save(childId, name.trim(), look);
			onDone(saved);
		} catch (err) {
			const code = err instanceof ApiError ? err.message : "";
			const mine = err instanceof ApiError && err.data.mine === true;
			setError(
				code === "taken"
					? mine
						? "You’ve already saved this exact look. Change one thing to make a new one."
						: "Someone already made this exact Roxy! Change one thing to make it yours."
					: code === "full"
						? "Your gallery is full. Delete a look in My looks to make room."
						: "Couldn’t save. Check the connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<form
			ref={ref}
			className="mt-6 space-y-4 border-t border-page-line pt-5"
			aria-labelledby={`${id}-h`}
			onSubmit={(e) => {
				e.preventDefault();
				void save();
			}}
		>
			<h2 id={`${id}-h`} className="text-xl font-semibold">
				Name this look
			</h2>
			<fieldset aria-label="Pick a name" className="flex flex-wrap gap-2">
				{LOOK_NAMES.map((n) => (
					<button
						key={n}
						type="button"
						aria-pressed={name === n}
						data-toggle
						data-pressed={name === n}
						className="key !min-h-11"
						onClick={() => setName(n)}
					>
						{n}
					</button>
				))}
			</fieldset>
			<label className="block space-y-1.5">
				<span className="text-sm text-page-muted">Or type your own</span>
				<input className="field" value={name} maxLength={LOOK_NAME_MAX} onChange={(e) => setName(e.target.value)} autoComplete="off" />
			</label>
			{error && (
				<p role="alert" className="font-medium">
					{error}
				</p>
			)}
			{!online && <p className="text-page-muted">Saving needs the internet. Your Roxy is kept on this device until then.</p>}
			<div className="flex flex-wrap gap-2">
				<button type="button" className="key" onClick={() => onDone(null)}>
					Cancel
				</button>
				<button type="submit" className="key" data-variant="go" disabled={busy || !online || !name.trim()}>
					<Save className="size-5" aria-hidden /> Save
				</button>
			</div>
		</form>
	);
}
