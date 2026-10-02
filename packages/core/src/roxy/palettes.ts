/**
 * Roxy's colours. These live only inside the stage, as fabric and paint, and never stand for right or wrong:
 * the four colour laws belong to letter tiles. Looks store the key, never the hex, so a palette can be retuned
 * without changing anyone's saved look.
 */

/** Fourteen skin tones, lightest to deepest. */
export const SKIN = {
	s1: "#fde7d6",
	s2: "#f9d7bf",
	s3: "#f3c7a6",
	s4: "#ecb68f",
	s5: "#e2a477",
	s6: "#d69465",
	s7: "#c68156",
	s8: "#b57049",
	s9: "#a2603e",
	s10: "#8f5134",
	s11: "#7b432b",
	s12: "#683724",
	s13: "#552c1d",
	s14: "#432317",
} as const;

/** Natural shades first, then the fun ones. Also used for brows and an animal's fur. */
export const HAIR = {
	h1: "#1f1712",
	h2: "#3b2618",
	h3: "#5c3a21",
	h4: "#7d4f2c",
	h5: "#a8703e",
	h6: "#d5a25e",
	h7: "#ecd08c",
	h8: "#b5452a",
	h9: "#d9692e",
	h10: "#9a9a9e",
	h11: "#f2efe8",
	h12: "#e87fb0",
	h13: "#8a5fd1",
	h14: "#3f7fd8",
	h15: "#3fb39a",
	h16: "#e8505b",
} as const;

export const EYE = {
	e1: "#3b2416",
	e2: "#6b4226",
	e3: "#8a6a2f",
	e4: "#4f7a3a",
	e5: "#3d78a8",
	e6: "#6e8796",
	e7: "#7a4fb0",
	e8: "#1c1c1c",
} as const;

export const FABRIC = {
	f1: "#f7f3ea",
	f2: "#2b2b33",
	f3: "#d8413c",
	f4: "#f08a3c",
	f5: "#f4cd4b",
	f6: "#8cc152",
	f7: "#2f9e6b",
	f8: "#3cb6c9",
	f9: "#3d74c9",
	f10: "#26386b",
	f11: "#8a5bd1",
	f12: "#e66fb0",
	f13: "#f6b6c8",
	f14: "#bfe3f0",
	f15: "#d9f0c8",
	f16: "#e8d9f7",
	f17: "#8a5a3c",
	f18: "#c9b28c",
	f19: "#9aa3ad",
	f20: "#b0894f",
} as const;

export const MAKEUP = {
	m1: "#f28fa5",
	m2: "#e85d75",
	m3: "#b3263f",
	m4: "#f0a07a",
	m5: "#c77d5e",
	m6: "#a873d9",
	m7: "#5fa3e0",
	m8: "#5fc9a3",
	m9: "#f2c94c",
	m10: "#e8e2f0",
} as const;

/** Fur, feathers and scales: natural coats first, then the fun ones. */
export const PET = {
	p1: "#2b2420",
	p2: "#6b4a33",
	p3: "#a8703e",
	p4: "#d9a066",
	p5: "#f2e3c8",
	p6: "#f7f4ee",
	p7: "#8a8a90",
	p8: "#e8822e",
	p9: "#5fa04a",
	p10: "#3f7f3a",
	p11: "#c9b25a",
	p12: "#e85d75",
	p13: "#5fa3e0",
	p14: "#8a5fd1",
	p15: "#f2c94c",
	p16: "#3fb39a",
} as const;

export const PALETTES = { skin: SKIN, hair: HAIR, eye: EYE, fabric: FABRIC, makeup: MAKEUP, pet: PET } as const;
export type PaletteName = keyof typeof PALETTES;
export type SkinId = keyof typeof SKIN;

/** The hex for a stored colour key, falling back to the palette's first colour. */
export function hex(palette: PaletteName, key: string | undefined): string {
	const p = PALETTES[palette] as Record<string, string>;
	return (key && p[key]) || Object.values(p)[0]!;
}
