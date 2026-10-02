import { ITEMS, starterLook, wear } from "@jade/core/roxy";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART } from "./art/index.ts";
import { RoxyFigure } from "./RoxyFigure.tsx";

describe("Roxy art", () => {
	it("has art for every item in the catalog, and nothing else", () => {
		const ids = ITEMS.map((i) => i.id);
		expect(ids.filter((id) => !ART[id])).toEqual([]);
		expect(Object.keys(ART).filter((id) => !ids.includes(id))).toEqual([]);
	});

	it("draws every item on every body shape", () => {
		for (const body of ["body-slim", "body-mid", "body-round"]) {
			const base = wear(starterLook("art-test"), "body", { item: body });
			for (const item of ITEMS) {
				const svg = renderToStaticMarkup(createElement(RoxyFigure, { look: wear(base, item.slot, { item: item.id }) }));
				expect(svg, `${item.id} on ${body}`).not.toMatch(/NaN|undefined/);
			}
		}
	});

	it("keeps clip ids apart when two figures share a page", () => {
		const look = wear(starterLook("a"), "top", { item: "top-stripes" });
		const html = renderToStaticMarkup(createElement("div", null, createElement(RoxyFigure, { look }), createElement(RoxyFigure, { look })));
		const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
