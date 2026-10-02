import { type Appearance, DEFAULT_APPEARANCE, DEFAULT_PIN_RELOCK_MINUTES, PIN_RELOCK_MINUTES } from "@jade/core";
import { HOLIDAY_LABEL, HOLIDAYS } from "@jade/core/roxy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun, SunMoon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { Problem } from "#/components/Problem.tsx";
import { SignOut } from "#/components/SignOut.tsx";
import { api } from "#/lib/api.ts";
import { useSession } from "#/lib/auth.ts";
import { parentQuery } from "#/lib/queries.ts";
import { applyAppearance } from "#/lib/theme.ts";

export const Route = createFileRoute("/_authed/parent/settings")({
	// `newPin`: arrived from "Forgot the PIN?" on the gate, so lead with choosing a new one.
	validateSearch: (search: Record<string, unknown>): { newPin?: boolean } => (search.newPin === true ? { newPin: true } : {}),
	component: Settings,
});

const SAVE_FAILED = "Couldn’t save that. Check the connection and try again.";

function PinField({
	describedBy,
	id,
	label,
	value,
	onChange,
	autoFocus,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
	autoFocus?: boolean;
	describedBy?: string;
}) {
	return (
		<label htmlFor={id} className="flex flex-col gap-1.5">
			<span className="text-sm font-medium">{label}</span>
			<input
				id={id}
				type="password"
				className="field w-40 text-center text-2xl tracking-[0.4em]"
				inputMode="numeric"
				pattern="\d{4}"
				maxLength={4}
				value={value}
				onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
				autoComplete="off"
				aria-describedby={describedBy}
				aria-invalid={!!describedBy || undefined}
				// biome-ignore lint/a11y/noAutofocus: only after "Forgot the PIN?", where choosing a new one is the whole point
				autoFocus={autoFocus}
			/>
		</label>
	);
}

function Settings() {
	const { newPin } = Route.useSearch();
	const { data: parent } = useQuery(parentQuery);
	const { data: session } = useSession();
	const qc = useQueryClient();
	const id = useId();
	const [pin, setPin] = useState("");
	const [again, setAgain] = useState("");
	const [saved, setSaved] = useState<string | null>(null);
	const [askRemove, setAskRemove] = useState(false);
	const save = useMutation({
		mutationFn: (value: string | null) => api("/api/parent", { method: "PUT", json: { pin: value } }),
		onMutate: () => setSaved(null),
		onSuccess: (_, value) => {
			qc.invalidateQueries({ queryKey: ["parent"] });
			setPin("");
			setAgain("");
			setSaved(value ? "PIN saved. You’ll need it to open the parent area." : "PIN removed. The parent area opens without one.");
		},
	});
	const relock = useMutation({
		mutationFn: (minutes: number) => api("/api/parent", { method: "PUT", json: { pinRelockMinutes: minutes } }),
		onMutate: () => setSaved(null),
		onSuccess: (_, m) => {
			// The parent area's idle clock reads this; update it now rather than when a refetch lands.
			qc.setQueryData(parentQuery.queryKey, (old) => old && { ...old, pinRelockMinutes: m });
			qc.invalidateQueries({ queryKey: ["parent"] });
			setSaved(`Saved. The PIN is asked for again after ${m === 1 ? "1 minute" : `${m} minutes`} without a tap.`);
		},
	});
	const minutes = relock.isPending ? relock.variables : (parent?.pinRelockMinutes ?? DEFAULT_PIN_RELOCK_MINUTES);
	const mismatch = pin.length === 4 && again.length === 4 && pin !== again;
	function submit(e: FormEvent) {
		e.preventDefault();
		if (pin.length === 4 && pin === again) save.mutate(pin);
	}
	return (
		<div className="space-y-10">
			<h1 className="text-4xl font-semibold">Settings</h1>
			<div className="grid grid-cols-1 items-start gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<section className="max-w-xl space-y-4" aria-labelledby={`${id}-pin`}>
					<h2 id={`${id}-pin`} className="text-2xl font-semibold">
						Parent PIN
					</h2>
					{newPin && parent?.hasPin && (
						<p role="status" className="patch p-4">
							You’re in. Choose a new PIN below, or remove it.
						</p>
					)}
					<p className="text-page-muted">
						{parent?.hasPin
							? "Kids need the PIN to get in here. It’s asked for again when you go back to Practice, sign out, or leave this area alone for a while. Forgot it? Your account password always works instead."
							: "On a shared laptop or iPad, a 4-digit PIN keeps kids out of list editing. It’s a speed bump, not a password, and your account password always opens the parent area if you forget it."}
					</p>
					<form onSubmit={submit} className="space-y-3">
						<div className="flex flex-wrap items-end gap-3">
							<PinField
								id={`${id}-new`}
								label={parent?.hasPin ? "New PIN" : "Choose a PIN"}
								value={pin}
								onChange={setPin}
								autoFocus={newPin}
							/>
							<PinField
								id={`${id}-again`}
								label="Type it again"
								value={again}
								onChange={setAgain}
								describedBy={mismatch ? `${id}-mismatch` : undefined}
							/>
							<button type="submit" className="key" data-variant="go" disabled={pin.length !== 4 || pin !== again || save.isPending}>
								{save.isPending && save.variables ? "Saving…" : "Save PIN"}
							</button>
						</div>
						{mismatch && <Problem id={`${id}-mismatch`}>Those two don’t match. Type the same 4 digits in both.</Problem>}
					</form>
					{/* Always mounted, so each confirmation is announced. */}
					<p role="status">{saved}</p>
					{save.isError && <Problem>{SAVE_FAILED}</Problem>}
					{parent?.hasPin && (
						<div className="flex flex-wrap items-end gap-3 pt-2">
							<label className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">Ask again after</span>
								<select
									className="field w-fit"
									value={minutes}
									disabled={relock.isPending}
									onChange={(e) => relock.mutate(Number(e.target.value))}
								>
									{PIN_RELOCK_MINUTES.map((m) => (
										<option key={m} value={m}>
											{m === 1 ? "1 minute" : `${m} minutes`} without a tap
										</option>
									))}
								</select>
							</label>
							<button type="button" className="key" data-variant="felt" disabled={save.isPending} onClick={() => setAskRemove(true)}>
								Remove PIN
							</button>
						</div>
					)}
					{askRemove && parent?.hasPin && (
						<Confirm
							message="Remove the PIN?"
							note="Anyone using this device can then open the parent area."
							confirmLabel="Remove PIN"
							busy={save.isPending}
							onCancel={() => setAskRemove(false)}
							onConfirm={() => save.mutate(null, { onSettled: () => setAskRemove(false) })}
						/>
					)}
					{relock.isError && <Problem>{SAVE_FAILED}</Problem>}
				</section>
				<section className="patch space-y-4 p-6" aria-labelledby={`${id}-account`}>
					<h2 id={`${id}-account`} className="text-2xl font-semibold">
						Account
					</h2>
					<p className="text-page-muted">
						Signed in as <span className="text-page-ink">{session?.user.email}</span>
					</p>
					<SignOut />
				</section>
			</div>
			<AppearanceChoice />
			<RoxyHolidays />
		</div>
	);
}

const APPEARANCE_CHOICES = [
	{ value: "auto", label: "Auto", Icon: SunMoon },
	{ value: "day", label: "Day", Icon: Sun },
	{ value: "night", label: "Night", Icon: Moon },
] as const satisfies readonly { value: Appearance; label: string; Icon: unknown }[];

const APPEARANCE_NOTE: Record<Appearance, string> = {
	auto: "Follows each device: Day when the laptop or iPad is in light mode, Night when it’s in dark mode.",
	day: "The light page, on every device, all day and evening.",
	night: "The dimmer page under a warm lamp, on every device. Easier on the eyes at bedtime.",
};

/** Day, Night, or follow the device. It lights the page here at once and on every device the family signs in on. */
function AppearanceChoice() {
	const { data: parent } = useQuery(parentQuery);
	const qc = useQueryClient();
	const id = useId();
	const save = useMutation({
		mutationFn: (appearance: Appearance) => api("/api/parent", { method: "PUT", json: { appearance } }),
		onMutate: (appearance) => {
			applyAppearance(appearance);
			const before = qc.getQueryData(parentQuery.queryKey)?.appearance;
			qc.setQueryData(parentQuery.queryKey, (old) => old && { ...old, appearance });
			return { before };
		},
		onError: (_, __, ctx) => {
			if (ctx?.before) {
				applyAppearance(ctx.before);
				qc.setQueryData(parentQuery.queryKey, (old) => old && { ...old, appearance: ctx.before });
			}
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["parent"] }),
	});
	const current = parent?.appearance ?? DEFAULT_APPEARANCE;
	return (
		<section className="max-w-3xl space-y-4" aria-labelledby={`${id}-appearance`}>
			<h2 id={`${id}-appearance`} className="text-2xl font-semibold">
				Day and Night
			</h2>
			<div className="flex flex-wrap gap-2">
				{APPEARANCE_CHOICES.map(({ value, label, Icon }) => (
					<button
						key={value}
						type="button"
						className="key"
						data-pressed={current === value}
						aria-pressed={current === value}
						disabled={!parent}
						onClick={() => current !== value && save.mutate(value)}
					>
						<Icon className="size-5" aria-hidden /> {label}
					</button>
				))}
			</div>
			<p className="text-page-muted">{APPEARANCE_NOTE[current]}</p>
			{save.isError && <Problem>{SAVE_FAILED}</Problem>}
		</section>
	);
}

/** Which holidays Roxy celebrates for this family's kids. All are on until a parent turns one off. */
function RoxyHolidays() {
	const { data: parent } = useQuery(parentQuery);
	const qc = useQueryClient();
	const id = useId();
	const off = new Set(parent?.roxyHolidaysOff ?? []);
	const save = useMutation({
		mutationFn: (next: string[]) => api("/api/parent", { method: "PUT", json: { roxyHolidaysOff: next } }),
		onMutate: (next) => qc.setQueryData(parentQuery.queryKey, (old) => old && { ...old, roxyHolidaysOff: next }),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["parent"] });
			qc.invalidateQueries({ queryKey: ["roxy"] });
		},
	});
	return (
		<section className="max-w-3xl space-y-4" aria-labelledby={`${id}-holidays`}>
			<h2 id={`${id}-holidays`} className="text-2xl font-semibold">
				Holidays in Roxy
			</h2>
			<p className="text-page-muted">
				In the week before each holiday, Roxy shows its collection and a free gift. Turn off any your family would rather skip; its items
				are hidden too.
			</p>
			<div className="flex flex-wrap gap-2">
				{HOLIDAYS.map((h) => {
					const on = !off.has(h);
					return (
						<button
							key={h}
							type="button"
							className="key"
							data-toggle
							data-pressed={on}
							aria-pressed={on}
							disabled={!parent}
							onClick={() => save.mutate(on ? [...off, h] : [...off].filter((x) => x !== h))}
						>
							{HOLIDAY_LABEL[h]}
						</button>
					);
				})}
			</div>
			{save.isError && <Problem>{SAVE_FAILED}</Problem>}
		</section>
	);
}
