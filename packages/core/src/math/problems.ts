import { int, pick, type Rng } from "./rng.ts";
import type { Problem } from "./types.ts";

/**
 * Authored word-problem templates. Kid-safe everyday settings, varied names, no money-anxiety or peril.
 * Level sets the operation and size: 1 add/sub within 20, 2 add/sub two-digit, 3 multiplication,
 * 4 sharing (division), 5 two steps.
 */
const NAMES = ["Maya", "Leo", "Priya", "Sam", "Aiko", "Omar", "Ruby", "Mateo", "Zoe", "Kai", "Nia", "Finn"];

type Tpl = (rng: Rng, name: string) => { text: string; value: number; explain: string; sig: string };

const LEVEL_TEMPLATES: Record<number, Tpl[]> = {
	1: [
		(rng, n) => {
			const a = int(rng, 3, 12);
			const b = int(rng, 2, 8);
			return {
				text: `${n} has ${a} stickers and gets ${b} more. How many stickers does ${n} have now?`,
				value: a + b,
				explain: `${a} + ${b} = ${a + b}`,
				sig: `stick+${a}+${b}`,
			};
		},
		(rng, n) => {
			const a = int(rng, 8, 18);
			const b = int(rng, 2, a - 2);
			return {
				text: `There are ${a} birds on a fence. ${b} fly away. How many birds are left?`,
				value: a - b,
				explain: `${a} − ${b} = ${a - b}`,
				sig: `bird-${a}-${b}-${n}`,
			};
		},
	],
	2: [
		(rng, n) => {
			const a = int(rng, 23, 68);
			const b = int(rng, 14, 31);
			return {
				text: `${n} read ${a} pages on Monday and ${b} pages on Tuesday. How many pages in all?`,
				value: a + b,
				explain: `${a} + ${b} = ${a + b}`,
				sig: `pages+${a}+${b}`,
			};
		},
		(rng, n) => {
			const a = int(rng, 45, 99);
			const b = int(rng, 12, a - 10);
			return {
				text: `A school garden has ${a} tulips. ${n}'s class picks ${b} for a party. How many tulips are still in the garden?`,
				value: a - b,
				explain: `${a} − ${b} = ${a - b}`,
				sig: `tulip-${a}-${b}`,
			};
		},
	],
	3: [
		(rng, n) => {
			const a = int(rng, 3, 9);
			const b = int(rng, 4, 12);
			return {
				text: `${n} has ${a} boxes of crayons with ${b} crayons in each box. How many crayons is that?`,
				value: a * b,
				explain: `${a} boxes × ${b} crayons = ${a * b}`,
				sig: `cray${a}x${b}`,
			};
		},
		(rng, n) => {
			const a = int(rng, 3, 8);
			const b = int(rng, 3, 9);
			return {
				text: `The team has ${a} rows of chairs with ${b} chairs in each row. How many chairs are there? ${n} is counting.`,
				value: a * b,
				explain: `${a} rows × ${b} chairs = ${a * b}`,
				sig: `chair${a}x${b}`,
			};
		},
	],
	4: [
		(rng, n) => {
			const k = int(rng, 3, 8);
			const each = int(rng, 3, 9);
			return {
				text: `${n} shares ${k * each} strawberries equally among ${k} friends. How many does each friend get?`,
				value: each,
				explain: `${k * each} ÷ ${k} = ${each}`,
				sig: `straw${k * each}/${k}`,
			};
		},
		(rng, n) => {
			const size = int(rng, 4, 8);
			const teams = int(rng, 3, 9);
			return {
				text: `${size * teams} kids sign up for a game. ${n} puts them into teams of ${size}. How many teams are there?`,
				value: teams,
				explain: `${size * teams} ÷ ${size} = ${teams}`,
				sig: `team${size * teams}/${size}`,
			};
		},
	],
	5: [
		(rng, n) => {
			const packs = int(rng, 3, 7);
			const per = int(rng, 4, 10);
			const used = int(rng, 2, packs * per - 2);
			return {
				text: `${n} buys ${packs} packs of ${per} balloons and uses ${used} for a party. How many balloons are left?`,
				value: packs * per - used,
				explain: `${packs} × ${per} = ${packs * per}, then ${packs * per} − ${used} = ${packs * per - used}`,
				sig: `ball${packs}x${per}-${used}`,
			};
		},
		(rng, n) => {
			const start = int(rng, 20, 60);
			const add = int(rng, 10, 40);
			const k = pick(rng, [2, 4, 5]);
			const total = start + add - ((start + add) % k);
			return {
				text: `${n} has ${start} marbles and wins ${total - start} more, then splits them equally into ${k} bags. How many marbles in each bag?`,
				value: total / k,
				explain: `${start} + ${total - start} = ${total}, then ${total} ÷ ${k} = ${total / k}`,
				sig: `marb${start}+${total - start}/${k}`,
			};
		},
	],
};

export function wordProblem(level: number, rng: Rng): Problem {
	const name = pick(rng, NAMES);
	const tpl = pick(rng, LEVEL_TEMPLATES[level] ?? LEVEL_TEMPLATES[1]!);
	const { text, value, explain, sig } = tpl(rng, name);
	return {
		key: `m:wp:${sig}`,
		skill: "problems",
		level,
		prompt: [{ t: "blank" }],
		answer: { kind: "int", value },
		spoken: text,
		text,
		explain,
	};
}
