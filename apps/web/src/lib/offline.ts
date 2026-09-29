import type { AttemptInput, Mode } from "@jade/core";
import Dexie, { type EntityTable } from "dexie";
import { ApiError, api, type BadgeView, type RoundSummary } from "./api.ts";

export type SessionStart = {
	id: string;
	childId: string;
	listId: string | null;
	mode: Mode;
	subject?: "spelling" | "math";
	startedAt: number;
};
export type SessionFinish = { attempts: AttemptInput[]; finishedAt: number; day: string };
export type AttemptsResult = { recorded: number; streak: number; newBadges: BadgeView[] };

/**
 * One server write for a round, kept on the device until it lands. Rounds are saved as they're played:
 * `start` when the first word is spoken, `attempts` after every word, `finish` at the end (or when the
 * speller stops early). Every endpoint is idempotent, so ops replay safely after a dropped connection.
 */
type Op =
	| { id: string; seq: number; kind: "start"; sessionId: string; body: SessionStart }
	| { id: string; seq: number; kind: "attempts"; sessionId: string; body: { attempts: AttemptInput[]; at: number; day: string } }
	| { id: string; seq: number; kind: "finish"; sessionId: string; body: SessionFinish };
type OpInput = Op extends infer O ? (O extends Op ? Omit<O, "id" | "seq"> : never) : never;

/** Rounds finished before incremental saving: start + finish travelling together. Drained into `ops`. */
type LegacyPending = { id: string; start: SessionStart; finish: SessionFinish; createdAt: number };

const db = new Dexie("jade") as Dexie & { pending: EntityTable<LegacyPending, "id">; ops: EntityTable<Op, "id"> };
db.version(1).stores({ pending: "id, createdAt" });
db.version(2)
	.stores({ pending: "id, createdAt", ops: "id, seq" })
	.upgrade(async (tx) => {
		let seq = 0;
		for (const p of (await tx.table("pending").toArray()) as LegacyPending[]) {
			await tx.table("ops").bulkPut([
				{ id: `${p.id}:start`, seq: seq++, kind: "start", sessionId: p.id, body: p.start },
				{ id: `${p.id}:finish`, seq: seq++, kind: "finish", sessionId: p.id, body: p.finish },
			]);
		}
		await tx.table("pending").clear();
	});

function send(op: Op): Promise<unknown> {
	switch (op.kind) {
		case "start":
			return api("/api/sessions", { method: "POST", json: op.body });
		case "attempts":
			return api(`/api/sessions/${op.sessionId}/attempts`, { method: "POST", json: op.body });
		case "finish":
			return api(`/api/sessions/${op.sessionId}/finish`, { method: "POST", json: op.body });
	}
}

/** 4xx means the server understood and refused (e.g. child deleted); retrying won't help, so drop it. */
const permanent = (err: unknown) => err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429;

const results = new Map<string, unknown>();
let running: Promise<void> | null = null;

/** Send queued ops in order. Stops at the first network failure so order is kept for the next try. */
export function flushPending(): Promise<void> {
	if (running) return running.then(() => flushPending());
	running = (async () => {
		try {
			for (const op of await db.ops.orderBy("seq").toArray()) {
				if (!navigator.onLine) return;
				try {
					results.set(op.id, await send(op));
					await db.ops.delete(op.id);
				} catch (err) {
					if (!permanent(err)) return;
					await db.ops.delete(op.id);
				}
			}
		} finally {
			running = null;
		}
	})();
	return running;
}

let counter = 0;
/** Queue a write and try to send it now. Resolves with the server's reply, or null if it's waiting for the network. */
async function submit<T>(input: OpInput): Promise<T | null> {
	const id = `${input.sessionId}:${input.kind}:${Date.now()}:${counter++}`;
	// seq orders ops across page reloads; the counter breaks ties within one millisecond.
	await db.ops.put({ ...input, id, seq: Date.now() * 1000 + (counter % 1000) } as Op);
	await flushPending().catch(() => {});
	const out = results.get(id);
	results.delete(id);
	return (out as T | undefined) ?? null;
}

export const startSession = (start: SessionStart) => submit({ kind: "start", sessionId: start.id, body: start });

export const saveAttempts = (sessionId: string, attempts: AttemptInput[], day: string) =>
	submit<AttemptsResult>({ kind: "attempts", sessionId, body: { attempts, at: Date.now(), day } });

export const finishSession = (sessionId: string, finish: SessionFinish) =>
	submit<RoundSummary>({ kind: "finish", sessionId, body: finish });

export const pendingCount = () => db.ops.count();
