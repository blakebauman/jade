import { gradeAttempt, starsForRound, starsForWord } from "@jade/core";
import { type Law, Pips, Square, Tile, WordTiles } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import { CloudOff, RotateCcw, Star, Volume2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { BadgeIcon } from "#/components/BadgeIcon.tsx";
import { useChild } from "#/lib/child.ts";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { progressQuery } from "#/lib/queries.ts";
import { useRound } from "#/lib/round.ts";
import { speaker } from "#/lib/speaker.ts";

export const Route = createFileRoute("/_authed/play/$childId/results")({
	beforeLoad: ({ params }) => {
		const last = useRound.getState().lastRound;
		if (!last || last.childId !== params.childId) throw redirect({ to: "/play/$childId", params });
	},
	component: Results,
});

/** The speller's attempt with every law marked, including a sky-edged gap where a letter was left out. */
function AttemptTiles({ target, typed, size = 22 }: { target: string; typed: string; size?: number }) {
	const letters = gradeAttempt(target, typed).letters;
	return (
		<span className="inline-flex gap-[3px]" role="img" aria-label={`You wrote ${typed || "nothing"}`}>
			{letters.map((m, i) =>
				m.mark === "missing" ? (
					<span
						key={`m${i}`}
						className="square inline-block shrink-0"
						style={{ width: size, height: size, boxShadow: "inset 0 -0.3em 0 var(--color-sky), inset 0 0.2em 0.5em rgb(0 0 0 / 0.45)" }}
					/>
				) : (
					<Tile
						key={`t${i}`}
						letter={m.typed}
						size={size}
						grain={i % 4}
						law={(m.mark === "ok" ? undefined : m.mark === "wrong" ? "wrong" : "extra") as Law | undefined}
						aria-hidden
					/>
				),
			)}
		</span>
	);
}

function Results() {
	const child = useChild();
	const navigate = useNavigate();
	const round = useRound((s) => s.lastRound)!;
	const { data: progress } = useQuery(progressQuery(child.id));
	const perWord = round.attempts.map(starsForWord);
	const correct = round.attempts.filter((a) => a.correct).length;
	const stars = round.summary?.stars ?? starsForRound(perWord);
	const missed = round.attempts.filter((a) => !a.correct || a.tries > 1);
	const perfect = round.attempts.length > 0 && perWord.every((s) => s === 3);

	const headline = useMemo(() => {
		const pct = round.attempts.length ? correct / round.attempts.length : 0;
		if (perfect) return "Perfect round!";
		if (pct >= 0.8) return "Great spelling!";
		if (pct >= 0.5) return "Good work. Let’s polish a few.";
		return "Every miss is a word you’re learning.";
	}, [correct, perfect, round.attempts.length]);

	useEffect(() => {
		if (stars >= 2 && !prefersReducedMotion()) {
			void confetti({
				particleCount: perfect ? 160 : 90,
				spread: 75,
				origin: { y: 0.3 },
				colors: ["#f1c98a", "#f2b632", "#f9e0b3", "#e3f3ec"],
			});
		}
	}, [stars, perfect]);

	function practiceMissed() {
		// A Bee round over just the missed words (keeping the list's own sentences when there is a list).
		navigate({
			to: "/play/$childId/round/$listId/$mode",
			params: { childId: child.id, listId: round.listId ?? "review", mode: round.listId ? "bee" : "review" },
			search: { only: missed.map((a) => a.word).join(",") },
		});
	}

	return (
		<main className="mx-auto min-h-dvh max-w-4xl px-5 py-10 md:px-10">
			<section className="flex flex-col items-center gap-5 text-center">
				<div className="flex gap-3" role="img" aria-label={`${stars} of 3 stars`}>
					{[1, 2, 3].map((i) =>
						i <= stars ? (
							<Tile key={i} size={72} grain={i} className="animate-tile-drop" style={{ animationDelay: `${i * 140}ms` }} aria-hidden>
								<Star className="size-9 fill-ink-soft text-ink-soft" aria-hidden strokeWidth={1.5} />
							</Tile>
						) : (
							<Square key={i} size={72} />
						),
					)}
				</div>
				<h1 className="text-4xl font-semibold md:text-5xl">{headline}</h1>
				<p className="font-display text-2xl tabular-nums">
					{correct} of {round.attempts.length} spelled right
				</p>
				{round.planned > round.attempts.length && (
					<p className="text-felt-muted">
						Stopped after {round.attempts.length} of {round.planned} words. Everything you answered is saved.
					</p>
				)}
				{round.summary && round.summary.streak > 1 && (
					<p className="text-felt-muted">{round.summary.streak}-day streak. Keep it going tomorrow.</p>
				)}
				{round.queued && (
					<p className="flex items-center gap-2 text-sm text-felt-muted">
						<CloudOff className="size-4" aria-hidden /> Saved on this device. It’ll sync when you’re back online.
					</p>
				)}
			</section>

			{(round.newBadges ?? []).length > 0 && (
				<section className="mt-10 flex flex-wrap justify-center gap-3" aria-label="New badges">
					{round.newBadges.map((b) => (
						<p key={b.id} className="plaque animate-tile-drop px-5 py-2.5 font-display text-lg">
							<BadgeIcon icon={b.icon} className="size-5" /> New badge: {b.label}
						</p>
					))}
				</section>
			)}

			{missed.length > 0 && (
				<section className="mt-14 space-y-5">
					<h2 className="text-2xl font-semibold">Words to practice</h2>
					<ul className="rack space-y-5 !px-5 !pt-5 !pb-7 md:!px-7">
						{missed.map((a) => (
							<li
								key={a.clientId}
								className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-maple-lo/40 pb-5 last:border-0 last:pb-0"
							>
								<button
									type="button"
									className="key size-12 !p-0"
									data-variant="tile"
									onClick={() => void speaker.say(a.word)}
									aria-label={`Hear ${a.word}`}
								>
									<Volume2 className="size-5" aria-hidden />
								</button>
								<div className="min-w-0 space-y-2">
									<div className="flex flex-wrap items-center gap-3">
										<WordTiles word={a.word} size={34} laws={[...a.word].map(() => "right")} />
										{progress && <Pips box={progress.boxes[a.word] ?? 1} className="rounded-full bg-felt-deep/80 px-2 py-1.5" />}
									</div>
									<p className="flex flex-wrap items-center gap-2 text-sm text-ink">
										{a.correct ? "Second try. First try was:" : "You wrote:"}
										<AttemptTiles target={a.word} typed={a.typed} />
									</p>
								</div>
							</li>
						))}
					</ul>
				</section>
			)}

			<div className="mt-12 flex flex-wrap justify-center gap-3">
				{missed.length > 0 && (
					<button type="button" className="key" data-variant="go" onClick={practiceMissed}>
						<RotateCcw className="size-5" aria-hidden />{" "}
						{missed.length === 1 ? "Practice this word now" : `Practice these ${missed.length} now`}
					</button>
				)}
				<Link to="/play/$childId" params={{ childId: child.id }} className="key">
					Done
				</Link>
			</div>
		</main>
	);
}
