import { Tile } from "@jade/ui/components/tile";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
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
		<main className="mx-auto grid min-h-dvh max-w-6xl content-center gap-12 px-5 py-10 md:grid-cols-[1.2fr_1fr] md:gap-16 md:px-10">
			<section className="min-w-0 space-y-8">
				<Brand size={40} />
				<h1 className="text-5xl leading-[1.05] font-semibold md:text-6xl">
					Hear it. Spell it.
					<br />
					Solve it.
				</h1>
				<p className="max-w-[46ch] text-lg text-pretty text-felt-muted">
					Spelling and math practice for 8–11 year olds. Load this week’s school list, and your child hears each word, asks for the
					definition or a sentence, and places the letters tile by tile, with feedback on every letter. Math covers times tables, mental
					math, fractions and word problems, with levels that adjust as they go.
				</p>
				<DemoRow />
				<p className="text-sm text-felt-muted">
					One tile went coral: <span className="font-semibold text-felt-ink">nece</span>
					<span className="font-semibold text-felt-ink underline decoration-coral decoration-[3px] underline-offset-4">s</span>
					<span className="font-semibold text-felt-ink">sary</span> has a single <span className="font-semibold text-felt-ink">c</span>.
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
						<p role="alert" className="rounded-lg bg-felt-deep px-3 py-2 text-sm text-felt-ink">
							{error}
						</p>
					)}
					<button type="submit" className="key w-full" data-variant="go" disabled={busy}>
						{busy ? "One moment…" : mode === "signup" ? "Create family account" : "Sign in"}
					</button>
					<p className="text-xs text-felt-muted">
						The account belongs to a parent. Kids pick their own tile to practice. No child email or password.
					</p>
				</form>
			</section>
		</main>
	);
}
