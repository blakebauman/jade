import { B, isSolid, type Volume } from "@jade/core/woods";

/**
 * A kid's figure moving through the island: a box 0.6 wide and 1.7 tall, stopped by solid blocks one axis at a time
 * (so it slides along walls), pulled down by gravity, slowed and buoyed in water. Walking into a one-block step hops
 * up it, so a thumb on a stick never gets stuck on a kerb. Pure, and stepped at a fixed rate.
 */

export type Vec3 = [number, number, number];
export type Body = { p: Vec3; v: Vec3; ground: boolean; water: boolean };
/** What the player wants: a direction across the ground (length up to 1) and whether jump is held. */
export type Wish = { x: number; z: number; jump: boolean };

export const HALF = 0.3;
export const TALL = 1.7;
export const EYE = 1.55;
export const SPEED = 4.3;
export const JUMP = 7.6;
export const GRAVITY = 24;
const SWIM_SPEED = 2.6;
const SWIM_UP = 3.2;
const SINK = 2;
const STEP_DT = 1 / 120;

export const newBody = (p: Vec3): Body => ({ p: [...p], v: [0, 0, 0], ground: false, water: false });

/** Whether a box at `p` would overlap a solid block. */
export function overlaps(vol: Volume, p: Vec3): boolean {
	const x0 = Math.floor(p[0] - HALF);
	const x1 = Math.floor(p[0] + HALF - 1e-6);
	const y0 = Math.floor(p[1]);
	const y1 = Math.floor(p[1] + TALL - 1e-6);
	const z0 = Math.floor(p[2] - HALF);
	const z1 = Math.floor(p[2] + HALF - 1e-6);
	for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (isSolid(vol.get(x, y, z))) return true;
	return false;
}

export function step(vol: Volume, body: Body, wish: Wish, dt: number) {
	for (let left = dt; left > 1e-9; left -= STEP_DT) tick(vol, body, wish, Math.min(STEP_DT, left));
}

function tick(vol: Volume, body: Body, wish: Wish, dt: number) {
	const { p, v } = body;
	body.water = vol.get(Math.floor(p[0]), Math.floor(p[1] + 0.6), Math.floor(p[2])) === B.water;
	const speed = body.water ? SWIM_SPEED : SPEED;
	// Starts and stops almost at once on the ground (a key held is a step taken), a little looser in the air.
	const k = Math.min(1, dt * (body.ground || body.water ? 45 : 10));
	v[0] += (wish.x * speed - v[0]) * k;
	v[2] += (wish.z * speed - v[2]) * k;
	if (body.water) {
		v[1] = wish.jump ? SWIM_UP : Math.max(-SINK, v[1] - 6 * dt);
	} else {
		if (wish.jump && body.ground) v[1] = JUMP;
		v[1] -= GRAVITY * dt;
	}

	body.ground = false;
	if (!move(vol, body, 1, v[1] * dt)) {
		if (v[1] < 0) body.ground = true;
		v[1] = 0;
	}
	for (const axis of [0, 2] as const) {
		if (move(vol, body, axis, v[axis] * dt)) continue;
		// Walked into a single step on the ground: hop up it.
		const up: Vec3 = [p[0], p[1] + 1.05, p[2]];
		up[axis] += Math.sign(v[axis]) * 0.1;
		if (body.ground && Math.hypot(wish.x, wish.z) > 0.2 && !overlaps(vol, up)) v[1] = JUMP;
		v[axis] = 0;
	}
}

/** Moves along one axis; returns false (and stops at the block) if something solid was in the way. */
function move(vol: Volume, body: Body, axis: 0 | 1 | 2, d: number): boolean {
	if (d === 0) return true;
	const next: Vec3 = [...body.p];
	next[axis] += d;
	if (!overlaps(vol, next)) {
		body.p[axis] = next[axis];
		return true;
	}
	// Snap flush against the block.
	if (axis === 1) body.p[1] = d < 0 ? Math.floor(next[1]) + 1 : Math.floor(next[1] + TALL) - TALL - 1e-4;
	else {
		const edge = d > 0 ? Math.floor(next[axis] + HALF) - HALF - 1e-4 : Math.floor(next[axis] - HALF) + 1 + HALF + 1e-4;
		const snapped: Vec3 = [...body.p];
		snapped[axis] = edge;
		if (!overlaps(vol, snapped)) body.p[axis] = edge;
	}
	return false;
}

/** Fell off the world (into the void below, or far out to sea): time to come back to camp. */
export const lost = (body: Body) => body.p[1] < -8 || body.p[0] < -24 || body.p[2] < -24 || body.p[0] > 120 || body.p[2] > 120;
