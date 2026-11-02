import { MAX_TICKETS_PER_GO, type Quest } from "@jade/core";
import { starterLook } from "@jade/core/roxy";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Disc3, Flame, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GUEST_NAMES, MOOD_COLOUR } from "#/components/phoenix/crowd.tsx";
import { type Flash, Highway, LANE_KEYS } from "#/components/phoenix/Highway.tsx";
import type { Live, Moment } from "#/components/phoenix/live.ts";
import {
	accuracy,
	advance,
	autoplay,
	flames,
	type Game,
	type GameEvent,
	HYPE_MAX,
	inRise,
	LEVEL_LABEL,
	LEVELS,
	type Level,
	multiplier,
	newGame,
	pick,
	press as pressLane,
	run,
	SONGS_PER_SET,
	songSeconds,
	ticketsFor,
} from "#/components/phoenix/sim.ts";
import * as sound from "#/components/phoenix/sound.ts";
import { type Mood, TRACK, TRACKS, type Track } from "#/components/phoenix/tracks.ts";
import { Tickets } from "#/components/play/PlayBits.tsx";
import { QuestsDone } from "#/components/play/QuestsDone.tsx";
import { GameLoading } from "#/components/roxy/GameLoading.tsx";
import { accent, GameScreen, GameStatus, Hint } from "#/components/roxy/GameScreen.tsx";
import { useChild } from "#/lib/child.ts";
import { earnTickets, useGamesFree } from "#/lib/play.ts";
import { questEvent } from "#/lib/quests.ts";
import { roxyQuery, shownLook } from "#/lib/roxy.ts";

const scene = () => import("#/components/phoenix/PhoenixScene.tsx");
// three.js only loads on game screens.
const PhoenixScene = lazy(() => scene().then((m) => ({ default: m.PhoenixScene })));

export const Route = createFileRoute("/_authed/play/$childId/games/phoenix")({
	component: PhoenixScreen,
});

/** The screen's phase: the start card, the crate between songs, a song, paused (in a song), or the set's results. */
type Phase = "ready" | "crate" | "song" | "paused" | "over";

type Hud = { score: number; combo: number; mult: number; hype: number; rise: boolean; song: number; track: string };

const LEVEL_KEY = "jade.phoenix.speed";
const bestKey = (childId: string) => `jade.phoenix.best.${childId}`;
const MOOD_ASK: Record<Mood, string> = {
	chill: "Something chill, please!",
	funky: "Make it funky!",
	bouncy: "Something bouncy!",
	big: "Play the big one!",
};
const MOOD_LABEL: Record<Mood, string> = { chill: "Chill", funky: "Funky", bouncy: "Bouncy", big: "Big" };
/** How long after its window a note is given up as missed, for presses held up by a slow frame. */
const MISS_GRACE_S = 0.12;
/** How far back a press is dated to the moment it happened, at most (beyond that a timestamp isn't trusted). */
const MAX_LATE_S = 0.25;
const KEY_LANE: Record<string, number> = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };

function readNumber(key: string) {
	try {
		return Number(localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}
function readLevel(): Level {
	try {
		const v = localStorage.getItem(LEVEL_KEY);
		return LEVELS.includes(v as Level) ? (v as Level) : "chill";
	} catch {
		return "chill";
	}
}

/** If this device can't draw 3D, say so; the party can't be played without it. */
class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		if (this.state.failed)
			return (
				<p className="grid size-full place-items-center p-6 text-center text-page-muted">
					This device can’t show 3D games, so the Phoenix party can’t be played here.
				</p>
			);
		return this.props.children;
	}
}

const snapshot = (g: Game): Hud => ({
	score: g.score,
	combo: g.combo,
	mult: multiplier(g),
	hype: Math.round(g.hype),
	rise: inRise(g),
	song: g.song,
	track: g.track?.name ?? "",
});

function PhoenixScreen() {
	const child = useChild();
	const free = useGamesFree(child.id);
	const { data: roxy } = useQuery(roxyQuery(child.id));
	const look = useMemo(() => (roxy ? shownLook(child.id, roxy) : starterLook(child.id)), [roxy, child.id]);
	const [level, setLevel] = useState(readLevel);
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const live = useRef<Live>({ game: newGame(seed, level), time: sound.songTime, moments: [], frozen: false });
	const [phase, setPhase] = useState<Phase>("ready");
	const [hud, setHud] = useState<Hud>(() => snapshot(live.current.game));
	const [best, setBest] = useState(() => readNumber(bestKey(child.id)));
	const [newBest, setNewBest] = useState(false);
	const [earned, setEarned] = useState(0);
	const [questsDone, setQuestsDone] = useState<Quest[]>([]);
	const [muted, setMuted] = useState(sound.isMuted);
	const [frozen, setFrozen] = useState(false);
	/** Test only: stop drawing the 3D (the song, the clock and the highway carry on), for timing tests on slow runners. */
	const [drawScene, setDrawScene] = useState(true);
	const [message, setMessage] = useState<string | null>(null);
	const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const autopilot = useRef(false);
	const flashes = useRef<(Flash | null)[]>([null, null, null, null]);
	const held = useRef<boolean[]>([false, false, false, false]);
	const gameRef = useMemo(
		() => ({
			get current() {
				return live.current.game;
			},
		}),
		[],
	) as React.MutableRefObject<Game>;

	const say = useCallback((text: string, ms = 2200) => {
		setMessage(text);
		clearTimeout(messageTimer.current);
		messageTimer.current = setTimeout(() => setMessage(null), ms);
	}, []);
	useEffect(() => () => clearTimeout(messageTimer.current), []);
	const moment = (m: Moment) => live.current.moments.push(m);

	const finish = useCallback(
		(g: Game) => {
			sound.stopSong();
			sound.setEnd();
			moment("end");
			setHud(snapshot(g));
			setPhase("over");
			const tickets = free.current ? 0 : ticketsFor(g, MAX_TICKETS_PER_GO);
			setEarned(tickets);
			if (tickets > 0) void earnTickets(child.id, `phoenix:${g.seed}`, tickets);
			setQuestsDone(
				questEvent(
					child.id,
					{ game: "phoenix", rises: g.rises, streak: g.bestCombo, requests: g.requestsMet, flames: flames(g) },
					free.current,
				),
			);
			const was = readNumber(bestKey(child.id));
			setNewBest(g.score > was);
			if (g.score > was) {
				setBest(g.score);
				try {
					localStorage.setItem(bestKey(child.id), String(g.score));
				} catch {}
			}
		},
		[child.id],
	);

	/** What the game just did: sounds, flashes on the pads, moments for the scene. */
	const handle = useCallback(
		(events: GameEvent[]) => {
			const g = live.current.game;
			const now = performance.now();
			for (const e of events) {
				if (e.type === "hit") {
					sound.hit(e.lane, e.grade === "perfect");
					flashes.current[e.lane] = { kind: e.grade, at: now };
				} else if (e.type === "miss") {
					sound.miss();
					flashes.current[e.lane] = { kind: "miss", at: now };
				} else if (e.type === "extra") {
					sound.extra();
					flashes.current[e.lane] = { kind: "extra", at: now };
				} else if (e.type === "streak") {
					sound.cheer(e.n >= 50);
					moment("streak");
					say(`${e.n} in a row!`);
				} else if (e.type === "rise") {
					sound.rise();
					moment("rise");
					say("The Phoenix rises! Fire Drop: double points!", 3200);
				} else if (e.type === "rise-end") {
					say("What a Fire Drop!");
				} else if (e.type === "song-end") {
					sound.stopSong(true);
					if (g.phase === "crate") {
						sound.cheer(g.hype > 60);
						if (g.hype < 25) sound.aww();
					}
				} else if (e.type === "over") finish(g);
			}
			events.length = 0;
			if (g.phase === "crate") setPhase((p) => (p === "song" ? "crate" : p));
		},
		[finish, say],
	);

	// The song loop: the clock is the music; every frame the game catches up to it.
	useEffect(() => {
		if (phase !== "song" || frozen) return;
		let raf = 0;
		let lastHud = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const g = live.current.game;
			sound.keep();
			const t = sound.songTime();
			if (autopilot.current) autoplay(g, t, 0.95);
			// Notes are given up a little after their window closes, so a press held up by a long frame (judged at its own
			// time) still finds its note.
			else advance(g, t - MISS_GRACE_S);
			if (g.events.length) handle(g.events);
			sound.setCrowd(0.3 + (g.hype / HYPE_MAX) * 0.7);
			if (now - lastHud > 100) {
				lastHud = now;
				const next = snapshot(g);
				setHud((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
			}
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase, frozen, handle]);

	/**
	 * A pad, from a key, a finger or a mouse. It's judged at the moment it was pressed (the event's own time), not when
	 * the page got round to it: a slow frame on an older iPad mustn't turn a hit into a miss.
	 */
	const onPress = useCallback(
		(lane: number, at: number) => {
			const g = live.current.game;
			if (g.phase !== "song" || phase !== "song") return;
			sound.unlock();
			const late = Math.min(MAX_LATE_S, Math.max(0, (performance.now() - at) / 1000));
			pressLane(g, lane, sound.songTime() - late);
			if (g.events.length) handle(g.events);
		},
		[phase, handle],
	);

	// Keys: D F J K (or the arrows) are the pads; P or Escape pauses; switching away from the tab pauses too.
	useEffect(() => {
		const typing = (t: EventTarget | null) =>
			t instanceof HTMLElement && (t.isContentEditable || !!t.closest("input, textarea, select, dialog, [role='dialog']"));
		const down = (e: KeyboardEvent) => {
			if (e.defaultPrevented || typing(e.target)) return;
			const lane = KEY_LANE[e.code];
			if (lane !== undefined) {
				e.preventDefault();
				if (e.repeat) return;
				held.current[lane] = true;
				onPress(lane, e.timeStamp);
				return;
			}
			if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) togglePause();
		};
		const up = (e: KeyboardEvent) => {
			const lane = KEY_LANE[e.code];
			if (lane !== undefined) held.current[lane] = false;
		};
		const onHide = () => {
			if (document.hidden) setPhase((p) => (p === "song" ? "paused" : p));
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			document.removeEventListener("visibilitychange", onHide);
		};
	});

	const paused = phase === "paused" || frozen;
	useEffect(() => {
		sound.setPaused(paused);
		live.current.frozen = frozen;
	}, [paused, frozen]);
	useEffect(() => () => sound.stopAll(), []);

	function togglePause() {
		// Inside the tap or key press: iOS only lets sound resume from one.
		const next = phase === "song" ? "paused" : phase === "paused" ? "song" : phase;
		if (next !== phase) sound.setPaused(next === "paused");
		sound.unlock();
		setPhase(next);
	}

	function start() {
		sound.unlock();
		sound.setCrowd(0.4);
		setMessage(null);
		setQuestsDone([]);
		setEarned(0);
		setNewBest(false);
		const s = phase === "over" ? Math.floor(Math.random() * 1e9) : seed;
		setSeed(s);
		live.current.game = newGame(s, level);
		live.current.moments.length = 0;
		setHud(snapshot(live.current.game));
		setPhase("crate");
	}

	function chooseLevel(l: Level) {
		setLevel(l);
		live.current.game.level = l;
		try {
			localStorage.setItem(LEVEL_KEY, l);
		} catch {}
	}

	/** Putting a record on: a moment's wait for its recording if it's still loading, then the song starts. */
	const [loading, setLoading] = useState(false);
	async function putOn(track: Track) {
		const g = live.current.game;
		if (g.phase !== "crate" || loading) return;
		sound.unlock();
		sound.select();
		setLoading(true);
		const gen = sound.currentGeneration();
		await sound.trackReady(track);
		// Left the game (or the tab) while it loaded: don't start a song nobody's there for.
		if (gen !== sound.currentGeneration()) return;
		setLoading(false);
		if (g !== live.current.game || g.phase !== "crate" || document.hidden) return;
		pick(g, track);
		moment("pick");
		if (g.matched) {
			moment("match");
			sound.cheer(false);
			say(`${GUEST_NAMES[g.requestBy]} loves it!`);
		}
		g.events.length = 0;
		sound.startSong(track);
		setHud(snapshot(g));
		setPhase("song");
	}

	// Dev and test only: jump to a state for screenshots, and hold still while one is taken.
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		const fresh = (s: number) => {
			const g = newGame(s, level);
			live.current.game = g;
			return g;
		};
		const playInto = (g: Game, track: Track, seconds: number) => {
			pick(g, track);
			run(g, seconds, 0.95);
			g.events.length = 0;
			sound.startSong(track, g.now);
		};
		(window as { __THREE_GAME_TEST_HOOKS__?: unknown }).__THREE_GAME_TEST_HOOKS__ = {
			setSeed: (s: number) => {
				setSeed(s);
				fresh(s);
				setPhase("ready");
				return { seed: s };
			},
			setState: async (name: string) => {
				sound.unlock();
				sound.stopSong();
				const g = fresh(seed);
				if (name === "ready") setPhase("ready");
				else if (name === "crate") setPhase("crate");
				else if (name === "active-play") {
					playInto(g, TRACK.pop, 22);
					g.hype = 70;
					setPhase("song");
				} else if (name === "fire-drop") {
					playInto(g, TRACK.drop, 14);
					// Straight into a rise, the moment it starts.
					g.hype = HYPE_MAX - 1;
					const n = g.notes[g.next]!;
					pressLane(g, n.lane, n.t);
					handle(g.events);
					setPhase("song");
				} else if (name === "results") {
					for (const t of TRACKS.slice(0, SONGS_PER_SET)) {
						if (g.phase !== "crate") break;
						pick(g, TRACKS.find((x) => x.mood === g.request) ?? t);
						run(g, songSeconds(g.track!) + 1, 0.9);
					}
					g.events.length = 0;
					finish(g);
				} else throw new Error(`Unknown state ${name}`);
				setHud(snapshot(g));
				await new Promise((r) => setTimeout(r, 400));
				return { state: name };
			},
			peek: () => {
				const g = live.current.game;
				const n = g.notes.slice(g.next).find((x) => !x.grade);
				return {
					phase: g.phase,
					score: g.score,
					combo: g.combo,
					counts: { ...g.counts },
					now: sound.songTime(),
					next: n ? { lane: n.lane, t: n.t } : null,
					music: sound.songSource(),
				};
			},
			setAutopilot: (on: boolean) => {
				autopilot.current = on;
				return { autopilot: on };
			},
			setSceneDrawing: (on: boolean) => {
				setDrawScene(on);
				return { drawing: on };
			},
			setPausedForScreenshot: (p: boolean) => {
				setFrozen(p);
				return { paused: p };
			},
		};
	}, [seed, level, finish, handle]);

	const g = live.current.game;
	const inSet = phase === "crate" || phase === "song" || phase === "paused";
	const running = !frozen && phase !== "paused" && drawScene;
	const asker = GUEST_NAMES[g.requestBy];

	return (
		<GameScreen
			panelLabel="How to play"
			// The go is the whole set: tickets and quests are paid at its end, so time running out between songs waits too.
			goInProgress={inSet}
			scene={
				<div className="relative size-full select-none">
					<NoWebGL>
						<Suspense fallback={<GameLoading />}>
							<PhoenixScene
								live={live}
								look={look}
								running={running}
								label={phase === "song" ? `The Phoenix party. ${hud.track} is playing.` : "The Phoenix party on the rooftop."}
							/>
						</Suspense>
					</NoWebGL>
					{(phase === "song" || phase === "paused") && (
						<>
							<HypeMeter hype={hud.hype} rise={hud.rise} />
							<div className="absolute inset-x-0 bottom-[max(0.75rem,var(--safe-bottom))] flex justify-center px-3 md:bottom-[max(1.25rem,var(--safe-bottom))]">
								<div className="h-[min(26rem,46vh)] w-[min(26rem,94vw)] short:h-[78vh] short:w-[min(20rem,46vw)]">
									<Highway game={gameRef} time={sound.songTime} flashes={flashes} held={held} onPress={onPress} />
								</div>
							</div>
						</>
					)}
					<p
						role="status"
						className={
							message && inSet
								? "glass glass-pill pointer-events-none absolute top-[calc(max(0.75rem,var(--safe-top))+9.6rem)] left-1/2 -translate-x-1/2 text-center text-sm font-medium whitespace-nowrap md:top-[calc(max(1.5rem,var(--safe-top))+5.6rem)]"
								: "sr-only"
						}
					>
						{message ?? ""}
					</p>
				</div>
			}
			back={
				<Link
					to="/play/$childId/games"
					params={{ childId: child.id }}
					className="orb glass"
					aria-label="Back to Games"
					title="Back to Games"
				>
					<ArrowLeft aria-hidden />
				</Link>
			}
			eyebrow="Games"
			title={accent("Phoenix DJ Party")}
			orbs={
				<>
					<button
						type="button"
						className="orb glass"
						onClick={() => {
							sound.setMuted(!muted);
							setMuted(!muted);
						}}
						aria-pressed={muted}
						aria-label={muted ? "Sound on" : "Sound off"}
						title={muted ? "Sound on" : "Sound off"}
					>
						{muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
					</button>
					{(phase === "song" || phase === "paused") && (
						<button
							type="button"
							className="orb glass"
							onClick={togglePause}
							aria-label={phase === "paused" ? "Carry on" : "Pause"}
							title={phase === "paused" ? "Carry on" : "Pause"}
						>
							{phase === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
						</button>
					)}
				</>
			}
			status={
				inSet && (
					<GameStatus>
						<span className="tabular-nums">{hud.score.toLocaleString()}</span>
						{phase !== "crate" && hud.mult > 1 && <span className="font-semibold text-roxy"> ×{hud.mult}</span>} · song{" "}
						{Math.min(hud.song + 1, SONGS_PER_SET)} of {SONGS_PER_SET}
					</GameStatus>
				)
			}
			hints={
				<>
					<Hint keys={[...LANE_KEYS]}>hit the beat</Hint>
					<Hint keys={["P"]}>pause</Hint>
				</>
			}
			prompt={
				<div aria-live="polite" className="flex flex-col items-center gap-2">
					{phase === "ready" && (
						<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
							<p className="font-display text-2xl font-semibold">You’re the DJ!</p>
							<p className="mt-2 text-sm text-page-muted">
								Pick a record the party asks for, then tap the pads as the notes land. Hit the beat to fill the floor, and when everyone’s
								dancing the Phoenix rises!
							</p>
							<fieldset className="mt-4">
								<legend className="sr-only">How busy the notes are</legend>
								<div className="flex justify-center gap-1.5">
									{LEVELS.map((l) => (
										<button
											key={l}
											type="button"
											className="key"
											data-variant="felt"
											data-pressed={level === l}
											aria-pressed={level === l}
											onClick={() => chooseLevel(l)}
										>
											{LEVEL_LABEL[l]}
										</button>
									))}
								</div>
							</fieldset>
							{best > 0 && (
								<p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
									<Trophy className="size-4" aria-hidden /> Your best: <span className="tabular-nums">{best.toLocaleString()}</span>
								</p>
							)}
						</div>
					)}
					{phase === "crate" && (
						<div className="glass w-[min(34rem,94vw)] rounded-[1.4rem] p-4 text-center max-md:p-3">
							<p className="text-sm text-page-muted">
								Song {g.song + 1} of {SONGS_PER_SET}
							</p>
							<p className="font-display text-xl font-semibold">
								<span
									className="inline-block size-3 rounded-full align-middle"
									style={{ background: MOOD_COLOUR[g.request] }}
									aria-hidden
								/>{" "}
								{asker} asks: “{MOOD_ASK[g.request]}”
							</p>
							<ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="The record crate">
								{TRACKS.map((t) => (
									<li key={t.id}>
										<button
											type="button"
											className="phoenix-record w-full"
											style={{ "--mood": MOOD_COLOUR[t.mood] } as React.CSSProperties}
											onPointerEnter={() => sound.crate()}
											onClick={() => void putOn(t)}
											disabled={loading}
											aria-busy={loading || undefined}
										>
											<Disc3 className="size-7" aria-hidden />
											<span className="font-display text-base leading-tight font-semibold">{t.name}</span>
											<span className="text-xs opacity-85">
												{MOOD_LABEL[t.mood]} · {t.bpm} BPM
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
					{phase === "paused" && <p className="glass glass-pill font-display font-semibold">Paused</p>}
					{phase === "over" && <Results g={g} earned={earned} quests={questsDone} best={best} newBest={newBest} />}
				</div>
			}
			actions={
				phase === "ready" ? (
					<button type="button" className="key" data-variant="go" onClick={start}>
						<Play className="size-5" aria-hidden /> Start the party
					</button>
				) : phase === "over" ? (
					<>
						<button type="button" className="key" onClick={start}>
							<RotateCcw className="size-5" aria-hidden /> Play again
						</button>
						<Link to="/play/$childId/games" params={{ childId: child.id }} className="key" data-variant="felt">
							Games
						</Link>
					</>
				) : phase === "paused" ? (
					<button type="button" className="key" onClick={togglePause}>
						<Play className="size-5" aria-hidden /> Carry on
					</button>
				) : null
			}
		/>
	);
}

/** The Phoenix meter, top centre: hype filling toward the rise; a Fire Drop when it's up. */
function HypeMeter({ hype, rise }: { hype: number; rise: boolean }) {
	return (
		<div className="glass pointer-events-none absolute top-[calc(max(0.75rem,var(--safe-top))+6.6rem)] left-1/2 flex w-[min(18rem,70vw)] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 md:top-[max(1.5rem,var(--safe-top))] short:top-[calc(max(0.75rem,var(--safe-top))+3.6rem)]">
			<meter className="sr-only" aria-label={rise ? "Fire Drop" : "Party hype"} min={0} max={HYPE_MAX} value={rise ? HYPE_MAX : hype} />
			<Flame className={`size-5 shrink-0 ${rise ? "text-[#ff7a1a]" : "text-roxy"}`} aria-hidden />
			<span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-page-pit">
				<span
					className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
					style={{
						width: `${rise ? 100 : hype}%`,
						background: rise ? "linear-gradient(90deg,#ff3d5a,#ffb02e)" : "linear-gradient(90deg,var(--color-roxy),#ff7a1a)",
					}}
				/>
			</span>
			<span className="font-display text-sm font-semibold whitespace-nowrap">{rise ? "Fire Drop ×2" : "Hype"}</span>
		</div>
	);
}

function Results({ g, earned, quests, best, newBest }: { g: Game; earned: number; quests: Quest[]; best: number; newBest: boolean }) {
	const f = flames(g);
	const headline = ["", "Nice set!", "Good party!", "Great party!", "Amazing party!", "Legendary party!"][f];
	return (
		<div className="glass max-w-sm rounded-[1.4rem] p-5 text-center">
			<p className="font-display text-3xl font-semibold">{headline}</p>
			<p className="mt-2 flex justify-center gap-1" role="img" aria-label={`${f} of 5 flames`}>
				{[1, 2, 3, 4, 5].map((k) => (
					<Flame
						key={k}
						className={`size-7 ${k <= f ? "text-[#ff7a1a]" : "text-page-line"}`}
						fill={k <= f ? "currentColor" : "none"}
						aria-hidden
					/>
				))}
			</p>
			<p className="mt-2 text-sm">
				You scored <span className="font-semibold tabular-nums">{g.score.toLocaleString()}</span>, hit{" "}
				<span className="font-semibold tabular-nums">{Math.round(accuracy(g) * 100)}%</span> of the beats, with a best streak of{" "}
				<span className="font-semibold tabular-nums">{g.bestCombo}</span>.
			</p>
			<p className="mt-1 text-sm text-page-muted">
				{g.rises > 0 ? `The Phoenix rose ${g.rises === 1 ? "once" : `${g.rises} times`}` : "The Phoenix stayed on its perch"}, and you
				played {g.requestsMet} of {SONGS_PER_SET} requests.
			</p>
			{earned > 0 && (
				<p className="mt-3 flex justify-center">
					<Tickets count={earned} />
				</p>
			)}
			<QuestsDone quests={quests} />
			<p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
				<Trophy className="size-4" aria-hidden />{" "}
				{newBest ? (
					"A new best!"
				) : (
					<>
						Your best: <span className="tabular-nums">{best.toLocaleString()}</span>
					</>
				)}
			</p>
		</div>
	);
}
