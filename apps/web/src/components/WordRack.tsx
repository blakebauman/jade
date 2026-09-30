import { WordTiles } from "@jade/ui/components/tile";
import { useLayoutEffect, useRef, useState } from "react";
import { fitTile } from "#/components/round/AnswerRow.tsx";

/**
 * A word as a rack of tiles that fits the space it's given: `max` where there's room, smaller for a long word in a narrow
 * row (a 14-letter bee word on a phone), never below `min`. Measures its parent, so it can sit inline beside other racks.
 * A rack stays on one line, like the answer row: only a word too long to fit even at `min` wraps, rather than overflow.
 */
export function WordRack({ word, max, min = 16, dropDelay }: { word: string; max: number; min?: number; dropDelay?: number }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const parent = ref.current?.parentElement;
		if (!parent) return;
		const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
		ro.observe(parent);
		return () => ro.disconnect();
	}, []);
	const size = width ? Math.max(min, fitTile(width, word.length, max).size) : max;
	return (
		<span ref={ref} className="inline-flex max-w-full">
			<WordTiles word={word} size={size} dropDelay={dropDelay} className="max-w-full flex-wrap" />
		</span>
	);
}
