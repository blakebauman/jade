/**
 * A child's identity: their initial printed on a round die-cut vinyl sticker, with their chosen number on a foil chip
 * stuck to its edge. Kept as KidTile, the name every screen already imports, though it is no longer wood.
 */
export function KidTile({ name, avatar, size = 64 }: { name: string; avatar: string; size?: number }) {
	const chip = Math.max(22, size * 0.38);
	return (
		<span className="kid-sticker" role="img" aria-label={name} style={{ width: size, height: size, fontSize: size * 0.52 }}>
			<span aria-hidden className="relative">
				{name.trim()[0]?.toUpperCase() ?? "?"}
			</span>
			<span
				aria-hidden
				className="foil"
				style={{
					minWidth: chip,
					height: chip,
					paddingInline: chip * 0.18,
					fontSize: Math.max(13, size * 0.21),
					borderWidth: Math.max(1.5, size * 0.03),
				}}
			>
				{avatar}
			</span>
		</span>
	);
}
