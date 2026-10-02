import { type Look, PLACE_INFO, type PlaceId } from "@jade/core/roxy";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type CanvasTexture, DoubleSide, type Group, type Material, type Mesh, type MeshBasicMaterial, Shape, ShapeGeometry } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import type { DriveInput } from "./drive.ts";
import { GOLD, lighter, Toon } from "./Furniture.tsx";
import type { Target } from "./near.ts";
import { useWake } from "./pace.tsx";
import { Board } from "./place/board.tsx";
import type { Hotspot, Place, V3 } from "./place/kit.tsx";
import { park } from "./place/park.tsx";
import { petshop } from "./place/petshop.tsx";
import { school } from "./place/school.tsx";
import { canvasTexture, type Spot, Walkers, WorldCanvas } from "./stage.tsx";

export type { Hotspot } from "./place/kit.tsx";

/**
 * A find being picked up: it floats up over Roxy's head (she's standing in front of it) inside a soft glow, spins,
 * and pops: a ring opens out and little stars shower down, so a find feels like a prize.
 * With reduced motion there's no show; the message under the scene says what was found.
 */
/** Above Roxy's head, so she doesn't hide it. */
const POP_HEIGHT = 2.7;
const SPARKLE_COLOURS = [GOLD, "#fff6cf", "#f6b6c8", "#9fd8f0"];
const POP_AT = 0.85;
function FindBurst({ at, node, onDone }: { at: V3; node: ReactNode; onDone: () => void }) {
	const item = useRef<Group>(null);
	const sparks = useRef<Group>(null);
	const ring = useRef<Mesh>(null);
	const glow = useRef<Mesh>(null);
	const start = useRef<number | null>(null);
	const done = useRef(onDone);
	done.current = onDone;
	const fired = useRef(false);
	const dirs = useMemo(
		() =>
			Array.from({ length: 14 }, (_, i) => {
				const a = (i / 14) * Math.PI * 2;
				return {
					x: Math.cos(a) * (1.1 + (i % 3) * 0.3),
					y: 2.4 + (i % 4) * 0.5,
					z: Math.sin(a) * (1.1 + (i % 2) * 0.4),
					s: 0.7 + (i % 3) * 0.25,
				};
			}),
		[],
	);
	const wake = useWake();
	// The show is drawn over everything (a find under a tree would otherwise pop inside the leaves): its own copies of
	// the find's materials, without depth testing, drawn last. Checked each frame, as a baked find arrives a frame late.
	const made = useRef<Material[]>([]);
	useEffect(
		() => () => {
			for (const m of made.current) m.dispose();
		},
		[],
	);
	const onTop = (g: Group | null) =>
		g?.traverse((o) => {
			const m = o as Mesh;
			if (!m.isMesh || m.userData.onTop) return;
			m.userData.onTop = true;
			const own = (m.material as Material).clone();
			own.depthTest = false;
			// See-through (fully opaque), so it's drawn after the glow, which is see-through too, and stays in front of it.
			own.transparent = true;
			m.material = own;
			m.renderOrder = 3;
			made.current.push(own);
		});
	useFrame(({ clock, camera }) => {
		wake();
		onTop(item.current);
		onTop(sparks.current);
		start.current ??= clock.elapsedTime;
		const t = clock.elapsedTime - start.current;
		if (t > 1.7) {
			if (!fired.current) done.current();
			fired.current = true;
			return;
		}
		const rise = POP_HEIGHT - at[1];
		if (item.current) {
			const k = Math.min(1, t / 0.55);
			item.current.position.y = Math.sin(k * Math.PI * 0.5) * rise;
			item.current.rotation.y = t * 7;
			item.current.scale.setScalar(t < POP_AT ? 1 + k * 1.6 : Math.max(0, 2.6 * (1 - (t - POP_AT) / 0.2)));
		}
		// The glow faces the camera and swells with the find, then goes with the pop.
		const g = glow.current;
		if (g) {
			const k = Math.min(1, t / 0.55);
			g.position.y = Math.sin(k * Math.PI * 0.5) * rise;
			g.quaternion.copy(camera.quaternion);
			g.scale.setScalar(t < POP_AT ? 0.4 + k * 0.9 : Math.max(0, 1.3 * (1 - (t - POP_AT) / 0.25)));
		}
		const st = Math.max(0, t - POP_AT);
		const r = ring.current;
		if (r) {
			r.visible = t > POP_AT && st < 0.5;
			r.position.y = rise;
			r.quaternion.copy(camera.quaternion);
			r.scale.setScalar(0.3 + st * 4.5);
			(r.material as MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - st / 0.5));
		}
		sparks.current?.children.forEach((c, i) => {
			const d = dirs[i]!;
			c.visible = t > POP_AT;
			c.position.set(d.x * st, rise + d.y * st - 4.5 * st * st, d.z * st);
			c.scale.setScalar(Math.max(0, d.s * (1 - st / 0.8)));
			c.quaternion.copy(camera.quaternion);
			c.rotateZ(st * 6 + i);
		});
	});
	return (
		<group position={at} userData={{ noCast: true }}>
			<mesh ref={glow} renderOrder={2} userData={{ noShadow: true }}>
				<planeGeometry args={[1.6, 1.6]} />
				<meshBasicMaterial map={glowTexture()} transparent depthWrite={false} depthTest={false} />
			</mesh>
			<group ref={item}>{node}</group>
			<mesh ref={ring} visible={false} renderOrder={3} userData={{ noShadow: true }}>
				<ringGeometry args={[0.42, 0.5, 40]} />
				<meshBasicMaterial color="#fff6cf" transparent depthWrite={false} depthTest={false} side={DoubleSide} />
			</mesh>
			<group ref={sparks}>
				{dirs.map((_, i) => (
					<mesh key={i} visible={false} geometry={starGeometry()} userData={{ noShadow: true }}>
						<meshBasicMaterial color={SPARKLE_COLOURS[i % SPARKLE_COLOURS.length]} side={DoubleSide} />
					</mesh>
				))}
			</group>
		</group>
	);
}

/** A flat five-point star, shared by every sparkle. */
let star: ShapeGeometry | undefined;
function starGeometry() {
	if (!star) {
		const s = new Shape();
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
			const r = i % 2 ? 0.07 : 0.17;
			if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
			else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
		}
		star = new ShapeGeometry(s);
	}
	return star;
}

/** A soft warm glow, bright in the middle. */
let glow: CanvasTexture | undefined;
function glowTexture() {
	glow ??= canvasTexture(
		64,
		64,
		(ctx) => {
			const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
			g.addColorStop(0, "rgba(255,246,207,0.7)");
			g.addColorStop(0.4, "rgba(255,226,140,0.35)");
			g.addColorStop(1, "rgba(255,226,140,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 64, 64);
		},
		[1, 1],
	);
	return glow;
}

/**
 * Something to tap in a place (a find or a hotspot). Under a mouse it grows a little when pointed at, with a pointer
 * cursor, so it's clear it does something; a hidden find also twinkles now and then (a tiny star winks over it) so
 * a sharp eye can spot it. Neither happens with reduced motion.
 */
function Tappable({
	at,
	onTap,
	twinkle,
	phase = 0,
	children,
}: {
	at: V3;
	onTap: () => void;
	twinkle?: boolean;
	phase?: number;
	children: ReactNode;
}) {
	const g = useRef<Group>(null);
	const wink = useRef<Mesh>(null);
	const over = useRef(false);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const wake = useWake();
	// Picked up while pointed at: don't leave the pointer cursor behind.
	useEffect(
		() => () => {
			if (over.current) document.body.style.cursor = "";
		},
		[],
	);
	useFrame(({ clock, camera }) => {
		const s = g.current?.scale;
		if (s) {
			const want = over.current && !reduced ? 1.18 : 1;
			if (Math.abs(s.x - want) > 0.002) {
				s.setScalar(s.x + (want - s.x) * 0.25);
				wake();
			}
		}
		const w = wink.current;
		if (!w) return;
		// A wink every few seconds: 0.6s of a star growing and shrinking as it turns.
		const t = (clock.elapsedTime + phase) % TWINKLE_EVERY;
		const k = t < 0.6 ? Math.sin((t / 0.6) * Math.PI) : 0;
		w.visible = k > 0;
		if (k > 0) {
			wake("ambient");
			w.quaternion.copy(camera.quaternion);
			w.rotateZ(t * 3);
			w.scale.setScalar(k * 1.1);
		}
	});
	return (
		<group
			position={at}
			// Finds grow, pop and go: they never cast (the sun's shadows are only redrawn when the scene changes).
			userData={{ noCast: true }}
			onClick={(e) => {
				e.stopPropagation();
				onTap();
			}}
			onPointerOver={(e) => {
				if (e.pointerType !== "mouse") return;
				e.stopPropagation();
				over.current = true;
				document.body.style.cursor = "pointer";
				wake();
			}}
			onPointerOut={() => {
				over.current = false;
				document.body.style.cursor = "";
				wake();
			}}
		>
			<group ref={g}>{children}</group>
			{twinkle && !reduced && (
				<mesh
					ref={wink}
					position={[0.12, 0.32, 0.12]}
					visible={false}
					geometry={starGeometry()}
					renderOrder={2}
					userData={{ noShadow: true }}
				>
					<meshBasicMaterial color="#fff6cf" transparent opacity={0.95} depthTest={false} side={DoubleSide} />
				</mesh>
			)}
		</group>
	);
}
const TWINKLE_EVERY = 5;

const PLACES: Record<PlaceId, Place> = { park, petshop, school };

/** Where Roxy stands to pick up each find: on the ground in front of it. */
export function findSpot(place: PlaceId, findId: string): Spot | null {
	const f = PLACES[place].finds[findId];
	return f ? { x: f.at[0], z: f.at[2] + 0.6 } : null;
}
/** Where Roxy starts and what she walks round, for checking every find can be reached. */
export const placeLayout = (place: PlaceId) => ({ area: PLACE_INFO[place].area, start: PLACES[place].start, blocks: PLACES[place].blocks });
export const FIND_SPOTS_FOR = (place: PlaceId) => Object.keys(PLACES[place].finds);
/** What Roxy can walk up to and use here: the finds still hidden, and the hotspots (stand in front of them). */
export function placeTargets(place: PlaceId, found: ReadonlySet<string>): Target[] {
	const def = PLACES[place];
	return [
		...Object.entries(def.finds)
			.filter(([id]) => !found.has(id))
			.map(([id, f]) => ({ kind: "find" as const, id, stand: { x: f.at[0], z: f.at[2] + 0.6 } })),
		...(def.hotspots ?? []).map((h) => ({ kind: "hotspot" as const, id: h.id, stand: { x: h.at[0], z: h.at[2] + 0.6 } })),
	];
}

type Props = {
	place: PlaceId;
	look: Look;
	found: ReadonlySet<string>;
	walkTo: Spot | null;
	onGround: (spot: Spot) => void;
	onFind: (findId: string) => void;
	onHotspot: (id: Hotspot) => void;
	onArrive: (spot: Spot) => void;
	/** Walks Roxy directly (keys or the touch stick). */
	drive?: RefObject<DriveInput>;
	/** Where Roxy is, a few times a second while she moves. */
	onMove?: (spot: Spot) => void;
	label: string;
};

export function PlaceScene({ place, look, found, walkTo, onGround, onFind, onHotspot, onArrive, drive, onMove, label }: Props) {
	const def = PLACES[place];
	const area = PLACE_INFO[place].area;
	const ground = useMemo(() => def.ground(area), [def, area]);
	useEffect(() => () => ground.dispose(), [ground]);
	// Finds picked up while we're here get a moment; the ones found on earlier visits just aren't there.
	const seen = useRef(found);
	const [bursts, setBursts] = useState<string[]>([]);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	useEffect(() => {
		const fresh = [...found].filter((id) => !seen.current.has(id) && def.finds[id]);
		seen.current = found;
		if (fresh.length && !reduced) setBursts((b) => [...b, ...fresh]);
	}, [found, def, reduced]);
	const tap = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		fn();
	};
	return (
		<WorldCanvas area={area} label={label} orbit town>
			<Board area={area} kind={def.board} extend={def.backdrop?.extend} />
			{def.backdrop?.node}
			<mesh position={[area.w / 2, -0.15, area.d / 2]} onClick={(e) => tap(() => onGround({ x: e.point.x, z: e.point.z }))(e)}>
				<boxGeometry args={[area.w, 0.3, area.d]} />
				<meshToonMaterial map={ground} />
			</mesh>
			{def.walls && (
				<>
					<mesh position={[area.w / 2, 1.5, -0.1]}>
						<boxGeometry args={[area.w, 3, 0.2]} />
						<Toon color={def.walls.colour} />
					</mesh>
					<mesh position={[-0.1, 1.5, area.d / 2]}>
						<boxGeometry args={[0.2, 3, area.d]} />
						<Toon color={lighter(def.walls.colour, 0.15)} />
					</mesh>
				</>
			)}
			{def.props}
			{def.hotspots?.map((h) => (
				<Tappable key={h.id} at={h.at} onTap={() => onHotspot(h.id)}>
					{h.node}
				</Tappable>
			))}
			{Object.entries(def.finds).map(
				([id, f], i) =>
					!found.has(id) && (
						<Tappable key={id} at={f.at} onTap={() => onFind(id)} twinkle phase={i * 1.9}>
							{f.node}
						</Tappable>
					),
			)}
			{bursts.map((id) => (
				<FindBurst key={id} at={def.finds[id]!.at} node={def.finds[id]!.node} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
			))}
			<Walkers
				look={look}
				walkTo={walkTo}
				area={area}
				start={def.start}
				blocks={def.blocks}
				onArrive={onArrive}
				drive={drive}
				onMove={onMove}
			/>
		</WorldCanvas>
	);
}
