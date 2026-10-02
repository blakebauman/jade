import { gradeAttempt, starsForRound, starsForWord } from "@jade/core";
import { type Law, Pips, Square, Tile, WordTiles } from "@jade/ui/components/tile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { CloudOff, RotateCcw, Star, Volume2 } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { BadgeIcon, badgeSticker } from "#/components/BadgeIcon.tsx";
import { useChild } from "#/lib/child.ts";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { type MathMode, useMathRound } from "#/lib/mathRound.ts";
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
						style={{ width: size, height: size, boxShadow: "inset 0 -0.3em 0 var(--color-sky), inset 0 0.2em 0.5em var(--tone-recess)" }}
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

/** When the perfect-round flip cascade starts (after all three stars have landed), and the gap between tiles. */
const FLIP_AT = 3 * 140 + 420 + 120;
const FLIP_STEP = 110;

/**
 * Star tile motion: an ordinary drop for one star, a heavier landing for two or three, and on a perfect round a flip
 * cascade after landing. The flip has no fill, so it only takes over transform while it runs.
 */
function starMotion(i: number, stars: number, perfect: boolean): CSSProperties {
	const land = `${stars >= 2 ? "tile-land 420ms" : "tile-drop 240ms"} var(--ease-out-expo) ${i * 140}ms both`;
	if (!perfect) return { animation: land };
	return { animation: `${land}, tile-flip 420ms var(--ease-out-expo) ${FLIP_AT + (i - 1) * FLIP_STEP}ms` };
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
	const isMath = round.subject === "math";
	const unit = isMath ? "problems" : "words";
	const mathMissed = (round.items ?? []).filter((it) => !it.firstTry);
	const mathRetry = mathMissed.flatMap((it) => (it.problem ? [it.problem] : []));

	const headline = useMemo(() => {
		const pct = round.attempts.length ? correct / round.attempts.length : 0;
		if (perfect) return "Perfect round!";
		if (pct >= 0.8) return isMath ? "Great math!" : "Great spelling!";
		if (pct >= 0.5) return "Good work. Let’s polish a few.";
		return isMath ? "Every miss is something you’re learning." : "Every miss is a word you’re learning.";
	}, [correct, perfect, round.attempts.length, isMath]);

	// The celebration is the board's own motion: star tiles land (2+ stars); on a perfect round they then flip
	// left to right and come up marigold, the colour of right. `lit` counts tiles whose edge has turned.
	const reduced = useMemo(prefersReducedMotion, []);
	const [lit, setLit] = useState(perfect && reduced ? 3 : 0);
	useEffect(() => {
		if (!perfect || reduced) return;
		// Each edge turns at the flip's midpoint (45% of 420ms), when the tile is edge-on.
		const timers = [0, 1, 2].map((i) => setTimeout(() => setLit(i + 1), FLIP_AT + i * FLIP_STEP + 190));
		return () => timers.forEach(clearTimeout);
	}, [perfect, reduced]);

	/** A math round of exactly the problems that needed another look, opened through the round's resume path. */
	function practiceMissedMath() {
		const topic = (round.mathMode ?? "facts") as MathMode;
		useMathRound.getState().start({ childId: child.id, mode: topic, problems: mathRetry });
		navigate({ to: "/play/$childId/math/$topic", params: { childId: child.id, topic }, search: { resume: true } });
	}

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
							<Tile key={i} size={72} grain={i} law={i <= lit ? "right" : undefined} style={starMotion(i, stars, perfect)} aria-hidden>
								<Star className="size-9 fill-ink-soft text-ink-soft" aria-hidden strokeWidth={1.5} />
							</Tile>
						) : (
							<Square key={i} size={72} />
						),
					)}
				</div>
				<h1 className="text-4xl font-semibold md:text-5xl">{headline}</h1>
				<p className="font-display text-2xl tabular-nums">
					{correct} of {round.attempts.length} {isMath ? "right" : "spelled right"}
				</p>
				{round.planned > round.attempts.length && (
					<p className="text-page-muted">
						Stopped after {round.attempts.length} of {round.planned} {unit}. Everything you answered is saved.
					</p>
				)}
				{round.summary && round.summary.streak > 1 && (
					<p className="text-page-muted">{round.summary.streak}-day streak. Keep it going tomorrow.</p>
				)}
				{round.queued && (
					<p className="flex items-center gap-2 text-sm text-page-muted">
						<CloudOff className="size-4" aria-hidden /> Saved on this device. It’ll sync when you’re back online.
					</p>
				)}
			</section>

			{(round.newBadges ?? []).length > 0 && (
				<section className="mt-10 flex flex-wrap justify-center gap-3" aria-label="New badges">
					{round.newBadges.map((b, i) => (
						<p
							key={b.id}
							className={`sticker flex animate-sticker-place items-center gap-2 !rounded-full px-5 py-2.5 font-display text-lg ${badgeSticker(b.icon).className}`}
							data-place={badgeSticker(b.icon)["data-place"]}
							style={{ "--tilt": `${i % 2 ? 2 : -2}deg`, animationDelay: `${300 + i * 120}ms` } as React.CSSProperties}
						>
							<BadgeIcon icon={b.icon} className="size-5" /> New badge: {b.label}
						</p>
					))}
				</section>
			)}

			{isMath && mathMissed.length > 0 && (
				<section className="mt-14 space-y-5">
					<h2 className="text-2xl font-semibold">Worth another look</h2>
					<ul className="rack space-y-5 !px-5 !pt-5 !pb-7 md:!px-7">
						{mathMissed.map((it, i) => {
							const story = it.key.startsWith("m:wp:");
							return (
								<li key={`${it.key}-${i}`} className="space-y-2.5 border-b border-maple-lo/40 pb-5 text-ink last:border-0 last:pb-0">
									{/* The problem with its answer in marigold tiles, as the round revealed it. */}
									<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
										<p className={story ? "max-w-prose text-pretty" : "font-display text-xl"}>{it.prompt.replace(/\s*\?$/, "")}</p>
										<WordTiles word={it.answer} size={34} laws={[...it.answer].map(() => "right")} />
									</div>
									{it.typed && (
										<p className="flex flex-wrap items-center gap-2 text-sm">
											{it.correct ? "Second try. First try was:" : "You answered:"}
											<WordTiles word={it.typed} size={22} laws={[...it.typed].map(() => "wrong")} />
										</p>
									)}
									<p className="max-w-prose text-sm text-pretty">{it.explain}</p>
								</li>
							);
						})}
					</ul>
				</section>
			)}

			{!isMath && missed.length > 0 && (
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
										{progress && <Pips box={progress.boxes[a.word] ?? 1} className="rounded-full bg-page-deep/80 px-2 py-1.5" />}
									</div>
									{(a.correct ? round.firstTries?.[a.clientId] : a.typed) !== undefined && (
										<p className="flex flex-wrap items-center gap-2 text-sm text-ink">
											{a.correct ? "Second try. First try was:" : "You wrote:"}
											<AttemptTiles target={a.word} typed={a.correct ? round.firstTries![a.clientId]! : a.typed} />
										</p>
									)}
								</div>
							</li>
						))}
					</ul>
				</section>
			)}

			<div className="mt-12 flex flex-wrap justify-center gap-3">
				{isMath && mathRetry.length > 0 && (
					<button type="button" className="key" data-variant="go" onClick={practiceMissedMath}>
						<RotateCcw className="size-5" aria-hidden />{" "}
						{mathRetry.length === 1 ? "Practice this one now" : `Practice these ${mathRetry.length} now`}
					</button>
				)}
				{isMath && (
					<Link
						to="/play/$childId/math/$topic"
						params={{ childId: child.id, topic: (round.mathMode ?? "facts") as MathMode }}
						className="key"
						// One primary key per view: Practice leads when there's something to practice.
						data-variant={mathRetry.length > 0 ? undefined : "go"}
					>
						{mathRetry.length === 0 && <RotateCcw className="size-5" aria-hidden />} Play again
					</Link>
				)}
				{!isMath && missed.length > 0 && (
					<button type="button" className="key" data-variant="go" onClick={practiceMissed}>
						<RotateCcw className="size-5" aria-hidden />{" "}
						{missed.length === 1 ? "Practice this word now" : `Practice these ${missed.length} now`}
					</button>
				)}
				<Link to={isMath ? "/play/$childId/math" : "/play/$childId/spelling"} params={{ childId: child.id }} className="key">
					Done
				</Link>
			</div>
		</main>
	);
}
