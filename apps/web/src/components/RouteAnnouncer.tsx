import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const APP = "Jade's World";

const text = (el: Element) => el.textContent?.replace(/\s+/g, " ").trim() ?? "";

/**
 * The page's own h1 (a round's is screen-reader only), once it has rendered; pages that load their data draw it a moment
 * later. Words inside it that only a screen reader hears (a game title's "Games:" eyebrow) stay out of the tab title.
 */
function heading() {
	const h = document.querySelector("main h1") ?? document.querySelector("h1");
	if (!h) return "";
	const seen = h.cloneNode(true) as Element;
	for (const el of seen.querySelectorAll(".sr-only")) el.remove();
	return text(seen) || text(h);
}

/**
 * Names every page. The tab's title follows the page's h1, and after a navigation a polite live region says it, so a
 * screen reader hears that the page changed. Focus is left where it was: the shelf's arrows and Enter, and a round's
 * typing, must keep working without a tab back.
 */
export function RouteAnnouncer() {
	const router = useRouter();
	const [said, setSaid] = useState("");
	useEffect(() => {
		let path = "";
		let timer = 0;
		const update = () => {
			const next = router.state.location.pathname;
			// A search change (a tab, a filter) is the same page.
			if (next === path) return;
			const first = !path;
			path = next;
			let tries = 0;
			clearTimeout(timer);
			const look = () => {
				const name = heading();
				if (!name && ++tries < 15) {
					timer = window.setTimeout(look, 100);
					return;
				}
				document.title = name ? `${name} · ${APP}` : APP;
				if (!first) setSaid(name || APP);
			};
			timer = window.setTimeout(look, 50);
		};
		update();
		const off = router.subscribe("onResolved", update);
		return () => {
			off();
			clearTimeout(timer);
		};
	}, [router]);
	return (
		<p className="sr-only" aria-live="polite" aria-atomic="true">
			{said}
		</p>
	);
}
