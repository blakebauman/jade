import { Tile } from "@jade/ui/components/tile";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BookOpenText, Calculator, type LucideIcon, Tent } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Brand } from "#/components/Brand.tsx";
import { fitTile } from "#/components/round/AnswerRow.tsx";
import { authClient, signIn, signUp } from "#/lib/auth.ts";
import { rememberedUser } from "#/lib/device.ts";
import { useElementWidth } from "#/lib/hooks.ts";
import { flushPending } from "#/lib/offline.ts";

export const Route = createFileRoute("/")({
	validateSearch: z.object({ next: z.string().optional() }),
	beforeLoad: async ({ search }) => {
		const to = search.next ?? "/profiles";
		// The installed app opens here; with no connection, a family already signed in on this device goes straight in.
		if (!navigator.onLine && rememberedUser()) throw redirect({ to });
		let data: unknown;
		try {
			({ data } = await authClient.getSession());
		} catch (err) {
			if (rememberedUser()) throw redirect({ to });
			throw err;
		}
		if (data) throw redirect({ to });
	},
	component: Landing,
});

/** A demo row that spells itself: shows the mechanism before any words are read. */
function DemoRow() {
	const word = "necessary";
	const laws = ["right", "right", "wrong", "right", "right", "right", "right", "right", "right"] as const;
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const { size, gap } = fitTile(width, word.length, 50);
	return (
		<div ref={ref} className="flex w-full max-w-[34rem]" style={{ gap }} aria-hidden>
			{[...word].map((c, i) => (
				<Tile
					key={`${c}-${i}`}
					letter={i === 2 ? "s" : c}
					law={laws[i]}
					size={size}
					grain={i % 4}
					className="animate-tile-drop"
					style={{ animationDelay: `${i * 70}ms` }}
				/>
			))}
		</div>
	);
}

/** The three places a kid finds behind their tile, in the hub's order. */
const PLACES: { hue: "spell" | "roxy" | "math"; name: string; icon: LucideIcon; tilt: string; text: string }[] = [
	{
		hue: "spell",
		name: "Spelling",
		icon: BookOpenText,
		tilt: "-1.5deg",
		text: "This week’s words, spoken aloud. Ask for the definition, a sentence or the origin, the way you can at a bee. Missed words come back until they stick.",
	},
	{
		hue: "roxy",
		name: "Play",
		icon: Tent,
		tilt: "1deg",
		text: "Dress Roxy and explore her town, then Gobble Town, Jelly Blocks and Campfire Woods: a block island the family builds on together, with friends you link.",
	},
	{
		hue: "math",
		name: "Math",
		icon: Calculator,
		tilt: "-0.75deg",
		text: "Times tables, mental math, fractions and word problems, read aloud. Levels adjust on their own, and every miss shows how to get the answer.",
	},
];

function Landing() {
	const { next } = Route.useSearch();
	const navigate = useNavigate();
	const [mode, setMode] = useState<"signin" | "signup">("signup");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		const email = String(f.get("email"));
		const password = String(f.get("password"));
		setBusy(true);
		setError(null);
		const res =
			mode === "signup"
				? await signUp.email({ email, password, name: String(f.get("name") || "Parent") })
				: await signIn.email({ email, password });
		setBusy(false);
		if (res.error) return setError(res.error.message ?? "That didn’t work. Check your email and password.");
		// Practice queued while the session had lapsed can upload now.
		void flushPending();
		navigate({ to: next ?? (mode === "signup" ? "/parent" : "/profiles") });
	}

	return (
		<main className="mx-auto grid min-h-dvh max-w-6xl content-center gap-12 px-safe-5 py-safe-10 md:grid-cols-[1.2fr_1fr] md:gap-16 md:px-safe-10">
			<section className="min-w-0 space-y-8">
				<Brand size={36} />
				<h1 className="text-5xl leading-[1.05] font-semibold md:text-6xl">
					Hear it. Spell it.
					<br />
					Solve it. Play.
				</h1>
				<p className="max-w-[46ch] text-lg text-pretty text-page-muted">
					Spelling and math practice for 8–11 year olds, and a world to play in. Load this week’s school list from a paste or a photo of the
					sheet, and your child spells each word tile by tile, with feedback on every letter.
				</p>
				<DemoRow />
				<p className="text-sm text-page-muted">
					One tile went coral: <span className="font-semibold text-page-ink">nece</span>
					<span className="font-semibold text-page-ink underline decoration-coral decoration-[3px] underline-offset-4">s</span>
					<span className="font-semibold text-page-ink">sary</span> has a single <span className="font-semibold text-page-ink">c</span>.
				</p>
			</section>

			<section className="patch min-w-0 p-6 md:p-8">
				<fieldset className="mx-0 mb-6 flex gap-2 border-0 p-0">
					<legend className="sr-only">Account</legend>
					{(["signup", "signin"] as const).map((m) => (
						<button
							key={m}
							type="button"
							aria-pressed={mode === m}
							className="key flex-1"
							data-pressed={mode === m}
							onClick={() => setMode(m)}
						>
							{m === "signup" ? "New family" : "Sign in"}
						</button>
					))}
				</fieldset>
				<form className="space-y-4" onSubmit={onSubmit}>
					{mode === "signup" && (
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">Your name</span>
							<input name="name" className="field" autoComplete="name" placeholder="Parent or guardian" />
						</label>
					)}
					<label className="block space-y-1.5">
						<span className="text-sm font-medium">Email</span>
						<input name="email" type="email" required className="field" autoComplete="email" />
					</label>
					<label className="block space-y-1.5">
						<span className="text-sm font-medium">Password</span>
						<input
							name="password"
							type="password"
							required
							minLength={8}
							className="field"
							autoComplete={mode === "signup" ? "new-password" : "current-password"}
						/>
					</label>
					{error && (
						<p role="alert" className="rounded-lg bg-page-deep px-3 py-2 text-sm text-page-ink">
							{error}
						</p>
					)}
					<button type="submit" className="key w-full" data-variant="go" disabled={busy}>
						{busy ? "One moment…" : mode === "signup" ? "Create family account" : "Sign in"}
					</button>
					<p className="text-xs text-page-muted">
						The account belongs to a parent. Kids pick their own tile to practice. No child email or password.
					</p>
				</form>
			</section>

			<section aria-labelledby="places" className="min-w-0 space-y-6 md:col-span-2">
				<h2 id="places" className="sr-only">
					What’s inside
				</h2>
				<ul className="grid gap-6 md:grid-cols-3">
					{PLACES.map(({ hue, name, icon: Icon, tilt, text }) => (
						<li key={hue} data-place={hue} className="sticker space-y-2 p-5" style={{ "--tilt": tilt } as React.CSSProperties}>
							<h3 className="flex items-center gap-2 text-2xl font-semibold">
								<Icon aria-hidden className="size-6" />
								{name}
							</h3>
							<p className="text-pretty text-page-muted">{text}</p>
						</li>
					))}
				</ul>
				<p className="max-w-[70ch] text-pretty text-page-muted">
					Games pay their own tickets, so practice stars stay a record of practice. You decide, for each child, how the two meet: stars can
					pay in games, games can open after today’s practice, or play time can cost stars. Rounds work offline, on a laptop, an iPad or a
					phone.
				</p>
			</section>
		</main>
	);
}
