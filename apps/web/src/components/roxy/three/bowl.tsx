import { BackSide, DoubleSide } from "three";
import { toonGradient } from "../world/Furniture.tsx";

/**
 * The goldfish's bowl. Only the inside of the water is drawn, so the fish sits in front of it in its own colour
 * rather than behind a blue veil, and the glass is faint.
 */
export function Bowl() {
	return (
		<>
			<mesh position={[0, 0.26, 0]}>
				<sphereGeometry args={[0.26, 24, 18, 0, Math.PI * 2, 0.5, Math.PI - 0.5]} />
				<meshToonMaterial color="#bfe3f0" gradientMap={toonGradient()} side={DoubleSide} transparent opacity={0.2} depthWrite={false} />
			</mesh>
			<mesh position={[0, 0.2, 0]} scale={[1, 0.6, 1]}>
				<sphereGeometry args={[0.22, 24, 16]} />
				<meshToonMaterial color="#5fa3e0" gradientMap={toonGradient()} side={BackSide} transparent opacity={0.75} />
			</mesh>
		</>
	);
}
