import type { Board, Cell, CodeEvent, Dir, Garden } from "./types.ts";

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
export const STEP: Record<Dir, Cell> = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };

export const sizeOf = (b: Board) => ({ w: Math.max(...b.rows.map((r) => r.length)), h: b.rows.length });
export const at = (b: Board, c: Cell) => b.rows[c.y]?.[c.x] ?? " ";
export const inside = (b: Board, c: Cell) => c.y >= 0 && c.y < b.rows.length && c.x >= 0 && c.x < (b.rows[c.y]?.length ?? 0);
export const blocked = (ch: string) => ch === "#" || ch === "~" || ch === " ";

/** Every square holding `ch`. */
export function cellsOf(b: Board, ch: string): Cell[] {
	const out: Cell[] = [];
	b.rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push({ x, y });
	});
	return out;
}

export const startGarden = (b: Board): Garden => ({
	pos: { x: b.start.x, y: b.start.y },
	dir: b.start.dir,
	pen: false,
	picked: [],
	lit: [],
	planted: [],
	painted: [],
	said: [],
});

/** The board as it stands after one event, for replaying a run on screen. Never mutates. */
export function applyEvent(g: Garden, ev: CodeEvent): Garden {
	switch (ev.t) {
		case "move":
			return { ...g, pos: ev.to };
		case "turn":
			return { ...g, dir: ev.dir };
		case "pick":
			return { ...g, picked: [...g.picked, cellKey(ev.at)] };
		case "light":
			return { ...g, lit: [...g.lit, cellKey(ev.at)] };
		case "plant":
			return { ...g, planted: [...g.planted, cellKey(ev.at)] };
		case "pen":
			return { ...g, pen: ev.down };
		case "paint":
			return g.painted.includes(cellKey(ev.at)) ? g : { ...g, painted: [...g.painted, cellKey(ev.at)] };
		case "say":
			return { ...g, said: [...g.said, ev.text] };
		default:
			return g;
	}
}

/** Text form of a board for tests and the Python parity stub. */
export const boardJson = (b: Board) => JSON.stringify({ rows: b.rows, start: b.start });
