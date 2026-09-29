import type { GradeResult, LetterMark } from "@jade/core";

/**
 * Short, specific notes about a miss, each pointing at letters rather than saying "wrong".
 * `reveal` = the answer is being shown, so notes may name the right letters; otherwise they only locate the problem.
 */
/** Index (in grade.letters) of the first letter a note is about, so the note can sit under that tile. */
export function firstFlagged(grade: GradeResult): number {
	return grade.letters.findIndex((m) => m.mark !== "ok");
}

export function describeMiss(grade: GradeResult, reveal: boolean): string[] {
	const L = grade.letters;
	const notes: string[] = [];
	for (let i = 0; i < L.length && notes.length < 2; i++) {
		const a = L[i]!;
		const b = L[i + 1];
		if (a.mark === "ok") continue;
		// Swapped pair: "ie" typed as "ei".
		if (b && a.mark === "wrong" && b.mark === "wrong" && a.expected === b.typed && b.expected === a.typed) {
			notes.push(reveal ? `“${a.expected}${b.expected}”, not “${a.typed}${b.typed}”` : "Two letters are swapped");
			i++;
			continue;
		}
		notes.push(noteFor(a, L, i, reveal));
	}
	return [...new Set(notes)];
}

function noteFor(m: LetterMark, L: LetterMark[], i: number, reveal: boolean): string {
	const prev = L[i - 1];
	const next = L[i + 1];
	switch (m.mark) {
		case "missing": {
			// Only a double letter if the neighbour really is the same letter in the word.
			const doubled = (prev?.mark === "ok" && prev.expected === m.expected) || (next?.mark === "ok" && next.expected === m.expected);
			if (reveal) return doubled ? `Double “${m.expected}${m.expected}”` : `Add “${m.expected}”`;
			return doubled ? "A double letter is missing" : "A letter is missing";
		}
		case "extra": {
			// "Only one x" only makes sense when the word has that letter right here; otherwise it just doesn't belong.
			const doubled = (prev?.mark === "ok" && prev.typed === m.typed) || (next?.mark === "ok" && next.typed === m.typed);
			if (reveal) return doubled ? `Only one “${m.typed}”` : `No “${m.typed}” there`;
			return doubled ? "One letter shouldn’t be doubled" : "There’s an extra letter";
		}
		default:
			return reveal ? `“${m.expected}”, not “${m.typed}”` : "A letter isn’t right";
	}
}
