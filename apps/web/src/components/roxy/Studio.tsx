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
	Dices,
	Footprints,
	Gem,
	Gift,
	Glasses,
	House,
	Images,
	Lock,
	Mountain,
	Palette,
	PawPrint,
	PersonStanding,
	Save,
	Scissors,
	Shirt,
	Smile,
	Star,
	Undo2,
} from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useId, useMemo, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { ApiError } from "#/lib/api.ts";
import { useOnline } from "#/lib/hooks.ts";
import {
	LOOK_NAMES,
	type OpenHoliday,
	roxyApi,
	roxyQuery,
	type Studio as StudioData,
	tryOn,
	useRevealed,
	useRoxyDraft,
	useSendFinds,
} from "#/lib/roxy.ts";
import { GameScreen } from "./GameScreen.tsx";
import { RoxyFigure, SLOT_VIEW } from "./RoxyFigure.tsx";

// three.js only loads on game screens.
const StudioStage = lazy(() => import("./three/StudioStage.tsx").then((m) => ({ default: m.StudioStage })));

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
	const [tab, setTab] = useState<TabId>(
		TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : holidays.length > 0 ? "holiday" : "body",
	);
	/** A locked item being tried on, waiting for "Use stars?". */
	const [trying, setTrying] = useState<{ slot: Slot; item: Item } | null>(null);
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
	}

	function colour(slot: Slot, which: "c1" | "c2", key: string) {
		const worn = draft.look.slots[slot];
		if (!worn) return;
		draft.set(wear(draft.look, slot, { ...worn, [which]: key }));
	}

	async function unlock(item: Item, slot: Slot) {
		setBusy(true);
		try {
			await roxyApi.unlock(childId, item.id);
			// The look as it is now, not as it was when "Unlock" was tapped.
			draft.set((look) => tryOn(look, slot, item));
			setTrying(null);
			await Promise.all([refresh(), progressRefresh()]);
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
		...TABS,
	];
	const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;

	return (
		<GameScreen
			panelLabel="Dress-up panel"
			scene={
				<Suspense fallback={<p className="grid size-full place-items-center text-page-muted">Setting up the stage…</p>}>
					<NoWebGL fallback={<RoxyFigure look={shown} title={describe(shown)} className="mx-auto block h-full w-auto py-20" />}>
						<StudioStage look={shown} label={describe(shown)} />
					</NoWebGL>
				</Suspense>
			}
			start={
				<>
					<Link to="/play/$childId/games" params={{ childId }} className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> <span className="max-md:sr-only">Games</span>
					</Link>
					<h1 className="foil px-4 py-1.5 font-display text-2xl font-semibold max-md:sr-only">
						Roxy{shown.slots.pet && shown.petName && <span className="font-normal"> and {shown.petName}</span>}
					</h1>
				</>
			}
			end={
				<>
					<p className="foil gap-1.5 px-3.5 py-1.5" title="Stars to spend">
						<Star className="size-5 fill-current" aria-hidden />
						<span className="font-display text-xl font-semibold tabular-nums">{data.balance}</span>
						<span className="sr-only">stars to spend</span>
					</p>
					<Link to="/play/$childId/games/roxy/home" params={{ childId }} className="key">
						<House className="size-5" aria-hidden /> <span className="max-md:sr-only">Home</span>
					</Link>
					<Link to="/play/$childId/games/roxy/looks" params={{ childId }} className="key">
						<Images className="size-5" aria-hidden /> <span className="max-md:sr-only">My looks</span>{" "}
						<span className="text-page-muted">({data.looks.length})</span>
					</Link>
				</>
			}
			actions={
				<>
					{/* On a phone, one key steps through the poses; on bigger screens they're all there to pick. */}
					<button
						type="button"
						className="key md:hidden"
						onClick={() => {
							const now = POSES.indexOf(draft.look.pose ?? "stand");
							const next = POSES[(now + 1) % POSES.length]!;
							const { pose: _, ...rest } = draft.look;
							draft.set(next === "stand" ? rest : { ...rest, pose: next });
						}}
					>
						<PersonStanding className="size-5" aria-hidden />
						<span className="sr-only">Pose: {POSE_LABEL[draft.look.pose ?? "stand"]}. Tap for the next one.</span>
					</button>
					<fieldset aria-label="Pose" className="hidden flex-wrap gap-1.5 md:flex">
						{POSES.map((p) => (
							<button
								key={p}
								type="button"
								className="key !min-h-11 !px-3 text-base"
								data-toggle
								aria-pressed={(draft.look.pose ?? "stand") === p}
								data-pressed={(draft.look.pose ?? "stand") === p}
								onClick={() => {
									const { pose: _, ...rest } = draft.look;
									draft.set(p === "stand" ? rest : { ...rest, pose: p });
								}}
							>
								{POSE_LABEL[p]}
							</button>
						))}
					</fieldset>
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
							disabled={locked.length > 0}
						>
							<Save className="size-5" aria-hidden /> Save<span className="max-md:sr-only"> look</span>
						</button>
					)}
				</>
			}
			panel={
				<>
					<div role="tablist" aria-label="What to change" className="flex flex-wrap gap-2">
						{tabs.map((t) => {
							const Icon = TAB_ICON[t.id];
							return (
								<button
									key={t.id}
									type="button"
									role="tab"
									id={`${id}-tab-${t.id}`}
									aria-selected={t.id === current.id}
									aria-controls={`${id}-panel`}
									data-pressed={t.id === current.id}
									className="key !min-h-11 !px-3.5 text-base"
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
									setMessage(`Saved “${saved.name}” to your looks.`);
									await refresh();
								}
							}}
						/>
					)}
					{/* Always mounted, so each message is announced. */}
					<p role="status" className="empty:hidden mt-4 font-medium">
						{message}
					</p>
					{trying && (
						<UnlockPrompt
							key={trying.item.id}
							item={trying.item}
							balance={data.balance}
							online={online}
							busy={busy}
							giftOpen={holidays.find((h) => trying.item.gift && h.id === trying.item.holiday)}
							onUnlock={() => void unlock(trying.item, trying.slot)}
							onClaim={(h) => void claim(h)}
							onCancel={() => setTrying(null)}
						/>
					)}

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
	return `Your Roxy: ${names.join(", ").toLowerCase()}`;
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
}: {
	palette: PaletteName;
	value?: string;
	onPick: (key: string) => void;
	label: string;
	keys?: string[];
}) {
	const colours = PALETTES[palette] as Record<string, string>;
	return (
		<fieldset aria-label={label} className="mt-3 flex flex-wrap gap-2">
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
						<ItemButton label="None" selected={!worn} onClick={() => onPick(null)}>
							<span className="grid size-full place-items-center text-sm text-page-muted">None</span>
						</ItemButton>
					</li>
				)}
				{items.map((item) => {
					const owned = isOwned(item, unlocked);
					const selected = worn?.item === item.id || trying === item.id;
					return (
						<li key={item.id}>
							<ItemButton
								label={`${item.label}${owned ? "" : item.gift ? ", free gift" : `, ${item.cost} stars`}${item.holiday ? `, ${HOLIDAY_LABEL[item.holiday]}` : ""}`}
								selected={selected}
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
				/>
			))}
		</section>
	);
}

function ItemButton({
	label,
	selected,
	onClick,
	badge,
	children,
}: {
	label: string;
	selected: boolean;
	onClick: () => void;
	/** Locked: its price in stars, or "gift" for a holiday's free gift. */
	badge?: number | "gift";
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			aria-label={label}
			title={label}
			onClick={onClick}
			className="relative block aspect-square w-full overflow-hidden rounded-xl bg-page-deep shadow-[inset_0_0.2em_0.5em_rgb(0_0_0/0.45)] transition-transform active:translate-y-px aria-pressed:ring-4 aria-pressed:ring-page-ink"
		>
			{children}
			{badge !== undefined && (
				<span className="plaque absolute right-1 bottom-1 gap-0.5 px-1.5 py-0.5 text-xs" aria-hidden>
					{badge === "gift" ? (
						<Gift className="size-3" />
					) : (
						<>
							<Lock className="size-3" /> {badge}
						</>
					)}
				</span>
			)}
		</button>
	);
}

type UnlockProps = {
	item: Item;
	balance: number;
	online: boolean;
	busy: boolean;
	/** For a holiday's gift: its holiday, while that's open. */
	giftOpen: OpenHoliday | undefined;
	onUnlock: () => void;
	onClaim: (holiday: OpenHoliday) => void;
	onCancel: () => void;
};

function UnlockPrompt(props: UnlockProps) {
	const ref = useRevealed<HTMLDivElement>();
	return (
		<div ref={ref} className="scroll-mt-6">
			<UnlockChoice {...props} />
		</div>
	);
}

function UnlockChoice({ item, balance, online, busy, giftOpen, onUnlock, onClaim, onCancel }: UnlockProps) {
	// A holiday's gift is never bought: it's opened free while the holiday is on, and waits for it otherwise.
	if (item.gift && !giftOpen)
		return (
			<p role="status" className="patch mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
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
			<p role="status" className="patch mt-6 p-4">
				Opening your free {item.label.toLowerCase()} needs the internet.
				<button type="button" className="key ml-3" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	if (item.gift && giftOpen)
		return (
			<Confirm
				className="mt-6"
				message={`Open your free ${item.label.toLowerCase()}?`}
				note={`It’s a ${giftOpen.label} gift. No stars needed.`}
				confirmLabel="Open it"
				cancelLabel="Not now"
				busy={busy}
				onConfirm={() => onClaim(giftOpen)}
				onCancel={onCancel}
			/>
		);
	if (!online)
		return (
			<p role="status" className="patch mt-6 p-4">
				Unlocking {item.label} needs the internet. You can still try everything you own.
				<button type="button" className="key ml-3" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	if (balance < item.cost)
		return (
			<p role="status" className="patch mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
				<span>
					<span className="font-display text-lg font-semibold">{item.label}</span> needs {item.cost} stars. Earn {item.cost - balance} more
					in Spelling or Math!
				</span>
				<button type="button" className="key" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	return (
		<Confirm
			className="mt-6"
			message={`Unlock ${item.label} for ${item.cost} stars?`}
			note={`You have ${balance}. It’s yours to keep.`}
			confirmLabel="Unlock"
			cancelLabel="Not now"
			busy={busy}
			onConfirm={onUnlock}
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
		<section aria-labelledby={headingId} className="patch space-y-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 id={headingId} className="text-2xl font-semibold">
						{holiday.label}
					</h2>
					<p className="text-page-muted">{holiday.note}</p>
				</div>
				{holiday.claimed ? (
					<p className="plaque gap-1.5 px-3 py-1.5 text-sm">
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
								label={`${item.label}${owned ? "" : item.gift ? ", free gift" : `, ${item.cost} stars`}`}
								selected={look.slots[item.slot]?.item === item.id}
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
			setError(
				code === "taken"
					? "Someone already made this exact Roxy! Change one thing to make it yours."
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
			className="patch mt-6 space-y-4 p-5"
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
