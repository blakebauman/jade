import { generate, problemFromKey } from "./generate.ts";
import type { Rng } from "./rng.ts";
import { type MathSkill, type MathTopic, type Problem, TOPIC_SKILLS } from "./types.ts";

export type MathSettings = { topics: MathTopic[]; tables: number[] };

/**
 * A round of math problems: facts due for review first (up to 4), then the topic's skills in turn at the child's
 * current level. No duplicate problem keys within a round.
 */
export function buildMathRound(
	topic: MathTopic | "review",
	settings: MathSettings,
	levels: Partial<Record<MathSkill, number>>,
	dueFacts: string[],
	rng: Rng,
	size = 10,
): Problem[] {
	const out: Problem[] = [];
	const seen = new Set<string>();
	const push = (p: Problem | null) => {
		if (p && !seen.has(p.key)) {
			seen.add(p.key);
			out.push(p);
		}
	};
	const dueLimit = topic === "review" ? size : topic === "facts" ? 4 : 0;
	for (const key of dueFacts.slice(0, dueLimit)) push(problemFromKey(key));
	if (topic === "review") return out;

	const skills = TOPIC_SKILLS[topic];
	for (let i = 0, guard = 0; out.length < size && guard < size * 20; guard++) {
		const skill = skills[i % skills.length]!;
		const before = out.length;
		push(generate(skill, levels[skill] ?? 1, rng, { tables: settings.tables }));
		if (out.length > before) i++;
	}
	return out;
}
