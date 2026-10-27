import { TURTLE, TURTLE_NAME_MAX, turtleName } from "@jade/core/code";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Turtle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api, type Child } from "#/lib/api.ts";
import { childrenQuery } from "#/lib/queries.ts";

const NAMES = [TURTLE, "Shelly", "Pebble", "Sprout", "Mossy", "Dash"];

/**
 * The turtle's name, which the kid picks: one of a few, or their own. It's saved on the kid (`settings.turtleName`, unset
 * meaning Tuck) a moment after the last change, and shows at once. Saving needs a connection; offline it says so.
 */
export function TurtleName({ child }: { child: Child }) {
	const qc = useQueryClient();
	const name = turtleName(child.settings);
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState(NAMES.includes(name) ? "" : name);
	const [failed, setFailed] = useState(false);
	const headingId = useId();
	const saved = useRef(child.settings.turtleName ?? "");
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const save = useMutation({
		mutationFn: (turtleName: string) => api<Child>(`/api/children/${child.id}`, { method: "PATCH", json: { settings: { turtleName } } }),
		onSuccess: (next) => {
			saved.current = next.settings.turtleName ?? "";
			setFailed(false);
			qc.setQueryData<Child[]>(childrenQuery.queryKey, (kids) => kids?.map((k) => (k.id === next.id ? next : k)));
		},
		onError: () => {
			setFailed(true);
			show(saved.current);
		},
	});
	useEffect(() => () => clearTimeout(timer.current), []);

	/** Shows `n` everywhere at once (the cached child), before the server has it. */
	function show(n: string) {
		qc.setQueryData<Child[]>(childrenQuery.queryKey, (kids) =>
			kids?.map((k) => (k.id === child.id ? { ...k, settings: { ...k.settings, turtleName: n } } : k)),
		);
	}
	function pick(n: string) {
		// Unset is Tuck, so picking Tuck (or clearing the box) stores nothing.
		const next = n === TURTLE ? "" : n;
		show(next);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			if (next !== saved.current) save.mutate(next);
		}, 800);
	}

	return (
		<section aria-labelledby={headingId} className="sticker mt-8 p-5 md:px-6" data-place="code">
			<div className="flex flex-wrap items-center gap-4">
				<span className="vinyl-disc size-13" aria-hidden>
					<Turtle className="relative size-6" strokeWidth={2.4} />
				</span>
				<h2 id={headingId} className="min-w-0 flex-1 font-display text-xl font-medium">
					Your turtle is called <span className="font-semibold">{name}</span>
				</h2>
				<button type="button" className="key ml-auto shrink-0" data-variant="felt" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
					{open ? <Check className="size-5" aria-hidden /> : <Pencil className="size-5" aria-hidden />}
					{open ? "Done" : "Rename"}
				</button>
			</div>
			{open && (
				<div className="mt-4">
					<fieldset aria-label="Pick a name" className="flex flex-wrap gap-2">
						{NAMES.map((n) => (
							<button
								key={n}
								type="button"
								aria-pressed={name === n}
								data-toggle
								data-pressed={name === n}
								className="key !min-h-11"
								onClick={() => {
									setTyped("");
									pick(n);
								}}
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
							maxLength={TURTLE_NAME_MAX}
							autoComplete="off"
							autoCorrect="off"
							onChange={(e) => {
								setTyped(e.target.value);
								pick(e.target.value.trim());
							}}
						/>
					</label>
				</div>
			)}
			{failed && (
				<p role="status" className="mt-3 text-page-muted">
					The new name couldn’t be saved. It needs the internet: try again when you’re online.
				</p>
			)}
		</section>
	);
}
