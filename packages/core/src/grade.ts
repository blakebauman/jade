import { normalizeWord } from "./normalize.ts";

/**
 * One cell of the feedback strip shown after a submit.
 * - ok: typed letter matches.
 * - wrong: a different letter was typed in this slot (`typed` holds it).
 * - missing: the child left this letter out.
 * - extra: the child typed a letter that doesn't belong (`expected` is empty).
 */
export type LetterMark = { expected: string; typed: string; mark: "ok" | "wrong" | "missing" | "extra" };

export type GradeResult = { correct: boolean; target: string; typed: string; letters: LetterMark[]; distance: number };

/** Grade a typed spelling against the target, with a letter-level alignment for feedback (Levenshtein backtrace). */
export function gradeAttempt(targetRaw: string, typedRaw: string): GradeResult {
	const target = normalizeWord(targetRaw);
	const typed = normalizeWord(typedRaw);
	const n = target.length;
	const m = typed.length;

	const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			const cost = target[i - 1] === typed[j - 1] ? 0 : 1;
			d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
		}
	}

	const letters: LetterMark[] = [];
	let i = n;
	let j = m;
	while (i > 0 || j > 0) {
		const here = d[i]![j]!;
		if (i > 0 && j > 0 && here === d[i - 1]![j - 1]! + (target[i - 1] === typed[j - 1] ? 0 : 1)) {
			const same = target[i - 1] === typed[j - 1];
			letters.push({ expected: target[i - 1]!, typed: typed[j - 1]!, mark: same ? "ok" : "wrong" });
			i--;
			j--;
		} else if (i > 0 && here === d[i - 1]![j]! + 1) {
			letters.push({ expected: target[i - 1]!, typed: "", mark: "missing" });
			i--;
		} else {
			letters.push({ expected: "", typed: typed[j - 1]!, mark: "extra" });
			j--;
		}
	}
	letters.reverse();

	return { correct: n > 0 && target === typed, target, typed, letters, distance: d[n]![m]! };
}
