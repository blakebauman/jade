import { Tile } from "@jade/ui/components/tile";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Brand } from "#/components/Brand.tsx";
import { fitTile } from "#/components/round/AnswerRow.tsx";
import { SubjectArt } from "#/components/SubjectArt.tsx";
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
	const { size, gap } = fitTile(width, word.length, 40);
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

/** The home shelf as a kid sees it, lit on a game: real art from each game, one tile with words waiting. */
const DEMO: { name: string; art: React.ReactNode; count?: number }[] = [
	{ name: "Gobble Town", art: <img src="/tiles/gobble.webp" alt="" className="absolute inset-0 size-full object-cover" /> },
	{ name: "Spelling", art: <SubjectArt hue="spell" tiles={["r", "h", "y", "t", "h", "m"]} />, count: 6 },
	{ name: "Jelly Blocks", art: <img src="/tiles/jelly.webp" alt="" className="absolute inset-0 size-full object-cover" /> },
	{ name: "Math", art: <SubjectArt hue="math" tiles={["7", "×", "8"]} answer /> },
];

/** Ends on whole tiles: four across the column (three on a phone), each a quarter of it, the first one lit. */
function DemoShelf() {
	return (
		<ul className="grid grid-cols-3 gap-3 pt-12 sm:grid-cols-4 md:gap-4" aria-hidden>
			{DEMO.map((t, i) => (
				<li key={t.name} className={`shelf-slot [container-type:inline-size] ${i === 3 ? "max-sm:hidden" : ""}`}>
					<span className="shelf-name" data-lit={i === 0 || undefined}>
						{t.name}
					</span>
					<span className="shelf-tile" data-lit={i === 0 || undefined} style={{ "--tile": "100cqi" } as React.CSSProperties}>
						{t.art}
						{t.count && <span className="shelf-count">{t.count}</span>}
					</span>
				</li>
			))}
		</ul>
	);
}

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
		<main className="mx-auto grid min-h-dvh max-w-6xl grid-cols-[minmax(0,1fr)] content-center gap-12 px-safe-5 py-safe-10 md:grid-cols-[1.2fr_1fr] md:gap-16 md:px-safe-10">
			<section className="min-w-0 space-y-8">
				{/* On a phone the form sits below the fold, so a returning parent gets a way to it up here. */}
				<div className="flex items-center justify-between gap-4">
					<Brand size={36} />
					<button
						type="button"
						className="key md:hidden"
						onClick={() => {
							setMode("signin");
							document.getElementById("account")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						Sign in
					</button>
				</div>
				<h1 className="text-5xl leading-[1.05] font-semibold text-balance md:text-6xl">
					Every game your kid loves, plus spelling and math, on one shelf.
				</h1>
				<p className="max-w-[48ch] text-lg text-pretty text-page-muted">
					A games portal for 8–11 year olds with practice built in. Roxy, her town, Gobble Town, Jelly Blocks and Campfire Woods sit beside
					Spelling and Math, the one they played last first, and you decide how play and practice meet.
				</p>
				<DemoShelf />
			</section>

			<section id="account" className="patch min-w-0 scroll-mt-6 self-start p-6 md:p-8">
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
						The account belongs to a parent. Kids pick their own sticker to play. No child email or password.
					</p>
				</form>
			</section>

			<section aria-labelledby="inside" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 md:col-span-2 md:grid-cols-3">
				<h2 id="inside" className="sr-only">
					What’s on the shelf
				</h2>
				<div className="space-y-2">
					<h3 className="text-2xl font-semibold">The games</h3>
					<p className="text-pretty text-page-muted">
						Dress Roxy and explore her town, then Gobble Town, Jelly Blocks and Campfire Woods: a block island the family builds on
						together, with friends you link. Games pay their own tickets, so practice stars stay a record of practice.
					</p>
				</div>
				<div className="space-y-3">
					<h3 className="text-2xl font-semibold">Spelling</h3>
					<p className="text-pretty text-page-muted">
						This week’s school list, from a paste or a photo of the sheet, spoken aloud. She spells each word tile by tile, with feedback on
						every letter, and missed words come back until they stick.
					</p>
					<DemoRow />
					<p className="text-sm text-page-muted">
						One tile went coral: <span className="font-semibold text-page-ink">nece</span>
						<span className="font-semibold text-page-ink underline decoration-coral decoration-[3px] underline-offset-4">s</span>
						<span className="font-semibold text-page-ink">sary</span> has a single <span className="font-semibold text-page-ink">c</span>.
					</p>
				</div>
				<div className="space-y-2">
					<h3 className="text-2xl font-semibold">Math</h3>
					<p className="text-pretty text-page-muted">
						Times tables, mental math, fractions and word problems, read aloud. Levels adjust on their own, and every miss shows how to get
						the answer.
					</p>
				</div>
				<p className="max-w-[70ch] text-pretty text-page-muted md:col-span-3">
					You decide, for each child, how play and practice meet: games can be free or earn tickets, stars can pay in games, games can open
					after today’s practice, or play time can cost stars. Rounds work offline, on a laptop, an iPad or a phone.
				</p>
			</section>
		</main>
	);
}
