import { type Grid, isFree } from "./path.ts";
import type { Spot } from "./stage.tsx";

/**
 * Walking Roxy herself, with the keyboard or the touch stick, beside tap-to-walk. Input is in screen terms (x right,
 * y up the screen, each -1…1); the camera's turn makes it a direction on the floor.
 */
export type DriveInput = { x: number; y: number; hop: boolean };

export const STILL: DriveInput = { x: 0, y: 0, hop: false };

const UP = new Set(["ArrowUp", "KeyW"]);
const DOWN = new Set(["ArrowDown", "KeyS"]);
const LEFT = new Set(["ArrowLeft", "KeyA"]);
const RIGHT = new Set(["ArrowRight", "KeyD"]);
/** The keys walking listens to (`KeyboardEvent.code`, so it works the same on any keyboard layout). */
export const DRIVE_KEYS = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, "Space"]);

const any = (pressed: ReadonlySet<string>, keys: Set<string>) => [...keys].some((k) => pressed.has(k));

/** The keys held down, as a direction no longer than 1 (so walking diagonally isn't faster). */
export function keysToInput(pressed: ReadonlySet<string>): DriveInput {
	const x = (any(pressed, RIGHT) ? 1 : 0) - (any(pressed, LEFT) ? 1 : 0);
	const y = (any(pressed, UP) ? 1 : 0) - (any(pressed, DOWN) ? 1 : 0);
	const len = Math.hypot(x, y);
	return { x: len > 1 ? x / len : x, y: len > 1 ? y / len : y, hop: pressed.has("Space") };
}

/**
 * A screen direction as a direction on the floor, for a camera turned `yaw` round from looking down -z. Right on screen
 * is the camera's right along the floor; up the screen is away from the camera.
 */
export function toWorld(input: Pick<DriveInput, "x" | "y">, yaw: number): Spot {
	const rx = Math.cos(yaw);
	const rz = -Math.sin(yaw);
	const fx = -Math.sin(yaw);
	const fz = -Math.cos(yaw);
	return { x: input.x * rx + input.y * fx, z: input.x * rz + input.y * fz };
}

/** One step from `from` by `delta`, sliding along whatever's in the way instead of stopping dead. */
export function stepFree(grid: Grid, from: Spot, delta: Spot): Spot {
	const whole = { x: from.x + delta.x, z: from.z + delta.z };
	if (isFree(grid, whole)) return whole;
	const alongX = { x: from.x + delta.x, z: from.z };
	if (delta.x !== 0 && isFree(grid, alongX)) return alongX;
	const alongZ = { x: from.x, z: from.z + delta.z };
	if (delta.z !== 0 && isFree(grid, alongZ)) return alongZ;
	return from;
}
