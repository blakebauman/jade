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
	type PerspectiveCamera,
	PointLight,
	Points,
	PointsMaterial,
	Raycaster,
	Vector2,
	Vector3,
} from "three";
import { useContextLoss } from "../roxy/world/pace.tsx";
import { atlasTexture } from "./atlas.ts";
import type { Controls } from "./controls.ts";
import type { Buffers, ColumnMesh } from "./mesher.ts";
import type { FromMesher, ToMesher } from "./mesher.worker.ts";
import { animal, campfire, deer, emoteTexture, type FigureModel, figure, swing } from "./models.ts";
import { EYE, HALF, lost, newBody, step, TALL } from "./physics.ts";
import { raycast } from "./raycast.ts";
import * as sound from "./sound.ts";
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
			<Island world={world} controls={controls} running={running} />
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

function Island({ world, controls, running }: Omit<Props, "label">) {
	const { scene, gl, invalidate } = useThree();
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
			<Sky world={world} />
			<Terrain world={world} />
			<Camp world={world} />
			<Others world={world} />
			<Animals world={world} controls={controls} />
			<NightDeer world={world} />
			<Player world={world} controls={controls} running={running} />
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
			clear: new MeshLambertMaterial({ map, vertexColors: true, transparent: true, depthWrite: false }),
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

// ── Sky and light ──

const NIGHT = new Color("#0b1530");
const DUSK = new Color("#e3a07c");
const DAY = new Color("#9ed4f5");

function Sky({ world }: { world: IslandState }) {
	const { scene } = useThree();
	const rig = useMemo(() => {
		const ambient = new AmbientLight("#ffffff", 0.6);
		const hemi = new HemisphereLight("#cfe8ff", "#5b4a33", 0.5);
		const sun = new DirectionalLight("#fff4dc", 1);
		sun.position.set(30, 60, 20);
		const stars = starField();
		return { ambient, hemi, sun, stars };
	}, []);
	useEffect(() => {
		scene.fog = new Fog(DAY.clone(), 24, 70);
		scene.background = DAY.clone();
		scene.add(rig.ambient, rig.hemi, rig.sun, rig.stars);
		return () => {
			scene.remove(rig.ambient, rig.hemi, rig.sun, rig.stars);
			scene.fog = null;
		};
	}, [scene, rig]);
	useFrame(({ camera }) => {
		const { sun } = phaseAt(world.elapsed());
		const sky = scene.background as Color;
		if (sun >= 0.5) sky.copy(DUSK).lerp(DAY, (sun - 0.5) * 2);
		else sky.copy(NIGHT).lerp(DUSK, sun * 2);
		const fog = scene.fog as Fog;
		fog.color.copy(sky);
		fog.near = 12 + 12 * sun;
		fog.far = 34 + 36 * sun;
		rig.ambient.intensity = 0.22 + 0.5 * sun;
		rig.hemi.intensity = 0.12 + 0.45 * sun;
		rig.sun.intensity = 1.1 * Math.max(0, sun - 0.25);
		(rig.stars.material as PointsMaterial).opacity = Math.max(0, 1 - sun * 2.5);
		rig.stars.position.copy(camera.position);
	});
	return null;
}

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
	p.renderOrder = -1;
	return p;
}

// ── The camp ──

function Camp({ world }: { world: IslandState }) {
	// Built in one go: three.js moves an object into whichever group adds it last, so pieces made in separate memos
	// (which React may run twice) could end up in a group that's thrown away.
	const { fire, light, torches, group } = useMemo(() => {
		const fire = campfire();
		const light = new PointLight("#ffae55", 2, 18, 1.2);
		/** Torches nearest the player, each with a small light (the rest just glow on their own). */
		const torches = Array.from({ length: TORCH_LIGHTS }, () => new PointLight("#ffc273", 0, 9, 1.4));
		const group = new Group();
		group.add(fire.group, light, ...torches);
		return { fire, light, torches, group };
	}, []);
	const scan = useRef({ at: 0, list: [] as [number, number, number][] });

	useFrame(({ clock, camera }) => {
		const [fx, fy, fz] = world.fire;
		fire.group.position.set(fx + 0.5, fy, fz + 0.5);
		const fuel = world.clock.fuel;
		const on = fuel > 0;
		const t = clock.elapsedTime;
		const size = on ? 0.45 + 0.55 * Math.min(1, fuel / (FUEL_MAX * 0.6)) : 0;
		fire.flames.forEach((f, k) => {
			f.visible = on;
			f.scale.copy(f.userData.size).multiplyScalar(size * (1 + 0.12 * Math.sin(t * (7 + k * 3) + k)));
			f.position.y = (0.36 + k * 0.22) * size;
		});
		light.position.set(fx + 0.5, fy + 1, fz + 0.5);
		light.intensity = on ? (2.2 + 0.4 * Math.sin(t * 11) + 0.3 * Math.sin(t * 17)) * (0.5 + size) : 0;
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
	const near = useRef(0);
	const fade = useRef(0);
	useFrame((_, dt) => {
		const e = world.elapsed();
		const p = phaseAt(e);
		const night = p.phase === "night";
		const low = world.clock.fuel < FUEL_MAX * FUEL_LOW ? 1 : 0;
		near.current += (low - near.current) * Math.min(1, dt * 0.4);
		fade.current += ((night ? 1 : 0) - fade.current) * Math.min(1, dt * 0.6);
		model.visible = fade.current > 0.02;
		if (!model.visible) return;
		const t = Math.max(0, (e % CYCLE_S) - DAY_S);
		const at = deerAt(world.seed, p.night, t, near.current);
		const ahead = deerAt(world.seed, p.night, t + 0.5, near.current);
		model.position.set(at.x, groundBelow(world, at.x, at.z), at.z);
		model.rotation.y = Math.atan2(-(ahead.x - at.x), -(ahead.z - at.z));
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

function Player({ world, controls, running }: Omit<Props, "label">) {
	const { camera } = useThree();
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
	const state = useRef({ sent: 0, last: [0, 0, 0] as number[], mining: -1, spawned: false });

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
			step(v, body, { x: wx, z: wz, jump: d.hop }, dt);
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
			if (Math.floor((controls.progress - step) * 4) !== Math.floor(controls.progress * 4)) sound.tap();
			if (controls.progress >= 1) {
				world.edit(hit.i, B.air);
				sound.dig(hit.block);
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
			if (at) build(world, controls, at);
		}

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

function build(world: IslandState, controls: Controls, hit: NonNullable<Controls["target"]>) {
	const b = controls.selected;
	if (!b || (world.inv[b] ?? 0) < 1) return;
	const [x, y, z] = [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
	if (!inBounds(x, y, z) || !world.volume) return;
	const there = world.volume.get(x, y, z);
	if (there !== B.air && there !== B.water) return;
	const [fx, fy, fz] = world.fire;
	if (x === fx && z === fz && (y === fy || y === fy + 1)) return;
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
		return;
	world.edit(indexOf(x, y, z), b);
	sound.place();
}
