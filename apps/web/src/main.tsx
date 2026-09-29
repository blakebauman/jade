import "@fontsource-variable/fredoka";
import "@fontsource-variable/lexend";
import "@fontsource/andika/400.css";
import "@fontsource/andika/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./styles.css";

import { registerSW } from "virtual:pwa-register";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Pending } from "./components/Pending.tsx";
import { flushPending } from "./lib/offline.ts";
import { routeTree } from "./routeTree.gen.ts";

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",
	defaultPendingComponent: Pending,
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

registerSW({ immediate: true });
// Rounds finished offline sync as soon as the device is back online.
window.addEventListener("online", () => void flushPending());
void flushPending();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
