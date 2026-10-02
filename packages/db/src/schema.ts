import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;
const createdAt = integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);
const updatedAt = integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now);

// ── Better Auth (parent accounts). Column names follow Better Auth's field names via the drizzle adapter. ──
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
	image: text("image"),
	// Better Auth admin plugin. `role` is "user" or "admin"; a banned parent can't sign in.
	role: text("role").default("user"),
	banned: integer("banned", { mode: "boolean" }).default(false),
	banReason: text("ban_reason"),
	banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
	createdAt,
	updatedAt,
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		/** Set when an admin is signed in as this parent (admin plugin impersonation). */
		impersonatedBy: text("impersonated_by"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt,
		updatedAt,
	},
	(t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
		scope: text("scope"),
		password: text("password"),
		createdAt,
		updatedAt,
	},
	(t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt,
	updatedAt,
});

// ── App ──

/**
 * Per-parent settings. `pinHash` gates the parent area on a shared family device (optional); `pinRelockMinutes` is how
 * long it may sit idle before the PIN is asked for again (null = the default).
 */
export const parentSettings = sqliteTable("parent_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	pinHash: text("pin_hash"),
	pinRelockMinutes: integer("pin_relock_minutes"),
	timeZone: text("time_zone"),
	/** Holidays this family has turned off in Roxy (JSON array of holiday ids). */
	roxyHolidaysOff: text("roxy_holidays_off").notNull().default("[]"),
	/** Day, Night, or Auto (follow the device). Applies on every device the family signs in on. */
	appearance: text("appearance", { enum: ["auto", "day", "night"] })
		.notNull()
		.default("auto"),
});

export const children = sqliteTable(
	"children",
	{
		id: text("id").primaryKey(),
		parentId: text("parent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		avatar: text("avatar").notNull(),
		grade: integer("grade"),
		settingsJson: text("settings_json").notNull().default("{}"),
		createdAt,
	},
	(t) => [index("children_parent_idx").on(t.parentId)],
);

/** Word lists. `ownerId` is the parent; built-in packs are not stored — they ship in @jade/core and are copied on use. */
export const wordLists = sqliteTable(
	"word_lists",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		grade: integer("grade"),
		source: text("source", { enum: ["paste", "csv", "ocr", "pack"] }).notNull(),
		/** Set when the parent moves the list to past lists: kids stop seeing it; its missed words still come back in Review. */
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt,
		updatedAt,
	},
	(t) => [index("word_lists_owner_idx").on(t.ownerId)],
);

/** Which kids a list is for. No rows means every kid in the family, including kids added later. */
export const listChildren = sqliteTable(
	"list_children",
	{
		listId: text("list_id")
			.notNull()
			.references(() => wordLists.id, { onDelete: "cascade" }),
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.listId, t.childId] }), index("list_children_child_idx").on(t.childId)],
);

export const listWords = sqliteTable(
	"list_words",
	{
		listId: text("list_id")
			.notNull()
			.references(() => wordLists.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		word: text("word").notNull(),
		customSentence: text("custom_sentence"),
		customDefinition: text("custom_definition"),
	},
	(t) => [primaryKey({ columns: [t.listId, t.word] })],
);

/** Global dictionary cache, shared across families. Keyed by normalized word. */
export const wordInfo = sqliteTable("word_info", {
	word: text("word").primaryKey(),
	definition: text("definition"),
	partOfSpeech: text("part_of_speech"),
	sentence: text("sentence"),
	origin: text("origin"),
	phonetic: text("phonetic"),
	syllables: text("syllables"),
	source: text("source").notNull(),
	fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const practiceSessions = sqliteTable(
	"practice_sessions",
	{
		id: text("id").primaryKey(),
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		listId: text("list_id").references(() => wordLists.id, { onDelete: "set null" }),
		subject: text("subject", { enum: ["spelling", "math"] })
			.notNull()
			.default("spelling"),
		mode: text("mode", { enum: ["bee", "learn", "tiles", "review", "facts", "mental", "fractions", "problems", "mathreview"] }).notNull(),
		startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
		finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
		correct: integer("correct").notNull().default(0),
		total: integer("total").notNull().default(0),
		stars: integer("stars").notNull().default(0),
	},
	(t) => [index("sessions_child_idx").on(t.childId, t.startedAt)],
);

export const attempts = sqliteTable(
	"attempts",
	{
		clientId: text("client_id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => practiceSessions.id, { onDelete: "cascade" }),
		/** Spelling: the word. Math: the problem key (`m:mul:7x8`). */
		word: text("word").notNull(),
		typed: text("typed").notNull(),
		correct: integer("correct", { mode: "boolean" }).notNull(),
		/** Math only: the skill and level the problem was generated at. */
		skill: text("skill"),
		level: integer("level"),
		tries: integer("tries").notNull(),
		hintsUsed: integer("hints_used").notNull(),
		replays: integer("replays").notNull(),
		ms: integer("ms").notNull(),
		stars: integer("stars").notNull(),
	},
	(t) => [index("attempts_session_idx").on(t.sessionId)],
);

export const wordProgress = sqliteTable(
	"word_progress",
	{
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		word: text("word").notNull(),
		box: integer("box").notNull(),
		dueAt: integer("due_at").notNull(),
		streak: integer("streak").notNull(),
		lastSeen: integer("last_seen").notNull(),
		misses: integer("misses").notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.childId, t.word] }), index("progress_due_idx").on(t.childId, t.dueAt)],
);

/** Adaptive math level (1–5) per child and skill (`mul`, `div`, `addsub`, `mixed`, `fractions`, `decimals`, `problems`). */
export const skillLevels = sqliteTable(
	"skill_levels",
	{
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		skill: text("skill").notNull(),
		level: integer("level").notNull().default(1),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
	},
	(t) => [primaryKey({ columns: [t.childId, t.skill] })],
);

export const childStats = sqliteTable("child_stats", {
	childId: text("child_id")
		.primaryKey()
		.references(() => children.id, { onDelete: "cascade" }),
	currentStreak: integer("current_streak").notNull().default(0),
	bestStreak: integer("best_streak").notNull().default(0),
	lastDay: text("last_day"),
	/** Lifetime stars earned; it never goes down, so star badges stay put. Spendable = totalStars − starsSpent. */
	totalStars: integer("total_stars").notNull().default(0),
	/** Stars spent unlocking Roxy items. */
	starsSpent: integer("stars_spent").notNull().default(0),
	perfectRounds: integer("perfect_rounds").notNull().default(0),
	wordsSpelled: integer("words_spelled").notNull().default(0),
	badgesJson: text("badges_json").notNull().default("[]"),
});

// ── Roxy (games) ──

/** Roxy items a child has unlocked with stars, or claimed free as a holiday gift (cost 0). */
export const roxyUnlocks = sqliteTable(
	"roxy_unlocks",
	{
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		itemId: text("item_id").notNull(),
		cost: integer("cost").notNull(),
		createdAt,
	},
	(t) => [primaryKey({ columns: [t.childId, t.itemId] })],
);

/** Saved looks: a child's gallery. `fingerprint` is unique across everyone, so no two saved Roxys are the same. */
export const roxyLooks = sqliteTable(
	"roxy_looks",
	{
		id: text("id").primaryKey(),
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		lookJson: text("look_json").notNull(),
		fingerprint: text("fingerprint").notNull().unique(),
		createdAt,
	},
	(t) => [index("roxy_looks_child_idx").on(t.childId, t.createdAt)],
);

/** The look on the stage right now (autosaved), and which saved look it came from, if any. */
export const roxyCurrent = sqliteTable("roxy_current", {
	childId: text("child_id")
		.primaryKey()
		.references(() => children.id, { onDelete: "cascade" }),
	lookJson: text("look_json").notNull(),
	wornLookId: text("worn_look_id").references(() => roxyLooks.id, { onDelete: "set null" }),
	updatedAt,
});

/** Roxy's home: the room's wallpaper, floor and furniture as JSON (see `HomeSchema` in @jade/core/roxy). */
export const roxyHomes = sqliteTable("roxy_homes", {
	childId: text("child_id")
		.primaryKey()
		.references(() => children.id, { onDelete: "cascade" }),
	homeJson: text("home_json").notNull(),
	updatedAt,
});

/** Things a child has found around Roxy's town (see `FINDS` in @jade/core/roxy). */
export const roxyFinds = sqliteTable(
	"roxy_finds",
	{
		childId: text("child_id")
			.notNull()
			.references(() => children.id, { onDelete: "cascade" }),
		findId: text("find_id").notNull(),
		createdAt,
	},
	(t) => [primaryKey({ columns: [t.childId, t.findId] })],
);
