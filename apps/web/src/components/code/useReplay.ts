import { applyEvent, type Board, type BoardCheck, type CodeEvent, type Garden, startGarden } from "@jade/core/code";
import { useEffect, useMemo, useRef, useState } from "react";
import { eventMs } from "./view.ts";

/** A pause between one garden's run and the next. */
const BETWEEN_MS = 600;

export type ReplayState = {
	/** Which garden is on show. */
	board: number;
	garden: Garden;
	playing: { ev: CodeEvent; t: number } | null;
	/** The line running now (1-based), or null. */
	line: number | null;
	/** Lines that have run so far in this garden. */
	ran: Set<number>;
	running: boolean;
};

type Step = { board: number; ev: CodeEvent | null; ms: number; at: number };

/**
 * Plays the runs of a check on the board, one garden after another, at `speed` (1 or 2). `token` changes for each new
 * run. `onDone` fires when the last event has played, or straight away when `skip` is called.
 */
export function useReplay(boards: Board[], checks: BoardCheck[] | null, token: number, speed: number, onDone: () => void) {
	const idle = (b: number): ReplayState => ({
		board: b,
		garden: startGarden(boards[b]!),
		playing: null,
		line: null,
		ran: new Set(),
		running: false,
	});
	// A new puzzle: back to the first garden at its start, in the same render (an effect would let the last puzzle's
	// garden show for a frame).
	const key = boards.map((b) => b.rows.join("/")).join("|");
	const [held, setHeld] = useState<{ key: string; state: ReplayState }>(() => ({ key, state: idle(0) }));
	// biome-ignore lint/correctness/useExhaustiveDependencies: the gardens are what `key` names.
	const fresh = useMemo(() => idle(0), [key]);
	const state = held.key === key ? held.state : fresh;
	const setState = (s: ReplayState) => setHeld({ key, state: s });
	const done = useRef(onDone);
	done.current = onDone;
	const speedRef = useRef(speed);
	speedRef.current = speed;
	const skipRef = useRef<() => void>(() => {});

	// biome-ignore lint/correctness/useExhaustiveDependencies: a run plays once per token.
	useEffect(() => {
		if (!checks || checks.length === 0) return;
		const steps: Step[] = [];
		let at = 0;
		checks.forEach((c, b) => {
			if (b > 0) {
				steps.push({ board: b, ev: null, ms: BETWEEN_MS, at });
				at += BETWEEN_MS;
			}
			c.run.events.forEach((ev, i) => {
				const ms = eventMs(ev, c.run.events[i + 1]);
				steps.push({ board: b, ev, ms, at });
				at += ms;
			});
		});
		const total = at;
		// Gardens as they stand before each step, worked out once.
		const before: Garden[] = [];
		let g = startGarden(boards[0]!);
		let cur = 0;
		for (const s of steps) {
			if (s.board !== cur) {
				cur = s.board;
				g = startGarden(boards[cur]!);
			}
			before.push(g);
			if (s.ev) g = applyEvent(g, s.ev);
		}
		const finalGarden = g;
		const lastBoard = cur;
		let raf = 0;
		let elapsed = 0;
		let last = performance.now();
		let finished = false;
		let shown = -1;
		const ran = new Set<number>();
		let ranBoard = 0;
		const finish = () => {
			if (finished) return;
			finished = true;
			cancelAnimationFrame(raf);
			setState({ board: lastBoard, garden: finalGarden, playing: null, line: null, ran: new Set(ran), running: false });
			done.current();
		};
		skipRef.current = finish;
		const frame = (now: number) => {
			elapsed += (now - last) * speedRef.current;
			last = now;
			if (elapsed >= total) return finish();
			// The step playing now: the last one that has started.
			let i = shown < 0 ? 0 : shown;
			while (i + 1 < steps.length && steps[i + 1]!.at <= elapsed) i++;
			const s = steps[i]!;
			if (s.board !== ranBoard) {
				ranBoard = s.board;
				ran.clear();
			}
			for (let k = Math.max(0, shown); k <= i; k++) {
				const e = steps[k]!.ev;
				if (e?.t === "line" && steps[k]!.board === s.board) ran.add(e.line);
			}
			shown = i;
			let line: number | null = null;
			for (let k = i; k >= 0 && steps[k]!.board === s.board; k--) {
				const e = steps[k]!.ev;
				if (e?.t === "line") {
					line = e.line;
					break;
				}
			}
			const t = s.ms > 0 ? Math.min(1, (elapsed - s.at) / s.ms) : 1;
			setState({
				board: s.board,
				garden: before[i]!,
				playing: s.ev && s.ev.t !== "line" ? { ev: s.ev, t } : null,
				line,
				ran: new Set(ran),
				running: true,
			});
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => {
			finished = true;
			cancelAnimationFrame(raf);
		};
	}, [token]);

	return {
		state,
		/** Jump to the end of the run. */
		skip: () => skipRef.current(),
		/** Show another garden at its start (the garden tabs, while nothing's running). */
		show: (b: number) => setState(idle(b)),
	};
}
