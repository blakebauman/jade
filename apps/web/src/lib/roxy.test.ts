import { type Look, starterHome, starterLook, wear } from "@jade/core/roxy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushFinds, pendingFinds, recordFind, type Studio, useHomeDraft, useRoxyDraft } from "./roxy.ts";

const CHILD = "kid-1";
const starter = starterLook(CHILD);
const studio = (over: Partial<Studio> = {}): Studio => ({
	current: starter,
	wornLookId: null,
	looks: [],
	unlocked: [],
	balance: 0,
	holidays: [],
	holidaysOff: [],
	home: starterHome(),
	finds: [],
	...over,
});

let online = true;
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
/** Answers each request with the first matching route; records what was sent. */
function serve(routes: [method: string, path: RegExp, reply: () => Response][]) {
	const sent: { method: string; url: string; body: unknown }[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		sent.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
		const route = routes.find(([m, p]) => m === method && p.test(url));
		if (!route) throw new TypeError("Failed to fetch");
		return route[2]();
	});
	return sent;
}

function wrapper() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}
const goOnline = () => act(() => void window.dispatchEvent(new Event("online")));

// Node's own localStorage stub shadows jsdom's here (as in theme.test.ts), so a plain in-memory store stands in.
beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	});
	online = true;
	Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("look autosave", () => {
	const spooky = wear(starter, "hat", { item: "hat-witch" });

	it("shows the look the server kept, not the one it sent", async () => {
		localStorage.setItem(`jade.roxy.${CHILD}`, JSON.stringify({ look: spooky, wornLookId: null, dirty: true }));
		serve([["PUT", /\/roxy\/current$/, () => json({ ok: true, look: starter, wornLookId: null })]]);
		const { result } = renderHook(() => useRoxyDraft(CHILD, studio()), { wrapper: wrapper() });
		expect(result.current.look).toEqual(spooky);
		goOnline();
		await waitFor(() => expect(result.current.look).toEqual(starter));
		expect(JSON.parse(localStorage.getItem(`jade.roxy.${CHILD}`)!)).toMatchObject({ look: starter, dirty: false });
	});

	it("gives up on a look the server refuses and takes the server's copy, instead of retrying forever", async () => {
		localStorage.setItem(`jade.roxy.${CHILD}`, JSON.stringify({ look: spooky, wornLookId: null, dirty: true }));
		const sent = serve([
			["PUT", /\/roxy\/current$/, () => json({ error: "Some of those are still locked" }, 403)],
			["GET", /\/roxy\?/, () => json(studio())],
		]);
		const { result } = renderHook(() => useRoxyDraft(CHILD, studio({ current: spooky })), { wrapper: wrapper() });
		goOnline();
		await waitFor(() => expect(result.current.look).toEqual(starter));
		expect(JSON.parse(localStorage.getItem(`jade.roxy.${CHILD}`)!)).toMatchObject({ dirty: false });
		// Nothing left to send.
		const puts = sent.filter((r) => r.method === "PUT").length;
		goOnline();
		await new Promise((r) => setTimeout(r, 0));
		expect(sent.filter((r) => r.method === "PUT")).toHaveLength(puts);
	});

	it("keeps the look on the device when the connection drops", async () => {
		localStorage.setItem(`jade.roxy.${CHILD}`, JSON.stringify({ look: spooky, wornLookId: null, dirty: true }));
		serve([]);
		const { result } = renderHook(() => useRoxyDraft(CHILD, studio()), { wrapper: wrapper() });
		goOnline();
		await new Promise((r) => setTimeout(r, 0));
		expect(result.current.look).toEqual(spooky);
		expect(JSON.parse(localStorage.getItem(`jade.roxy.${CHILD}`)!)).toMatchObject({ dirty: true });
	});

	it("applies a change to the latest look, so one made meanwhile isn't lost", () => {
		serve([]);
		online = false;
		const { result } = renderHook(() => useRoxyDraft(CHILD, studio()), { wrapper: wrapper() });
		const tryOnLater = (look: Look) => wear(look, "glasses", { item: "glasses-round" });
		act(() => {
			result.current.set(wear(starter, "hat", { item: "hat-cap" }));
			result.current.set(tryOnLater);
		});
		expect(result.current.look.slots.hat?.item).toBe("hat-cap");
		expect(result.current.look.slots.glasses?.item).toBe("glasses-round");
	});
});

describe("home autosave", () => {
	it("takes the server's copy when it refuses the room", async () => {
		const pumpkins = { ...starterHome(), items: [...starterHome().items, { uid: "h", item: "pumpkins", x: 5, z: 7, rot: 0 }] };
		localStorage.setItem(`jade.roxyhome.${CHILD}`, JSON.stringify({ home: pumpkins, dirty: true }));
		serve([
			["PUT", /\/roxy\/home$/, () => json({ error: "Some of those are still locked" }, 403)],
			["GET", /\/roxy\?/, () => json(studio())],
		]);
		const { result } = renderHook(() => useHomeDraft(CHILD, starterHome()), { wrapper: wrapper() });
		expect(result.current.saving).toBe(true);
		goOnline();
		await waitFor(() => expect(result.current.saving).toBe(false));
		expect(result.current.home).toEqual(starterHome());
	});
});

describe("finds", () => {
	it("keeps a find made offline and sends it when the device is back online", async () => {
		online = false;
		const sent = serve([["POST", /\/roxy\/find$/, () => json({ ok: true })]]);
		expect(await recordFind(CHILD, "park-acorn")).toBe(false);
		expect(pendingFinds(CHILD)).toEqual(["park-acorn"]);
		online = true;
		expect(await flushFinds(CHILD)).toBe(true);
		expect(pendingFinds(CHILD)).toEqual([]);
		expect(sent.map((r) => r.body)).toEqual([{ findId: "park-acorn" }]);
	});

	it("keeps a find through a dropped connection, and drops one the server refuses", async () => {
		serve([["POST", /\/roxy\/find$/, () => json({ error: "Nothing like that here" }, 404)]]);
		localStorage.setItem(`jade.roxyfinds.${CHILD}`, JSON.stringify(["moon-rock"]));
		await flushFinds(CHILD);
		expect(pendingFinds(CHILD)).toEqual([]);

		vi.restoreAllMocks();
		serve([]);
		await recordFind(CHILD, "park-acorn");
		expect(pendingFinds(CHILD)).toEqual(["park-acorn"]);
	});
});
