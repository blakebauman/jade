import type { RefObject } from "react";
import type { DriveInput } from "../roxy/world/drive.ts";
import type { Body } from "./physics.ts";
import type { Hit } from "./raycast.ts";

/**
 * What the screen and the scene share each frame, without re-rendering: the screen writes what the kid is doing
 * (walking, looking, holding to mine, tapping to build, the block in hand), and the scene writes back where the
 * figure is and what it's aiming at, for the HUD's prompts.
 */
export type Controls = {
	drive: RefObject<DriveInput>;
	/** Radians: yaw turns left and right (0 looks along -z), pitch looks up and down. */
	look: { yaw: number; pitch: number };
	/** Holding to mine. */
	mining: boolean;
	/** A tap or right click asked to build, once. */
	place: boolean;
	/** Where on the screen a finger is aiming (-1…1 each way); null aims at the middle (the crosshair). */
	aim: [number, number] | null;
	/** The block in hand. */
	selected: number;
	/** Written by the scene. */
	body: Body | null;
	target: Hit | null;
	/** How far through mining the target is, 0 to 1. */
	progress: number;
};

export const PITCH_MAX = Math.PI / 2 - 0.05;

export function turn(c: Controls, dx: number, dy: number, speed: number) {
	c.look.yaw -= dx * speed;
	c.look.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, c.look.pitch - dy * speed));
}
