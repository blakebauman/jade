import { describe, expect, it } from "vitest";
import { HEAD_R } from "./body.tsx";
import { CLOUDS, cloudPoints, overFace } from "./hair.tsx";

describe("3D hair", () => {
	it("keeps curls and coils off the face", () => {
		for (const [style, parts] of Object.entries(CLOUDS))
			for (const [n, rx, ry, cy, br, rz] of parts)
				for (const p of cloudPoints(n, rx, ry, cy, rz)) {
					// A ball's whole front edge, not only its middle, stays off the face.
					const front: [number, number, number] = [p[0], p[1] - br * 0.5, p[2] + br];
					expect(overFace(p) || (overFace(front) && p[1] < HEAD_R * 0.5), `${style} at ${p.map((v) => v.toFixed(2))}`).toBe(false);
				}
	});
});
