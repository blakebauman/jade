import type { BufferGeometry } from "three";
import { describe, expect, it } from "vitest";
import { KIND_IDS, KINDS, type KindId } from "./kinds.ts";
import { propGeometry } from "./props.ts";

/** Triangles a kind may cost: small things are drawn a hundred times over. */
const BUDGET: Record<KindId, number> = {
	flower: 300,
	cone: 300,
	ball: 300,
	hydrant: 300,
	bin: 1500,
	postbox: 1500,
	bush: 1500,
	lamp: 1500,
	bench: 1500,
	sign: 1500,
	tree: 1500,
	car: 1500,
	kiosk: 1500,
	slide: 1500,
	fountain: 1500,
	bus: 1500,
	cottage: 6000,
	petshop: 6000,
	school: 6000,
	tower: 8000,
};

const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;

function attributesOk(g: BufferGeometry) {
	const n = g.getAttribute("position").count;
	expect(Object.keys(g.attributes).sort()).toEqual(["color", "normal", "position", "tint"]);
	expect(g.getAttribute("normal").count).toBe(n);
	expect(g.getAttribute("color").count).toBe(n);
	expect(g.getAttribute("color").itemSize).toBe(3);
	expect(g.getAttribute("tint").count).toBe(n);
	expect(g.getAttribute("tint").itemSize).toBe(1);
	const normals = g.getAttribute("normal");
	for (let i = 0; i < n; i++) {
		const len = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
		expect(Math.abs(len - 1)).toBeLessThan(0.01);
	}
}

describe("propGeometry", () => {
	it.each(KIND_IDS)("%s fits its footprint and height, within budget", (id) => {
		const kind = KINDS[id];
		const { body, glow } = propGeometry(id);
		attributesOk(body);
		if (glow) {
			attributesOk(glow);
			expect(glow.getAttribute("tint").array.every((t) => t === 0)).toBe(true);
		}

		const box = body.boundingBox?.clone();
		if (!box) throw new Error("no bounding box");
		if (glow?.boundingBox) box.union(glow.boundingBox);
		const reach = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
		expect(reach).toBeLessThanOrEqual(kind.r * 1.05);
		expect(Math.abs(box.min.y)).toBeLessThan(0.02);
		expect(box.max.y).toBeGreaterThan(kind.h * 0.75);
		expect(box.max.y).toBeLessThan(kind.h * 1.25);

		expect(tris(body) + (glow ? tris(glow) : 0)).toBeLessThanOrEqual(BUDGET[id]);
	});

	it("paints tint parts white and only on tinted kinds", () => {
		for (const id of KIND_IDS) {
			const { body } = propGeometry(id);
			const tint = body.getAttribute("tint");
			const colour = body.getAttribute("color");
			let tinted = 0;
			for (let i = 0; i < tint.count; i++) {
				if (tint.getX(i) !== 1) continue;
				tinted++;
				expect([colour.getX(i), colour.getY(i), colour.getZ(i)]).toEqual([1, 1, 1]);
			}
			expect(tinted > 0, id).toBe(Boolean(KINDS[id].tint));
		}
	});

	it("builds each kind once", () => {
		expect(propGeometry("car")).toBe(propGeometry("car"));
	});

	it("reports the triangle counts", () => {
		const counts = Object.fromEntries(
			KIND_IDS.map((id) => {
				const { body, glow } = propGeometry(id);
				return [id, tris(body) + (glow ? tris(glow) : 0)];
			}),
		);
		expect(Object.keys(counts)).toHaveLength(KIND_IDS.length);
		if (process.env.PROPS_TRIS) console.log(counts);
	});
});
