import {
	type Animal,
	B,
	type ClientMsg,
	type Clock,
	cellOf,
	type Emote,
	type Figure,
	generate,
	type Inventory,
	type Lost,
	NO_STATS,
	packEdit,
	type ServerMsg,
	unpackEdit,
	type Volume,
	type WoodsStats,
} from "@jade/core/woods";

/**
 * The island as this screen knows it: a copy of the volume (for walking and aiming), everyone else's figures, the
 * fire and clock, tonight's lost animals, and this kid's inventory. It's fed by the socket, and it's what the scene
 * reads every frame and the HUD reads a few times a second. Mutable on purpose: the frame loop never re-renders React.
 */

export type Other = Figure & {
	/** Where the figure is drawn, eased toward `p` (moves arrive ten times a second). */
	shown: [number, number, number];
	emote: { e: Emote; until: number } | null;
};
export type LostNow = Lost & { follows: number | null };

export type Status = "connecting" | "open" | "reconnecting" | "kicked" | "offline";

export type WorldEvent =
	| { t: "ready" }
	| { t: "join"; label: string }
	| { t: "leave"; label: string }
	| { t: "night"; night: number }
	| { t: "dawn"; night: number; kept: boolean }
	| { t: "home"; animal: Animal; mine: boolean; at: [number, number, number] }
	| { t: "fed"; added: number }
	| { t: "snuffed"; at: [number, number, number] }
	| { t: "follow"; animal: Animal }
	| { t: "goal"; key: string; tickets: number; label: string }
	| { t: "refused"; why: Extract<ServerMsg, { t: "refused" }>["why"] }
	| { t: "kicked"; why: Extract<ServerMsg, { t: "kicked" }>["why"] }
	| { t: "status"; status: Status };

export class IslandState {
	seed = 0;
	/** How the island was made from its seed (older islands: 1). */
	gen = 1;
	volume: Volume | null = null;
	fire: [number, number, number] = [48, 20, 48];
	seat = -1;
	island = { label: "", mine: true, build: true };
	others = new Map<number, Other>();
	lost: LostNow[] = [];
	home: Animal[] = [];
	clock: Clock = { elapsed: 0, fuel: 0, nights: 0 };
	/** When `clock` arrived (performance.now), so the screen can run the clock smoothly between ticks. */
	clockAt = 0;
	inv: Inventory = {};
	stats: WoodsStats = { ...NO_STATS };
	status: Status = "connecting";
	/** Every torch cell on the island, kept as edits arrive (the scene lights the nearest few). */
	torches = new Set<number>();
	/** Dev and test only: seconds added to the island's clock on this screen, to see another time of day. */
	shift = 0;
	/** Dev and test only: the fire's fuel as this screen shows it, whatever the island says. */
	fuelShown: number | null = null;
	/** This kid's own figure is drawn by the player controller; its spawn point comes from here. */
	myEmote: { e: Emote; until: number } | null = null;
	/** Edits shown before the island agreed: cell → what was there, to put back if refused. */
	private pending = new Map<number, number>();
	private welcome: Extract<ServerMsg, { t: "welcome" }> | null = null;
	private socket: WebSocket | null = null;
	private retry = 0;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;
	private closed = false;

	/** The scene's terrain listens here: a whole new island, or some edits to it. */
	onIsland: ((data: Uint8Array) => void) | null = null;
	onEdits: ((edits: Int32Array) => void) | null = null;
	private listeners = new Set<(e: WorldEvent) => void>();

	constructor(private url: string) {}

	listen(fn: (e: WorldEvent) => void) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}
	private emit(e: WorldEvent) {
		for (const fn of this.listeners) fn(e);
	}
	private setStatus(s: Status) {
		this.status = s;
		this.emit({ t: "status", status: s });
	}

	/** Seconds of island time now, run on from the last tick. */
	elapsed(now = performance.now()) {
		return this.shift + this.clock.elapsed + (this.status === "open" ? Math.min(2, (now - this.clockAt) / 1000) : 0);
	}

	connect() {
		this.closed = false;
		clearTimeout(this.retryTimer);
		if (typeof navigator !== "undefined" && navigator.onLine === false) {
			this.setStatus("offline");
			const back = () => {
				window.removeEventListener("online", back);
				if (!this.closed) this.connect();
			};
			window.addEventListener("online", back);
			return;
		}
		this.setStatus(this.retry ? "reconnecting" : "connecting");
		const ws = new WebSocket(this.url);
		ws.binaryType = "arraybuffer";
		this.socket = ws;
		ws.onmessage = (e) => {
			if (typeof e.data === "string") this.message(JSON.parse(e.data) as ServerMsg);
			else this.edits(new Int32Array(e.data as ArrayBuffer));
		};
		ws.onclose = () => {
			if (this.socket !== ws) return;
			this.socket = null;
			if (this.closed || this.status === "kicked") return;
			this.retry++;
			this.setStatus("reconnecting");
			this.retryTimer = setTimeout(() => this.connect(), Math.min(15_000, 1000 * 2 ** Math.min(4, this.retry - 1)));
		};
	}

	close() {
		this.closed = true;
		clearTimeout(this.retryTimer);
		this.socket?.close();
		this.socket = null;
	}

	send(msg: ClientMsg) {
		if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
	}

	/** Mines or builds now, on this screen, and asks the island; it's taken back if the island says no. */
	edit(i: number, b: number) {
		if (!this.volume) return;
		if (!this.pending.has(i)) this.pending.set(i, this.volume.data[i]!);
		if (b === B.air) this.send({ t: "mine", i });
		else {
			this.send({ t: "place", i, b });
			this.inv[b] = Math.max(0, (this.inv[b] ?? 0) - 1);
		}
		this.set(i, b);
	}

	private set(i: number, b: number) {
		if (!this.volume) return;
		this.volume.data[i] = b;
		this.track(i, b);
		this.onEdits?.(Int32Array.of(packEdit(i, b)));
	}

	private track(i: number, b: number) {
		if (b === B.torch) this.torches.add(i);
		else this.torches.delete(i);
	}

	private edits(packed: Int32Array) {
		// The first binary frame after a welcome is the island's changes: build the island with them.
		if (this.welcome) {
			const w = this.welcome;
			this.welcome = null;
			this.gen = w.gen ?? 1;
			const island = generate(w.seed, this.gen);
			island.volume.apply(packed);
			this.volume = island.volume;
			this.torches.clear();
			for (let i = 0; i < island.volume.data.length; i++) if (island.volume.data[i] === B.torch) this.torches.add(i);
			this.fire = island.fire;
			this.pending.clear();
			this.onIsland?.(island.volume.data);
			this.retry = 0;
			this.setStatus("open");
			this.emit({ t: "ready" });
			return;
		}
		// An undo: blocks put back.
		if (!this.volume) return;
		for (const e of packed) {
			const [i, b] = unpackEdit(e);
			this.volume.data[i] = b;
			this.track(i, b);
			this.pending.delete(i);
		}
		this.onEdits?.(packed);
	}

	private message(m: ServerMsg) {
		switch (m.t) {
			case "welcome":
				this.welcome = m;
				this.seed = m.seed;
				this.seat = m.seat;
				this.island = m.island;
				this.inv = m.inv;
				this.stats = m.stats;
				this.clock = m.clock;
				this.clockAt = performance.now();
				this.lost = m.lost;
				this.home = m.home;
				this.others.clear();
				for (const f of m.figures) if (f.seat !== m.seat) this.others.set(f.seat, other(f));
				return;
			case "join":
				if (m.figure.seat === this.seat) return;
				this.others.set(m.figure.seat, other(m.figure));
				return this.emit({ t: "join", label: m.figure.label });
			case "leave": {
				const was = this.others.get(m.seat);
				this.others.delete(m.seat);
				if (was) this.emit({ t: "leave", label: was.label });
				return;
			}
			case "move": {
				const o = this.others.get(m.seat);
				if (o) {
					o.p = m.p;
					o.yaw = m.yaw;
				}
				return;
			}
			case "edit":
				if (m.seat === this.seat && this.pending.has(m.i)) {
					this.pending.delete(m.i);
					return;
				}
				this.pending.delete(m.i);
				if (m.seat === -1) this.emit({ t: "snuffed", at: cellOf(m.i) });
				return this.set(m.i, m.b);
			case "refused":
				this.pending.delete(m.i);
				this.set(m.i, m.b);
				return this.emit({ t: "refused", why: m.why });
			case "inv":
				this.inv = m.inv;
				this.stats = m.stats;
				return;
			case "tick": {
				const was = this.clock.fuel;
				this.clock = this.fuelShown === null ? m.clock : { ...m.clock, fuel: this.fuelShown };
				this.clockAt = performance.now();
				// More fuel than a second's burning took: someone fed the fire.
				if (this.clock.fuel > was + 2) this.emit({ t: "fed", added: this.clock.fuel - was });
				return;
			}
			case "night":
				this.lost = m.lost.map((l) => ({ ...l, follows: null }));
				return this.emit({ t: "night", night: m.night });
			case "dawn":
				this.lost = [];
				return this.emit({ t: "dawn", night: m.night, kept: m.kept });
			case "lost": {
				const a = this.lost.find((l) => l.id === m.id);
				if (!a) return;
				// Where it was left: by whoever it was following.
				if (m.follows === null && a.follows !== null) {
					const by = a.follows === this.seat ? null : this.others.get(a.follows);
					if (by) a.at = [...by.p];
				}
				a.follows = m.follows;
				if (m.follows === this.seat) this.emit({ t: "follow", animal: a.animal });
				return;
			}
			case "home": {
				const a = this.lost.find((l) => l.id === m.id);
				const by = m.seat === this.seat ? null : this.others.get(m.seat);
				const at: [number, number, number] = by ? [...by.p] : a ? [...a.at] : [this.fire[0], this.fire[1], this.fire[2]];
				this.lost = this.lost.filter((l) => l.id !== m.id);
				this.home = [...this.home, m.animal];
				return this.emit({ t: "home", animal: m.animal, mine: m.seat === this.seat, at });
			}
			case "goal":
				return this.emit({ t: "goal", key: m.key, tickets: m.tickets, label: m.label });
			case "emote": {
				const until = performance.now() + 2500;
				if (m.seat === this.seat) this.myEmote = { e: m.e, until };
				const o = this.others.get(m.seat);
				if (o) o.emote = { e: m.e, until };
				return;
			}
			case "kicked":
				this.status = "kicked";
				this.emit({ t: "kicked", why: m.why });
				return this.setStatus("kicked");
		}
	}
}

const other = (f: Figure): Other => ({ ...f, shown: [...f.p], emote: null });

export const woodsUrl = (childId: string, island?: string) => {
	const proto = location.protocol === "https:" ? "wss" : "ws";
	const q = island ? `?island=${encodeURIComponent(island)}` : "";
	return `${proto}://${location.host}/api/children/${childId}/woods/ws${q}`;
};
