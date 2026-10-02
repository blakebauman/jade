import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	component: () => <Outlet />,
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
				<p className="text-page-muted">{error instanceof Error ? error.message : "Please try again."}</p>
				<button type="button" className="key" onClick={reset}>
					Try again
				</button>
			</div>
		</main>
	),
});
