import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "./Model.tsx";

// Tests run from apps/web (and jsdom's URL isn't one node:fs accepts).
const file = (url: string) => join(process.cwd(), "public", url);

describe("generated models", () => {
	for (const [id, url] of Object.entries(MODELS))
		it(`${id} is in public/ and cut down for an iPad`, () => {
			// Straight from Tripo a prop is over 2 MB with three 2048px maps; cut down it's one 512px map and meshopt.
			expect(statSync(file(url)).size).toBeLessThan(200_000);
			const json = readFileSync(file(url)).toString("latin1");
			expect(json).toContain("EXT_meshopt_compression");
			expect(json).not.toContain("normalTexture");
		});
});
