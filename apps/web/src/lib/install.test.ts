import { describe, expect, it } from "vitest";
import { isIos } from "./install.ts";

describe("isIos", () => {
	it("knows an iPhone", () => {
		expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(true);
	});
	it("knows an iPad that says it's a Mac", () => {
		expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
	});
	it("leaves a real Mac alone", () => {
		expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
	});
});
