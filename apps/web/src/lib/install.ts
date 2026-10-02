/** Running as the installed app (Home Screen), not in a browser tab. */
export function isStandalone() {
	if (typeof window === "undefined") return false;
	if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
	return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone or iPad. iPadOS 13+ says it's a Mac; touch points give it away. */
export function isIos(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
	return /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
}

const DISMISSED = "jade.install-dismissed";

export function installDismissed() {
	try {
		return localStorage.getItem(DISMISSED) === "1";
	} catch {
		return false;
	}
}

export function dismissInstall() {
	try {
		localStorage.setItem(DISMISSED, "1");
	} catch {
		// Private browsing: it'll ask again next visit, which is fine.
	}
}

/** Safari on iPhone or iPad, not yet on the Home Screen, and not waved away. iOS has no install prompt of its own. */
export const shouldHintInstall = () => isIos() && !isStandalone() && !installDismissed();
