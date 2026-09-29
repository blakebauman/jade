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
		cloudflare(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.svg", "apple-touch-icon.png"],
			manifest: {
				name: "Jade Learning",
				short_name: "Jade",
				description: "Spelling bee practice: hear it, spell it, master it.",
				theme_color: "#0e4f43",
				background_color: "#0e4f43",
				display: "standalone",
				orientation: "any",
				start_url: "/",
				icons: [
					{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
					{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
				],
			},
			workbox: {
				navigateFallback: "/index.html",
				navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
				globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
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
				],
			},
		}),
	],
});
