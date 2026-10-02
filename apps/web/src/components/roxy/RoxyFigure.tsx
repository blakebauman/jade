import { hex, ITEM, type Look, type Slot } from "@jade/core/roxy";
import { Fragment, type ReactNode, useId } from "react";
import { furFor } from "./art/body.tsx";
import { ART, HIDES_HAIR, type Parts } from "./art/index.ts";
import { type BodyShape, VIEW } from "./geometry.ts";

type Layer = [Slot, keyof Parts];

/** Back to front. Each item draws its parts where they belong in the stack. */
const LAYERS: Layer[] = [
	["background", "main"],
	["outer", "back"],
	["top", "back"],
	["bag", "back"],
	["hat", "back"],
	["hair", "back"],
	["gem", "back"],
	["form", "back"],
	["body", "main"],
	["socks", "main"],
	["shoes", "main"],
	["bottom", "main"],
	["top", "main"],
	["dress", "main"],
	["outer", "main"],
	["necklace", "main"],
	["bag", "main"],
	["pet", "main"],
	["petwear", "main"],
	["face", "main"],
	["form", "main"],
	["marks", "main"],
	["blush", "main"],
	["eyeshadow", "main"],
	["eyes", "main"],
	["brows", "main"],
	["nose", "main"],
	["mouth", "main"],
	["facepaint", "main"],
	["earrings", "main"],
	["hair", "front"],
	["gem", "front"],
	["glasses", "main"],
	["hat", "front"],
];

/** Slots an animal form draws itself, so the human versions step aside. */
const ANIMAL_REPLACES = new Set<Slot>(["face", "nose", "hair", "earrings", "gem"]);

function colours(slot: Slot, look: Look) {
	const worn = look.slots[slot];
	const item = worn && ITEM.get(worn.item);
	const [p1, p2] = item?.colors ?? [];
	return { c1: p1 ? hex(p1, worn?.c1) : "#888888", c2: p2 ? hex(p2, worn?.c2) : "#888888" };
}

type FigureProps = {
	look: Look;
	viewBox?: string;
	title?: string;
	className?: string;
	/** Slots to leave out, e.g. the stage and the pet when the world draws its own. */
	omit?: readonly Slot[];
	/** Only these slots (the pet on its own). */
	only?: readonly Slot[];
	/** Pixel size, for drawing the SVG onto a canvas (three.js textures need one). */
	size?: { width: number; height: number };
};

/** A whole Roxy as one SVG. `viewBox` crops it (item thumbnails show just the part that changed). */
export function RoxyFigure({ look, viewBox, title, className, omit, only, size }: FigureProps) {
	const uid = `r${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const form = look.slots.form && ITEM.get(look.slots.form.item);
	const animal = form?.animal;
	const shape = (look.slots.body?.item.replace("body-", "") ?? "mid") as BodyShape;
	const hairColour = colours("hair", look).c1;
	const skin = animal ? furFor(animal, colours("form", look).c1) : hex("skin", look.skin);
	const hideHair = !!look.slots.hat && HIDES_HAIR.has(look.slots.hat.item);
	const pet = look.slots.pet?.item;
	const lips = look.slots.lips && { item: look.slots.lips.item, color: colours("lips", look).c1 };

	const parts = new Map<Slot, Parts>();
	for (const [slot, worn] of Object.entries(look.slots) as [Slot, { item: string }][]) {
		if (animal && ANIMAL_REPLACES.has(slot)) continue;
		if (hideHair && slot === "hair") continue;
		if (omit?.includes(slot) || (only && !only.includes(slot))) continue;
		const art = ART[worn.item];
		if (!art) continue;
		parts.set(
			slot,
			art({
				shape,
				skin,
				hair: hairColour,
				uid: `${uid}${slot}`,
				...colours(slot, look),
				...(animal && { animal }),
				...(lips && { lips }),
				...(pet && { pet }),
			}),
		);
	}

	const layers: ReactNode[] = LAYERS.map(([slot, part]) => {
		const node = parts.get(slot)?.[part];
		return node ? <Fragment key={`${slot}-${part}`}>{node}</Fragment> : null;
	});

	return (
		<svg
			viewBox={viewBox ?? `0 0 ${VIEW.w} ${VIEW.h}`}
			className={className}
			role="img"
			aria-label={title ?? "Roxy"}
			xmlns="http://www.w3.org/2000/svg"
			{...size}
		>
			{layers}
		</svg>
	);
}

/** Where the pet stands in the figure's coordinates, for drawing it on its own. */
export const PET_VIEW = { x: 262, y: 452, w: 140, h: 170 } as const;

/** Crops for item thumbnails, so a hair swatch shows the head and a shoe shows the feet. */
export const SLOT_VIEW: Partial<Record<Slot, string>> = {
	face: "70 50 260 260",
	eyes: "110 130 180 120",
	brows: "110 120 180 120",
	nose: "130 150 140 120",
	mouth: "130 170 140 120",
	marks: "100 140 200 140",
	blush: "100 140 200 140",
	eyeshadow: "110 130 180 120",
	lips: "130 170 140 120",
	facepaint: "90 100 220 200",
	hair: "50 20 300 420",
	hat: "60 0 280 260",
	glasses: "90 120 220 140",
	earrings: "80 120 240 180",
	gem: "40 0 320 500",
	necklace: "120 230 160 140",
	top: "90 230 220 260",
	bottom: "90 340 220 280",
	dress: "70 230 260 400",
	outer: "60 230 280 360",
	socks: "100 440 200 200",
	shoes: "100 500 200 140",
	bag: "60 230 320 340",
	pet: "250 440 150 190",
	petwear: "250 440 150 190",
};
