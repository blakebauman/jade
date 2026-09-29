import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { api } from "../src/index.ts";

export type AiCall = { model: string; input: unknown };

/** A stand-in for the Workers AI binding: records calls and answers per model. */
export function fakeAi(answers: Record<string, (input: unknown) => unknown> = {}) {
	const calls: AiCall[] = [];
	const ai = {
		run: async (model: string, input: unknown) => {
			calls.push({ model, input });
			const answer = answers[model];
			if (!answer) throw new Error(`unexpected model ${model}`);
			return answer(input);
		},
	};
	return { ai: ai as unknown as Ai, calls };
}

export function mp3Stream(bytes = [0xff, 0xfb, 0x90, 0x44]) {
	return new ReadableStream({
		start(c) {
			c.enqueue(new Uint8Array(bytes));
			c.close();
		},
	});
}

export async function call(path: string, init: RequestInit & { json?: unknown; cookie?: string } = {}, ai = fakeAi().ai) {
	const headers = new Headers(init.headers);
	headers.set("Origin", "http://localhost:5190");
	if (init.cookie) headers.set("Cookie", init.cookie);
	let body = init.body;
	if (init.json !== undefined) {
		headers.set("Content-Type", "application/json");
		body = JSON.stringify(init.json);
	}
	const ctx = createExecutionContext();
	const res = await api.request(`http://localhost:5190${path}`, { ...init, headers, body }, { ...env, AI: ai }, ctx);
	await waitOnExecutionContext(ctx);
	return res;
}

let n = 0;
/** Sign up a fresh parent and return their session cookie. */
export async function signUp(): Promise<string> {
	n++;
	const res = await call("/api/auth/sign-up/email", {
		method: "POST",
		json: { email: `parent${n}-${crypto.randomUUID().slice(0, 6)}@example.com`, password: "correct-horse-battery", name: `Parent ${n}` },
	});
	if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
	const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
	return cookies.join("; ");
}
