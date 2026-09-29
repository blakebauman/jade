import { Tile } from "./tile.tsx";

/** A child's identity: their initial on a maple tile with their chosen point value. */
export function KidTile({ name, avatar, size = 64 }: { name: string; avatar: string; size?: number }) {
	return <Tile letter={name.trim()[0]?.toUpperCase() ?? "?"} points={avatar} size={size} aria-label={name} />;
}
