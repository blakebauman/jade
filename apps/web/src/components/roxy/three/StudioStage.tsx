import type { Look } from "@jade/core/roxy";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Group, PerspectiveCamera } from "three";
import { Diagnostics } from "../world/diagnostics.tsx";
import { toonGradient } from "../world/Furniture.tsx";
import { Pace, useContextLoss, useWake } from "../world/pace.tsx";
import { figureTexture } from "../world/texture.ts";
import { PetModel, RoxyModel } from "./RoxyModel.tsx";

/**
 * The studio in 3D: Roxy on a round stage in front of her chosen backdrop, with her pet beside her. Drag (or swipe)
 * sideways to turn her around; she eases back to face you when left alone.
 */
export function StudioStage({ look, label }: { look: Look; label: string }) {
	// One finger turns her; a second finger on the screen is ignored rather than making her jump.
	const turn = useRef({ angle: 0, dragging: false, lastX: 0, idleAt: 0, pointer: -1 });
	const onCreated = useContextLoss();
	const stop = () => {
		turn.current.dragging = false;
		turn.current.pointer = -1;
		turn.current.idleAt = performance.now();
	};
	return (
		<Canvas
			flat
			frameloop="demand"
			onCreated={onCreated}
			dpr={[1, 2]}
			camera={{ position: [0, 1.7, 7.2], fov: 30 }}
			gl={{ alpha: true, antialias: true }}
			aria-label={label}
			role="img"
			style={{ touchAction: "none" }}
			onPointerDown={(e) => {
				if (turn.current.dragging) return;
				turn.current.dragging = true;
				turn.current.pointer = e.pointerId;
				turn.current.lastX = e.clientX;
				(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
			}}
			onPointerMove={(e) => {
				const t = turn.current;
				if (!t.dragging || e.pointerId !== t.pointer) return;
				t.angle += (e.clientX - t.lastX) * 0.012;
				t.lastX = e.clientX;
				t.idleAt = performance.now();
			}}
			onPointerUp={(e) => {
				if (e.pointerId === turn.current.pointer) stop();
			}}
			onPointerCancel={(e) => {
				if (e.pointerId === turn.current.pointer) stop();
			}}
			onPointerLeave={(e) => {
				if (e.pointerId === turn.current.pointer) stop();
			}}
		>
			<Pace>
				<Aim />
				{import.meta.env.DEV && <Diagnostics />}
				<hemisphereLight args={["#fffaf0", "#d8cbb8", 2.2]} />
				<directionalLight position={[3, 6, 5]} intensity={1.3} />
				{/* A cool light from behind and above, catching her outline so she stands off the backdrop. */}
				<directionalLight position={[-2.5, 4, -5]} intensity={0.9} color="#e6f0ff" />
				<Backdrop look={look} />
				<Plinth />
				<Contact r={0.62} />
				<Turntable turn={turn}>
					<RoxyModel look={look} />
				</Turntable>
				{look.slots.pet && (
					<group position={[1.25, 0, 0.5]} rotation={[0, -0.5, 0]}>
						<Contact r={0.36} />
						<PetModel look={look} />
					</group>
				)}
			</Pace>
		</Canvas>
	);
}

/**
 * How far back the camera stands. Narrow screens (a phone held upright) step back so Roxy and her pet both fit;
 * squarer ones (an upright iPad, where the header wraps onto a second row over the scene) step back a little so
 * the header doesn't cover her hair.
 */
const cameraZ = (size: { width: number; height: number }) => {
	const aspect = size.width / size.height;
	return aspect < 0.8 ? 11.5 : aspect < 1.4 ? 8.8 : 7.8;
};
/**
 * How far the camera drops (keeping its angle), lifting Roxy up the frame. On an upright phone the action bar sits
 * over the bottom of the scene, so she stands above it rather than behind it.
 */
const cameraDrop = (size: { width: number; height: number }) => (size.width / size.height < 0.8 ? 0.75 : 0);
const CAMERA_Y = 1.7;
const AIM_Y = 1.4;

function Aim() {
	const { camera, size } = useThree();
	// A layout effect, so the camera is in place before the first frame is drawn.
	useLayoutEffect(() => {
		const drop = cameraDrop(size);
		camera.position.set(0, CAMERA_Y - drop, cameraZ(size));
		camera.lookAt(0, AIM_Y - drop, 0);
	}, [camera, size]);
	return null;
}

/** Plain toon for the stage (Roxy's own material has a rim of light the stage shouldn't). */
const Mat = ({ c }: { c: string }) => <meshToonMaterial color={c} gradientMap={toonGradient()} />;

/** The stage: a cream disc with a rounded lip, on a slightly wider, darker plinth. */
function Plinth() {
	return (
		<group>
			<mesh position={[0, -0.05, 0]}>
				<cylinderGeometry args={[1.9, 1.9, 0.1, 64]} />
				<Mat c="#f4ead8" />
			</mesh>
			<mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[1.9, 0.05, 10, 64]} />
				<Mat c="#e6d5b8" />
			</mesh>
			<mesh position={[0, -0.2, 0]}>
				<cylinderGeometry args={[2.02, 2.1, 0.2, 64]} />
				<Mat c="#d9c4a0" />
			</mesh>
		</group>
	);
}

/** A soft shadow where feet meet the stage: a few rings, darkest in the middle. */
function Contact({ r }: { r: number }) {
	return (
		<group position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
			{[1, 0.72, 0.45].map((k, i) => (
				<mesh key={k} position={[0, 0, i * 0.001]}>
					<circleGeometry args={[r * k, 32]} />
					<meshBasicMaterial color="#5a4630" transparent opacity={0.09} depthWrite={false} />
				</mesh>
			))}
		</group>
	);
}

function Turntable({
	turn,
	children,
}: {
	turn: React.MutableRefObject<{ angle: number; dragging: boolean; idleAt: number }>;
	children: React.ReactNode;
}) {
	const g = useRef<Group>(null);
	const wake = useWake();
	useFrame((_, dt) => {
		const t = turn.current;
		if (t.dragging) wake();
		// After a few seconds alone, ease back round to face the front.
		if (!t.dragging && performance.now() - t.idleAt > 3000) {
			const target = Math.round(t.angle / (Math.PI * 2)) * Math.PI * 2;
			if (Math.abs(target - t.angle) > 0.001) wake();
			t.angle += (target - t.angle) * Math.min(1, dt * 2);
		}
		if (g.current) g.current.rotation.y = t.angle;
	});
	return <group ref={g}>{children}</group>;
}

const BACKDROP_Z = -4;

/** The look's stage art as a painted backdrop, filling the view like a photo (cropped, never stretched). */
function Backdrop({ look }: { look: Look }) {
	const key = look.slots.background?.item ?? "none";
	// Keyed on the backdrop alone: nothing else in the look changes it.
	const bg = useMemo(() => figureTexture(look, { x: 0, y: 0, w: 400, h: 640 }, { only: ["background"] }), [key]);
	useEffect(() => () => bg.texture.dispose(), [bg]);
	const { camera, size } = useThree();
	// Sized from where Aim puts the camera for this screen, not where it is right now (Aim moves it after render).
	const camZ = cameraZ(size);
	const drop = cameraDrop(size);
	const dist = camZ - BACKDROP_Z;
	const h = 2 * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360) * dist * 1.12;
	const w = h * (size.width / size.height);
	const art = bg.aspect;
	const view = w / h;
	// Crop the portrait art to the screen's shape, keeping its ground in view.
	if (view > art) {
		bg.texture.repeat.set(1, art / view);
		bg.texture.offset.set(0, (1 - art / view) * 0.2);
	} else {
		bg.texture.repeat.set(view / art, 1);
		bg.texture.offset.set((1 - view / art) / 2, 0);
	}
	return (
		<mesh position={[0, CAMERA_Y - drop + (AIM_Y - CAMERA_Y) * (dist / camZ), BACKDROP_Z]}>
			<planeGeometry args={[w, h]} />
			<meshBasicMaterial map={bg.texture} />
		</mesh>
	);
}
