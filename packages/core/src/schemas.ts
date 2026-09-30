import { z } from "zod";

export const SPELLING_MODES = ["bee", "learn", "tiles", "review"] as const;
/** Math modes are the parent-facing topics, plus a review round of due facts. */
export const MATH_MODES = ["facts", "mental", "fractions", "problems", "mathreview"] as const;
export const MODES = [...SPELLING_MODES, ...MATH_MODES] as const;
export const SUBJECTS = ["spelling", "math"] as const;
export const subjectSchema = z.enum(SUBJECTS);
export type Subject = z.infer<typeof subjectSchema>;
export const modeSchema = z.enum(MODES);
export type Mode = z.infer<typeof modeSchema>;

/** Tile/answer letter faces. Andika is SIL's literacy face (single-storey a and g). */
export const FONTS = ["fredoka", "andika", "lexend", "atkinson"] as const;
/** Aura-2 speakers offered to parents. Append only: children's saved settings name these. */
export const VOICES = [
	"luna",
	"asteria",
	"athena",
	"hera",
	"orion",
	"apollo",
	"cora",
	"pandora",
	"theia",
	"amalthea",
	"draco",
	"hyperion",
] as const;

export const childSettingsSchema = z.object({
	font: z.enum(FONTS).default("fredoka"),
	voice: z.enum(VOICES).default("luna"),
	/** Playback rate for browser speech and <audio>. 0.6 is noticeably slow for "say it slowly". */
	rate: z.number().min(0.5).max(1.5).default(0.95),
	/** Show one empty square per letter in Bee mode. Off by default: a real bee gives no length hint. */
	showLength: z.boolean().default(false),
	highContrast: z.boolean().default(false),
	math: z
		.object({
			topics: z
				.array(z.enum(["facts", "mental", "fractions", "problems"]))
				.min(1)
				.default(["facts", "mental", "fractions", "problems"]),
			/** Times tables to practice (2–12). */
			tables: z.array(z.number().int().min(1).max(12)).min(1).default([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
		})
		.default({ topics: ["facts", "mental", "fractions", "problems"], tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
});
export type ChildSettings = z.infer<typeof childSettingsSchema>;
export const DEFAULT_SETTINGS: ChildSettings = childSettingsSchema.parse({});

/** A child's "tile": their initial on a maple tile with a chosen point value in the corner. */
export const AVATARS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

export const childInputSchema = z.object({
	name: z.string().trim().min(1).max(40),
	avatar: z.enum(AVATARS).default("1"),
	grade: z.number().int().min(0).max(8).nullable().default(null),
	settings: childSettingsSchema.partial().optional(),
});
export type ChildInput = z.infer<typeof childInputSchema>;

export const wordSchema = z
	.string()
	.trim()
	.min(1)
	.max(40)
	.regex(/^[A-Za-z][A-Za-z'’ -]*$/, "Letters, apostrophes and hyphens only");

export const listWordInputSchema = z.object({
	word: wordSchema,
	sentence: z.string().trim().max(240).nullish(),
	definition: z.string().trim().max(240).nullish(),
});

export const LIST_SOURCES = ["paste", "csv", "ocr", "pack"] as const;
export const listInputSchema = z.object({
	name: z.string().trim().min(1).max(80),
	grade: z.number().int().min(0).max(8).nullable().default(null),
	source: z.enum(LIST_SOURCES).default("paste"),
	words: z.array(listWordInputSchema).max(300).default([]),
});
export type ListInput = z.infer<typeof listInputSchema>;

export const replaceWordsSchema = z.object({ words: z.array(listWordInputSchema).max(300) });

export const TTS_KINDS = ["word", "sentence", "definition", "letters"] as const;
export const ttsQuerySchema = z.object({
	text: z.string().trim().min(1).max(300),
	kind: z.enum(TTS_KINDS).default("word"),
	voice: z.enum(VOICES).default("luna"),
});

export const sessionStartSchema = z.object({
	childId: z.string().min(1),
	listId: z.string().min(1).nullable(),
	mode: modeSchema,
	subject: subjectSchema.default("spelling"),
	/** Client-generated id so a session started offline can be created later without duplicates. */
	id: z.string().min(8).max(64),
	startedAt: z.number().int(),
});

export const attemptSchema = z.object({
	clientId: z.string().min(8).max(64),
	/** Spelling: the word. Math: the problem key, e.g. `m:mul:7x8`. */
	word: z.string().min(1).max(80),
	/** Math only: the skill and level the problem was generated at (drives adaptive levels). */
	skill: z.string().max(20).optional(),
	level: z.number().int().min(1).max(5).optional(),
	typed: z.string().max(60),
	correct: z.boolean(),
	tries: z.number().int().min(1).max(5),
	hintsUsed: z.number().int().min(0).max(20),
	replays: z.number().int().min(0).max(50),
	ms: z.number().int().min(0).max(3_600_000),
});
export type AttemptInput = z.infer<typeof attemptSchema>;

/** Answers saved as they happen (one word at a time), so leaving mid-round never loses progress. */
export const attemptsBatchSchema = z.object({
	attempts: z.array(attemptSchema).min(1).max(50),
	/** When the answers were given (client clock), for SRS due dates. */
	at: z.number().int(),
	/** Family-local calendar day, "YYYY-MM-DD", for streaks. */
	day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AttemptsBatch = z.infer<typeof attemptsBatchSchema>;

export const sessionFinishSchema = z.object({
	attempts: z.array(attemptSchema).max(300),
	finishedAt: z.number().int(),
	/** Family-local calendar day, "YYYY-MM-DD", for streaks. */
	day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SessionFinish = z.infer<typeof sessionFinishSchema>;

export type WordInfo = {
	word: string;
	definition: string | null;
	partOfSpeech: string | null;
	sentence: string | null;
	origin: string | null;
	phonetic: string | null;
	syllables: string[];
};
