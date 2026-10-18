import type { PieceType } from "./sim.ts";

/** Jelly flavours by piece: I mint, O lemon, T grape, S lime, Z strawberry, J blueberry, L orange. */
export const FLAVOURS: Record<PieceType, string> = {
	1: "#2fcfc0",
	2: "#ffd24d",
	3: "#9a6bff",
	4: "#8cd648",
	5: "#ff5f8f",
	6: "#4f7dff",
	7: "#ff9a40",
};

/** The jar's size in world units (squares) with its frame: the page leaves a slot this shape for it. */
export const JAR_W = 11.9;
export const JAR_H = 21.8;
