import type { Animal } from "@jade/core/roxy";
import type { ReactNode } from "react";
import {
	armPath,
	CX,
	dims,
	EAR_Y,
	EYE_DX,
	EYE_Y,
	footAt,
	HEAD,
	HIP_Y,
	handAt,
	INK,
	LINE,
	legPath,
	SHOULDER_Y,
	shade,
	torso,
} from "../geometry.ts";
import type { Art, ArtProps } from "./types.ts";

/** Arms, legs, neck and torso in skin (or fur). Clothes cover what they cover. */
const body: Art = ({ shape, skin }) => {
	const d = dims(shape);
	const edge = shade(skin, -0.28);
	const limb = (path: string, width: number) => (
		<>
			<path d={path} stroke={edge} strokeOpacity={0.55} strokeWidth={width + 5} strokeLinecap="round" fill="none" />
			<path d={path} stroke={skin} strokeWidth={width} strokeLinecap="round" fill="none" />
		</>
	);
	return {
		main: (
			<g>
				{limb(legPath(d, -1), d.leg)}
				{limb(legPath(d, 1), d.leg)}
				{([-1, 1] as const).map((s) => {
					const f = footAt(d, s);
					return <ellipse key={s} cx={f.x} cy={f.y} rx={d.leg * 0.62} ry={12} fill={skin} {...LINE} />;
				})}
				<rect x={CX - 15} y={HEAD.y + 70} width={30} height={SHOULDER_Y - HEAD.y - 60} fill={skin} />
				<path d={torso(d)} fill={skin} {...LINE} />
				<rect x={CX - 15} y={HEAD.y + 70} width={30} height={22} fill={shade(skin, -0.14)} />
				{limb(armPath(d, -1), d.arm)}
				{limb(armPath(d, 1), d.arm)}
				{([-1, 1] as const).map((s) => {
					const h = handAt(d, s);
					return <circle key={s} cx={h.x} cy={h.y} r={h.r} fill={skin} {...LINE} />;
				})}
			</g>
		),
	};
};

const ears = (skin: string, rx: number = HEAD.rx) =>
	([-1, 1] as const).map((s) => (
		<g key={s}>
			<ellipse cx={HEAD.x + s * (rx - 2)} cy={EAR_Y} rx={15} ry={21} fill={skin} {...LINE} />
			<path
				d={`M ${HEAD.x + s * (rx + 3)},${EAR_Y - 9} q ${s * 5},9 0,18`}
				stroke={shade(skin, -0.25)}
				strokeWidth={3}
				fill="none"
				strokeLinecap="round"
			/>
		</g>
	));

const head =
	(shapeEl: (fill: string) => ReactNode, rx: number = HEAD.rx): Art =>
	({ skin }) => ({
		main: (
			<g>
				{ears(skin, rx)}
				{shapeEl(skin)}
			</g>
		),
	});

const FACES: Record<string, Art> = {
	"face-oval": head((fill) => <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx} ry={HEAD.ry} fill={fill} {...LINE} />),
	"face-round": head((fill) => <ellipse cx={HEAD.x} cy={HEAD.y + 4} rx={97} ry={94} fill={fill} {...LINE} />, 97),
	"face-heart": head(
		(fill) => (
			<path
				d={`M ${CX},${HEAD.y + 98} C ${CX - 48},${HEAD.y + 90} ${CX - 92},${HEAD.y + 50} ${CX - 92},${HEAD.y - 6} C ${CX - 92},${HEAD.y - 66} ${CX - 52},${HEAD.y - 98} ${CX},${HEAD.y - 98} C ${CX + 52},${HEAD.y - 98} ${CX + 92},${HEAD.y - 66} ${CX + 92},${HEAD.y - 6} C ${CX + 92},${HEAD.y + 50} ${CX + 48},${HEAD.y + 90} ${CX},${HEAD.y + 98} Z`}
				fill={fill}
				{...LINE}
			/>
		),
		92,
	),
	"face-square": head((fill) => <rect x={HEAD.x - 90} y={HEAD.y - 96} width={180} height={192} rx={58} fill={fill} {...LINE} />),
};

// ── Animals: the moon gem's forms, and the small gems' ears and tails ──

/** Fur for the body. A panda is white with dark patches; everyone else is their fur colour. */
export const furFor = (animal: Animal, c1: string) => (animal === "panda" ? "#f4f1ea" : c1);

/** Ears for each animal, sitting on top of the head (or on hair, for a small gem). */
export function animalEars(animal: Animal, fur: string, patch: string): ReactNode {
	const inner = "#f2a7b5";
	const dark = shade(fur, -0.3);
	switch (animal) {
		case "cat":
			return ([-1, 1] as const).map((s) => (
				<g key={s}>
					<path d={`M ${CX + s * 82},${118} L ${CX + s * 70},${42} L ${CX + s * 28},${84} Z`} fill={fur} {...LINE} />
					<path d={`M ${CX + s * 72},${104} L ${CX + s * 66},${62} L ${CX + s * 42},${86} Z`} fill={inner} />
				</g>
			));
		case "fox":
			return ([-1, 1] as const).map((s) => (
				<g key={s}>
					<path d={`M ${CX + s * 88},${124} L ${CX + s * 82},${26} L ${CX + s * 26},${86} Z`} fill={fur} {...LINE} />
					<path d={`M ${CX + s * 84},${52} L ${CX + s * 82},${26} L ${CX + s * 60},${50} Z`} fill={INK} fillOpacity={0.75} />
					<path d={`M ${CX + s * 76},${108} L ${CX + s * 74},${62} L ${CX + s * 44},${90} Z`} fill="#fbe9dc" />
				</g>
			));
		case "bunny":
			return ([-1, 1] as const).map((s) => (
				<g key={s} transform={`rotate(${s * 12} ${CX + s * 42} 100)`}>
					<ellipse cx={CX + s * 42} cy={56} rx={21} ry={54} fill={fur} {...LINE} />
					<ellipse cx={CX + s * 42} cy={60} rx={10} ry={40} fill={inner} />
				</g>
			));
		case "puppy":
			return ([-1, 1] as const).map((s) => (
				<path
					key={s}
					d={`M ${CX + s * 58},${92} C ${CX + s * 112},${78} ${CX + s * 124},${150} ${CX + s * 112},${222} C ${CX + s * 104},${246} ${CX + s * 82},${236} ${CX + s * 84},${206} C ${CX + s * 86},${160} ${CX + s * 76},${120} ${CX + s * 58},${92} Z`}
					fill={dark}
					{...LINE}
				/>
			));
		case "panda":
			return ([-1, 1] as const).map((s) => <circle key={s} cx={CX + s * 70} cy={92} r={28} fill={patch} {...LINE} />);
		case "bear":
			return ([-1, 1] as const).map((s) => (
				<g key={s}>
					<circle cx={CX + s * 70} cy={92} r={28} fill={fur} {...LINE} />
					<circle cx={CX + s * 70} cy={94} r={15} fill={shade(fur, 0.35)} />
				</g>
			));
	}
}

/** A tail, drawn behind the body from the back of the hip. */
export function animalTail(animal: Animal, fur: string, patch: string, shape: ArtProps["shape"]): ReactNode {
	const d = dims(shape);
	const x = CX + d.hip - 14;
	const y = HIP_Y - 26;
	switch (animal) {
		case "cat":
			return (
				<path
					d={`M ${x},${y} C ${x + 60},${y + 10} ${x + 70},${y - 60} ${x + 46},${y - 110}`}
					stroke={fur}
					strokeWidth={17}
					strokeLinecap="round"
					fill="none"
				/>
			);
		case "fox":
			return (
				<g>
					<path
						d={`M ${x - 4},${y + 6} C ${x + 70},${y + 30} ${x + 110},${y - 40} ${x + 74},${y - 112} C ${x + 54},${y - 70} ${x + 30},${y - 30} ${x - 4},${y + 6} Z`}
						fill={fur}
						{...LINE}
					/>
					<path
						d={`M ${x + 74},${y - 112} C ${x + 90},${y - 84} ${x + 90},${y - 66} ${x + 82},${y - 54} C ${x + 70},${y - 70} ${x + 66},${y - 90} ${x + 74},${y - 112} Z`}
						fill="#fbf4ec"
					/>
				</g>
			);
		case "bunny":
			return <circle cx={x + 30} cy={y + 8} r={22} fill="#fbf7f1" {...LINE} />;
		case "puppy":
			return <path d={`M ${x},${y} q 34,-6 40,-52`} stroke={fur} strokeWidth={15} strokeLinecap="round" fill="none" />;
		case "panda":
			return <circle cx={x + 12} cy={y + 6} r={15} fill={patch} />;
		case "bear":
			return <circle cx={x + 12} cy={y + 6} r={16} fill={fur} {...LINE} />;
	}
}

/** The whole animal head. Eyes, brows, mouth and makeup still go on top, so it's still them. */
function animalHead(animal: Animal, fur: string, patch: string): ReactNode {
	const muzzle = animal === "panda" ? "#ffffff" : shade(fur, 0.55);
	const nose = animal === "cat" || animal === "bunny" ? "#e98a9c" : INK;
	const headShape =
		animal === "fox" ? (
			<path
				d={`M ${CX},${HEAD.y + 88} C ${CX - 40},${HEAD.y + 86} ${CX - 70},${HEAD.y + 66} ${CX - 104},${HEAD.y + 40} C ${CX - 92},${HEAD.y - 50} ${CX - 60},${HEAD.y - 88} ${CX},${HEAD.y - 88} C ${CX + 60},${HEAD.y - 88} ${CX + 92},${HEAD.y - 50} ${CX + 104},${HEAD.y + 40} C ${CX + 70},${HEAD.y + 66} ${CX + 40},${HEAD.y + 86} ${CX},${HEAD.y + 88} Z`}
				fill={fur}
				{...LINE}
			/>
		) : (
			<ellipse cx={HEAD.x} cy={HEAD.y + 6} rx={animal === "bear" || animal === "panda" ? 98 : 94} ry={88} fill={fur} {...LINE} />
		);
	return (
		<g>
			{animalEars(animal, fur, patch)}
			{headShape}
			{animal === "fox" && (
				<path
					d={`M ${CX},${HEAD.y + 88} C ${CX - 40},${HEAD.y + 86} ${CX - 70},${HEAD.y + 66} ${CX - 104},${HEAD.y + 40} C ${CX - 60},${HEAD.y + 40} ${CX - 30},${HEAD.y + 20} ${CX},${HEAD.y + 30} C ${CX + 30},${HEAD.y + 20} ${CX + 60},${HEAD.y + 40} ${CX + 104},${HEAD.y + 40} C ${CX + 70},${HEAD.y + 66} ${CX + 40},${HEAD.y + 86} ${CX},${HEAD.y + 88} Z`}
					fill="#fbf4ec"
				/>
			)}
			{animal === "panda" &&
				([-1, 1] as const).map((s) => (
					<ellipse
						key={s}
						cx={CX + s * EYE_DX}
						cy={EYE_Y + 2}
						rx={26}
						ry={30}
						transform={`rotate(${s * -24} ${CX + s * EYE_DX} ${EYE_Y})`}
						fill={patch}
					/>
				))}
			{animal !== "fox" && <ellipse cx={CX} cy={HEAD.y + 54} rx={40} ry={27} fill={muzzle} />}
			<path
				d={`M ${CX - 11},${HEAD.y + 38} Q ${CX},${HEAD.y + 34} ${CX + 11},${HEAD.y + 38} Q ${CX},${HEAD.y + 54} ${CX - 11},${HEAD.y + 38} Z`}
				fill={nose}
			/>
			{(animal === "cat" || animal === "fox" || animal === "bunny") &&
				([-1, 1] as const).flatMap((s) =>
					[-8, 2, 12].map((dy) => (
						<path
							key={`${s}${dy}`}
							d={`M ${CX + s * 44},${HEAD.y + 50 + dy / 2} L ${CX + s * 92},${HEAD.y + 42 + dy * 1.4}`}
							stroke={INK}
							strokeOpacity={0.5}
							strokeWidth={2}
							strokeLinecap="round"
						/>
					)),
				)}
		</g>
	);
}

const PATCH_DEFAULT = "#2b2b33";
const form =
	(animal: Animal): Art =>
	({ c1, shape }) => {
		const fur = furFor(animal, c1);
		const patch = animal === "panda" ? (c1 === fur ? PATCH_DEFAULT : c1) : PATCH_DEFAULT;
		return { main: animalHead(animal, fur, patch), back: animalTail(animal, fur, patch, shape) };
	};

/** Small gems: animal ears over the hair and a tail, on the character as they are. */
const gem =
	(animal: Animal): Art =>
	({ c1, shape }) => ({
		front: animalEars(animal, animal === "panda" ? "#f4f1ea" : c1, animal === "panda" ? c1 : PATCH_DEFAULT),
		back: animalTail(animal, animal === "panda" ? "#f4f1ea" : c1, animal === "panda" ? c1 : PATCH_DEFAULT, shape),
	});

const ANIMAL_LIST: Animal[] = ["fox", "cat", "bunny", "puppy", "panda", "bear"];

export const BODY_ART: Record<string, Art> = {
	"body-slim": body,
	"body-mid": body,
	"body-round": body,
	...FACES,
	...Object.fromEntries(ANIMAL_LIST.map((a) => [`form-${a}`, form(a)])),
	...Object.fromEntries(ANIMAL_LIST.map((a) => [`gem-${a}`, gem(a)])),
};
