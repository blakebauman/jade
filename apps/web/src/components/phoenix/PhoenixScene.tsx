import type { Look } from "@jade/core/roxy";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, memo, useMemo, useRef } from "react";
import { Fog, type PerspectiveCamera, Vector3 } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { Diagnostics } from "../roxy/world/diagnostics.tsx";
import { useContextLoss } from "../roxy/world/pace.tsx";
import { softwareGl, Thrift } from "../roxy/world/stage.tsx";
import { Phoenix } from "./bird.tsx";
import { Crowd, guestLooks } from "./crowd.tsx";
import { Beams, DanceFloor } from "./floor.tsx";
import { type Fx, Sparks } from "./fx.tsx";
import { type Beat, BeatContext, conduct, type Live, newBeat } from "./live.ts";
import { RooftopSet } from "./set.tsx";

/**
 * Phoenix DJ Party's scene: a rooftop party at sunset, seen from above the back of the dance floor. It draws every
 * frame while a set is on (it's music: everything moves to the beat), and reads the game and the song clock through
 * `live`, so the screen never re-renders it to move it. About 110 draw calls with the crowd.
 */

export const PhoenixScene = memo(function PhoenixScene({
	live,
	look,
	running,
	label,
}: {
	live: MutableRefObject<Live>;
	look: Look;
	running: boolean;
	label: string;
}) {
	const onCreated = useContextLoss();
	const software = useMemo(softwareGl, []);
	return (
		<Canvas
			flat
			frameloop={running ? "always" : "demand"}
			onCreated={(s) => {
				onCreated(s);
				s.scene.fog = new Fog("#e58a86", 30, 110);
			}}
			dpr={software ? 0.75 : [1, 1.75]}
			camera={{ fov: 38, near: 0.3, far: 400, position: [0, 7, 15] }}
			gl={{ antialias: true }}
			aria-label={label}
			role="img"
		>
			<Thrift />
			{import.meta.env.DEV && <Diagnostics />}
			<Party live={live} look={look} running={running} />
		</Canvas>
	);
});

/** Frames the party: the stage and the floor fill the width, with room at the bottom for the pads. */
function CameraRig() {
	const camera = useThree((s) => s.camera) as PerspectiveCamera;
	const size = useThree((s) => s.size);
	const look = useMemo(() => new Vector3(0, 2.7, -1.8), []);
	useFrame(() => {
		const aspect = size.width / Math.max(1, size.height);
		// How much of the roof must be seen across: the whole stage and floor on a wide screen, the floor and the booth
		// on an upright phone (the sides crop).
		const half = aspect < 1 ? 5.4 : 8.8;
		const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect);
		const dist = Math.max(14.5, half / Math.tan(hfov / 2));
		const dir = new Vector3(0, 0.32, 1).normalize();
		camera.position.copy(look).addScaledVector(dir, dist);
		// Upright screens look a little lower, so the stage sits mid-screen above the pads.
		camera.lookAt(look.x, look.y - (aspect < 1 ? 0.6 : 0), look.z);
	});
	return null;
}

const FIREWORKS = [
	["#ffd166", "#ff8a3d", "#ffffff"],
	["#ff4f9a", "#ffd1e6", "#ffffff"],
	["#8a5cff", "#c8b6ff", "#ffffff"],
	["#22c5b5", "#bff7ef", "#ffffff"],
];

function Party({ live, look, running }: { live: MutableRefObject<Live>; look: Look; running: boolean }) {
	const beat = useRef<Beat>(newBeat());
	const fx = useRef<Fx>(null);
	const reduced = useMemo(() => prefersReducedMotion(), []);
	const guests = useMemo(guestLooks, []);
	const game = useMemo(
		() => ({
			get current() {
				return live.current.game;
			},
		}),
		[live],
	) as MutableRefObject<Live["game"]>;
	/** Scene time until which the floor and the DJ cheer. */
	const cheer = useRef(0);
	const show = useRef({ nextFirework: 0, last: 0 });

	// The conductor runs first each frame, so everything after reads this frame's beat.
	useFrame((state, dt) => {
		const l = live.current;
		const t = state.clock.elapsedTime;
		const step = l.frozen || !running ? 0 : Math.min(dt, 0.1);
		conduct(beat.current, l, t, step, reduced);
		const b = beat.current;
		const f = fx.current;
		// Moments from the screen.
		for (const m of l.moments.splice(0)) {
			if (m === "rise") {
				cheer.current = t + 2.5;
				show.current.nextFirework = t + 0.6;
			} else if (m === "streak" || m === "match") {
				cheer.current = t + b.spb * 4;
				// Confetti cannons either side of the stage.
				for (const s of [-1, 1])
					f?.spray([s * 3.5, 3.4, -5.2], [-s * 1.6, 6.5, 3.2], ["#ff4f9a", "#ffd166", "#8a5cff", "#22c5b5", "#ffffff"], 50);
			} else if (m === "end") {
				cheer.current = t + 4;
				for (let k = 0; k < 4; k++) {
					const p: [number, number, number] = [-8 + k * 5.3, 13 + (k % 2) * 3, -24];
					f?.burst(p, FIREWORKS[k % FIREWORKS.length]!, 90, 7, { gravity: 1.2, life: 2, size: 0.9 });
				}
			} else if (m === "pick") {
				f?.burst([0, 2.3, -4.8], ["#ffd166", "#ff8a3d"], 24, 2.5, { gravity: 1, life: 0.8, size: 0.25 });
			}
		}
		// Fireworks over the city on the beats of a Fire Drop.
		if (b.rise && f && !reduced && t >= show.current.nextFirework) {
			show.current.nextFirework = t + b.spb * 2;
			const k = Math.floor(Math.random() * FIREWORKS.length);
			f.burst([(Math.random() - 0.5) * 30, 12 + Math.random() * 8, -22 - Math.random() * 14], FIREWORKS[k]!, 110, 7, {
				gravity: 1.2,
				life: 2,
				size: 0.9,
			});
		}
	}, -1);

	return (
		<BeatContext.Provider value={beat}>
			<CameraRig />
			{/* Sunset light: a warm key from the front, the sun's orange rim from behind, and a pink-and-violet fill. */}
			<hemisphereLight args={["#ffd9c2", "#6b4a8a", 1.5]} />
			<directionalLight position={[4, 12, 12]} intensity={1.5} color="#fff1e0" />
			<directionalLight position={[-8, 4, -20]} intensity={1.1} color="#ff9a5a" />
			<RooftopSet />
			<DanceFloor />
			<Beams />
			<Crowd look={look} guests={guests} game={game} cheer={cheer} reduced={reduced} />
			<Phoenix fx={fx} reduced={reduced} />
			<Sparks ref={fx} reduced={reduced} />
		</BeatContext.Provider>
	);
}
