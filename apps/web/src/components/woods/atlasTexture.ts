import { CanvasTexture, NearestFilter, NearestMipmapLinearFilter, SRGBColorSpace } from "three";
import { drawAtlas } from "./atlas.ts";

/** The atlas as a texture, for the scene. Kept apart from atlas.ts, which the screen loads, so three.js waits for the lazy scene. */
export function atlasTexture() {
	const t = new CanvasTexture(drawAtlas());
	t.magFilter = NearestFilter;
	// Crisp pixels up close; far off, mipmaps blend each tile down so distant leaves read as soft colour, not noise.
	t.minFilter = NearestMipmapLinearFilter;
	t.generateMipmaps = true;
	t.anisotropy = 4;
	t.colorSpace = SRGBColorSpace;
	return t;
}
