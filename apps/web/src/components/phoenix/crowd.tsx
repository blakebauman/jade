import { type Look, type Pose, starterLook } from "@jade/core/roxy";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, memo, useMemo, useRef, useState } from "react";
import { CanvasTexture, type Group, type Sprite } from "three";
import { RoxyModel } from "../roxy/three/RoxyModel.tsx";
import { Shadow } from "../roxy/world/stage.tsx";
import { useBeat } from "./live.ts";
import { BOOTH, STAGE_Y } from "./set.tsx";
import { type Game, GUESTS } from "./sim.ts";
import type { Mood } from "./tracks.ts";

/**
 * The party's people: the kid's own character at the decks, and eight guests built like Roxy from seeded starter
 * looks (no pets: it's a party). As many guests dance as the hype allows; the rest wander off to the snack table and
 * the beanbags, and come back when the floor heats up. On the floor they bounce and twist on the beat, each in their
 * own style, and jump during a Fire Drop. The guest asking for a song wears a bubble with the mood's colour.
 */

export const SCALE = 0.55;
/** The DJ stands on a riser behind the booth, so the party can see them over the decks. */
const DJ_RISER = 0.35;
export const GUEST_NAMES = ["Mia", "Leo", "Ava", "Sam", "Zoe", "Kai", "Ivy", "Max"] as const;

export const MOOD_COLOUR: Record<Mood, string> = {
	chill: "#22c5b5",
	funky: "#8a5cff",
	bouncy: "#ff4f9a",
	big: "#ff8a3d",
	jungle: "#4cbf3a",
};

/** Where each guest dances, and where they go when they're not. */
const FLOOR: [number, number][] = [
	[-1.3, -0.2],
	[1.4, 0.1],
	[-2.8, 1.2],
	[0.1, 1.6],
	[2.9, 1.4],
	[-1.6, 2.9],
	[1.7, 3.0],
	[-3.6, -0.6],
];
const OFF: [number, number][] = [
	[6.5, 2.4],
	[-6.6, 3.3],
	[8.0, 2.5],
	[-5.7, 0.4],
	[7.6, -0.4],
	[-7.7, 3.9],
	[6.4, 4.4],
	[-6.9, -1.0],
];
/** Who comes to the floor first as it fills (a seeded order would do; this one spreads them round). */
const ORDER = [3, 0, 1, 6, 2, 5, 4, 7];

export function guestLooks(): Look[] {
	return Array.from({ length: GUESTS }, (_, i) => {
		const look = starterLook(`phoenix-guest-${i}`);
		const { pet: _p, petwear: _w, ...slots } = look.slots;
		return { ...look, slots, name: GUEST_NAMES[i] };
	});
}

type Mover = { x: number; z: number; yaw: number; walking: MutableRefObject<number> };

const Guest = memo(function Guest({ look, pose, mover, i }: { look: Look; pose: Pose; mover: Mover; i: number }) {
	const beat = useBeat();
	const root = useRef<Group>(null);
	const turn = useRef<Group>(null);
	const style = i % 3;
	useFrame(() => {
		const b = beat.current;
		const g = root.current;
		const t = turn.current;
		if (!g || !t) return;
		g.position.set(mover.x, 0, mover.z);
		const dancing = mover.walking.current < 0.1 && Math.hypot(mover.x - FLOOR[i]![0], mover.z - FLOOR[i]![1]) < 0.3;
		const e = b.energy;
		const p = b.beat * Math.PI;
		let bob = 0;
		let twist = 0;
		let lean = 0;
		if (dancing && b.playing) {
			// Three styles: bounce on every beat, a side-step sway, a twist on the half-bar.
			if (style === 0) bob = Math.abs(Math.sin(p)) * (0.1 + 0.15 * e);
			else if (style === 1) {
				bob = Math.abs(Math.sin(p)) * 0.08;
				lean = Math.sin(p) * 0.12;
			} else {
				bob = Math.abs(Math.sin(p)) * 0.07;
				twist = Math.sin(p / 2) * (0.3 + 0.3 * e);
			}
			if (b.rise) bob += Math.abs(Math.sin(p)) * 0.35;
		} else if (!b.playing || !dancing) {
			lean = Math.sin(b.t * 1.2 + i) * 0.03;
		}
		t.position.y = bob;
		t.rotation.set(0, mover.yaw + twist, lean);
	});
	return (
		<group ref={root}>
			<Shadow r={0.3} />
			<group ref={turn} scale={SCALE}>
				<RoxyModel look={look} pose={pose} walking={mover.walking} />
			</group>
		</group>
	);
});

/** The speech bubble: a round glass bubble with a music note, in the colour of the mood asked for. */
function bubbleTexture(colour: string) {
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const ctx = c.getContext("2d")!;
	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.arc(64, 56, 46, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(48, 96);
	ctx.lineTo(64, 122);
	ctx.lineTo(74, 98);
	ctx.fill();
	ctx.fillStyle = colour;
	ctx.beginPath();
	ctx.arc(64, 56, 38, 0, Math.PI * 2);
	ctx.fill();
	// A beamed pair of notes.
	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.ellipse(50, 74, 10, 8, -0.4, 0, Math.PI * 2);
	ctx.ellipse(80, 68, 10, 8, -0.4, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillRect(57, 34, 5, 40);
	ctx.fillRect(87, 28, 5, 40);
	ctx.beginPath();
	ctx.moveTo(57, 34);
	ctx.lineTo(92, 28);
	ctx.lineTo(92, 38);
	ctx.lineTo(57, 44);
	ctx.fill();
	return new CanvasTexture(c);
}

function Bubble({ game, movers }: { game: MutableRefObject<Game>; movers: Mover[] }) {
	const beat = useBeat();
	const ref = useRef<Sprite>(null);
	const textures = useMemo(
		() => Object.fromEntries(Object.entries(MOOD_COLOUR).map(([m, c]) => [m, bubbleTexture(c)])) as Record<Mood, CanvasTexture>,
		[],
	);
	useFrame(() => {
		const s = ref.current;
		const g = game.current;
		if (!s) return;
		s.visible = g.phase === "crate";
		if (!s.visible) return;
		const m = movers[g.requestBy]!;
		const b = beat.current;
		s.position.set(m.x, 2.25 + Math.sin(b.t * 3) * 0.06, m.z);
		const map = textures[g.request];
		const mat = s.material as { map: CanvasTexture | null; needsUpdate: boolean };
		if (mat.map !== map) {
			mat.map = map;
			mat.needsUpdate = true;
		}
	});
	return (
		<sprite ref={ref} scale={[0.75, 0.75, 1]} renderOrder={5}>
			<spriteMaterial depthTest={false} transparent />
		</sprite>
	);
}

/** The kid at the decks: bobbing on the beat, cheering when the Phoenix rises or a streak lands, waving between songs. */
function Dj({ look, cheer }: { look: Look; cheer: MutableRefObject<number> }) {
	const beat = useBeat();
	const turn = useRef<Group>(null);
	const [pose, setPose] = useState<Pose>("wave");
	const walking = useRef(0);
	useFrame(() => {
		const b = beat.current;
		const t = turn.current;
		if (!t) return;
		t.position.y = b.playing ? Math.abs(Math.sin(b.beat * Math.PI)) * 0.06 : 0;
		t.rotation.set(0, b.playing ? Math.sin(b.beat * Math.PI * 0.5) * 0.15 : 0, b.playing ? Math.sin(b.beat * Math.PI) * 0.04 : 0);
		const want: Pose = b.rise || b.t < cheer.current ? "cheer" : b.playing ? "stand" : "wave";
		if (want !== pose) setPose(want);
	});
	return (
		<group position={[BOOTH[0], STAGE_Y + DJ_RISER, BOOTH[2] - 0.75]}>
			<group ref={turn} scale={SCALE * 1.05}>
				<RoxyModel look={look} pose={pose} walking={walking} />
			</group>
		</group>
	);
}

/** Everyone. `cheer` (scene seconds) holds the DJ's and the floor's cheer until then. */
export function Crowd({
	look,
	guests,
	game,
	cheer,
	reduced,
}: {
	look: Look;
	guests: Look[];
	game: MutableRefObject<Game>;
	cheer: MutableRefObject<number>;
	reduced: boolean;
}) {
	const beat = useBeat();
	// The first few start on the floor, so the party's going when the kid arrives; the rest by the snacks.
	const movers = useMemo<Mover[]>(
		() =>
			OFF.map((off, i) => {
				const [x, z] = ORDER.slice(0, 3).includes(i) ? FLOOR[i]! : off;
				return { x, z, yaw: 0, walking: { current: 0 } };
			}),
		[],
	);
	const [poses, setPoses] = useState<Pose[]>(() => guests.map(() => "stand"));
	const lastBar = useRef(-1);

	useFrame(() => {
		const b = beat.current;
		const on = new Set(ORDER.slice(0, b.dancers));
		const step = Math.min(b.dt, 0.05) * 2.4;
		for (let i = 0; i < movers.length; i++) {
			const m = movers[i]!;
			const [tx, tz] = on.has(i) ? FLOOR[i]! : OFF[i]!;
			const dx = tx - m.x;
			const dz = tz - m.z;
			const d = Math.hypot(dx, dz);
			if (d > 0.05) {
				const k = reduced ? 1 : Math.min(1, step / d);
				m.x += dx * k;
				m.z += dz * k;
				m.walking.current = reduced ? 0 : 1;
				m.yaw = Math.atan2(dx, dz);
			} else {
				m.walking.current = 0;
				// On the floor, facing out to the party (and us), turned a little toward the middle; off it, toward the floor.
				const want = on.has(i) ? -m.x * 0.12 : Math.atan2(-m.x, 1 - m.z);
				m.yaw += (want - m.yaw) * Math.min(1, b.dt * 4);
			}
		}
		// Poses change once a bar: cheering when it's hot, a wave now and then, hands on hips off the floor.
		const bar = Math.floor(b.beat / 4);
		if (bar !== lastBar.current) {
			lastBar.current = bar;
			const next = guests.map((_, i): Pose => {
				if (!on.has(i)) return i % 3 === 0 ? "hips" : "stand";
				if (b.rise || b.t < cheer.current) return "cheer";
				if (!b.playing) return "stand";
				if (b.energy > 0.7) return (i + bar) % 3 === 0 ? "wave" : "cheer";
				if (b.energy > 0.4) return (i + bar) % 4 === 0 ? "cheer" : "stand";
				return "stand";
			});
			setPoses((was) => (was.every((p, i) => p === next[i]) ? was : next));
		}
	});

	return (
		<>
			<Dj look={look} cheer={cheer} />
			{guests.map((g, i) => (
				<Guest key={i} i={i} look={g} pose={poses[i]!} mover={movers[i]!} />
			))}
			<Bubble game={game} movers={movers} />
		</>
	);
}
