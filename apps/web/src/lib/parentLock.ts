/**
 * Whether the parent area is unlocked on this tab. Entering the PIN unlocks it for the signed-in parent only. It locks
 * again when anyone leaves the parent area, when a parent signs out, and after the idle minutes the parent chose in
 * Settings, so a device handed back to a child is never left open. It lives in sessionStorage, so a reload keeps it and a
 * new tab asks again.
 */
const KEY = "jade.parent-unlocked";

type Unlock = { user: string; at: number };

function read(): Unlock | null {
	try {
		const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Unlock> | null;
		return v && typeof v.user === "string" && typeof v.at === "number" ? (v as Unlock) : null;
	} catch {
		return null;
	}
}

/** `idleMs`: idle time after which the PIN is asked for again. */
export function isParentUnlocked(user: string, idleMs: number, now = Date.now()) {
	const u = read();
	// A clock set backwards (at in the future) counts as expired too.
	return !!u && u.user === user && now >= u.at && now - u.at < idleMs;
}

/** Unlocks, or restarts the idle clock on an unlock that is still valid. */
export function unlockParent(user: string, now = Date.now()) {
	try {
		sessionStorage.setItem(KEY, JSON.stringify({ user, at: now } satisfies Unlock));
	} catch {}
}

export function lockParent() {
	try {
		sessionStorage.removeItem(KEY);
	} catch {}
}
