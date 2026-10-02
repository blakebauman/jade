import { AVATARS, type ChildSettings, FONTS, VOICES } from "@jade/core";
import { generate, MATH_TOPICS, type Problem as MathProblem, type MathSkill, seeded, TOPIC_LABEL, TOPIC_SKILLS } from "@jade/core/math";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, Plus, Trash2, Volume2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { Problem } from "#/components/Problem.tsx";
import { api, type Child, failure } from "#/lib/api.ts";
import { childrenQuery, listsQuery, progressQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/parent/kids")({
	// `edit`: open this kid's editor (from "Change" on their Progress page).
	validateSearch: (search: Record<string, unknown>): { edit?: string } => (typeof search.edit === "string" ? { edit: search.edit } : {}),
	loader: ({ context }) =>
		Promise.all([context.queryClient.ensureQueryData(childrenQuery), context.queryClient.ensureQueryData(listsQuery)]),
	component: Kids,
});

/** Accent and character, from Deepgram's Aura-2 voice notes. */
const VOICE_INFO: Record<(typeof VOICES)[number], { group: "Women" | "Men"; label: string }> = {
	luna: { group: "Women", label: "Luna · American, friendly" },
	asteria: { group: "Women", label: "Asteria · American, clear" },
	athena: { group: "Women", label: "Athena · American, calm" },
	hera: { group: "Women", label: "Hera · American, warm" },
	cora: { group: "Women", label: "Cora · American, storyteller" },
	pandora: { group: "Women", label: "Pandora · British" },
	theia: { group: "Women", label: "Theia · Australian" },
	amalthea: { group: "Women", label: "Amalthea · Filipino" },
	orion: { group: "Men", label: "Orion · American, calm" },
	apollo: { group: "Men", label: "Apollo · American, casual" },
	draco: { group: "Men", label: "Draco · British" },
	hyperion: { group: "Men", label: "Hyperion · Australian" },
};

const FONT_LABEL: Record<(typeof FONTS)[number], string> = {
	fredoka: "Rounded",
	andika: "Andika (school print)",
	lexend: "Lexend",
	atkinson: "Atkinson",
};

const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const gradeName = (g: number | null) => (g === null ? "No grade set" : g === 0 ? "Kindergarten" : `Grade ${g}`);

const TABLES = Array.from({ length: 11 }, (_, i) => i + 2);
/** Quick picks for the times tables; any table can still be toggled on its own. */
const TABLE_PRESETS = [
	{ label: "All", tables: TABLES },
	{ label: "2, 5, 10", tables: [2, 5, 10] },
	{ label: "3, 4, 6–9", tables: [3, 4, 6, 7, 8, 9] },
	{ label: "11, 12", tables: [11, 12] },
];

function AvatarPicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
	const group = useId();
	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-medium">Tile number</legend>
			<p className="max-w-prose text-sm text-page-muted">
				Their first letter goes on the tile; the number in the corner is theirs to pick, so siblings can tell tiles apart.
			</p>
			<div className="flex flex-wrap gap-2">
				{AVATARS.map((a) => (
					<label key={a} className="cursor-pointer">
						<input
							type="radio"
							name={group}
							value={a}
							checked={value === a}
							onChange={() => onChange(a)}
							className="peer sr-only"
							aria-label={`Number ${a}`}
						/>
						<span className="block rounded-xl p-1 peer-checked:ring-3 peer-checked:ring-page-ink peer-focus-visible:outline-3 peer-focus-visible:outline-page-ink">
							<Tile letter={name.trim()[0]?.toUpperCase() || "?"} points={a} size={44} />
							<span className="mt-1 block text-center font-display text-base font-semibold tabular-nums" aria-hidden>
								{a}
							</span>
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function GradeSelect({ id, value, onChange }: { id: string; value: number | null; onChange: (g: number | null) => void }) {
	return (
		<select id={id} className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
			<option value="">—</option>
			{GRADES.map((g) => (
				<option key={g} value={g}>
					{g === 0 ? "K" : g}
				</option>
			))}
		</select>
	);
}

/**
 * Renames that couldn't be saved after their editor had already closed (the area locked, or the parent left). The Kids
 * page shows them until they're retried or let go, so a new name is never lost without a word.
 */
const lostRenames = {
	items: [] as { childId: string; name: string }[],
	listeners: new Set<() => void>(),
	set(items: { childId: string; name: string }[]) {
		this.items = items;
		for (const l of this.listeners) l();
	},
};
const useLostRenames = () =>
	useSyncExternalStore(
		(cb) => {
			lostRenames.listeners.add(cb);
			return () => lostRenames.listeners.delete(cb);
		},
		() => lostRenames.items,
	);

/** Saves a child's changes as they're made, and says so: "Saving…", then "Saved" for a moment, or what went wrong. */
function useChildUpdate(child: Child) {
	const qc = useQueryClient();
	const [savedAt, setSavedAt] = useState(0);
	const update = useMutation({
		mutationFn: (patch: Partial<Pick<Child, "name" | "avatar" | "grade">> & { settings?: Partial<ChildSettings> }) =>
			api<Child>(`/api/children/${child.id}`, { method: "PATCH", json: patch }),
		onSuccess: (next) => {
			qc.setQueryData<Child[]>(childrenQuery.queryKey, (kids) => kids?.map((k) => (k.id === next.id ? next : k)));
			qc.invalidateQueries({ queryKey: ["children"] });
			setSavedAt(Date.now());
		},
	});
	const [showSaved, setShowSaved] = useState(false);
	useEffect(() => {
		if (!savedAt) return;
		setShowSaved(true);
		const t = setTimeout(() => setShowSaved(false), 2500);
		return () => clearTimeout(t);
	}, [savedAt]);
	const status = update.isPending ? "Saving…" : update.isError ? null : showSaved ? "Saved" : null;
	return { update, status };
}

type Update = ReturnType<typeof useChildUpdate>;

/** One part of a child's settings, with its own "Saved" and its own error, beside the change that caused them. */
function Group({ title, save, children }: { title: string; save: Update; children: ReactNode }) {
	const id = useId();
	return (
		<section className="patch space-y-4 p-5" aria-labelledby={id}>
			<div className="flex items-baseline justify-between gap-3">
				<h3 id={id} className="font-display text-lg font-medium">
					{title}
				</h3>
				<SaveStatus status={save.status} />
			</div>
			{children}
			{save.update.isError && <Problem>{failure(save.update.error, "save that change")}</Problem>}
		</section>
	);
}

function SaveStatus({ status }: { status: string | null }) {
	return (
		<span className="inline-flex items-center gap-1 text-sm text-page-muted" role="status">
			{status === "Saved" && <Check className="size-4" aria-hidden />}
			{status}
		</span>
	);
}

function KidEditor({ child, onRemove }: { child: Child; onRemove: () => void }) {
	const about = useChildUpdate(child);
	const spelling = useChildUpdate(child);
	const math = useChildUpdate(child);
	const ids = { name: useId(), grade: useId(), voice: useId(), font: useId(), rate: useId() };
	const s = child.settings;
	const [name, setName] = useState(child.name);
	// Speed commits once the slider settles, not on every step of a drag.
	const [rate, setRate] = useState(s.rate);
	const rateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(rateTimer.current), []);
	function changeRate(v: number) {
		setRate(v);
		clearTimeout(rateTimer.current);
		rateTimer.current = setTimeout(() => spelling.update.mutate({ settings: { rate: v } }), 400);
	}
	// A rename typed but not yet committed (no blur, no Enter) still saves if this editor goes away: the parent area
	// locking itself, or a tap on Practice.
	const pendingName = useRef({ typed: child.name, saved: child.name });
	pendingName.current = { typed: name, saved: child.name };
	const qc = useQueryClient();
	useEffect(
		() => () => {
			const n = pendingName.current.typed.trim();
			if (n && n !== pendingName.current.saved)
				void api(`/api/children/${child.id}`, { method: "PATCH", json: { name: n } }).then(
					() => qc.invalidateQueries({ queryKey: ["children"] }),
					() => lostRenames.set([...lostRenames.items.filter((x) => x.childId !== child.id), { childId: child.id, name: n }]),
				);
		},
		[child.id, qc],
	);
	function commitName(e?: FormEvent) {
		e?.preventDefault();
		const n = name.trim();
		if (!n) return setName(child.name);
		if (n !== child.name) about.update.mutate({ name: n });
	}
	return (
		<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
			<div className="xl:col-span-2">
				<Group title={`About ${child.name}`} save={about}>
					<form onSubmit={commitName} className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
						<label htmlFor={ids.name} className="block min-w-0 space-y-1.5">
							<span className="text-sm font-medium">First name</span>
							<input
								id={ids.name}
								className="field"
								maxLength={40}
								value={name}
								onChange={(e) => setName(e.target.value)}
								onBlur={() => commitName()}
							/>
						</label>
						<label htmlFor={ids.grade} className="block min-w-0 space-y-1.5">
							<span className="text-sm font-medium">Grade</span>
							<GradeSelect id={ids.grade} value={child.grade} onChange={(grade) => about.update.mutate({ grade })} />
						</label>
					</form>
					<AvatarPicker value={child.avatar} name={child.name} onChange={(avatar) => about.update.mutate({ avatar })} />
				</Group>
			</div>

			<Group title="Spelling" save={spelling}>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="min-w-0 space-y-1.5 sm:col-span-2">
						<label htmlFor={ids.voice} className="block text-sm font-medium">
							Voice
						</label>
						<div className="flex gap-2">
							<select
								id={ids.voice}
								className="field min-w-0 flex-1"
								value={s.voice}
								onChange={(e) => spelling.update.mutate({ settings: { voice: e.target.value as ChildSettings["voice"] } })}
							>
								{(["Women", "Men"] as const).map((g) => (
									<optgroup key={g} label={g}>
										{VOICES.filter((v) => VOICE_INFO[v].group === g).map((v) => (
											<option key={v} value={v}>
												{VOICE_INFO[v].label}
											</option>
										))}
									</optgroup>
								))}
							</select>
							<button
								type="button"
								className="key shrink-0"
								data-variant="felt"
								aria-label={`Hear ${VOICE_INFO[s.voice].label.split(" · ")[0]}`}
								onClick={() => {
									speaker.unlock();
									speaker.voice = s.voice;
									void speaker.say("Your word is: necessary.", { kind: "sentence" });
								}}
							>
								<Volume2 className="size-5" aria-hidden />
							</button>
						</div>
					</div>
					<label htmlFor={ids.font} className="block min-w-0 space-y-1.5">
						<span className="text-sm font-medium">Letter style on tiles</span>
						<select
							id={ids.font}
							className="field"
							value={s.font}
							onChange={(e) => spelling.update.mutate({ settings: { font: e.target.value as ChildSettings["font"] } })}
						>
							{FONTS.map((f) => (
								<option key={f} value={f}>
									{FONT_LABEL[f]}
								</option>
							))}
						</select>
					</label>
					<label htmlFor={ids.rate} className="block min-w-0 space-y-1.5">
						<span className="flex justify-between text-sm font-medium">
							Speaking speed <span className="font-normal text-page-muted tabular-nums">{rate.toFixed(2)}×</span>
						</span>
						<input
							id={ids.rate}
							type="range"
							min={0.7}
							max={1.2}
							step={0.05}
							value={rate}
							onChange={(e) => changeRate(Number(e.target.value))}
							className="h-11 w-full"
						/>
					</label>
					<label className="flex min-h-11 cursor-pointer items-center gap-3 self-end">
						<input
							type="checkbox"
							className="size-6 shrink-0 accent-page-ink"
							checked={s.showLength}
							onChange={(e) => spelling.update.mutate({ settings: { showLength: e.target.checked } })}
						/>
						<span className="text-sm">Show how many letters (easier; a real bee doesn’t)</span>
					</label>
				</div>
			</Group>

			<Group title="Math" save={math}>
				<MathSettings child={child} onChange={(m) => math.update.mutate({ settings: { math: m } })} />
				<MathLevels child={child} />
			</Group>

			<div className="xl:col-span-2">
				<button type="button" className="key" data-variant="felt" onClick={onRemove}>
					<Trash2 className="size-4" aria-hidden /> Remove this child…
				</button>
			</div>
		</div>
	);
}

/** Which math topics and times tables this child practices. Difficulty within them adapts on its own. */
function MathSettings({ child, onChange }: { child: Child; onChange: (m: ChildSettings["math"]) => void }) {
	const m = child.settings.math;
	const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
	const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
	return (
		<div className="space-y-5">
			<fieldset className="space-y-2 border-0 p-0">
				<legend className="text-sm font-medium">Topics</legend>
				<div className="flex flex-wrap gap-2">
					{MATH_TOPICS.map((t) => {
						const on = m.topics.includes(t);
						return (
							<button
								key={t}
								type="button"
								className="key text-base"
								data-variant="felt"
								data-toggle
								data-pressed={on}
								aria-pressed={on}
								// At least one topic stays on.
								disabled={on && m.topics.length === 1}
								onClick={() => {
									const topics = toggle(m.topics, t);
									if (topics.length > 0) onChange({ ...m, topics });
								}}
							>
								{on && <Check className="size-4" aria-hidden />}
								{TOPIC_LABEL[t]}
							</button>
						);
					})}
				</div>
			</fieldset>
			{m.topics.includes("facts") && (
				<fieldset className="space-y-3 border-0 p-0">
					<legend className="text-sm font-medium">
						Times tables{" "}
						<span className="font-normal text-page-muted">
							· {m.tables.length === TABLES.length ? "all 11 on" : `${m.tables.length} of 11 on`}
						</span>
					</legend>
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="text-page-muted">Quick pick:</span>
						{TABLE_PRESETS.map((p) => (
							<button
								key={p.label}
								type="button"
								className="key !min-h-11 !px-3 text-sm"
								data-variant="felt"
								data-toggle
								data-pressed={same(m.tables, p.tables)}
								aria-pressed={same(m.tables, p.tables)}
								onClick={() => onChange({ ...m, tables: p.tables })}
							>
								{p.label}
							</button>
						))}
					</div>
					<div className="flex flex-wrap gap-1.5">
						{TABLES.map((n) => (
							<button
								key={n}
								type="button"
								className="key !min-h-11 !min-w-11 !px-0 text-base tabular-nums"
								data-variant="felt"
								data-toggle
								data-pressed={m.tables.includes(n)}
								aria-pressed={m.tables.includes(n)}
								aria-label={`${n} times table`}
								// At least one table stays on.
								disabled={m.tables.length === 1 && m.tables.includes(n)}
								onClick={() => {
									const tables = toggle(m.tables, n).sort((a, b) => a - b);
									if (tables.length > 0) onChange({ ...m, tables });
								}}
							>
								{n}
							</button>
						))}
					</div>
				</fieldset>
			)}
		</div>
	);
}

const SKILL_LABEL: Record<MathSkill, string> = {
	mul: "Times tables",
	div: "Division facts",
	addsub: "Add & subtract",
	mixed: "Mixed & multi-step",
	fractions: "Fractions",
	decimals: "Decimals",
	problems: "Word problems",
};

/** A problem at this level, written out, so "Level 3" means something: "e.g. 3/4 = ?/8". */
function example(skill: MathSkill, level: number) {
	const p: MathProblem = generate(skill, level, seeded(level * 97 + skill.length * 13));
	if (p.text) return p.text.length > 70 ? `${p.text.slice(0, 67)}…` : p.text;
	return p.prompt.map((t) => (t.t === "num" || t.t === "op" ? t.v : t.t === "frac" ? `${t.n}/${t.d}` : "?")).join(" ");
}

/**
 * How hard each math skill is, beside the topics that switch it on. Levels move on their own from accuracy and pace;
 * this is the nudge for "too easy" or "too hard", shown with an example so a level is something a parent can judge.
 */
function MathLevels({ child }: { child: Child }) {
	const qc = useQueryClient();
	const id = useId();
	const { data: progress, isError } = useQuery(progressQuery(child.id));
	const set = useMutation({
		mutationFn: (v: { skill: MathSkill; level: number }) => api(`/api/children/${child.id}/math-level`, { method: "PUT", json: v }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", child.id] }),
	});
	const skills = child.settings.math.topics.flatMap((t) => TOPIC_SKILLS[t]);
	const levels = progress?.math.levels;
	return (
		<section className="space-y-3 border-t border-page-line/50 pt-4" aria-labelledby={id}>
			<div className="flex items-baseline justify-between gap-3">
				<h4 id={id} className="text-sm font-medium">
					How hard
				</h4>
				<span className="text-sm text-page-muted" role="status">
					{set.isPending ? "Saving…" : set.isSuccess ? "Saved" : ""}
				</span>
			</div>
			<p className="max-w-prose text-sm text-page-muted">Levels move on their own. Nudge one if it feels too easy or too hard.</p>
			{!levels ? (
				isError ? (
					<Problem>Couldn’t load {child.name}’s levels. Check the connection and try again.</Problem>
				) : (
					<p className="text-sm text-page-muted">Loading levels…</p>
				)
			) : (
				<ul className="space-y-3">
					{skills.map((skill) => {
						const level = levels[skill] ?? 1;
						return (
							<li key={skill} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
								<span className="min-w-0">
									<span className="block">
										{SKILL_LABEL[skill]} <span className="text-page-muted">· level {level} of 5</span>
									</span>
									<span className="block text-sm text-page-muted tabular-nums">e.g. {example(skill, level)}</span>
								</span>
								<span className="flex gap-2">
									<button
										type="button"
										className="key !min-h-11 text-sm"
										data-variant="felt"
										disabled={level <= 1 || set.isPending}
										aria-label={`Make ${SKILL_LABEL[skill]} easier`}
										onClick={() => set.mutate({ skill, level: level - 1 })}
									>
										Easier
									</button>
									<button
										type="button"
										className="key !min-h-11 text-sm"
										data-variant="felt"
										disabled={level >= 5 || set.isPending}
										aria-label={`Make ${SKILL_LABEL[skill]} harder`}
										onClick={() => set.mutate({ skill, level: level + 1 })}
									>
										Harder
									</button>
								</span>
							</li>
						);
					})}
				</ul>
			)}
			{set.isError && <Problem>{failure(set.error, "change that level")}</Problem>}
		</section>
	);
}

function AddChild({ onDone, onAdded }: { onDone?: () => void; onAdded: (name: string) => void }) {
	const qc = useQueryClient();
	const ids = { name: useId(), grade: useId() };
	const [name, setName] = useState("");
	const [grade, setGrade] = useState<number | null>(null);
	const [avatar, setAvatar] = useState<string>("1");
	const create = useMutation({
		mutationFn: () => api<Child>("/api/children", { method: "POST", json: { name, avatar, grade } }),
		onSuccess: (child) => {
			qc.invalidateQueries({ queryKey: ["children"] });
			onAdded(child.name);
			setName("");
			setGrade(null);
			onDone?.();
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				create.mutate();
			}}
			className="patch space-y-5 p-6"
			aria-labelledby={`${ids.name}-heading`}
		>
			<h2 id={`${ids.name}-heading`} className="text-2xl font-semibold">
				Add a child
			</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
				<label htmlFor={ids.name} className="block min-w-0 space-y-1.5">
					<span className="text-sm font-medium">First name</span>
					<input id={ids.name} className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
				</label>
				<label htmlFor={ids.grade} className="block min-w-0 space-y-1.5">
					<span className="text-sm font-medium">Grade</span>
					<GradeSelect id={ids.grade} value={grade} onChange={setGrade} />
				</label>
			</div>
			<AvatarPicker value={avatar} onChange={setAvatar} name={name} />
			<p className="text-sm text-page-muted">Voice, letter style and math topics can be changed once they’re added.</p>
			<div className="flex flex-wrap gap-2">
				<button type="submit" className="key" data-variant="go" disabled={!name.trim() || create.isPending}>
					{create.isPending ? "Adding…" : "Add child"}
				</button>
				{onDone && (
					<button type="button" className="key" data-variant="felt" onClick={onDone}>
						Cancel
					</button>
				)}
			</div>
			{create.isError && <Problem>{failure(create.error, `add ${name.trim() || "that child"}`)}</Problem>}
		</form>
	);
}

function Kids() {
	const search = Route.useSearch();
	const { data: kids } = useSuspenseQuery(childrenQuery);
	const lost = useLostRenames();
	const qc = useQueryClient();
	const retry = useMutation({
		mutationFn: (x: { childId: string; name: string }) => api(`/api/children/${x.childId}`, { method: "PATCH", json: { name: x.name } }),
		onSuccess: (_, x) => {
			lostRenames.set(lostRenames.items.filter((i) => i.childId !== x.childId));
			qc.invalidateQueries({ queryKey: ["children"] });
		},
	});
	const { data: lists } = useSuspenseQuery(listsQuery);
	const [adding, setAdding] = useState(false);
	const [added, setAdded] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(search.edit ?? null);
	const [removing, setRemoving] = useState<string | null>(null);
	const remove = useMutation({
		mutationFn: (id: string) => api(`/api/children/${id}`, { method: "DELETE" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
	});
	const showForm = adding || kids.length === 0;

	return (
		<div className="max-w-5xl space-y-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<h1 className="text-4xl font-semibold">Kids</h1>
				{kids.length > 0 && !adding && (
					<button type="button" className="key" data-variant="go" onClick={() => setAdding(true)}>
						<Plus className="size-5" aria-hidden /> Add a child
					</button>
				)}
			</div>
			{lost.map((x) => {
				const kid = kids.find((k) => k.id === x.childId);
				if (!kid) return null;
				return (
					<div key={x.childId} className="space-y-2">
						<Problem>
							Couldn’t save {kid.name}’s new name, “{x.name}”. Check the connection and try again.
						</Problem>
						<div className="flex flex-wrap gap-2">
							<button type="button" className="key" data-variant="felt" disabled={retry.isPending} onClick={() => retry.mutate(x)}>
								Save “{x.name}”
							</button>
							<button
								type="button"
								className="key"
								data-variant="felt"
								onClick={() => lostRenames.set(lostRenames.items.filter((i) => i.childId !== x.childId))}
							>
								Keep “{kid.name}”
							</button>
						</div>
					</div>
				);
			})}
			{kids.length === 0 && (
				<p className="max-w-prose text-page-muted">
					Add each child who will practice. They’ll pick their tile on the “Who’s practicing?” screen.
				</p>
			)}
			{added && (
				<p role="status" className="text-lg">
					<span className="font-semibold">{added}</span> is added.{" "}
					{lists.length === 0 ? (
						<Link to="/parent/lists/$listId" params={{ listId: "new" }} className="underline underline-offset-4">
							Next, add this week’s word list.
						</Link>
					) : (
						"They’ll see every word list under Spelling."
					)}
				</p>
			)}
			{showForm && (
				<div className="max-w-3xl">
					<AddChild onDone={kids.length > 0 ? () => setAdding(false) : undefined} onAdded={setAdded} />
				</div>
			)}
			<ul className="space-y-3">
				{kids.map((k) => {
					const open = editing === k.id;
					return (
						<li key={k.id} className="space-y-4">
							<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
								<KidTile name={k.name} avatar={k.avatar} size={56} />
								<div className="min-w-0 flex-1">
									<h2 className="font-display text-2xl font-medium break-words">{k.name}</h2>
									<p className="text-sm text-page-muted">{gradeName(k.grade)}</p>
								</div>
								<div className="flex gap-2">
									<Link
										to="/parent/progress/$childId"
										params={{ childId: k.id }}
										className="key"
										data-variant="felt"
										aria-label={`${k.name}’s progress`}
									>
										Progress
									</Link>
									<button
										type="button"
										className="key"
										data-variant="felt"
										data-pressed={open}
										aria-expanded={open}
										aria-label={`Edit ${k.name}`}
										onClick={() => setEditing(open ? null : k.id)}
									>
										Edit <ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} aria-hidden />
									</button>
								</div>
							</div>
							{open && <KidEditor child={k} onRemove={() => setRemoving(k.id)} />}
							{removing === k.id && (
								<Confirm
									message={`Remove ${k.name}?`}
									note="All of their practice history goes too. This can’t be undone."
									confirmLabel={`Remove ${k.name}`}
									busy={remove.isPending}
									onCancel={() => setRemoving(null)}
									onConfirm={() => remove.mutate(k.id, { onSettled: () => setRemoving(null) })}
								/>
							)}
							{remove.isError && remove.variables === k.id && <Problem>{failure(remove.error, `remove ${k.name}`)}</Problem>}
							<hr className="border-page-line/60" />
						</li>
					);
				})}
			</ul>
		</div>
	);
}
