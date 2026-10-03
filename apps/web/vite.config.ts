import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	server: { port: 5190, strictPort: true },
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		// JADE_LOCAL_ONLY=1 (CI e2e) turns off remote bindings, so the dev server starts without Cloudflare credentials.
		// Workers AI then isn't reachable; e2e stubs speech and word info in the browser, and the client falls back.
		cloudflare({ remoteBindings: process.env.JADE_LOCAL_ONLY !== "1" }),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.svg", "apple-touch-icon.png"],
			manifest: {
				name: "Jade's World",
				short_name: "Jade's World",
				description: "Spelling bee and math practice for 8–11 year olds, with stars to spend in Roxy’s dress-up studio.",
				theme_color: "#0e4f43",
				background_color: "#0e4f43",
				display: "standalone",
				orientation: "any",
				id: "/",
				start_url: "/",
				icons: [
					{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
					{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
				],
			},
			workbox: {
				navigateFallback: "/index.html",
				navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
				globPatterns: ["**/*.{js,css,html,svg,png,woff2,glb}"],
				// Latin type only: the other scripts' subsets load on demand (unicode-range) and would only weigh down the
				// install on a phone. Splash screens are fetched by iOS itself when the app is added, never by the app.
				globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,hebrew}-*.woff2", "splash/**"],
				runtimeCaching: [
					{
						// Spoken words never change for a given text+voice; once heard, a round replays offline.
						urlPattern: ({ url }) => url.pathname === "/api/tts",
						handler: "CacheFirst",
						options: {
							cacheName: "jade-tts",
							expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 180 },
							cacheableResponse: { statuses: [200] },
						},
					},
					{
						// The family's data, last copy kept so the app opens and rounds start offline (progress feeds levels
						// and review; /api/parent keeps the PIN gate up). Cleared on sign-out: keep the name in step with DATA_CACHE
						// in src/lib/device.ts.
						urlPattern: ({ url, request }) =>
							request.method === "GET" &&
							(url.pathname.startsWith("/api/words/") ||
								/^\/api\/lists(\/|$)/.test(url.pathname) ||
								/^\/api\/children(\/[^/]+\/progress)?$/.test(url.pathname) ||
								url.pathname === "/api/parent"),
						handler: "NetworkFirst",
						options: { cacheName: "jade-data", networkTimeoutSeconds: 4, cacheableResponse: { statuses: [200] } },
					},
					{
						// Roxy's studio and the kid's Play status. Their `?day=` changes daily, so offline they match whatever day was
						// last loaded.
						urlPattern: ({ url, request }) => request.method === "GET" && /^\/api\/children\/[^/]+\/(roxy|play)$/.test(url.pathname),
						handler: "NetworkFirst",
						options: {
							cacheName: "jade-data",
							networkTimeoutSeconds: 4,
							cacheableResponse: { statuses: [200] },
							matchOptions: { ignoreSearch: true },
						},
					},
				],
			},
		}),
	],
});
