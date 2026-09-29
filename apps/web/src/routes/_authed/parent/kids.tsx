import { AVATARS, type ChildSettings, FONTS, VOICES } from "@jade/core";
import { KidTile } from "@jade/ui/components/kid-tile";
import { Tile } from "@jade/ui/components/tile";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Volume2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { api, type Child } from "#/lib/api.ts";
import { childrenQuery } from "#/lib/queries.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/parent/kids")({
	loader: ({ context }) => context.queryClient.ensureQueryData(childrenQuery),
	component: Kids,
});

const FONT_LABEL: Record<(typeof FONTS)[number], string> = {
	fredoka: "Rounded",
	andika: "Andika (school print)",
	lexend: "Lexend",
	atkinson: "Atkinson",
};

function AvatarPicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-medium">Tile number</legend>
			<div className="flex flex-wrap gap-2">
				{AVATARS.map((a) => (
					<label key={a} className="cursor-pointer">
						<input
							type="radio"
							name={`avatar-${name}`}
							value={a}
							checked={value === a}
							onChange={() => onChange(a)}
							className="peer sr-only"
						/>
						<span className="block rounded-xl p-1 peer-checked:ring-3 peer-checked:ring-felt-ink peer-focus-visible:outline-3 peer-focus-visible:outline-felt-ink">
							<Tile letter={name.trim()[0]?.toUpperCase() || "?"} points={a} size={44} />
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function SettingsForm({ child }: { child: Child }) {
	const qc = useQueryClient();
	const update = useMutation({
		mutationFn: (settings: Partial<ChildSettings>) => api<Child>(`/api/children/${child.id}`, { method: "PATCH", json: { settings } }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
	});
	const s = child.settings;
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<label className="space-y-1.5">
				<span className="text-sm font-medium">Voice</span>
				<div className="flex gap-2">
					<select className="field" value={s.voice} onChange={(e) => update.mutate({ voice: e.target.value as ChildSettings["voice"] })}>
						{VOICES.map((v) => (
							<option key={v} value={v}>
								{v[0]!.toUpperCase() + v.slice(1)}
							</option>
						))}
					</select>
					<button
						type="button"
						className="key shrink-0"
						aria-label={`Hear ${s.voice}`}
						onClick={() => {
							speaker.unlock();
							speaker.voice = s.voice;
							void speaker.say("Your word is: necessary.", { kind: "sentence" });
						}}
					>
						<Volume2 className="size-5" aria-hidden />
					</button>
				</div>
			</label>
			<label className="space-y-1.5">
				<span className="text-sm font-medium">Letter style on tiles</span>
				<select className="field" value={s.font} onChange={(e) => update.mutate({ font: e.target.value as ChildSettings["font"] })}>
					{FONTS.map((f) => (
						<option key={f} value={f}>
							{FONT_LABEL[f]}
						</option>
					))}
				</select>
			</label>
			<label className="space-y-1.5">
				<span className="text-sm font-medium">Speaking speed</span>
				<input
					type="range"
					min={0.7}
					max={1.2}
					step={0.05}
					value={s.rate}
					onChange={(e) => update.mutate({ rate: Number(e.target.value) })}
					className="w-full"
				/>
			</label>
			<label className="flex items-center gap-3 self-end pb-2">
				<input
					type="checkbox"
					className="size-5"
					checked={s.showLength}
					onChange={(e) => update.mutate({ showLength: e.target.checked })}
				/>
				<span className="text-sm">Show how many letters (easier; a real bee doesn’t)</span>
			</label>
		</div>
	);
}

function Kids() {
	const { data: kids } = useSuspenseQuery(childrenQuery);
	const qc = useQueryClient();
	const [name, setName] = useState("");
	const [avatar, setAvatar] = useState<string>("1");
	const create = useMutation({
		mutationFn: (body: { name: string; avatar: string; grade: number | null }) =>
			api<Child>("/api/children", { method: "POST", json: body }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["children"] });
			setName("");
		},
	});
	const remove = useMutation({
		mutationFn: (id: string) => api(`/api/children/${id}`, { method: "DELETE" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
	});

	function onCreate(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const g = new FormData(e.currentTarget).get("grade");
		create.mutate({ name, avatar, grade: g === "" || g === null ? null : Number(g) });
	}

	return (
		<div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
			<section className="space-y-6">
				<h1 className="text-4xl font-semibold">Spellers</h1>
				{kids.length === 0 && (
					<p className="text-felt-muted">Add each child who will practice. They’ll pick their tile on the “Who’s practicing?” screen.</p>
				)}
				<ul className="space-y-8">
					{kids.map((k) => (
						<li key={k.id} className="space-y-4 border-b border-felt-line/60 pb-8">
							<div className="flex flex-wrap items-center gap-4">
								<KidTile name={k.name} avatar={k.avatar} size={56} />
								<div className="flex-1">
									<h2 className="font-display text-2xl font-medium">{k.name}</h2>
									<p className="text-sm text-felt-muted">
										{k.grade === null ? "No grade set" : k.grade === 0 ? "Kindergarten" : `Grade ${k.grade}`}
									</p>
								</div>
								<Link to="/parent/progress/$childId" params={{ childId: k.id }} className="key" data-variant="felt">
									Progress
								</Link>
								<button
									type="button"
									className="text-sm text-felt-muted underline underline-offset-4"
									onClick={() => confirm(`Remove ${k.name} and all their practice history?`) && remove.mutate(k.id)}
								>
									Remove
								</button>
							</div>
							<SettingsForm child={k} />
						</li>
					))}
				</ul>
			</section>
			<section>
				<form onSubmit={onCreate} className="patch space-y-5 p-6 lg:sticky lg:top-6">
					<h2 className="text-2xl font-semibold">Add a speller</h2>
					<label className="block space-y-1.5">
						<span className="text-sm font-medium">First name</span>
						<input className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
					</label>
					<label className="block space-y-1.5">
						<span className="text-sm font-medium">Grade</span>
						<select name="grade" className="field" defaultValue="">
							<option value="">—</option>
							{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
								<option key={g} value={g}>
									{g === 0 ? "K" : g}
								</option>
							))}
						</select>
					</label>
					<AvatarPicker value={avatar} onChange={setAvatar} name={name} />
					<button type="submit" className="key w-full" data-variant="go" disabled={!name.trim() || create.isPending}>
						Add speller
					</button>
					{create.error && <p role="alert">{create.error.message}</p>}
				</form>
			</section>
		</div>
	);
}
