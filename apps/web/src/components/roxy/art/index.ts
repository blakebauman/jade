import { BODY_ART } from "./body.tsx";
import { CLOTHES_ART } from "./clothes.tsx";
import { EXTRAS_ART } from "./extras.tsx";
import { FACE_ART } from "./face.tsx";
import { HAIR_ART } from "./hair.tsx";
import { PET_ART } from "./pets.tsx";
import { STAGE_ART } from "./stages.tsx";
import type { Art } from "./types.ts";

export { HIDES_HAIR } from "./extras.tsx";
export type { Art, ArtProps, Parts } from "./types.ts";

/** Every catalog item's art, by id. A test checks this covers the whole catalog. */
export const ART: Record<string, Art> = { ...STAGE_ART, ...BODY_ART, ...FACE_ART, ...HAIR_ART, ...CLOTHES_ART, ...EXTRAS_ART, ...PET_ART };
