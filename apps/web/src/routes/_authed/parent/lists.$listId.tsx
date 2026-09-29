import { normalizeWord, parseWordList } from "@jade/core";
import { WordTiles } from "@jade/ui/components/tile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, ClipboardPaste, FileUp, Trash2, X } from "lucide-react";
import { type ChangeEvent, useEffect, useId, useState } from "react";
import { api, type ListWord, type WordList } from "#/lib/api.ts";
import { preparePhoto, wordsFromFile } from "#/lib/import.ts";
import { listQuery } from "#/lib/queries.ts";
import { warmList } from "#/lib/warm.ts";

export const Route = createFileRoute("/_authed/parent/lists/$listId")({ component: ListEditor });

type Source = "paste" | "csv" | "ocr" | "pack";

function mergeWords(existing: ListWord[], incoming: ListWord[]) {
	const seen = new Set(existing.map((w) => w.word));
	return [...existing, ...incoming.filter((w) => !seen.has(w.word) && seen.add(w.word))];
}

function ListEditor() {
	const { listId } = Route.useParams();
	const isNew = listId === "new";
	const { data: existing } = useQuery({ ...listQuery(listId), enabled: !isNew });
	const qc = useQueryClient();
	const navigate = useNavigate();

	const [name, setName] = useState("");
	const [grade, setGrade] = useState<number | null>(null);
	const [words, setWords] = useState<ListWord[]>([]);
	const [source, setSource] = useState<Source>("paste");
	const [tab, setTab] = useState<"paste" | "file" | "photo">("paste");
	const [pasted, setPasted] = useState("");
	const [single, setSingle] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [ocrBusy, setOcrBusy] = useState(false);
	const [openWord, setOpenWord] = useState<string | null>(null);
	const ids = { name: useId(), grade: useId(), paste: useId(), add: useId() };

	useEffect(() => {
		if (!existing) return;
		setName(existing.name);
		setGrade(existing.grade);
		setWords(existing.words);
		setSource(existing.source as Source);
	}, [existing]);

	const save = useMutation({
		mutationFn: async () => {
			const body = { name: name.trim() || "Spelling words", grade, source, words };
			let list: WordList;
			if (isNew) list = await api<WordList>("/api/lists", { method: "POST", json: body });
			else {
				await api<WordList>(`/api/lists/${listId}`, { method: "PATCH", json: { name: body.name, grade } });
				list = await api<WordList>(`/api/lists/${listId}/words`, { method: "PUT", json: { words } });
			}
			// Fetch definitions/sentences and pre-generate the voice clips so the first round plays instantly.
			void warmList(list.words);
			return list;
		},
		onSuccess: (list) => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			qc.setQueryData(listQuery(list.id).queryKey, list);
			navigate({ to: "/parent" });
		},
	});

	const remove = useMutation({
		mutationFn: () => api(`/api/lists/${listId}`, { method: "DELETE" }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["lists"] });
			navigate({ to: "/parent" });
		},
	});

	function add(incoming: ListWord[], from: Source) {
		const merged = mergeWords(words, incoming);
		setNotice(merged.length === words.length ? "No new words found." : `Added ${merged.length - words.length} words.`);
		setWords(merged);
		if (isNew && words.length === 0) setSource(from);
	}

	async function onFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (file) add(wordsFromFile(await file.text()), "csv");
	}

	async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setOcrBusy(true);
		setNotice("Reading the photo…");
		try {
			const form = new FormData();
			form.set("image", await preparePhoto(file));
			const res = await fetch("/api/import/ocr", { method: "POST", body: form, credentials: "same-origin" });
			const data = (await res.json()) as { words?: string[]; title?: string | null; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Couldn’t read that photo.");
			if (data.title && !name) setName(data.title);
			add(
				(data.words ?? []).map((word) => ({ word, sentence: null, definition: null })),
				"ocr",
			);
			setNotice(`Found ${data.words?.length ?? 0} words. Check them below; photos can misread a letter.`);
		} catch (err) {
			setNotice(err instanceof Error ? err.message : "Couldn’t read that photo.");
		} finally {
			setOcrBusy(false);
		}
	}

	const tabs = [
		{ id: "paste", label: "Paste", icon: ClipboardPaste },
		{ id: "file", label: "CSV or text file", icon: FileUp },
		{ id: "photo", label: "Photo of the sheet", icon: Camera },
	] as const;

	return (
		<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<section className="space-y-6">
				<h1 className="text-4xl font-semibold">{isNew ? "New list" : "Edit list"}</h1>
				<div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
					<label htmlFor={ids.name} className="space-y-1.5">
						<span className="text-sm font-medium">List name</span>
						<input id={ids.name} className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Week 6 spelling" />
					</label>
					<label htmlFor={ids.grade} className="space-y-1.5">
						<span className="text-sm font-medium">Grade</span>
						<select
							id={ids.grade}
							className="field"
							value={grade ?? ""}
							onChange={(e) => setGrade(e.target.value === "" ? null : Number(e.target.value))}
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

				<div className="patch space-y-4 p-5">
					<fieldset className="mx-0 flex flex-wrap gap-2 border-0 p-0">
						<legend className="sr-only">Add words from</legend>
						{tabs.map((t) => (
							<button
								key={t.id}
								type="button"
								aria-pressed={tab === t.id}
								className="key text-base"
								data-pressed={tab === t.id}
								onClick={() => setTab(t.id)}
							>
								<t.icon className="size-4" aria-hidden /> {t.label}
							</button>
						))}
					</fieldset>

					{tab === "paste" && (
						<div className="space-y-3">
							<label htmlFor={ids.paste} className="text-sm text-felt-muted">
								One word per line, or separated by commas. Numbering like “1.” is ignored.
							</label>
							<textarea
								id={ids.paste}
								className="field min-h-40"
								value={pasted}
								onChange={(e) => setPasted(e.target.value)}
								placeholder={"1. believe\n2. receive\n3. neighbor"}
							/>
							<button
								type="button"
								className="key"
								disabled={!pasted.trim()}
								onClick={() => {
									add(
										parseWordList(pasted).map((word) => ({ word, sentence: null, definition: null })),
										"paste",
									);
									setPasted("");
								}}
							>
								Add these words
							</button>
						</div>
					)}
					{tab === "file" && (
						<div className="space-y-3 text-sm text-felt-muted">
							<p>
								A CSV with a <code className="text-felt-ink">word</code> column (and optional{" "}
								<code className="text-felt-ink">sentence</code> and <code className="text-felt-ink">definition</code> columns), or any text
								file of words.
							</p>
							<label className="key cursor-pointer text-base has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-felt-ink">
								<FileUp className="size-4" aria-hidden /> Choose file
								<input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
							</label>
						</div>
					)}
					{tab === "photo" && (
						<div className="space-y-3 text-sm text-felt-muted">
							<p>Take a clear, flat photo of the school list. We read the words, you check them. The photo is not stored.</p>
							<label
								className="key cursor-pointer text-base has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-felt-ink"
								aria-disabled={ocrBusy}
							>
								<Camera className="size-4" aria-hidden /> {ocrBusy ? "Reading…" : "Take or choose photo"}
								<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocrBusy} onChange={onPhoto} />
							</label>
						</div>
					)}
					{notice && (
						<p role="status" className="text-sm text-felt-ink">
							{notice}
						</p>
					)}
				</div>
			</section>

			<section className="space-y-4">
				<div className="flex items-baseline justify-between gap-4">
					<h2 className="text-2xl font-semibold">
						Words <span className="text-felt-muted tabular-nums">({words.length})</span>
					</h2>
					{words.length > 0 && (
						<button
							type="button"
							className="min-h-11 px-2 text-sm text-felt-muted underline underline-offset-4 hover:text-felt-ink"
							onClick={() => setWords([])}
						>
							Clear all
						</button>
					)}
				</div>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						const w = normalizeWord(single);
						if (w) add([{ word: w, sentence: null, definition: null }], "paste");
						setSingle("");
					}}
				>
					<label htmlFor={ids.add} className="sr-only">
						Add one word
					</label>
					<input
						id={ids.add}
						className="field"
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
					<p className="py-8 text-felt-muted">
						Words you add show up here as tiles. Check the spelling of each one: this is the answer key.
					</p>
				) : (
					<ol className="space-y-1">
						{words.map((w, i) => (
							<li key={w.word} className="rounded-xl px-2 py-2 hover:bg-felt-raised/40">
								<div className="flex items-center gap-3">
									<span className="w-6 text-right text-sm text-felt-muted tabular-nums">{i + 1}</span>
									<button
										type="button"
										className="flex-1 text-left"
										aria-expanded={openWord === w.word}
										onClick={() => setOpenWord(openWord === w.word ? null : w.word)}
									>
										<WordTiles word={w.word} size={26} />
										<span className="sr-only">Edit sentence and definition</span>
									</button>
									<button
										type="button"
										className="grid size-11 place-items-center rounded-lg text-felt-muted hover:bg-felt-deep hover:text-felt-ink"
										aria-label={`Remove ${w.word}`}
										onClick={() => setWords(words.filter((x) => x.word !== w.word))}
									>
										<X className="size-5" aria-hidden />
									</button>
								</div>
								{openWord === w.word && (
									<div className="mt-3 grid gap-2 pl-9">
										{(["sentence", "definition"] as const).map((k) => (
											<label key={k} className="space-y-1">
												<span className="text-xs text-felt-muted">
													Your own {k} <span className="opacity-80">(optional; otherwise we look it up)</span>
												</span>
												<input
													className="field min-h-10 py-2 text-sm"
													value={w[k] ?? ""}
													onChange={(e) => setWords(words.map((x) => (x.word === w.word ? { ...x, [k]: e.target.value || null } : x)))}
												/>
											</label>
										))}
									</div>
								)}
							</li>
						))}
					</ol>
				)}
				<div className="flex flex-wrap items-center gap-3 border-t border-felt-line/60 pt-5">
					<button
						type="button"
						className="key"
						data-variant="go"
						disabled={words.length === 0 || save.isPending}
						onClick={() => save.mutate()}
					>
						{save.isPending ? "Saving…" : "Save list"}
					</button>
					{!isNew && (
						<button
							type="button"
							className="key"
							data-variant="felt"
							disabled={remove.isPending}
							onClick={() => confirm("Delete this list? Practice history stays.") && remove.mutate()}
						>
							<Trash2 className="size-4" aria-hidden /> Delete
						</button>
					)}
					{save.error && (
						<p role="alert" className="text-sm">
							{save.error.message}
						</p>
					)}
				</div>
			</section>
		</div>
	);
}
