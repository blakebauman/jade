import { adaptLevel, type SkillResult } from "@jade/core/math";
import { type Db, schema } from "@jade/db";
import { and, desc, eq, gte, isNotNull, like, or } from "drizzle-orm";

type AttemptRow = typeof schema.attempts.$inferSelect;

/** Current adaptive level per skill (missing skills are level 1). */
export async function getSkillLevels(db: Db, childId: string): Promise<Record<string, number>> {
	const rows = await db.query.skillLevels.findMany({ where: eq(schema.skillLevels.childId, childId) });
	return Object.fromEntries(rows.map((r) => [r.skill, r.level]));
}

/**
 * After a math round, adapt each skill practiced in it. History is the child's recent answers for that skill across
 * rounds (last 12), so a level can move on the strength of two short rounds, not just one long one.
 * Returns the resulting levels for the skills touched.
 */
export async function updateSkillLevels(db: Db, childId: string, roundAttempts: AttemptRow[]) {
	const skills = [...new Set(roundAttempts.map((a) => a.skill).filter((x): x is string => !!x))];
	if (skills.length === 0) return {};
	const current = await getSkillLevels(db, childId);
	const out: Record<string, number> = {};
	const writes = [];
	for (const skill of skills) {
		const recent = await db
			.select({ correct: schema.attempts.correct, tries: schema.attempts.tries, ms: schema.attempts.ms, level: schema.attempts.level })
			.from(schema.attempts)
			.innerJoin(schema.practiceSessions, eq(schema.practiceSessions.id, schema.attempts.sessionId))
			.where(and(eq(schema.practiceSessions.childId, childId), eq(schema.attempts.skill, skill), isNotNull(schema.attempts.level)))
			.orderBy(desc(schema.practiceSessions.startedAt), desc(schema.attempts.clientId))
			.limit(12);
		const history: SkillResult[] = recent.reverse().map((r) => ({ correct: r.correct, tries: r.tries, ms: r.ms, level: r.level ?? 1 }));
		const level = current[skill] ?? 1;
		const next = adaptLevel(level, history, skill);
		out[skill] = next;
		if (next !== level || current[skill] === undefined) {
			writes.push(
				db
					.insert(schema.skillLevels)
					.values({ childId, skill, level: next })
					.onConflictDoUpdate({
						target: [schema.skillLevels.childId, schema.skillLevels.skill],
						set: { level: next, updatedAt: new Date() },
					}),
			);
		}
	}
	if (writes.length > 0) await db.batch(writes as [(typeof writes)[number], ...typeof writes]);
	return out;
}

/** Inputs for the math badges: facts mastered (Leitner box 4+) and the fractions level. */
export async function mathBadgeStats(db: Db, childId: string) {
	const [mastered, levels] = await Promise.all([
		db
			.select({ word: schema.wordProgress.word })
			.from(schema.wordProgress)
			.where(
				and(
					eq(schema.wordProgress.childId, childId),
					gte(schema.wordProgress.box, 4),
					or(like(schema.wordProgress.word, "m:mul:%"), like(schema.wordProgress.word, "m:div:%")),
				),
			),
		getSkillLevels(db, childId),
	]);
	return { factsMastered: mastered.length, fractionsLevel: levels.fractions ?? 1 };
}
