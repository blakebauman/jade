import { Star, Ticket } from "lucide-react";
import { Confirm } from "#/components/Confirm.tsx";
import type { Pay, Wallet } from "#/lib/roxy.ts";
import { Tickets } from "./PlayBits.tsx";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Buying something in a game: with tickets, or with stars too while a parent lets stars be spent in games. Whatever
 * the kid can afford is offered after "Not now"; if neither covers it, it says how to earn the rest, in games first.
 */
export function BuyChoice({
	name,
	cost,
	wallet,
	online,
	busy,
	onBuy,
	onCancel,
	className = "",
}: {
	/** As it reads in a sentence: "Crown", "the piano". */
	name: string;
	cost: number;
	wallet: Wallet;
	online: boolean;
	busy: boolean;
	onBuy: (pay: Pay) => void;
	onCancel: () => void;
	className?: string;
}) {
	const tickets = wallet.tickets >= cost;
	const stars = wallet.stars !== null && wallet.stars >= cost;
	if (!online || (!tickets && !stars))
		return (
			<p role="status" className={`patch flex flex-wrap items-center justify-between gap-3 p-4 ${className}`}>
				<span>
					{!online ? (
						<>Unlocking {name} needs the internet. You can still use everything you own.</>
					) : (
						<>
							<span className="font-display text-lg font-semibold">{name[0]!.toUpperCase() + name.slice(1)}</span> costs{" "}
							{plural(cost, "ticket", "tickets")}. Earn {cost - wallet.tickets} more in Town or Gobble Town
							{wallet.stars !== null && <>, or use stars from Spelling and Math once you have {cost}</>}.
						</>
					)}
				</span>
				<button type="button" className="key" onClick={onCancel}>
					OK
				</button>
			</p>
		);
	return (
		<Confirm
			className={className}
			message={`Unlock ${name}?`}
			note={`It’s yours to keep. You have ${plural(wallet.tickets, "ticket", "tickets")}${wallet.stars !== null ? ` and ${plural(wallet.stars, "star", "stars")}` : ""}.`}
			cancelLabel="Not now"
			busy={busy}
			onCancel={onCancel}
			choices={[
				...(tickets
					? [
							{
								key: "tickets",
								onChoose: () => onBuy("tickets"),
								label: (
									<>
										<Ticket className="size-5" aria-hidden /> {plural(cost, "ticket", "tickets")}
									</>
								),
							},
						]
					: []),
				...(stars
					? [
							{
								key: "stars",
								onChoose: () => onBuy("stars"),
								label: (
									<>
										<Star className="size-5" aria-hidden /> {plural(cost, "star", "stars")}
									</>
								),
							},
						]
					: []),
			]}
		/>
	);
}

/** What there is to spend, in a game screen's top-right corner. Nothing while games are free. */
export function CornerWallet({ wallet }: { wallet: Wallet }) {
	if (wallet.free) return null;
	return (
		<>
			<Tickets count={wallet.tickets} tall />
			{wallet.stars !== null && (
				// On a phone the corner holds play time and tickets only; stars show when buying.
				<p className="foil px-4 max-md:!hidden" style={{ minHeight: "3rem" }} title="Stars to spend">
					<Star className="size-5 fill-current" aria-hidden />
					<span className="font-display text-xl font-semibold tabular-nums">{wallet.stars}</span>
					<span className="sr-only">stars to spend</span>
				</p>
			)}
		</>
	);
}
