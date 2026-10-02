/**
 * Signing in as another family (admin plugin impersonation) and back. Switching accounts on this device mustn't carry
 * one family's data into the other: queued practice has to reach the server first, then the device forgets the
 * account (`jade.user`, `jade-data`) and the page reloads so no query cache survives.
 */
import { authClient } from "./auth.ts";
import { forgetDevice } from "./device.ts";
import { flushPending, pendingCount } from "./offline.ts";

async function switchAccount(change: () => Promise<{ error: { message?: string } | null }>): Promise<string | null> {
	await flushPending().catch(() => {});
	if ((await pendingCount()) > 0) return "This device has practice that hasn’t uploaded yet. Wait until it’s online and try again.";
	const res = await change().catch(() => null);
	if (!res) return "Couldn’t switch accounts. Check the connection and try again.";
	if (res.error) return res.error.message ?? "Couldn’t switch accounts.";
	await forgetDevice();
	window.location.assign("/profiles");
	return null;
}

export const impersonate = (userId: string) => switchAccount(() => authClient.admin.impersonateUser({ userId }));
export const stopImpersonating = () => switchAccount(() => authClient.admin.stopImpersonating());
