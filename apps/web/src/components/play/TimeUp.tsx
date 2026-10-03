import { Link, useParams } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/**
 * Play time is up: the go has finished and everything is saved, so the scene stays behind and only the way out is
 * offered. The Play home says how to get more.
 */
export function TimeUp() {
	const { childId } = useParams({ strict: false }) as { childId: string };
	const id = useId();
	const back = useRef<HTMLAnchorElement>(null);
	useEffect(() => back.current?.focus(), []);
	return (
		<div className="fixed inset-0 z-30 grid place-items-center bg-page-deep/80 p-6">
			<section
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={id}
				className="glass max-w-sm space-y-4 rounded-[1.5rem] p-6 text-center"
			>
				<Clock className="mx-auto size-9" aria-hidden />
				<h2 id={id} className="font-display text-2xl font-semibold">
					That’s your play time
				</h2>
				<p className="text-page-muted">Everything you did is saved, right where you left it.</p>
				<Link ref={back} to="/play/$childId/games" params={{ childId }} className="key" data-variant="go">
					Back to Play
				</Link>
			</section>
		</div>
	);
}
