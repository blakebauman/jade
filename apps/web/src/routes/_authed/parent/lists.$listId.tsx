import { normalizeWord, parseWordList } from "@jade/core";
import { Square, Tile } from "@jade/ui/components/tile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { Archive, ArrowLeft, Camera, Check, ClipboardPaste, FileUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Confirm } from "#/components/Confirm.tsx";
import { Problem } from "#/components/Problem.tsx";
import { WordRack } from "#/components/WordRack.tsx";
import { ApiError, api, failure, type ListWord, type WordList } from "#/lib/api.ts";
import { useCoarsePointer } from "#/lib/hooks.ts";
import { preparePhoto, wordsFromFile } from "#/lib/import.ts";
import { childrenQuery, listQuery } from "#/lib/queries.ts";
import { warmList } from "#/lib/warm.ts";

export const Route = createFileRoute("/_authed/parent/lists/$listId")({ component: ListEditor });

type Source = "paste" | "csv" | "ocr" | "pack";
/** `childIds`: the kids it's for; empty means nobody yet (in a one-kid family, saving gives it to that kid). */
type Draft = { name: string; grade: number | null; words: ListWord[]; source: Source; childIds: string[] };

const EMPTY: Draft = { name: "", grade: null, words: [], source: "paste", childIds: [] };

/**
 * Unsaved edits live in sessionStorage as well as in state, so they survive the parent area locking itself mid-edit
 * (which unmounts this screen) and a reload. Saving, deleting or choosing to leave without saving clears them.
 */
const draftKey = (listId: string) => `jade.list-draft:${listId}`;
function readDraft(listId: string): Draft | null {
	try {
		const d = JSON.parse(sessionStorage.getItem(draftKey(listId)) ?? "null") as Draft | null;
		return d && { ...d, childIds: d.childIds ?? [] };
	} catch {
		return null;
	}
}
function writeDraft(listId: string, d: Draft | null) {
	try {
		if (d) sessionStorage.setItem(draftKey(listId), JSON.stringify(d));
		else sessionStorage.removeItem(draftKey(listId));
	} catch {}
}

const same = (a: Draft, b: Draft) =>
	a.name === b.name &&
	a.grade === b.grade &&
	JSON.stringify(a.words) === JSON.stringify(b.words) &&
	[...a.childIds].sort().join() === [...b.childIds].sort().join();

function mergeWords(existing: ListWord[], incoming: ListWord[]) {
	const seen = new Set(existing.map((w) => w.word));
	const added = incoming.filter((w) => !seen.has(w.word) && seen.add(w.word));
	return { words: [...existing, ...added], added: added.map((w) => w.word), repeats: incoming.length - added.length };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Added 12 words. 2 were already on the list." */
function addedNotice(added: number, repeats: number) {
	if (added === 0) return repeats > 0 ? "Those words are already on the list." : "No words found.";
	const also = repeats > 0 ? ` ${plural(repeats, "was", "were")} already on the list.` : "";
	return `Added ${plural(added, "word", "words")}.${also}`;
}

const OCR_ERRORS: Record<number, string> = {
	413: "That photo is too large. Crop it closer to the list, or take it again.",
	415: "That file isn’t a photo we can read. Use a JPEG, PNG or WebP.",
	429: "Too many photos in a row. Wait a minute, then try again.",
};

function ListEditor() {
	const { listId } = Route.useParams();
	const isNew = listId === "new";
	const { data: existing, isPending, isError, refetch } = useQuery({ ...listQuery(listId), enabled: !isNew });
	const { data: kids = [] } = useQuery(childrenQuery);
	const qc = useQueryClient();
	const navigate = useNavigate();

	const baseline: Draft | null = isNew
		? EMPTY
		: existing
			? {
					name: existing.name,
					grade: existing.grade,
					words: existing.words,
					source: existing.source as Source,
					childIds: existing.childIds ?? [],
				}
			: null;
	const [draft, setDraft] = useState<Draft | null>(null);
	const { name, grade, words, source, childIds } = draft ?? EMPTY;
	const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...(d ?? EMPTY), ...patch }));

	// On a touch device the camera is the quickest way in; with a keyboard, pasting is.
	const touch = useCoarsePointer();
	const [tab, setTab] = useState<"paste" | "file" | "photo">(isNew && touch ? "photo" : "paste");
	/** Reopening a list is about its words: the ways to add more stay folded until asked for. */
	const [showImport, setShowImport] = useState(isNew);
	const [pasted, setPasted] = useState("");
	const [single, setSingle] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [importProblem, setImportProblem] = useState<string | null>(null);
	/** Set when a photo's words land, so the first one to check gets focus once it's on screen. */
	const focusCheck = useRef(false);
	const wordsRef = useRef<HTMLOListElement>(null);
	const [ocrBusy, setOcrBusy] = useState(false);
	const [openWord, setOpenWord] = useState<string | null>(null);
	const [askDelete, setAskDelete] = useState(false);
	/** Words from the last photo, marked until the parent has checked them: photos can misread a letter. */
	const [toCheck, setToCheck] = useState<Set<string>>(new Set());
	/** The words "Clear all" removed, for Undo. */
	const [cleared, setCleared] = useState<ListWord[] | null>(null);
	const ids = { name: useId(), grade: useId(), paste: useId(), add: useId() };

	// Start from the saved list, or from unsaved edits this tab was in the middle of.
	useEffect(() => {
		if (draft || !baseline) return;
		const kept = readDraft(listId);
		if (kept && !same(kept, baseline)) {
			setDraft(kept);
			setNotice("Picked up your unsaved changes.");
		} else setDraft(baseline);
	}, [draft, baseline, listId]);

	const dirty = !!draft && !!baseline && !same(draft, baseline);
	useEffect(() => {
		if (draft) writeDraft(listId, dirty ? draft : null);
	}, [draft, dirty, listId]);

	// Leaving on purpose (after saving or deleting) skips the "unsaved changes" question.
	const leaving = useRef(false);
	const blocker = useBlocker({ shouldBlockFn: () => dirty && !leaving.current, enableBeforeUnload: () => dirty, withResolver: true });
	function leave(to: () => void) {
		leaving.current = true;
		writeDraft(listId, null);
		to();
	}

	const save = useMutation({
		mutationFn: async () => {
			// With one kid there's no choice to make: the list is theirs. Until the kids have loaded, who it's for is left as it was.
			const forKids = kids.length === 1 ? [kids[0]!.id] : kids.length > 1 ? childIds : undefined;
			const body = { name: name.trim() || "Spelling words", grade, source, words, childIds: forKids };
			let list: WordList;
			if (isNew) list = await api<WordList>("/api/lists", { method: "POST", json: body });
			else {
				await api<WordList>(`/api/lists/${listId}`, { method: "PATCH", json: { name: body.name, grade, childIds: forKids } });
				list = await api<WordList>(`/api/lists/${listId}/words`, { method: "PUT", json: { words } });
			}
			// Fetch definitions/sentences and pre-generate the voice clips so the first round plays instantly.
			void warmList(list.words);
			return list;
		},
		onSuccess: (list) => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			qc.setQueryData(listQuery(list.id).queryKey, list);
			leave(() => navigate({ to: "/parent", search: { saved: list.id } }));
		},
	});

	const archive = useMutation({
		mutationFn: (archived: boolean) => api<WordList>(`/api/lists/${listId}`, { method: "PATCH", json: { archived } }),
		onSuccess: (list) => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			qc.setQueryData(listQuery(listId).queryKey, (old) => old && { ...old, archived: list.archived });
			setNotice(
				list.archived ? "Moved to past lists. Kids won’t see it; its missed words still come back in Review." : "Back in This week.",
			);
		},
	});

	/** A list is only for the kids chosen here: kids added later don't get it. */
	const toggleKid = (id: string) => set({ childIds: childIds.includes(id) ? childIds.filter((x) => x !== id) : [...childIds, id] });
	/** With more than one kid, the parent says who a list is for before saving it. */
	const needsKids = kids.length > 1 && !childIds.some((id) => kids.some((k) => k.id === id));

	const remove = useMutation({
		mutationFn: () => api(`/api/lists/${listId}`, { method: "DELETE" }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			leave(() => navigate({ to: "/parent" }));
		},
	});

	function add(incoming: ListWord[], from: Source) {
		const merged = mergeWords(words, incoming);
		set({ words: merged.words, ...(isNew && words.length === 0 && { source: from }) });
		setCleared(null);
		return merged;
	}

	async function onFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		const { added, repeats } = add(wordsFromFile(await file.text()), "csv");
		setNotice(addedNotice(added.length, repeats));
	}

	async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setOcrBusy(true);
		setNotice(null);
		setImportProblem(null);
		try {
			const form = new FormData();
			form.set("image", await preparePhoto(file));
			const data = await api<{ words?: string[]; title?: string | null }>("/api/import/ocr", { method: "POST", body: form });
			if (data.title && !name) set({ name: data.title });
			const found = data.words ?? [];
			if (found.length === 0) {
				setImportProblem("No words found in that photo. Try a flatter, brighter shot, or paste the words instead.");
				return;
			}
			const { added, repeats } = add(
				found.map((word) => ({ word, sentence: null, definition: null })),
				"ocr",
			);
			setToCheck(new Set(added));
			focusCheck.current = added.length > 0;
			setNotice(
				added.length > 0
					? `${addedNotice(added.length, repeats)} Photos can misread a letter, so check the ringed ones.`
					: addedNotice(0, repeats),
			);
		} catch (err) {
			setImportProblem(
				err instanceof ApiError && OCR_ERRORS[err.status]
					? OCR_ERRORS[err.status]!
					: err instanceof ApiError
						? "Couldn’t read that photo. Try a flatter, brighter shot, or paste the words instead."
						: "Couldn’t reach the server to read the photo. Check the connection and try again.",
			);
		} finally {
			setOcrBusy(false);
		}
	}

	// Once a photo's words are on the board, take the parent straight to the first one to check.
	useEffect(() => {
		if (!focusCheck.current || toCheck.size === 0) return;
		focusCheck.current = false;
		const first = wordsRef.current?.querySelector<HTMLButtonElement>("[data-check] button[aria-expanded]");
		first?.focus({ preventScroll: true });
		first?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
	}, [toCheck]);

	/** Correct a word in place (a misread letter, a typo), keeping its sentence and definition. */
	function rename(from: string, to: string): string | null {
		const w = normalizeWord(to);
		if (!w) return "Type the word, or remove it with ✕.";
		if (w !== from && words.some((x) => x.word === w)) return "That word is already on the list.";
		set({ words: words.map((x) => (x.word === from ? { ...x, word: w } : x)) });
		setToCheck((s) => {
			const next = new Set(s);
			next.delete(from);
			return next;
		});
		setOpenWord(w);
		return null;
	}

	// The way in that suits this device comes first: the camera on a touch screen, pasting with a keyboard.
	const photoTab = { id: "photo", label: "Photo of the sheet", icon: Camera } as const;
	const pasteTab = { id: "paste", label: "Paste", icon: ClipboardPaste } as const;
	const tabs = [...(touch ? [photoTab, pasteTab] : [pasteTab, photoTab]), { id: "file", label: "CSV or text file", icon: FileUp } as const];

	const back = (
		<Link to="/parent" className="key self-start" data-variant="felt">
			<ArrowLeft className="size-5" aria-hidden /> Lists
		</Link>
	);

	if (!isNew && !existing) {
		return (
			<div className="space-y-6">
				{back}
				{isPending ? (
					<p className="text-page-muted" role="status">
						Opening the list…
					</p>
				) : (
					isError && (
						<div className="space-y-4">
							<Problem>Couldn’t open this list. It may have been deleted, or the connection dropped.</Problem>
							<button type="button" className="key" onClick={() => void refetch()}>
								Try again
							</button>
						</div>
					)
				)}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			{/* At the top, beside the navigation the parent just tapped, not down in the save bar. */}
			{blocker.status === "blocked" && (
				<Confirm
					className="-order-1 lg:col-span-2"
					message="Leave without saving?"
					note={`Your changes to ${name.trim() ? `“${name.trim()}”` : "this list"} haven’t been saved.`}
					cancelLabel="Keep editing"
					confirmLabel="Leave without saving"
					onCancel={blocker.reset}
					onConfirm={() => leave(blocker.proceed)}
				/>
			)}
			<section className="min-w-0 space-y-6">
				<div className="flex flex-col gap-4">
					{back}
					<h1 className="text-4xl font-semibold">{isNew ? "New list" : "Edit list"}</h1>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
					<label htmlFor={ids.name} className="block min-w-0 space-y-1.5">
						<span className="text-sm font-medium">List name</span>
						<input
							id={ids.name}
							className="field"
							value={name}
							onChange={(e) => set({ name: e.target.value })}
							placeholder="e.g. Week 6 spelling"
							aria-describedby={!name.trim() && words.length > 0 ? `${ids.name}-hint` : undefined}
						/>
						{!name.trim() && words.length > 0 && (
							<span id={`${ids.name}-hint`} className="block text-sm text-page-muted">
								Left blank, it’s saved as “Spelling words”.
							</span>
						)}
					</label>
					<label htmlFor={ids.grade} className="block min-w-0 space-y-1.5">
						<span className="text-sm font-medium">Grade</span>
						<select
							id={ids.grade}
							className="field"
							value={grade ?? ""}
							onChange={(e) => set({ grade: e.target.value === "" ? null : Number(e.target.value) })}
						>
							<option value="">—</option>
							{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
								<option key={g} value={g}>
									{g === 0 ? "K" : g}
								</option>
							))}
						</select>
					</label>
				</div>

				{kids.length > 1 && (
					<fieldset className="space-y-2 border-0 p-0">
						<legend className="text-sm font-medium">Who it’s for</legend>
						<div className="flex flex-wrap gap-2">
							{kids.map((k) => {
								const on = childIds.includes(k.id);
								return (
									<button
										key={k.id}
										type="button"
										className="key text-base"
										data-variant="felt"
										data-toggle
										data-pressed={on}
										aria-pressed={on}
										onClick={() => toggleKid(k.id)}
									>
										{on && <Check className="size-4" aria-hidden />}
										{k.name}
									</button>
								);
							})}
						</div>
					</fieldset>
				)}

				{!showImport ? (
					<button type="button" className="key" data-variant="felt" aria-expanded={false} onClick={() => setShowImport(true)}>
						<Plus className="size-5" aria-hidden /> Add more words: photo, paste or file
					</button>
				) : (
					<div className="patch space-y-4 p-5">
						<fieldset className="mx-0 flex flex-wrap gap-2 border-0 p-0">
							<legend className="sr-only">Add words from</legend>
							{tabs.map((t) => (
								<button
									key={t.id}
									type="button"
									aria-pressed={tab === t.id}
									className="key text-base"
									data-toggle
									data-pressed={tab === t.id}
									onClick={() => setTab(t.id)}
								>
									{tab === t.id ? <Check className="size-4" aria-hidden /> : <t.icon className="size-4" aria-hidden />} {t.label}
								</button>
							))}
						</fieldset>

						{tab === "paste" && (
							<div className="space-y-3">
								<label htmlFor={ids.paste} className="text-sm text-page-muted">
									One word per line, or separated by commas. Numbering like “1.” is ignored.
								</label>
								<textarea
									id={ids.paste}
									className="field min-h-40"
									value={pasted}
									onChange={(e) => setPasted(e.target.value)}
									placeholder={"e.g.\n1. believe\n2. receive"}
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
								/>
								<button
									type="button"
									className="key"
									disabled={!pasted.trim()}
									onClick={() => {
										const { added, repeats } = add(
											parseWordList(pasted).map((word) => ({ word, sentence: null, definition: null })),
											"paste",
										);
										setNotice(addedNotice(added.length, repeats));
										setPasted("");
									}}
								>
									Add these words
								</button>
							</div>
						)}
						{tab === "file" && (
							<div className="space-y-3 text-sm text-page-muted">
								<p>
									A CSV with a <code className="text-page-ink">word</code> column (and optional{" "}
									<code className="text-page-ink">sentence</code> and <code className="text-page-ink">definition</code> columns), or any
									text file of words.
								</p>
								<label className="key cursor-pointer text-base has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-page-ink">
									<FileUp className="size-4" aria-hidden /> Choose file
									<input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
								</label>
							</div>
						)}
						{tab === "photo" && (
							<div className="space-y-3 text-sm text-page-muted">
								<p>
									Lay the sheet flat in good light and fill the frame with the list; neat handwriting works too. We read the words, you
									check them. The photo is not stored.
								</p>
								<label
									className="key cursor-pointer text-base has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-page-ink"
									aria-disabled={ocrBusy}
								>
									<Camera className="size-4" aria-hidden /> {ocrBusy ? "Reading the photo…" : "Take or choose photo"}
									<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocrBusy} onChange={onPhoto} />
								</label>
							</div>
						)}
						{ocrBusy && (
							<div className="flex items-center gap-3" role="status">
								<span className="flex items-center gap-1" aria-hidden>
									{[0, 1, 2].map((i) => (
										<Tile key={i} size={22} grain={i} className="animate-tile-drop" style={{ animationDelay: `${i * 120}ms` }} />
									))}
									<Square size={22} active />
								</span>
								<span className="text-sm text-page-muted">Reading the words off the sheet…</span>
							</div>
						)}
						{importProblem && <Problem>{importProblem}</Problem>}
					</div>
				)}
				{/* Always mounted, so screen readers hear each new notice. */}
				<p role="status" className="text-sm text-page-ink">
					{notice}
				</p>
			</section>

			<section className={`min-w-0 space-y-4 ${isNew ? "" : "order-first lg:order-none"}`}>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4">
					<h2 className="text-2xl font-semibold">
						Words <span className="text-page-muted tabular-nums">({words.length})</span>
					</h2>
					{words.length > 0 && (
						<button
							type="button"
							className="key !min-h-11 text-sm"
							data-variant="felt"
							onClick={() => {
								setCleared(words);
								setToCheck(new Set());
								set({ words: [] });
							}}
						>
							Clear all
						</button>
					)}
				</div>
				<div role="status" className="empty:mb-0">
					{cleared && (
						<p className="flex flex-wrap items-center gap-3">
							Cleared {plural(cleared.length, "word", "words")}.
							<button
								type="button"
								className="key"
								data-variant="felt"
								onClick={() => {
									set({ words: mergeWords(cleared, words).words });
									setCleared(null);
								}}
							>
								Undo
							</button>
						</p>
					)}
				</div>
				{toCheck.size > 0 && (
					<div className="patch flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4">
						<p className="min-w-0 flex-1 text-sm">
							<span className="font-semibold">{plural(toCheck.size, "word", "words")} from the photo to check.</span> The ringed ones are
							what we read; tap one to fix a letter.
						</p>
						<button type="button" className="key" data-variant="felt" onClick={() => setToCheck(new Set())}>
							They all look right
						</button>
					</div>
				)}
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						const w = normalizeWord(single);
						if (w) {
							const { added, repeats } = add([{ word: w, sentence: null, definition: null }], "paste");
							setNotice(addedNotice(added.length, repeats));
						}
						setSingle("");
					}}
				>
					<label htmlFor={ids.add} className="sr-only">
						Add one word
					</label>
					<input
						id={ids.add}
						className="field min-w-0"
						value={single}
						onChange={(e) => setSingle(e.target.value)}
						placeholder="Add one word"
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
					/>
					<button type="submit" className="key">
						Add
					</button>
				</form>
				{words.length === 0 ? (
					<p className="py-8 text-page-muted">
						Words you add show up here as tiles. Check the spelling of each one: this is the answer key.
					</p>
				) : (
					<ol className="space-y-1" ref={wordsRef}>
						{words.map((w, i) => (
							<WordRow
								key={w.word}
								n={i + 1}
								word={w}
								check={toCheck.has(w.word)}
								dropDelay={toCheck.has(w.word) ? [...toCheck].indexOf(w.word) * 120 : undefined}
								open={openWord === w.word}
								onToggle={() => setOpenWord(openWord === w.word ? null : w.word)}
								onRename={(to) => rename(w.word, to)}
								onChange={(k, v) => set({ words: words.map((x) => (x.word === w.word ? { ...x, [k]: v } : x)) })}
								onRemove={() => {
									set({ words: words.filter((x) => x.word !== w.word) });
									setToCheck((s) => {
										const next = new Set(s);
										next.delete(w.word);
										return next;
									});
								}}
							/>
						))}
					</ol>
				)}
			</section>

			{/* With something to save, the save bar stays in reach at the bottom of the screen, however long the list; with
			    nothing to save it sits at the end and leaves the words uncovered. */}
			<div className={`-mx-2 lg:col-span-2 ${dirty || isNew ? "sticky bottom-0 z-10" : ""}`}>
				<div className="patch flex flex-wrap items-center gap-3 p-3 [background:color-mix(in_oklab,var(--color-page-raised)_94%,transparent)]">
					<button
						type="button"
						className="key"
						data-variant="go"
						disabled={words.length === 0 || needsKids || save.isPending || (!isNew && !dirty)}
						onClick={() => save.mutate()}
					>
						{save.isPending ? "Saving…" : "Save list"}
					</button>
					<span className="text-sm text-page-muted" role="status">
						{words.length === 0
							? "Add at least one word to save."
							: needsKids
								? "Choose who it’s for to save."
								: dirty
									? "Unsaved changes"
									: isNew
										? ""
										: "All saved"}
					</span>
					{dirty && !isNew && baseline && (
						<button
							type="button"
							className="key !min-h-11 text-sm"
							data-variant="felt"
							onClick={() => {
								setDraft(baseline);
								setToCheck(new Set());
								setCleared(null);
								setNotice(null);
							}}
						>
							Undo changes
						</button>
					)}
					{!isNew && existing && (
						<button
							type="button"
							className="key ml-auto"
							data-variant="felt"
							disabled={archive.isPending}
							onClick={() => archive.mutate(!existing.archived)}
						>
							{existing.archived ? (
								<>
									<RotateCcw className="size-4" aria-hidden /> Use again
								</>
							) : (
								<>
									<Archive className="size-4" aria-hidden /> Done with it
								</>
							)}
						</button>
					)}
					{!isNew && (
						<button type="button" className="key" data-variant="felt" disabled={remove.isPending} onClick={() => setAskDelete(true)}>
							<Trash2 className="size-4" aria-hidden /> Delete
						</button>
					)}
					{askDelete && (
						<Confirm
							className="basis-full"
							message={`Delete “${name.trim() || "this list"}”?`}
							note="Practice history stays."
							confirmLabel="Delete list"
							busy={remove.isPending}
							onCancel={() => setAskDelete(false)}
							onConfirm={() => remove.mutate()}
						/>
					)}
					{(save.error || remove.error || archive.error) && (
						<Problem className="basis-full">
							{save.error
								? failure(save.error, "save the list")
								: remove.error
									? failure(remove.error, "delete the list")
									: failure(archive.error, "move the list")}
						</Problem>
					)}
				</div>
			</div>
		</div>
	);
}

function WordRow({
	n,
	word: w,
	check,
	dropDelay,
	open,
	onToggle,
	onRename,
	onChange,
	onRemove,
}: {
	n: number;
	word: ListWord;
	check: boolean;
	dropDelay?: number;
	open: boolean;
	onToggle: () => void;
	onRename: (to: string) => string | null;
	onChange: (k: "sentence" | "definition", v: string | null) => void;
	onRemove: () => void;
}) {
	const id = useId();
	const [spelling, setSpelling] = useState(w.word);
	const [problem, setProblem] = useState<string | null>(null);
	function commit(e?: FormEvent) {
		e?.preventDefault();
		if (spelling === w.word) return setProblem(null);
		setProblem(onRename(spelling));
	}
	return (
		<li
			data-check={check || undefined}
			className={`rounded-xl px-2 py-2 ${open ? "bg-page-raised/40" : "hover:bg-page-raised/40"} ${check ? "outline-2 -outline-offset-2 outline-page-muted/70 outline-dashed" : ""}`}
		>
			<div className="flex items-center gap-3">
				{/* The number gives its room to the word on a phone. */}
				<span className="hidden w-6 shrink-0 text-right text-sm text-page-muted tabular-nums sm:block">{n}</span>
				<button
					type="button"
					className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
					aria-expanded={open}
					aria-label={check ? `Edit ${w.word}, read from the photo: check the spelling` : `Edit ${w.word}`}
					onClick={onToggle}
				>
					<WordRack word={w.word} max={26} min={10} dropDelay={dropDelay} />
					{check && (
						<span className="text-xs font-medium text-page-muted" aria-hidden>
							check
						</span>
					)}
				</button>
				<button
					type="button"
					className="grid size-11 shrink-0 place-items-center rounded-lg text-page-muted hover:bg-page-deep hover:text-page-ink"
					aria-label={`Remove ${w.word}`}
					onClick={onRemove}
				>
					<X className="size-5" aria-hidden />
				</button>
			</div>
			{open && (
				<div className="mt-3 grid gap-3 sm:pl-9">
					<form onSubmit={commit} className="space-y-1">
						<label htmlFor={`${id}-spelling`} className="text-xs text-page-muted">
							Spelling <span className="opacity-80">(this is the answer key)</span>
						</label>
						<div className="flex gap-2">
							<input
								id={`${id}-spelling`}
								className="field min-w-0"
								value={spelling}
								onChange={(e) => setSpelling(e.target.value)}
								onBlur={() => commit()}
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								aria-invalid={!!problem}
								aria-describedby={problem ? `${id}-problem` : undefined}
							/>
							<button type="submit" className="key" data-variant="felt" disabled={spelling === w.word}>
								Fix
							</button>
						</div>
						{problem && <Problem id={`${id}-problem`}>{problem}</Problem>}
					</form>
					{(["sentence", "definition"] as const).map((k) => (
						<label key={k} className="space-y-1">
							<span className="text-xs text-page-muted">
								Your own {k} <span className="opacity-80">(optional; otherwise we look it up)</span>
							</span>
							<input className="field" value={w[k] ?? ""} onChange={(e) => onChange(k, e.target.value || null)} />
						</label>
					))}
				</div>
			)}
		</li>
	);
}
