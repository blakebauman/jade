import { applyEvent, type Board, type Cell, type CodeEvent, type Garden, startGarden } from "@jade/core/code";

/**
 * What a garden view draws: the flat SVG board and the 3D board take the same props, so either can stand in for the
 * other (the flat one while the 3D chunk loads, and for good when WebGL can't start).
 */
export type BoardViewProps = {
	board: Board;
	/** The garden after every event before `playing`. */
	garden: Garden;
	/** The event being shown now and how far through it (0–1): Tuck walks, turns, bumps or picks across it. */
	playing: { ev: CodeEvent; t: number } | null;
	/** Predict puzzles: tapping a square answers. */
	onCell?: (c: Cell) => void;
	/** The square the kid chose, and once it's checked, where Tuck really ended up. */
	chosen?: Cell | null;
	answer?: Cell | null;
	/** Spoken name of the garden, e.g. "Garden 1 of 2". */
	label: string;
};

/** How long each event takes at 1×, in ms. A line with no action still lights for a moment, so it can be followed. */
export function eventMs(ev: CodeEvent, next?: CodeEvent): number {
	switch (ev.t) {
		case "line":
			return !next || next.t === "line" ? 180 : 0;
		case "move":
			return 360;
		case "turn":
			return 260;
		case "bump":
			return 520;
		case "pick":
		case "light":
		case "plant":
			return 420;
		case "pen":
			return 160;
		case "paint":
			return 0;
		case "say":
			return 900;
	}
}

/** Where Tuck stands, partway through an event: for tweening in either view. */
export function tuckAt(garden: Garden, playing: BoardViewProps["playing"]): { x: number; y: number; angle: number; hop: number } {
	const angle = garden.dir * 90;
	if (!playing) return { x: garden.pos.x, y: garden.pos.y, angle, hop: 0 };
	const { ev, t } = playing;
	const e = 1 - (1 - t) ** 3;
	if (ev.t === "move")
		return {
			x: garden.pos.x + (ev.to.x - garden.pos.x) * e,
			y: garden.pos.y + (ev.to.y - garden.pos.y) * e,
			angle,
			hop: Math.sin(Math.PI * t),
		};
	if (ev.t === "turn") {
		let d = ev.dir * 90 - angle;
		if (d > 180) d -= 360;
		if (d < -180) d += 360;
		return { x: garden.pos.x, y: garden.pos.y, angle: angle + d * e, hop: 0 };
	}
	if (ev.t === "bump") {
		// A step toward the hedge and back.
		const k = 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.4));
		return { x: garden.pos.x + (ev.at.x - garden.pos.x) * k, y: garden.pos.y + (ev.at.y - garden.pos.y) * k, angle, hop: 0 };
	}
	return { x: garden.pos.x, y: garden.pos.y, angle, hop: 0 };
}

/** The garden after the first `n` events (for jumping straight to the end of a run). */
export const gardenAfter = (board: Board, events: CodeEvent[], n = events.length) =>
	events.slice(0, n).reduce(applyEvent, startGarden(board));
