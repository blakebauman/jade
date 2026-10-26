import { sizeOf, TURTLE } from "@jade/core/code";
import { lazy, Suspense, useState } from "react";
import { FlatBoard } from "./FlatBoard.tsx";
import type { BoardViewProps } from "./view.ts";

/** three.js loads only on a code round, never on the topic picker or any other practice screen. */
const CodeBoard3D = lazy(() => import("./CodeBoard3D.tsx"));

const webgl = (() => {
	let ok: boolean | null = null;
	return () => {
		if (ok === null) {
			try {
				ok = !!document.createElement("canvas").getContext("webgl2");
			} catch {
				ok = false;
			}
		}
		return ok;
	};
})();

/**
 * The garden: the 3D toy board, with the flat one from above standing in while it loads and for good if WebGL can't
 * start. "Where will Tuck end up?" always uses the flat board: squares to tap are clearest from above.
 */
export function CodeBoard(props: BoardViewProps & { flat?: boolean }) {
	const [lost, setLost] = useState(false);
	const { w, h } = sizeOf(props.board);
	const said = props.playing?.ev.t === "say" ? props.playing.ev.text : (props.garden.said.at(-1) ?? null);
	const flat = props.flat || lost || !webgl();
	return (
		<div className="relative w-full">
			{flat ? (
				<div className="mx-auto" style={{ maxWidth: `min(100%, ${(w / h) * 46}vh)` }}>
					<FlatBoard {...props} />
				</div>
			) : (
				<div className="relative mx-auto w-full" style={{ aspectRatio: "4 / 3", maxHeight: "46vh" }}>
					<Suspense
						fallback={
							<div className="mx-auto h-full" style={{ aspectRatio: `${w} / ${h}` }}>
								<FlatBoard {...props} />
							</div>
						}
					>
						<CodeBoard3D {...props} onLost={() => setLost(true)} />
					</Suspense>
					{said && (
						<p className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-2xl bg-white px-4 py-1.5 font-display text-lg text-[#24302a] shadow-md">
							<span className="sr-only">{TURTLE} says </span>
							{said}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
