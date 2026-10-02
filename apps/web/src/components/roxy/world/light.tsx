import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box3, type DirectionalLight, type Mesh, Object3D, Vector3 } from "three";

/**
 * The town's light: a low warm sun from over the viewer's right shoulder casting soft shadows back and to the left,
 * a sky-and-ground fill so nothing goes dark, and a cool rim from behind that picks out edges against the backdrop.
 * At Night (the album's Night) the sun becomes a pale moon and lamps and windows come on (places ask `useNight`).
 * Colour stays untone-mapped (the canvas is `flat`) so palette colours read as the same paint everywhere.
 */

/** Whether the album is in Night, live: Night is the default page, Day is `data-theme="day"`. */
export function useNight() {
	const read = () => typeof document !== "undefined" && document.documentElement.dataset.theme !== "day";
	const [night, setNight] = useState(read);
	useEffect(() => {
		const root = document.documentElement;
		const o = new MutationObserver(() => setNight(root.dataset.theme !== "day"));
		o.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
		return () => o.disconnect();
	}, []);
	return night;
}

const RIG = {
	day: { sky: "#fff7ea", ground: "#cdbf9f", fill: 1.4, sun: "#fff0d2", key: 2.1, rim: "#cfe6ff", rimI: 0.55 },
	night: { sky: "#5f70c2", ground: "#262241", fill: 0.62, sun: "#aebfff", key: 0.6, rim: "#9fc2ff", rimI: 0.7 },
};

/** Where the sun sits relative to the middle of a place: right and in front, high (shadows fall back-left). */
const SUN = [7, 13, 6] as const;

export function TownLights({ area }: { area: { w: number; d: number } }) {
	const night = useNight();
	const rig = night ? RIG.night : RIG.day;
	const key = useRef<DirectionalLight>(null);
	const target = useRef(new Object3D());
	const cx = area.w / 2;
	const cz = area.d / 2;
	// The shadow camera covers the whole place, with a little room for the backdrop.
	const reach = Math.max(area.w, area.d) * 0.85 + 3;
	useLayoutEffect(() => {
		const l = key.current;
		if (!l) return;
		target.current.position.set(cx, 0, cz);
		l.target = target.current;
		const cam = l.shadow.camera;
		cam.left = -reach;
		cam.right = reach;
		cam.top = reach;
		cam.bottom = -reach;
		cam.near = 1;
		cam.far = 60;
		cam.updateProjectionMatrix();
		l.shadow.mapSize.set(2048, 2048);
		l.shadow.bias = -0.0004;
		l.shadow.normalBias = 0.03;
		l.shadow.radius = 4;
		l.shadow.needsUpdate = true;
	}, [cx, cz, reach]);
	return (
		<>
			<primitive object={target.current} />
			<hemisphereLight args={[rig.sky, rig.ground, rig.fill]} />
			<directionalLight ref={key} position={[cx + SUN[0], SUN[1], cz + SUN[2]]} color={rig.sun} intensity={rig.key} castShadow />
			<directionalLight position={[cx - 9, 6, cz - 10]} color={rig.rim} intensity={rig.rimI} />
			<ShadowFlags />
		</>
	);
}

/**
 * Turns shadows on for whatever's in the scene, including things that arrive later (a generated model loading, Roxy
 * changing clothes): every solid mesh casts and receives. See-through things, flat pictures (basic material) and
 * anything marked `userData.noShadow` are left out, so the soft round contact shadows don't cast shadows of their own.
 * A group marked `userData.noCast` receives but doesn't cast (scenery whose shadow would fall where no one sees it), and
 * nor does anything too small or flat to show one (`unseen`).
 */
/**
 * Things whose shadow no one would see: smaller than this across (in squares), like a butterfly, a duckling or a find,
 * or flatter than `FLAT` (the ground, a pond, a rug), which lie on what they'd shadow.
 */
const SPECK = 0.6;
const FLAT = 0.1;
const box = new Box3();
const size = new Vector3();
function unseen(m: Mesh) {
	if ((m as { isInstancedMesh?: boolean }).isInstancedMesh) return false;
	box.setFromObject(m).getSize(size);
	return size.y < FLAT || Math.max(size.x, size.y, size.z) < SPECK;
}

function ShadowFlags() {
	const scene = useThree((s) => s.scene);
	const gl = useThree((s) => s.gl);
	const last = useRef(-1);
	const casting = useRef(0);
	// Nothing that casts moves (Roxy and the pet don't cast; butterflies and finds are specks), so the sun's shadow map
	// is drawn only when something new casts or receives, not every frame.
	useLayoutEffect(() => {
		gl.shadowMap.autoUpdate = false;
		gl.shadowMap.needsUpdate = true;
		return () => {
			gl.shadowMap.autoUpdate = true;
		};
	}, [gl]);
	useFrame(({ clock }) => {
		const t = clock.elapsedTime;
		// Often while the place is still arriving (generated models loading), then now and then (a change of clothes).
		if (t - last.current < (t < 6 ? 0.5 : 2)) return;
		last.current = t;
		let changed = false;
		let casters = 0;
		const walk = (o: Object3D, noCast: boolean) => {
			// Hidden things (the shapes `Static` has baked) are skipped, children and all.
			if (!o.visible) return;
			const quiet = noCast || !!o.userData.noCast;
			const m = o as Mesh;
			if (m.isMesh && !m.userData.shadowed) {
				m.userData.shadowed = true;
				changed = true;
				const mat = Array.isArray(m.material) ? m.material[0] : m.material;
				if (mat && !mat.transparent && !m.userData.noShadow && !(mat as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) {
					m.castShadow = !quiet && !unseen(m);
					m.receiveShadow = true;
				}
			}
			if (m.isMesh && m.castShadow) casters++;
			for (const c of o.children) walk(c, quiet);
		};
		walk(scene, false);
		// Something new, or something gone (a generated model replacing its stand-in): draw the shadows again.
		if (changed || casters !== casting.current) gl.shadowMap.needsUpdate = true;
		casting.current = casters;
	});
	return null;
}
