import type { Animal } from "@jade/core/roxy";
import type { ReactNode } from "react";
import type { BodyShape } from "../geometry.ts";

/** What every item's art is drawn from: the body it sits on and its own colours, already as hex. */
export type ArtProps = {
	shape: BodyShape;
	c1: string;
	c2: string;
	skin: string;
	/** The hair colour, for brows and lashes. */
	hair: string;
	/** Set when the moon gem has turned the character into an animal. */
	animal?: Animal;
	/** Unique per figure, for clip-path and gradient ids. */
	uid: string;
	/** The pet's item id, so its accessories know where its neck and head are. */
	pet?: string;
	/** The lip colour and style, which the mouth draws with. */
	lips?: { item: string; color: string };
};

/** An item can draw behind the body, at its own place in the stack, and in front of the face. */
export type Parts = { back?: ReactNode; main?: ReactNode; front?: ReactNode };
export type Art = (p: ArtProps) => Parts;
