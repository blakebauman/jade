import type { Animal } from "@jade/core/roxy";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import { HEAD_R, onFace } from "./body.tsx";
import { Ball, Cone, darker, lighter, M, Mat, Ring, type V3 } from "./shapes.tsx";

/**
 * Animals in 3D: a small gem's ears and tail on Roxy as she is, the moon gem's whole animal head, and pets. Pets
 * are drawn in their own coordinates (feet at the origin, facing +z) with a neck and head point for accessories.
 */

const R = HEAD_R;
const INK = "#2b2b33";
const PINK = "#f2a7b5";

/** Ears on top of the head (head coordinates). */
export function Ears({ animal, fur, patch }: { animal: Animal; fur: string; patch: string }) {
	switch (animal) {
		case "cat":
		case "fox":
			return (
				<>
					{[-1, 1].map((s) => (
						<group key={s} position={[s * R * 0.55, R * 0.82, 0]} rotation={[0, 0, -s * 0.35]}>
							<Cone r={animal === "fox" ? 0.2 : 0.17} h={animal === "fox" ? 0.42 : 0.32} c={fur} />
							<Cone r={0.09} h={0.2} p={[0, -0.02, 0.06]} c={animal === "fox" ? "#fbe9dc" : PINK} />
							{animal === "fox" && <Cone r={0.07} h={0.12} p={[0, 0.17, 0]} c={INK} />}
						</group>
					))}
				</>
			);
		case "bunny":
			return (
				<>
					{[-1, 1].map((s) => (
						<group key={s} position={[s * 0.22, R * 1.25, -0.05]} rotation={[0, 0, -s * 0.15]}>
							<Ball r={0.13} c={fur} s={[1, 3, 0.55]} />
							<Ball r={0.07} p={[0, 0, 0.05]} c={PINK} s={[1, 3.4, 0.4]} />
						</group>
					))}
				</>
			);
		case "puppy":
			return (
				<>
					{[-1, 1].map((s) => (
						<Ball key={s} r={0.18} p={[s * R * 0.95, R * 0.15, 0]} c={darker(fur, 0.25)} s={[0.6, 1.6, 1]} />
					))}
				</>
			);
		case "panda":
		case "bear":
			return (
				<>
					{[-1, 1].map((s) => (
						<group key={s} position={[s * R * 0.66, R * 0.72, 0]}>
							<Ball r={0.17} c={animal === "panda" ? patch : fur} s={[1, 1, 0.6]} />
							{animal === "bear" && <Ball r={0.09} p={[0, 0, 0.06]} c={lighter(fur, 0.35)} s={[1, 1, 0.5]} />}
						</group>
					))}
				</>
			);
	}
}

/** A tail from the back of the hips (body coordinates). */
export function Tail({ animal, fur, patch }: { animal: Animal; fur: string; patch: string }) {
	const curve = useMemo(() => {
		const pts: Record<string, V3[]> = {
			cat: [
				[0, 1.02, -0.3],
				[0.15, 1.0, -0.6],
				[0.35, 1.3, -0.7],
				[0.3, 1.65, -0.62],
			],
			puppy: [
				[0, 1.05, -0.3],
				[0.05, 1.15, -0.55],
				[0.1, 1.4, -0.62],
			],
		};
		const p = pts[animal];
		return p ? new CatmullRomCurve3(p.map((v) => new Vector3(...v))) : null;
	}, [animal]);
	if (curve)
		return (
			<mesh>
				<tubeGeometry args={[curve, 24, animal === "cat" ? 0.06 : 0.07, 10, false]} />
				<Mat c={fur} />
			</mesh>
		);
	if (animal === "fox")
		return (
			<group position={[0.15, 1.15, -0.5]} rotation={[0.9, 0, -0.5]}>
				<Ball r={0.2} c={fur} s={[1, 2.2, 1]} />
				<Ball r={0.13} p={[0, 0.36, 0]} c="#fbf4ec" s={[1, 1.2, 1]} />
			</group>
		);
	return (
		<Ball r={animal === "bunny" ? 0.13 : 0.1} p={[0, 1.05, -0.36]} c={animal === "bunny" ? "#fbf7f1" : animal === "panda" ? patch : fur} />
	);
}

/** Fur for the body; a panda is white with dark patches. */
export const fur3 = (animal: Animal, c1: string) => (animal === "panda" ? "#f4f1ea" : c1);

/** The moon gem's animal head (head coordinates). Roxy's eyes, brows and mouth still go on top. */
export function AnimalHead({ animal, fur, patch }: { animal: Animal; fur: string; patch: string }) {
	const muzzle = animal === "panda" ? "#ffffff" : animal === "fox" ? "#fbf4ec" : lighter(fur, 0.5);
	const nose = animal === "cat" || animal === "bunny" ? "#e98a9c" : INK;
	const snout = onFace(200, 232, -0.04);
	return (
		<group>
			<Ball r={R} c={fur} s={animal === "fox" ? [1.08, 0.96, 1] : [1.04, 0.98, 1]} />
			{animal === "fox" &&
				[-1, 1].map((s) => <Ball key={s} r={0.2} p={[s * R * 0.62, -R * 0.38, R * 0.42]} c="#fbf4ec" s={[1, 0.6, 0.6]} />)}
			{animal === "panda" && [163, 237].map((x) => <Ball key={x} r={0.14} p={onFace(x, 190, -0.06)} c={patch} s={[1, 1.25, 0.5]} />)}
			<Ball r={0.22} p={snout} c={muzzle} s={[1.2, 0.85, 0.75]} />
			<Ball r={0.06} p={[snout[0], snout[1] + 0.08, snout[2] + 0.13]} c={nose} s={[1.3, 0.9, 0.9]} />
			<Ears animal={animal} fur={fur} patch={patch} />
		</group>
	);
}

// ── Pets ──

type PetDef = { draw: (c1: string, c2: string) => React.ReactNode; neck: V3; neckR: number; head: V3 };
const eye = (p: V3, r = 0.035) => (
	<group position={p}>
		<Ball r={r} c={INK} />
		<Ball r={r * 0.35} p={[r * 0.3, r * 0.35, r * 0.75]} c="#ffffff" />
	</group>
);

export const PETS_3D: Record<string, PetDef> = {
	"pet-cat": {
		neck: [0, 0.36, 0.1],
		neckR: 0.12,
		head: [0, 0.66, 0.12],
		draw: (c1, c2) => (
			<>
				<Ball r={0.2} p={[0, 0.2, -0.02]} c={c1} s={[1, 1.05, 1.15]} />
				<Ball r={0.11} p={[0, 0.2, 0.13]} c={c2} s={[1, 1.3, 0.6]} />
				<Ball r={0.17} p={[0, 0.5, 0.08]} c={c1} />
				{[-1, 1].map((s) => (
					<Cone key={s} r={0.07} h={0.14} p={[s * 0.1, 0.65, 0.06]} rot={[0, 0, -s * 0.3]} c={c1} />
				))}
				{eye([-0.06, 0.53, 0.23])}
				{eye([0.06, 0.53, 0.23])}
				<Ball r={0.02} p={[0, 0.48, 0.25]} c="#e98a9c" />
				<mesh>
					<tubeGeometry
						args={[
							new CatmullRomCurve3([new Vector3(0, 0.08, -0.2), new Vector3(0.2, 0.1, -0.3), new Vector3(0.25, 0.35, -0.32)]),
							12,
							0.035,
							8,
							false,
						]}
					/>
					<Mat c={c1} />
				</mesh>
			</>
		),
	},
	"pet-dog": {
		neck: [0, 0.38, 0.12],
		neckR: 0.13,
		head: [0, 0.72, 0.14],
		draw: (c1, c2) => (
			<>
				<Ball r={0.21} p={[0, 0.21, -0.02]} c={c1} s={[1, 1, 1.2]} />
				<Ball r={0.19} p={[0, 0.52, 0.1]} c={c1} />
				{[-1, 1].map((s) => (
					<Ball key={s} r={0.07} p={[s * 0.17, 0.5, 0.08]} c={c2} s={[0.6, 1.6, 1]} />
				))}
				<Ball r={0.09} p={[0, 0.46, 0.25]} c={lighter(c1, 0.4)} s={[1.1, 0.8, 1]} />
				<Ball r={0.03} p={[0, 0.5, 0.33]} c={INK} />
				{eye([-0.07, 0.57, 0.25])}
				{eye([0.07, 0.57, 0.25])}
				<Cone r={0.04} h={0.2} p={[0, 0.3, -0.26]} rot={[-0.8, 0, 0]} c={c1} />
			</>
		),
	},
	"pet-bunny": {
		neck: [0, 0.32, 0.08],
		neckR: 0.11,
		head: [0, 0.62, 0.1],
		draw: (c1, c2) => (
			<>
				<Ball r={0.2} p={[0, 0.18, -0.02]} c={c1} s={[1, 0.95, 1.1]} />
				<Ball r={0.07} p={[0, 0.15, -0.24]} c="#fbf7f1" />
				<Ball r={0.15} p={[0, 0.45, 0.08]} c={c1} />
				{[-1, 1].map((s) => (
					<group key={s} position={[s * 0.06, 0.7, 0.04]} rotation={[0, 0, -s * 0.15]}>
						<Ball r={0.05} c={c1} s={[1, 3, 0.6]} />
						<Ball r={0.025} p={[0, 0, 0.025]} c={c2 === c1 ? PINK : c2} s={[1, 3.3, 0.4]} />
					</group>
				))}
				{eye([-0.055, 0.48, 0.2], 0.03)}
				{eye([0.055, 0.48, 0.2], 0.03)}
				<Ball r={0.018} p={[0, 0.43, 0.22]} c="#e98a9c" />
			</>
		),
	},
	"pet-hamster": {
		neck: [0, 0.2, 0.1],
		neckR: 0.15,
		head: [0, 0.38, 0.05],
		draw: (c1, c2) => (
			<>
				<Ball r={0.2} p={[0, 0.18, 0]} c={c1} s={[1.1, 0.9, 1]} />
				<Ball r={0.14} p={[0, 0.13, 0.08]} c={c2} s={[1, 0.8, 0.8]} />
				{[-1, 1].map((s) => (
					<Ball key={s} r={0.05} p={[s * 0.12, 0.34, 0]} c={c1} />
				))}
				{eye([-0.07, 0.24, 0.17], 0.028)}
				{eye([0.07, 0.24, 0.17], 0.028)}
				<Ball r={0.015} p={[0, 0.2, 0.2]} c="#e98a9c" />
			</>
		),
	},
	"pet-goldfish": {
		neck: [0, 0.5, 0],
		neckR: 0.2,
		head: [0, 0.52, 0],
		draw: (c1, c2) => (
			<>
				<M c="#bfe3f0" p={[0, 0.26, 0]} side="double">
					<sphereGeometry args={[0.26, 24, 18, 0, Math.PI * 2, 0.5, Math.PI - 0.5]} />
				</M>
				<Ball r={0.22} p={[0, 0.2, 0]} c="#5fa3e0" s={[1, 0.6, 1]} />
				<Ball r={0.08} p={[0, 0.28, 0.02]} c={c1} s={[1.4, 1, 0.7]} />
				<Cone r={0.06} h={0.08} p={[-0.13, 0.28, 0.02]} rot={[0, 0, Math.PI / 2]} c={c2} />
				{eye([0.08, 0.3, 0.07], 0.016)}
			</>
		),
	},
	"pet-turtle": {
		neck: [0, 0.14, 0.24],
		neckR: 0.06,
		head: [0, 0.26, 0.32],
		draw: (c1, c2) => (
			<>
				<M c={c1} p={[0, 0.08, 0]} s={[1, 0.65, 1.15]}>
					<sphereGeometry args={[0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
				</M>
				<Ring r={0.26} tube={0.03} p={[0, 0.08, 0]} c={darker(c1, 0.25)} rot={[Math.PI / 2, 0, 0]} />
				<Ball r={0.09} p={[0, 0.14, 0.3]} c={c2} />
				{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Ball key={`${sx}${sz}`} r={0.05} p={[sx * 0.2, 0.04, sz * 0.2]} c={c2} />))}
				{eye([-0.04, 0.17, 0.37], 0.02)}
				{eye([0.04, 0.17, 0.37], 0.02)}
			</>
		),
	},
	"pet-frog": {
		neck: [0, 0.2, 0.08],
		neckR: 0.16,
		head: [0, 0.38, 0.05],
		draw: (c1, c2) => (
			<>
				<Ball r={0.2} p={[0, 0.16, 0]} c={c1} s={[1.25, 0.8, 1]} />
				<Ball r={0.13} p={[0, 0.12, 0.08]} c={c2} s={[1.2, 0.7, 0.8]} />
				{[-1, 1].map((s) => (
					<group key={s}>
						<Ball r={0.07} p={[s * 0.1, 0.3, 0.06]} c={c1} />
						<Ball r={0.045} p={[s * 0.1, 0.31, 0.11]} c="#ffffff" />
						{eye([s * 0.1, 0.31, 0.14], 0.025)}
						<Ball r={0.07} p={[s * 0.18, 0.04, 0.1]} c={c1} s={[1.2, 0.4, 1.4]} />
					</group>
				))}
			</>
		),
	},
	"pet-hedgehog": {
		neck: [0, 0.14, 0.18],
		neckR: 0.1,
		head: [0, 0.32, 0.05],
		draw: (c1, c2) => (
			<>
				<Ball r={0.22} p={[0, 0.16, -0.04]} c={c2} s={[1, 0.8, 1.15]} />
				{Array.from({ length: 14 }, (_, i) => {
					const a = (i / 14) * Math.PI * 2;
					return (
						<Cone
							key={i}
							r={0.04}
							h={0.12}
							p={[Math.cos(a) * 0.17, 0.25 + Math.sin(i) * 0.04, -0.06 + Math.sin(a) * 0.17]}
							rot={[Math.sin(a) * -0.8, 0, Math.cos(a) * 0.8]}
							c={darker(c2, 0.15)}
						/>
					);
				})}
				<Ball r={0.11} p={[0, 0.12, 0.2]} c={c1} s={[1, 0.9, 1.2]} />
				<Ball r={0.025} p={[0, 0.12, 0.33]} c={INK} />
				{eye([-0.05, 0.16, 0.28], 0.02)}
				{eye([0.05, 0.16, 0.28], 0.02)}
			</>
		),
	},
	"pet-parrot": {
		neck: [0, 0.82, 0.02],
		neckR: 0.08,
		head: [0, 1.0, 0.02],
		draw: (c1, c2) => (
			<>
				<M c="#8a5a3c" p={[0, 0.3, 0]}>
					<cylinderGeometry args={[0.025, 0.04, 0.6, 8]} />
				</M>
				<M c="#8a5a3c" p={[0, 0.6, 0]} r={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
				</M>
				<Ball r={0.11} p={[0, 0.74, 0]} c={c1} s={[1, 1.5, 1]} />
				<Ball r={0.07} p={[0, 0.72, -0.08]} c={c2} s={[1, 1.6, 0.5]} />
				<Cone r={0.05} h={0.25} p={[0, 0.55, -0.12]} rot={[0.4, 0, 0]} c={c2} />
				<Ball r={0.085} p={[0, 0.9, 0.02]} c={c1} />
				<Cone r={0.035} h={0.08} p={[0, 0.88, 0.11]} rot={[Math.PI / 2 + 0.4, 0, 0]} c="#f2c94c" />
				{eye([-0.05, 0.92, 0.07], 0.018)}
				{eye([0.05, 0.92, 0.07], 0.018)}
			</>
		),
	},
	"pet-gecko": {
		neck: [0, 0.1, 0.22],
		neckR: 0.06,
		head: [0, 0.2, 0.28],
		draw: (c1, c2) => (
			<>
				<Ball r={0.1} p={[0, 0.08, 0]} c={c1} s={[1, 0.65, 2.2]} />
				<Ball r={0.08} p={[0, 0.1, 0.27]} c={c1} s={[1, 0.8, 1.3]} />
				<mesh>
					<tubeGeometry
						args={[
							new CatmullRomCurve3([new Vector3(0, 0.07, -0.2), new Vector3(0.1, 0.05, -0.4), new Vector3(0.2, 0.05, -0.38)]),
							12,
							0.04,
							8,
							false,
						]}
					/>
					<Mat c={c1} />
				</mesh>
				{[-0.05, 0.06, 0.15].map((z) => (
					<Ball key={z} r={0.03} p={[0, 0.14, z]} c={c2} />
				))}
				{[-1, 1].flatMap((sx) => [-0.12, 0.14].map((z) => <Ball key={`${sx}${z}`} r={0.03} p={[sx * 0.12, 0.03, z]} c={c1} />))}
				{eye([-0.05, 0.14, 0.33], 0.02)}
				{eye([0.05, 0.14, 0.33], 0.02)}
			</>
		),
	},
	"pet-snake": {
		neck: [0, 0.32, 0.12],
		neckR: 0.06,
		head: [0, 0.44, 0.16],
		draw: (c1, c2) => (
			<>
				<Ring r={0.18} tube={0.06} p={[0, 0.06, 0]} c={c1} rot={[Math.PI / 2, 0, 0]} />
				<Ring r={0.12} tube={0.055} p={[0, 0.15, 0]} c={c2} rot={[Math.PI / 2, 0, 0]} />
				<mesh>
					<tubeGeometry
						args={[
							new CatmullRomCurve3([new Vector3(0.12, 0.18, 0), new Vector3(0.05, 0.28, 0.08), new Vector3(0, 0.36, 0.14)]),
							12,
							0.05,
							8,
							false,
						]}
					/>
					<Mat c={c1} />
				</mesh>
				<Ball r={0.07} p={[0, 0.38, 0.17]} c={c1} s={[1.1, 0.8, 1.3]} />
				{eye([-0.035, 0.41, 0.23], 0.016)}
				{eye([0.035, 0.41, 0.23], 0.016)}
			</>
		),
	},
	"pet-dragon": {
		neck: [0, 0.14, 0.24],
		neckR: 0.08,
		head: [0, 0.28, 0.3],
		draw: (c1, c2) => (
			<>
				<Ball r={0.13} p={[0, 0.1, 0]} c={c1} s={[1.1, 0.6, 2]} />
				<Ball r={0.1} p={[0, 0.14, 0.3]} c={c1} s={[1.1, 0.85, 1.3]} />
				<Cone r={0.09} h={0.1} p={[0, 0.07, 0.36]} rot={[0.4, 0, 0]} c={c2} />
				{[-0.15, 0, 0.15].map((z) => (
					<Cone key={z} r={0.03} h={0.07} p={[0, 0.18, z]} c={darker(c1, 0.2)} />
				))}
				<Cone r={0.05} h={0.4} p={[0, 0.07, -0.4]} rot={[-Math.PI / 2, 0, 0]} c={c1} />
				{[-1, 1].flatMap((sx) => [-0.15, 0.15].map((z) => <Ball key={`${sx}${z}`} r={0.035} p={[sx * 0.14, 0.03, z]} c={c1} />))}
				{eye([-0.06, 0.18, 0.36], 0.02)}
				{eye([0.06, 0.18, 0.36], 0.02)}
			</>
		),
	},
};

const PETWEAR: Record<string, (pet: PetDef, c1: string) => React.ReactNode> = {
	"petwear-collar": (p, c1) => (
		<>
			<Ring r={p.neckR} tube={0.02} p={p.neck} c={c1} rot={[Math.PI / 2, 0, 0]} />
			<Ball r={0.025} p={[p.neck[0], p.neck[1] - 0.03, p.neck[2] + p.neckR]} c="#e8b93c" />
		</>
	),
	"petwear-bow": (p, c1) => (
		<group position={[p.head[0] + 0.06, p.head[1], p.head[2]]}>
			{[-1, 1].map((s) => (
				<Ball key={s} r={0.05} p={[s * 0.045, 0, 0]} c={c1} s={[1, 0.7, 0.5]} />
			))}
		</group>
	),
	"petwear-bandana": (p, c1) => (
		<Cone
			r={p.neckR + 0.02}
			h={p.neckR * 1.4}
			p={[p.neck[0], p.neck[1] - p.neckR * 0.5, p.neck[2] + 0.02]}
			rot={[Math.PI, 0, 0]}
			c={c1}
			seg={3}
		/>
	),
	"petwear-scarf": (p, c1) => <Ring r={p.neckR + 0.01} tube={0.035} p={p.neck} c={c1} rot={[Math.PI / 2, 0, 0]} />,
	"petwear-partyhat": (p) => (
		<>
			<Cone r={0.06} h={0.16} p={[p.head[0], p.head[1] + 0.08, p.head[2]]} c="#8a5bd1" />
			<Ball r={0.025} p={[p.head[0], p.head[1] + 0.17, p.head[2]]} c="#f2c94c" />
		</>
	),
	"petwear-crown": (p) => (
		<M c="#e8b93c" p={[p.head[0], p.head[1] + 0.03, p.head[2]]} side="double">
			<cylinderGeometry args={[0.07, 0.07, 0.07, 10, 1, true]} />
		</M>
	),
	"petwear-hearts": (p) => (
		<>
			<Ring r={p.neckR} tube={0.02} p={p.neck} c="#e85d75" rot={[Math.PI / 2, 0, 0]} />
			<Ball r={0.03} p={[p.neck[0], p.neck[1] - 0.03, p.neck[2] + p.neckR]} c="#e85d75" />
		</>
	),
	"petwear-pumpkin": (p) => (
		<Cone
			r={p.neckR + 0.02}
			h={p.neckR * 1.4}
			p={[p.neck[0], p.neck[1] - p.neckR * 0.5, p.neck[2] + 0.02]}
			rot={[Math.PI, 0, 0]}
			c="#f08a3c"
			seg={3}
		/>
	),
	"petwear-santa": (p) => (
		<>
			<Cone r={0.07} h={0.16} p={[p.head[0], p.head[1] + 0.08, p.head[2]]} rot={[0, 0, -0.3]} c="#d8413c" />
			<Ball r={0.025} p={[p.head[0] + 0.05, p.head[1] + 0.16, p.head[2]]} c="#f7f3ea" />
		</>
	),
};
export const PETWEAR_3D = new Set(Object.keys(PETWEAR));

/** A pet, two and a half times life size next to Roxy (toy proportions), with its accessory. */
export function Pet3D({ item, c1, c2, wear, wearC }: { item: string; c1: string; c2: string; wear?: string; wearC: string }) {
	const pet = PETS_3D[item];
	if (!pet) return null;
	const w = wear ? PETWEAR[wear] : undefined;
	return (
		<group scale={1.5}>
			{pet.draw(c1, c2)}
			{w?.(pet, wearC)}
		</group>
	);
}
