import { GOAL_LABEL, goalLeft, goalProgress, minutesLeft, TIME_BLOCK } from "@jade/core";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, Gamepad2, Star, Ticket } from "lucide-react";
import { useId, useState } from "react";
import { ApiError } from "#/lib/api.ts";
import { dayKey, useOnline } from "#/lib/hooks.ts";
import { type PlayStatus, playApi, playQuery, starsInPlay } from "#/lib/play.ts";

/** The games' money: a berry ticket stub with the count after its perforation. */
export function Tickets({ count, className = "", tall }: { count: number; className?: string; tall?: boolean }) {
	return (
		// Tall: as tall as the round glass keys beside it in a game's corner.
		<span className={`ticket ${className}`} style={tall ? { minHeight: "3rem", paddingInline: "1rem" } : undefined}>
			<Ticket className="size-5" aria-hidden />
			<span className="font-display text-xl font-semibold tabular-nums">
				{count}
				<span className="sr-only"> {count === 1 ? "ticket" : "tickets"}</span>
			</span>
		</span>
	);
}

/** Stars that can be spent in games, on foil like every star. Shown only while a parent lets stars into games. */
export function SpendableStars({ count }: { count: number }) {
	return (
		<span className="foil px-3.5 py-1.5">
			<Star className="size-5 fill-current" aria-hidden />
			<span className="font-display text-xl font-semibold tabular-nums">{count}</span>
			{/* Said on the chip, not only in a tooltip: the header's foil star is every star ever earned. */}
			<span className="text-sm font-medium">to spend</span>
		</span>
	);
}

/** What a kid has to spend in Play. Free games have nothing to count, so they say so instead. */
export function PlayWallet({ status }: { status: PlayStatus }) {
	const { settings, wallet, time } = status;
	if (settings.free) return <p className="text-sm font-medium text-page-muted">Everything in games is free to use</p>;
	return (
		<div className="flex flex-wrap items-center gap-2.5">
			<Tickets count={wallet.tickets} />
			{starsInPlay(settings) && <SpendableStars count={wallet.stars} />}
			{settings.timeCosts && (
				<span className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-page-muted tabular-nums">
					<Clock className="size-4" aria-hidden /> {minutesLeft(time.secondsLeft)} min of play time
				</span>
			)}
		</div>
	);
}

/** Remembers that today's Play page has been seen open, so the sticker is placed only the first time it opens. */
export function usePlacedToday(childId: string, status: PlayStatus | undefined) {
	const key = `jade.play.opened.${childId}`;
	const [place] = useState(() => {
		if (!status?.settings.practiceFirst || !status.open) return false;
		try {
			if (localStorage.getItem(key) === dayKey()) return false;
			localStorage.setItem(key, dayKey());
			return true;
		} catch {
			return false;
		}
	});
	return place;
}

/** Buy one block of play time with stars, and say plainly if it didn't work. */
function useBuyTime(childId: string) {
	const qc = useQueryClient();
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	async function buy() {
		setBusy(true);
		setProblem(null);
		try {
			qc.setQueryData(playQuery(childId).queryKey, await playApi.buyTime(childId));
		} catch (err) {
			setProblem(
				err instanceof ApiError && err.status === 409
					? "Not quite enough stars for that yet."
					: "Couldn’t get more time. Check the connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}
	return { buy, busy, problem };
}

/** While play time costs stars and some is left: top it up before it runs out. */
export function MoreTime({ childId, status }: { childId: string; status: PlayStatus }) {
	const online = useOnline();
	const { buy, busy, problem } = useBuyTime(childId);
	if (!status.settings.timeCosts || status.settings.free) return null;
	const afford = status.wallet.stars >= TIME_BLOCK.stars;
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<button type="button" className="key" disabled={busy || !online || !afford} onClick={() => void buy()}>
				<Clock className="size-5" aria-hidden /> {TIME_BLOCK.minutes} more minutes · {TIME_BLOCK.stars} stars
			</button>
			<p role="status" className="text-sm text-page-muted">
				{problem ??
					(!online
						? "Adding time needs the internet."
						: !afford
							? `Earn ${TIME_BLOCK.stars - status.wallet.stars} more stars to add time.`
							: "")}
			</p>
		</div>
	);
}

/**
 * Play while it's shut: the games are a printed slot on the page, saying what opens them. Practice first shows how far
 * today's practice has come; out of time offers more minutes for stars, or says how to earn them.
 */
export function PlayClosed({
	childId,
	status,
	size = "large",
	level = "h3",
}: {
	childId: string;
	status: PlayStatus;
	size?: "large" | "small";
	/** h2 directly under a page's h1 (the Play home); h3 under the hub's "What shall we play?". */
	level?: "h2" | "h3";
}) {
	const id = useId();
	const H = level;
	const online = useOnline();
	const { buy, busy, problem } = useBuyTime(childId);
	const { settings, today, wallet } = status;
	const progress = goalProgress(settings.goal, today);

	return (
		<section className={`slot content-center gap-3 text-center ${size === "large" ? "min-h-48 p-6 md:p-8" : "p-5"}`} aria-labelledby={id}>
			<Gamepad2 className="size-10 opacity-80" aria-hidden />
			{status.shut ? (
				<>
					<H id={id} className="font-display text-2xl font-semibold text-page-ink">
						Play opens after practice
					</H>
					<p className="text-page-muted">{goalLeft(settings.goal, today)}</p>
					{progress.unit === "star" && (
						<p className="font-display text-lg font-medium text-page-ink tabular-nums">
							{progress.have} of {progress.need} stars
							<span className="sr-only"> for {GOAL_LABEL[settings.goal].toLowerCase()}</span>
						</p>
					)}
				</>
			) : (
				<>
					<H id={id} className="font-display text-2xl font-semibold text-page-ink">
						Out of play time
					</H>
					{wallet.stars >= TIME_BLOCK.stars ? (
						<>
							<p className="text-balance text-page-muted">You have {wallet.stars} stars.</p>
							<button type="button" className="key" data-variant="go" disabled={busy || !online} onClick={() => void buy()}>
								<Clock className="size-5" aria-hidden /> {TIME_BLOCK.minutes} more minutes · {TIME_BLOCK.stars} stars
							</button>
							{!online && <p className="text-sm text-page-muted">Getting more time needs the internet.</p>}
						</>
					) : (
						<p className="text-page-muted">
							{TIME_BLOCK.minutes} more minutes cost {TIME_BLOCK.stars} stars. Earn {TIME_BLOCK.stars - wallet.stars} more in{" "}
							<Link to="/play/$childId/spelling" params={{ childId }} className="font-medium text-page-ink underline underline-offset-4">
								Spelling
							</Link>{" "}
							or{" "}
							<Link to="/play/$childId/math" params={{ childId }} className="font-medium text-page-ink underline underline-offset-4">
								Math
							</Link>
							.
						</p>
					)}
					{problem && (
						<p role="status" className="text-sm text-page-muted">
							{problem}
						</p>
					)}
				</>
			)}
		</section>
	);
}
