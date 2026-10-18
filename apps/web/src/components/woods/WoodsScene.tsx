import {
	B,
	blockInfo,
	CYCLE_S,
	canMine,
	cellOf,
	DAY_S,
	deerAt,
	FUEL_LOW,
	FUEL_MAX,
	fireRadius,
	inBounds,
	indexOf,
	isPlant,
	MOVE_HZ,
	phaseAt,
	spawnPoint,
} from "@jade/core/woods";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import {
	AmbientLight,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	DirectionalLight,
	EdgesGeometry,
	Fog,
	Group,
	HemisphereLight,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	PCFSoftShadowMap,
	type PerspectiveCamera,
	PointLight,
	Points,
	PointsMaterial,
	Raycaster,
	Vector2,
	Vector3,
} from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { useContextLoss } from "../roxy/world/pace.tsx";
import { atlasTexture } from "./atlas.ts";
import { camp, flicker } from "./camp.ts";
import type { Controls } from "./controls.ts";
import { Held } from "./held.ts";
import { type Buffers, type ColumnMesh, tileUv } from "./mesher.ts";
import type { FromMesher, ToMesher } from "./mesher.worker.ts";
import { animal, deer, deerWalk, emoteTexture, type FigureModel, figure, swing } from "./models.ts";
import { EYE, HALF, lost, newBody, step, TALL } from "./physics.ts";
import { raycast } from "./raycast.ts";
import { Sky as SkyDome } from "./sky.ts";
import * as sound from "./sound.ts";
import { Effects } from "./vfx.ts";
import type { IslandState } from "./world.ts";

/**
 * Campfire Woods in 3D: the island's columns (meshed in a worker), the sky and its light through the day and night,
 * the campfire, everyone else's figures, the lost animals and the ones brought home, the Night Deer, and the kid's
 * own eyes: walking, looking, aiming, mining and building.
 */

type Props = { world: IslandState; controls: Controls; running: boolean; label: string };

export const WoodsScene = memo(function WoodsScene({ world, controls, running, label }: Props) {
	const onCreated = useContextLoss();
	const software = useMemo(() => /swiftshader|llvmpipe/i.test(gpuName()), []);
	const quality = useMemo<Quality>(() => {
		if (software) return "low";
		const phone =
			typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
		return phone ? "medium" : "high";
	}, [software]);
	return (
		<Canvas
			flat
			frameloop={running ? "always" : "demand"}
			dpr={software ? 0.75 : [1, 1.5]}
			gl={{ antialias: false, powerPreference: "high-performance" }}
			camera={{ fov: 72, near: 0.05, far: 140 }}
			onCreated={onCreated}
			aria-label={label}
			role="img"
		>
			<Island world={world} controls={controls} running={running} quality={quality} />
		</Canvas>
	);
});

function gpuName() {
	try {
		const gl = document.createElement("canvas").getContext("webgl");
		const ext = gl?.getExtension("WEBGL_debug_renderer_info");
		return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
	} catch {
		return "";
	}
}

function Island({ world, controls, running, quality }: Omit<Props, "label"> & { quality: Quality }) {
	const { scene, gl, invalidate } = useThree();
	// Sparks, chips, embers, smoke, stars and fireflies: one pooled set for the whole island.
	const fx = useMemo(() => new Effects({ reducedMotion: prefersReducedMotion(), mobile: quality !== "high" }), [quality]);
	useEffect(() => {
		scene.add(fx.group);
		return () => {
			scene.remove(fx.group);
			fx.dispose();
		};
	}, [scene, fx]);
	useEffect(
		() =>
			world.listen((e) => {
				if (e.t === "fed") fx.sparks(world.fire, Math.min(1, e.added / 45));
				else if (e.t === "snuffed") fx.smokePuff(e.at);
				else if (e.t === "home") {
					const p = e.mine && controls.body ? controls.body.p : e.at;
					fx.stars([Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])]);
				}
			}),
		[world, fx, controls],
	);
	useFrame(({ camera, clock }, dt) => {
		fx.update(dt, camera, clock.elapsedTime);
		waterTime.value = clock.elapsedTime;
		const { sun } = phaseAt(world.elapsed());
		const p = controls.body?.p;
		fx.setFireflies(p ? Math.max(0, Math.min(1, (0.45 - sun) * 2.5)) : 0, p ?? [0, 0, 0]);
	});
	useEffect(() => {
		const report = () => {
			if (!import.meta.env.DEV) return;
			(window as { __THREE_GAME_DIAGNOSTICS__?: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
				renderer: { calls: gl.info.render.calls, triangles: gl.info.render.triangles },
				columns: scene.getObjectByName("terrain")?.children.length ?? 0,
			};
			(window as { __woodsScene?: unknown }).__woodsScene = scene;
		};
		const timer = setInterval(report, 500);
		return () => clearInterval(timer);
	}, [gl, scene]);
	useEffect(() => {
		const off = world.listen(() => invalidate());
		return () => {
			off();
		};
	}, [world, invalidate]);
	return (
		<>
			<Sky world={world} quality={quality} />
			<Terrain world={world} />
			<Camp world={world} fx={fx} />
			<Others world={world} />
			<Animals world={world} controls={controls} />
			<NightDeer world={world} />
			<Player world={world} controls={controls} running={running} fx={fx} />
		</>
	);
}

// ── The island ──

function Terrain({ world }: { world: IslandState }) {
	const { invalidate } = useThree();
	const group = useMemo(() => {
		const g = new Group();
		g.name = "terrain";
		return g;
	}, []);
	const materials = useMemo(() => {
		const map = atlasTexture();
		return {
			solid: new MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5 }),
			clear: waterShimmer(new MeshLambertMaterial({ map, vertexColors: true, transparent: true, depthWrite: false })),
		};
	}, []);

	useEffect(() => {
		const worker = new Worker(new URL("./mesher.worker.ts", import.meta.url), { type: "module" });
		const meshes = new Map<number, { solid: Mesh; clear: Mesh }>();
		const geometry = (b: Buffers) => {
			const g = new BufferGeometry();
			g.setAttribute("position", new BufferAttribute(b.position, 3));
			g.setAttribute("normal", new BufferAttribute(b.normal, 3));
			g.setAttribute("uv", new BufferAttribute(b.uv, 2));
			g.setAttribute("color", new BufferAttribute(b.color, 3));
			g.setIndex(new BufferAttribute(b.index, 1));
			g.computeBoundingSphere();
			return g;
		};
		const put = (m: ColumnMesh) => {
			let pair = meshes.get(m.key);
			if (!pair) {
				pair = { solid: new Mesh(undefined, materials.solid), clear: new Mesh(undefined, materials.clear) };
				pair.clear.renderOrder = 1;
				pair.solid.castShadow = pair.solid.receiveShadow = true;
				pair.clear.receiveShadow = true;
				meshes.set(m.key, pair);
				group.add(pair.solid, pair.clear);
			}
			pair.solid.geometry.dispose();
			pair.clear.geometry.dispose();
			pair.solid.geometry = geometry(m.solid);
			pair.clear.geometry = geometry(m.clear);
			pair.solid.visible = m.solid.index.length > 0;
			pair.clear.visible = m.clear.index.length > 0;
		};
		worker.onmessage = (e: MessageEvent<FromMesher>) => {
			for (const m of e.data.meshes) put(m);
			invalidate();
		};
		const send = (m: ToMesher, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
		world.onIsland = (data) => send({ t: "load", data: data.slice() });
		world.onEdits = (edits) => send({ t: "edits", edits: edits.slice() });
		if (world.volume) world.onIsland(world.volume.data);
		return () => {
			world.onIsland = null;
			world.onEdits = null;
			worker.terminate();
			for (const { solid, clear } of meshes.values()) {
				solid.geometry.dispose();
				clear.geometry.dispose();
			}
			group.clear();
		};
	}, [world, group, materials, invalidate]);

	return <primitive object={group} />;
}

/** Water's time: the shimmer below reads it. */
const waterTime = { value: 0 };

/**
 * Still water that isn't flat: on water's own tile, the colour ripples in slow crossing waves by where it is in the
 * world, with the odd bright glint. Glass, which shares the material, is untouched.
 */
function waterShimmer(m: MeshLambertMaterial) {
	const [u0, v0, u1, v1] = tileUv("water");
	m.onBeforeCompile = (shader) => {
		shader.uniforms.waterTime = waterTime;
		shader.uniforms.waterRect = { value: [u0, v0, u1, v1] };
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
			.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", "#include <common>\nvarying vec3 vWorld;\nuniform float waterTime;\nuniform vec4 waterRect;")
			.replace(
				"#include <map_fragment>",
				`#include <map_fragment>
				if (vMapUv.x > waterRect.x && vMapUv.x < waterRect.z && vMapUv.y > waterRect.y && vMapUv.y < waterRect.w) {
					float w = sin(vWorld.x * 1.3 + waterTime * 1.1) * sin(vWorld.z * 1.1 - waterTime * 0.9);
					float g = step(0.985, sin(vWorld.x * 3.7 + waterTime * 2.0) * sin(vWorld.z * 3.1 + waterTime * 1.7));
					diffuseColor.rgb *= 0.92 + 0.12 * w;
					diffuseColor.rgb += vec3(0.35, 0.4, 0.45) * g;
				}`,
			);
	};
	return m;
}

// ── Sky and light ──

function Sky({ world, quality }: { world: IslandState; quality: Quality }) {
	const { scene, gl } = useThree();
	const rig = useMemo(() => {
		const ambient = new AmbientLight("#ffffff", 0.6);
		const hemi = new HemisphereLight("#d6ecff", "#6b5536", 0.5);
		// One light is the sun by day and the moon by night, and it casts the island's shadows.
		const sun = new DirectionalLight("#fff1d6", 1);
		const shadows = quality !== "low";
		sun.castShadow = shadows;
		if (shadows) {
			const size = quality === "high" ? 2048 : 1024;
			sun.shadow.mapSize.set(size, size);
			const cam = sun.shadow.camera;
			cam.left = cam.bottom = -SHADOW_SPAN;
			cam.right = cam.top = SHADOW_SPAN;
			cam.near = 1;
			cam.far = 140;
			sun.shadow.bias = -0.0006;
			sun.shadow.normalBias = 0.04;
		}
		const sky = new SkyDome();
		const stars = starField();
		return { ambient, hemi, sun, sky, stars, shadows };
	}, [quality]);
	useEffect(() => {
		gl.shadowMap.enabled = rig.shadows;
		gl.shadowMap.type = PCFSoftShadowMap;
		scene.fog = new Fog(new Color(), 24, 70);
		scene.background = null;
		scene.add(rig.ambient, rig.hemi, rig.sun, rig.sun.target, rig.sky.group, rig.stars);
		return () => {
			scene.remove(rig.ambient, rig.hemi, rig.sun, rig.sun.target, rig.sky.group, rig.stars);
			scene.fog = null;
		};
	}, [scene, gl, rig]);
	const dir = useMemo(() => new Vector3(), []);
	useFrame(({ camera, clock }) => {
		const p = phaseAt(world.elapsed());
		const { sun } = p;
		const night = p.phase === "night";
		rig.sky.update(camera, sun, p.progress, night, clock.elapsedTime);
		const fog = scene.fog as Fog;
		fog.color.copy(rig.sky.colours.horizon);
		fog.near = 14 + 12 * sun;
		fog.far = 38 + 36 * sun;
		rig.ambient.intensity = 0.2 + 0.42 * sun;
		rig.hemi.intensity = 0.14 + 0.5 * sun;
		// The key light: warm sun by day (low and golden near dusk), a cool soft moon by night.
		const a = Math.PI * (0.12 + 0.76 * p.progress);
		dir.set(Math.cos(a) * 0.8, Math.max(0.35, Math.sin(a)), 0.45).normalize();
		if (night) {
			rig.sun.color.set("#9fb6ff");
			rig.sun.intensity = 0.28;
		} else {
			rig.sun.color.setRGB(1, 0.86 + 0.12 * sun, 0.7 + 0.25 * sun);
			rig.sun.intensity = 1.25 * Math.max(0, sun - 0.2);
		}
		// Shadows follow the kid, snapped to the shadow map's texels so they don't shimmer while walking.
		const step = (SHADOW_SPAN * 2) / rig.sun.shadow.mapSize.x;
		const tx = Math.round(camera.position.x / step) * step;
		const tz = Math.round(camera.position.z / step) * step;
		rig.sun.target.position.set(tx, camera.position.y - 2, tz);
		rig.sun.position.set(tx + dir.x * 60, camera.position.y - 2 + dir.y * 60, tz + dir.z * 60);
		(rig.stars.material as PointsMaterial).opacity = Math.max(0, 1 - sun * 2.5);
		rig.stars.position.copy(camera.position);
	});
	return null;
}

/** Half the width of the area round the kid that gets real shadows, in blocks. */
const SHADOW_SPAN = 30;

/** How much the device can draw: shadows and resolution follow it. */
export type Quality = "high" | "medium" | "low";

function starField() {
	const pts: number[] = [];
	for (let k = 0; k < 400; k++) {
		const a = Math.random() * Math.PI * 2;
		const up = 0.15 + Math.random() * 0.85;
		const r = 110;
		pts.push(Math.cos(a) * r * Math.sqrt(1 - up * up), up * r, Math.sin(a) * r * Math.sqrt(1 - up * up));
	}
	const g = new BufferGeometry();
	g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
	const p = new Points(g, new PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false, transparent: true, fog: false }));
	p.renderOrder = -9;
	return p;
}

// ── The camp ──

function Camp({ world, fx }: { world: IslandState; fx: Effects }) {
	// Built in one go: three.js moves an object into whichever group adds it last, so pieces made in separate memos
	// (which React may run twice) could end up in a group that's thrown away.
	const { kit, light, torches, group } = useMemo(() => {
		const kit = camp();
		const light = new PointLight("#ffae55", 2, 18, 1.2);
		/** Torches nearest the player, each with a small light (the rest just glow on their own). */
		const torches = Array.from({ length: TORCH_LIGHTS }, () => new PointLight("#ffc273", 0, 9, 1.4));
		const group = new Group();
		group.add(kit.group, light, ...torches);
		return { kit, light, torches, group };
	}, []);
	const scan = useRef({ at: 0, list: [] as [number, number, number][] });

	useFrame(({ clock, camera }) => {
		const [fx0, fy, fz] = world.fire;
		kit.group.position.set(fx0 + 0.5, fy, fz + 0.5);
		const fuel = world.clock.fuel;
		const strength = fuel <= 0 ? 0 : 0.25 + 0.75 * Math.min(1, fuel / (FUEL_MAX * 0.6));
		const t = clock.elapsedTime;
		flicker(kit.fire, t, strength);
		fx.setFire(world.fire, fuel <= 0 ? 0 : strength);
		light.position.set(fx0 + 0.5, fy + 1.1, fz + 0.5);
		light.intensity = strength > 0 ? (2.2 + 0.45 * Math.sin(t * 11) + 0.3 * Math.sin(t * 17.3)) * (0.4 + strength) : 0;
		light.distance = fireRadius(fuel) * 2.2 + 2;

		// Torches: the nearest of those the island knows about.
		const now = performance.now();
		if (now - scan.current.at > 500) {
			scan.current.at = now;
			scan.current.list = nearest(world.torches, camera.position, 24);
		}
		const { sun } = phaseAt(world.elapsed());
		torches.forEach((l, k) => {
			const c = scan.current.list[k];
			l.intensity = c ? 1.6 * (1.2 - sun) : 0;
			if (c) l.position.set(c[0] + 0.5, c[1] + 0.7, c[2] + 0.5);
		});
		(kit.lantern.material as MeshBasicMaterial).color.setRGB(1, 0.78 + 0.1 * (1 - sun), 0.42);
	});
	return <primitive object={group} />;
}

function nearest(torches: Set<number>, at: Vector3, r: number): [number, number, number][] {
	const out: { c: [number, number, number]; d: number }[] = [];
	for (const i of torches) {
		const c = cellOf(i);
		const d = Math.hypot(c[0] - at.x, c[1] - at.y, c[2] - at.z);
		if (d <= r) out.push({ c, d });
	}
	return out.sort((a, b) => a.d - b.d).map((o) => o.c);
}

// ── Everyone else ──

function Others({ world }: { world: IslandState }) {
	const group = useMemo(() => new Group(), []);
	const models = useRef(new Map<number, { m: FigureModel; key: string }>());
	useFrame(({ clock }, dt) => {
		const seen = new Set<number>();
		for (const o of world.others.values()) {
			seen.add(o.seat);
			const key = `${o.label}|${o.colour}`;
			let entry = models.current.get(o.seat);
			if (!entry || entry.key !== key) {
				if (entry) group.remove(entry.m.group);
				entry = { m: figure(o.colour, o.label), key };
				models.current.set(o.seat, entry);
				group.add(entry.m.group);
			}
			// Ease toward the last move heard.
			const k = Math.min(1, dt * 12);
			const before = [...o.shown];
			for (const a of [0, 1, 2] as const) o.shown[a] += (o.p[a] - o.shown[a]) * k;
			const speed = Math.hypot(o.shown[0] - before[0]!, o.shown[2] - before[2]!) / Math.max(dt, 1e-3);
			entry.m.group.position.set(...o.shown);
			entry.m.group.rotation.y = o.yaw;
			swing(entry.m, clock.elapsedTime, Math.min(1, speed / 3));
			showEmote(entry.m, o.emote);
		}
		for (const [seat, entry] of models.current) {
			if (seen.has(seat)) continue;
			group.remove(entry.m.group);
			models.current.delete(seat);
		}
	});
	return <primitive object={group} />;
}

function showEmote(m: FigureModel, emote: { e: string; until: number } | null) {
	const on = !!emote && emote.until > performance.now();
	m.bubble.visible = on;
	if (on) {
		const mat = m.bubble.material;
		const tex = emoteTexture(emote!.e as Parameters<typeof emoteTexture>[0]);
		if (mat.map !== tex) {
			mat.map = tex;
			mat.needsUpdate = true;
		}
	}
}

// ── Animals: tonight's lost ones, and the ones living at camp ──

function Animals({ world, controls }: { world: IslandState; controls: Controls }) {
	const group = useMemo(() => new Group(), []);
	const lost = useRef(new Map<string, Group>());
	const home = useRef<Group[]>([]);
	useFrame(({ clock }) => {
		const t = clock.elapsedTime;
		const seen = new Set<string>();
		for (const a of world.lost) {
			seen.add(a.id);
			let g = lost.current.get(a.id);
			if (!g) {
				g = animal(a.animal);
				lost.current.set(a.id, g);
				group.add(g);
			}
			const leader =
				a.follows === null ? null : a.follows === world.seat ? (controls.body?.p ?? null) : (world.others.get(a.follows)?.shown ?? null);
			if (leader) {
				// Trot a step behind whoever found it.
				const dx = leader[0] - g.position.x;
				const dz = leader[2] - g.position.z;
				const d = Math.hypot(dx, dz);
				if (d > 1.4) {
					g.position.x += (dx / d) * (d - 1.4) * 0.15;
					g.position.z += (dz / d) * (d - 1.4) * 0.15;
					g.rotation.y = Math.atan2(-dx, -dz);
				}
				g.position.y += (leader[1] - g.position.y) * 0.2;
			} else g.position.set(...a.at);
			g.children[0]!.position.y = Math.abs(Math.sin(t * (leader ? 8 : 2))) * (leader ? 0.12 : 0.04);
			const halo = g.getObjectByName("halo");
			if (halo) halo.visible = a.follows === null;
		}
		for (const [id, g] of lost.current) {
			if (seen.has(id)) continue;
			group.remove(g);
			lost.current.delete(id);
		}
		// Those at home amble round the fire (the first sixteen; a big crowd would hide it).
		const living = world.home.slice(0, 16);
		while (home.current.length > living.length) group.remove(home.current.pop()!);
		living.forEach((kind, k) => {
			let g = home.current[k];
			if (!g || g.userData.kind !== kind) {
				if (g) group.remove(g);
				g = animal(kind, false);
				g.userData.kind = kind;
				home.current[k] = g;
				group.add(g);
			}
			const [fx, fy, fz] = world.fire;
			const r = 3 + (k % 4) * 0.9;
			const a = (k / living.length) * Math.PI * 2 + t * 0.05 * (k % 2 ? 1 : -1);
			g.position.set(fx + 0.5 + Math.cos(a) * r, fy, fz + 0.5 + Math.sin(a) * r);
			g.rotation.y = -a + (k % 2 ? 0 : Math.PI);
			g.children[0]!.position.y = Math.abs(Math.sin(t * 3 + k)) * 0.05;
		});
	});
	return <primitive object={group} />;
}

// ── The Night Deer ──

function NightDeer({ world }: { world: IslandState }) {
	const model = useMemo(() => deer(), []);
	const near = useRef(-1);
	const fade = useRef(0);
	useFrame(({ clock }, dt) => {
		const e = world.elapsed();
		const p = phaseAt(e);
		const night = p.phase === "night";
		const low = world.clock.fuel < FUEL_MAX * FUEL_LOW ? 1 : 0;
		// Arriving mid-night, she's already where she'd be; after that she drifts in and out slowly.
		near.current = near.current < 0 ? low : near.current + (low - near.current) * Math.min(1, dt * 0.4);
		fade.current += ((night ? 1 : 0) - fade.current) * Math.min(1, dt * 0.6);
		model.visible = fade.current > 0.02;
		if (!model.visible) return;
		const t = Math.max(0, (e % CYCLE_S) - DAY_S);
		const at = deerAt(world.seed, p.night, t, near.current);
		const ahead = deerAt(world.seed, p.night, t + 0.5, near.current);
		model.position.set(at.x, groundBelow(world, at.x, at.z), at.z);
		model.rotation.y = Math.atan2(-(ahead.x - at.x), -(ahead.z - at.z));
		deerWalk(model, clock.elapsedTime);
		model.traverse((o) => {
			const m = (o as Mesh).material as MeshBasicMaterial | undefined;
			if (m && "opacity" in m && m.transparent) m.opacity = fade.current;
		});
	});
	return <primitive object={model} />;
}

function groundBelow(world: IslandState, x: number, z: number) {
	const v = world.volume;
	if (!v) return 20;
	const xi = Math.floor(x);
	const zi = Math.floor(z);
	for (let y = 47; y > 0; y--) {
		const b = v.get(xi, y, zi);
		if (b !== B.air && b !== B.leaves && b !== B.torch) return y + 1;
	}
	return 0;
}

// ── The kid's own eyes ──

const ray = new Raycaster();
const ndc = new Vector2();
const dir = new Vector3();

function Player({ world, controls, running, fx }: Omit<Props, "label"> & { fx: Effects }) {
	const { camera, scene } = useThree();
	const held = useMemo(() => new Held(atlasTexture()), []);
	useEffect(() => {
		// The held block hangs off the camera, so the camera has to be in the scene for it to be drawn.
		scene.add(camera);
		camera.add(held.group);
		return () => {
			camera.remove(held.group);
			scene.remove(camera);
		};
	}, [scene, camera, held]);
	const still = useMemo(() => prefersReducedMotion(), []);
	const outline = useMemo(() => {
		const l = new LineSegments(new EdgesGeometry(new BoxGeometry(1.005, 1.005, 1.005)), new LineBasicMaterial({ color: "#1d1d1f" }));
		l.visible = false;
		return l;
	}, []);
	const crack = useMemo(() => {
		const m = new Mesh(
			new BoxGeometry(1.01, 1.01, 1.01),
			new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0, depthWrite: false }),
		);
		m.visible = false;
		return m;
	}, []);
	const state = useRef({
		sent: 0,
		last: [0, 0, 0] as number[],
		mining: -1,
		spawned: false,
		walked: 0,
		wasGround: true,
		fallFrom: 0,
		stride: 0,
	});

	useEffect(() => {
		(camera as PerspectiveCamera).rotation.order = "YXZ";
	}, [camera]);

	useFrame((_, rawDt) => {
		const v = world.volume;
		if (!v) return;
		const s = state.current;
		if (!controls.body || !s.spawned) {
			controls.body = newBody(spawnPoint({ volume: v, seed: world.seed, fire: world.fire }));
			s.spawned = true;
		}
		const body = controls.body;
		const dt = Math.min(rawDt, 0.05);
		const { yaw, pitch } = controls.look;
		if (running) {
			const d = controls.drive.current;
			const len = Math.min(1, Math.hypot(d.x, d.y));
			const ang = Math.atan2(d.x, d.y);
			const wx = len ? -Math.sin(yaw - ang) * len : 0;
			const wz = len ? -Math.cos(yaw - ang) * len : 0;
			const before = [body.p[0], body.p[2]];
			const grounded = body.ground;
			step(v, body, { x: wx, z: wz, jump: d.hop }, dt);
			// Footsteps on whatever's underfoot, about two a block; a jump whooshes and a landing thumps.
			if (body.ground) {
				s.walked += Math.hypot(body.p[0] - before[0]!, body.p[2] - before[1]!);
				if (s.walked > 0.55) {
					s.walked = 0;
					sound.step(v.get(Math.floor(body.p[0]), Math.floor(body.p[1] - 0.05), Math.floor(body.p[2])));
				}
			}
			if (grounded && !body.ground && body.v[1] > 0) {
				sound.jump();
				s.fallFrom = body.p[1];
			}
			if (!grounded && body.ground) sound.land(Math.min(1, Math.max(0, (s.fallFrom - body.p[1]) / 6)));
			if (body.ground) s.fallFrom = body.p[1];
			else s.fallFrom = Math.max(s.fallFrom, body.p[1]);
			if (lost(body)) {
				body.p = spawnPoint({ volume: v, seed: world.seed, fire: world.fire });
				body.v = [0, 0, 0];
			}
		}
		camera.position.set(body.p[0], body.p[1] + EYE, body.p[2]);
		camera.rotation.set(pitch, yaw, 0);

		// What it's aiming at: under the finger, or the middle of the screen.
		const aimAt = (aim: [number, number] | null) => {
			if (!running) return null;
			if (aim) {
				ndc.set(aim[0], aim[1]);
				ray.setFromCamera(ndc, camera);
				dir.copy(ray.ray.direction);
			} else camera.getWorldDirection(dir);
			return raycast(v, [camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z]);
		};
		const hit = aimAt(controls.aim);
		controls.target = hit;
		outline.visible = !!hit;
		if (hit) outline.position.set(hit.cell[0] + 0.5, hit.cell[1] + 0.5, hit.cell[2] + 0.5);

		// Holding to mine: the crack darkens until the block gives.
		if (running && controls.mining && hit && canMine(hit.block)) {
			if (s.mining !== hit.i) {
				s.mining = hit.i;
				controls.progress = 0;
			}
			// Real time, not the physics step: a slow frame still digs its share.
			const step = Math.min(rawDt, 0.25) / (blockInfo(hit.block).hardness * DIG_SPEED);
			controls.progress += step;
			if (Math.floor((controls.progress - step) * 4) !== Math.floor(controls.progress * 4)) {
				sound.tap();
				fx.chips(hit.cell, hit.block, hit.normal);
			}
			if (controls.progress >= 1) {
				world.edit(hit.i, B.air);
				sound.dig(hit.block);
				fx.burst(hit.cell, hit.block);
				controls.progress = 0;
				s.mining = -1;
			}
		} else {
			s.mining = -1;
			controls.progress = 0;
		}
		crack.visible = controls.progress > 0 && !!hit;
		if (hit) crack.position.copy(outline.position);
		(crack.material as MeshBasicMaterial).opacity = 0.08 + Math.floor(controls.progress * 4) * 0.12;

		// A tap or right click builds on the face it's aiming at.
		if (controls.place) {
			const at = aimAt(controls.place.aim);
			controls.place = null;
			const placed = at ? build(world, controls, at) : null;
			if (placed) {
				fx.pop(placed);
				held.built();
			}
		}

		// What's in hand, moving with the kid.
		const speed = body.ground ? Math.min(1, Math.hypot(body.v[0], body.v[2]) / 4.3) : 0;
		s.stride += Math.hypot(body.v[0], body.v[2]) * dt;
		held.hold((world.inv[controls.selected] ?? 0) > 0 ? controls.selected : 0);
		held.group.visible = running;
		held.update(dt, speed, s.stride, controls.progress > 0, still);

		// Tell the island where we are, ten times a second while moving.
		const now = performance.now();
		const moved =
			Math.hypot(body.p[0] - s.last[0]!, body.p[1] - s.last[1]!, body.p[2] - s.last[2]!) > 0.02 || Math.abs(yaw - s.last[3]!) > 0.02;
		if (moved && now - s.sent > 1000 / MOVE_HZ) {
			s.sent = now;
			s.last = [...body.p, yaw];
			world.send({ t: "move", p: [round(body.p[0]), round(body.p[1]), round(body.p[2])], yaw: round(yaw) });
		}
	});
	return (
		<>
			<primitive object={outline} />
			<primitive object={crack} />
		</>
	);
}

/** Torches lit with a real light at once (the nearest); each one costs every pixel a little, so only a couple. */
const TORCH_LIGHTS = 2;

/** Hardness is in seconds; digging takes this share of it, quick enough that a click feels like it does something. */
const DIG_SPEED = 0.45;

const round = (n: number) => Math.round(n * 100) / 100;

/** Builds on the face aimed at, if it can; returns the cell built in. */
function build(world: IslandState, controls: Controls, hit: NonNullable<Controls["target"]>): [number, number, number] | null {
	const b = controls.selected;
	if (!b || (world.inv[b] ?? 0) < 1) return null;
	const [x, y, z] = [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
	if (!inBounds(x, y, z) || !world.volume) return null;
	const there = world.volume.get(x, y, z);
	if (there !== B.air && there !== B.water && !isPlant(there)) return null;
	const [fx, fy, fz] = world.fire;
	if (x === fx && z === fz && (y === fy || y === fy + 1)) return null;
	// Never inside the kid themselves.
	const p = controls.body?.p;
	if (
		p &&
		blockInfo(b).solid &&
		Math.abs(p[0] - (x + 0.5)) < 0.5 + HALF &&
		Math.abs(p[2] - (z + 0.5)) < 0.5 + HALF &&
		p[1] < y + 1 &&
		p[1] + TALL > y
	)
		return null;
	world.edit(indexOf(x, y, z), b);
	sound.place();
	return [x, y, z];
}
