import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { dismissInstall, shouldHintInstall } from "#/lib/install.ts";

/**
 * For the parent, on an iPhone or iPad in Safari: how to put Jade's World on the Home Screen, where it opens full
 * screen (iPhone has no other way to hide Safari's bars) and works offline. iOS never offers this on its own.
 * Shown a moment after the page settles, so it never flashes in on first paint, and gone for good once waved away.
 */
export function InstallHint() {
	const [show, setShow] = useState(false);
	useEffect(() => {
		if (!shouldHintInstall()) return;
		const t = setTimeout(() => setShow(true), 1500);
		return () => clearTimeout(t);
	}, []);
	if (!show) return null;
	return (
		<aside className="patch mb-6 flex items-start gap-3 p-4" aria-label="Add to Home Screen">
			<Share className="mt-0.5 size-5 flex-none" aria-hidden />
			<p className="min-w-0 flex-1 text-sm">
				<span className="font-semibold">Put Jade’s World on the Home Screen.</span> In Safari, tap Share, then{" "}
				<span className="font-semibold">Add to Home Screen</span>. It opens full screen, like an app, and keeps working without Wi-Fi.
			</p>
			<button
				type="button"
				className="key size-11 flex-none !p-0"
				data-variant="felt"
				aria-label="Not now"
				onClick={() => {
					dismissInstall();
					setShow(false);
				}}
			>
				<X className="size-5" aria-hidden />
			</button>
		</aside>
	);
}
