/**
 * What this device remembers about the signed-in family so the app can open with no connection: the last confirmed
 * user (here) and the API responses the service worker keeps in the `jade-data` cache (see vite.config.ts).
 * Signing out forgets both.
 */
const USER_KEY = "jade.user";
/** Must match the `cacheName` of the data rule in vite.config.ts. */
export const DATA_CACHE = "jade-data";

/** In-memory copy; `undefined` until first read from storage. */
let memo: unknown;

export function rememberUser(user: unknown) {
	memo = user;
	try {
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	} catch {}
}

export function rememberedUser<T>(): T | null {
	if (memo === undefined) {
		try {
			const v = localStorage.getItem(USER_KEY);
			memo = v ? JSON.parse(v) : null;
		} catch {
			memo = null;
		}
	}
	return memo as T | null;
}

export async function forgetDevice() {
	memo = null;
	try {
		localStorage.removeItem(USER_KEY);
	} catch {}
	try {
		await caches.delete(DATA_CACHE);
	} catch {}
}
