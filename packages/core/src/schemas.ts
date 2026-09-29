import { z } from "zod";

export const MODES = ["bee", "learn", "tiles", "review"] as const;
export const modeSchema = z.enum(MODES);
export type Mode = z.infer<typeof modeSchema>;

/** Tile/answer letter faces. Andika is SIL's literacy face (single-storey a and g). */
export const FONTS = ["fredoka", "andika", "lexend", "atkinson"] as const;
export const VOICES = ["luna", "asteria", "athena", "hera", "orion", "apollo"] as const;

export const childSettingsSchema = z.object({
	font: z.enum(FONTS).default("fredoka"),
	voice: z.enum(VOICES).default("luna"),
	/** Playback rate for browser speech and <audio>. 0.6 is noticeably slow for "say it slowly". */
	rate: z.number().min(0.5).max(1.5).default(0.95),
	/** Show one empty square per letter in Bee mode. Off by default: a real bee gives no length hint. */
	showLength: z.boolean().default(false),
	highContrast: z.boolean().default(false),
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
	/** Client-generated id so a session started offline can be created later without duplicates. */
	id: z.string().min(8).max(64),
	startedAt: z.number().int(),
});

export const attemptSchema = z.object({
	clientId: z.string().min(8).max(64),
	word: z.string().min(1).max(40),
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
