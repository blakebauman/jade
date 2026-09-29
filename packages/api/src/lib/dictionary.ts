import { splitSyllables, type WordInfo } from "@jade/core";
import { type Db, schema } from "@jade/db";
import { eq } from "drizzle-orm";
import type { ApiBindings } from "../env.ts";

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

type Partial = Omit<WordInfo, "word" | "syllables"> & { source: string };
const EMPTY: Partial = { definition: null, partOfSpeech: null, sentence: null, origin: null, phonetic: null, source: "none" };

function rowToInfo(row: typeof schema.wordInfo.$inferSelect): WordInfo {
	return {
		word: row.word,
		definition: row.definition,
		partOfSpeech: row.partOfSpeech,
		sentence: row.sentence,
		origin: row.origin,
		phonetic: row.phonetic,
		syllables: row.syllables ? row.syllables.split("·") : splitSyllables(row.word),
	};
}

/** Rows missing a definition or sentence (upstream was down, model answer rejected) get another try after this. */
const RETRY_INCOMPLETE_MS = 24 * 60 * 60 * 1000;

/** Word info from the global cache, filling it on first request. Never throws for upstream failures. */
export async function getWordInfo(db: Db, env: ApiBindings, word: string): Promise<WordInfo> {
	const cached = await db.query.wordInfo.findFirst({ where: eq(schema.wordInfo.word, word) });
	const complete = cached?.definition && cached.sentence;
	if (cached && (complete || Date.now() - cached.fetchedAt.getTime() < RETRY_INCOMPLETE_MS)) return rowToInfo(cached);

	let info: Partial = EMPTY;
	if (env.MW_KEY) info = (await fromMerriamWebster(word, env.MW_KEY).catch(() => null)) ?? EMPTY;
	if (!info.definition) info = mergeMissing(info, (await fromFreeDictionary(word).catch(() => null)) ?? EMPTY);
	if (!info.sentence || !info.definition) info = mergeMissing(info, (await fromWorkersAi(env.AI, word).catch(() => null)) ?? EMPTY);

	const row = {
		word,
		...info,
		// Dictionaries often use the word itself in the definition ("friendly: in a friend-like way"); hide it so a
		// read-aloud definition doesn't give away the spelling.
		definition: info.definition ? maskWord(info.definition, word) : null,
		syllables: splitSyllables(word).join("·"),
	};
	const fetchedAt = new Date();
	await db
		.insert(schema.wordInfo)
		.values({ ...row, fetchedAt })
		.onConflictDoUpdate({ target: schema.wordInfo.word, set: { ...row, fetchedAt } });
	return rowToInfo({ ...row, fetchedAt });
}

function mergeMissing(a: Partial, b: Partial): Partial {
	return {
		definition: a.definition ?? b.definition,
		partOfSpeech: a.partOfSpeech ?? b.partOfSpeech,
		sentence: a.sentence ?? b.sentence,
		origin: a.origin ?? b.origin,
		phonetic: a.phonetic ?? b.phonetic,
		source: a.source === "none" ? b.source : b.source === "none" ? a.source : `${a.source}+${b.source}`,
	};
}

function maskWord(text: string, word: string): string {
	return text.replace(new RegExp(`\\b${word.replace(/[-']/g, "\\$&")}\\w*`, "gi"), "this word");
}

/** Keep sentences short and single-sentence; long dictionary examples are hard for kids to follow. */
function tidySentence(s: string | undefined | null): string | null {
	if (!s) return null;
	const t = s.trim().replace(/\s+/g, " ");
	if (t.length < 8 || t.length > 160) return null;
	return /[.!?]$/.test(t) ? t[0]!.toUpperCase() + t.slice(1) : `${t[0]!.toUpperCase()}${t.slice(1)}.`;
}

type FreeDictEntry = {
	phonetic?: string;
	phonetics?: { text?: string }[];
	origin?: string;
	meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[];
};

async function fromFreeDictionary(word: string): Promise<Partial | null> {
	const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
		signal: AbortSignal.timeout(2500),
	});
	if (!res.ok) return null;
	const entries = (await res.json()) as FreeDictEntry[];
	const first = entries[0];
	if (!first) return null;
	const meaning = first.meanings?.[0];
	const example = entries
		.flatMap((e) => e.meanings ?? [])
		.flatMap((m) => m.definitions ?? [])
		.find((d) => tidySentence(d.example));
	return {
		definition: meaning?.definitions?.[0]?.definition ?? null,
		partOfSpeech: meaning?.partOfSpeech ?? null,
		sentence: tidySentence(example?.example),
		origin: first.origin ?? null,
		phonetic: first.phonetic ?? first.phonetics?.find((p) => p.text)?.text ?? null,
		source: "dictionaryapi.dev",
	};
}

type MwEntry = { shortdef?: string[]; fl?: string; hwi?: { prs?: { mw?: string }[] }; et?: [string, string][] };

/** Merriam-Webster Elementary (sd2). Examples live deep in `def`; pull the first "vis" text and strip markup. */
async function fromMerriamWebster(word: string, key: string): Promise<Partial | null> {
	const res = await fetch(`https://www.dictionaryapi.com/api/v3/references/sd2/json/${encodeURIComponent(word)}?key=${key}`, {
		signal: AbortSignal.timeout(4000),
	});
	if (!res.ok) return null;
	const raw = await res.text();
	const entries = JSON.parse(raw) as (MwEntry | string)[];
	const first = entries.find((e): e is MwEntry => typeof e === "object" && !!e.shortdef?.length);
	if (!first) return null;
	const vis = /"vis",\s*\[\s*\{\s*"t"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(raw)?.[1];
	const strip = (s: string) => s.replace(/\{\/?[a-z_]+(\|[^}]*)?\}/gi, "").trim();
	return {
		definition: first.shortdef?.[0] ?? null,
		partOfSpeech: first.fl ?? null,
		sentence: tidySentence(vis ? strip(JSON.parse(`"${vis}"`)) : null),
		origin: first.et?.find(([k]) => k === "text")?.[1] ? strip(first.et.find(([k]) => k === "text")![1]) : null,
		phonetic: first.hwi?.prs?.[0]?.mw ?? null,
		source: "merriam-webster",
	};
}

const AI_SCHEMA = {
	type: "object",
	properties: { definition: { type: "string" }, partOfSpeech: { type: "string" }, sentence: { type: "string" } },
	required: ["definition", "partOfSpeech", "sentence"],
};

async function fromWorkersAi(ai: Ai, word: string): Promise<Partial | null> {
	const usesWord = (s: string | null) => !!s && new RegExp(`\\b${word.replace(/[-']/g, "\\$&")}\\b`, "i").test(s);
	let best = null as Partial | null;
	// Small models occasionally paraphrase the word away; one retry is usually enough.
	for (let attempt = 0; attempt < 2; attempt++) {
		const out = (await ai.run(
			TEXT_MODEL as keyof AiModels,
			{
				messages: [
					{
						role: "system",
						content:
							"You help children aged 8-11 practice for a spelling bee. For the word the user gives, reply with JSON: " +
							'{"definition": string, "partOfSpeech": string, "sentence": string}. ' +
							"The definition is one short, simple clause and must NOT contain the word. " +
							`The sentence is 6-14 words, warm, everyday, age-appropriate, and must contain the exact word "${word}".`,
					},
					{ role: "user", content: word },
				],
				response_format: { type: "json_schema", json_schema: AI_SCHEMA },
				max_tokens: 160,
			} as never,
		)) as { response?: string | Record<string, unknown> };
		const body = typeof out.response === "string" ? parseJsonObject(out.response) : out.response;
		if (!body) continue;
		const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() || null : null);
		const sentence = tidySentence(str("sentence"));
		best = {
			definition: best?.definition ?? str("definition"),
			partOfSpeech: best?.partOfSpeech ?? str("partOfSpeech"),
			sentence: usesWord(sentence) ? sentence : null,
			origin: null,
			phonetic: null,
			source: "workers-ai",
		};
		if (best.sentence) break;
		console.warn("workers-ai sentence rejected", { word, sentence: str("sentence") });
	}
	return best;
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
	const match = /\{[\s\S]*\}/.exec(text);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as Record<string, unknown>;
	} catch {
		return null;
	}
}
