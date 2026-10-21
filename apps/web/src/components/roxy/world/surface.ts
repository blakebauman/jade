import type { PlaceId } from "@jade/core/roxy";
import type { Surface } from "../sound.ts";

/** The park's cobbled path: a band across the whole lawn, from front to back between these. */
export const PARK_PATH = { z0: 4.5, z1: 5.9 } as const;

/** What Roxy's walking on: the park's lawn, or the cobbled path across it; the pet shop's tiles; the school's boards. */
export function surfaceAt(place: PlaceId, spot: { x: number; z: number }): Surface {
	if (place === "petshop") return "tile";
	if (place === "school") return "wood";
	return spot.z >= PARK_PATH.z0 && spot.z <= PARK_PATH.z1 ? "path" : "grass";
}
