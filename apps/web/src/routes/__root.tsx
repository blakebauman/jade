import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { RouteAnnouncer } from "#/components/RouteAnnouncer.tsx";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	component: () => (
		<>
			<Outlet />
			<RouteAnnouncer />
		</>
	),
	notFoundComponent: () => (
		<main className="grid min-h-dvh place-items-center p-safe-6 text-center">
			<div className="space-y-5">
				<h1 className="text-4xl font-semibold">That square is empty</h1>
				<p className="text-page-muted">We couldn’t find that page.</p>
				<Link to="/" className="key">
					Back to the board
				</Link>
			</div>
		</main>
	),
	errorComponent: ({ error, reset }) => (
		<main className="grid min-h-dvh place-items-center p-safe-6 text-center">
			<div className="max-w-md space-y-5">
				<h1 className="text-4xl font-semibold">Something slipped off the board</h1>
				{/* A raw error (a validation dump, a stack) means nothing to a kid and can run off a phone's edge; keep it for the console. */}
				<p className="text-page-muted">Try again, or head back to the start.</p>
				<div className="flex flex-wrap justify-center gap-3">
					<button type="button" className="key" data-variant="go" onClick={reset}>
						Try again
					</button>
					<a href="/" className="key">
						Back to the start
					</a>
				</div>
				<ErrorLog error={error} />
			</div>
		</main>
	),
});

function ErrorLog({ error }: { error: unknown }) {
	useEffect(() => console.error(error), [error]);
	return null;
}
