/**
 * PBKDF2-SHA256 via WebCrypto for Better Auth. Better Auth's default scrypt runs in JS and blows the Workers CPU
 * budget; SubtleCrypto runs natively. 100k iterations is the Workers runtime maximum for PBKDF2.
 * Format: pbkdf2$<iterations>$<salt b64>$<hash b64>
 */
const ITERATIONS = 100_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
	const [scheme, iter, salt, expected] = hash.split("$");
	if (scheme !== "pbkdf2" || !iter || !salt || !expected) return false;
	const actual = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
	const want = unb64(expected);
	if (actual.length !== want.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ want[i]!;
	return diff === 0;
}
