import { beforeEach, describe, expect, it } from "vitest";
import { forgetDevice } from "./device.ts";
import { isParentUnlocked, lockParent, unlockParent } from "./parentLock.ts";

const IDLE = 5 * 60_000;

describe("parent lock", () => {
	beforeEach(() => sessionStorage.clear());

	it("starts locked and unlocks for the parent who entered the PIN only", () => {
		expect(isParentUnlocked("a", IDLE)).toBe(false);
		unlockParent("a", 1_000);
		expect(isParentUnlocked("a", IDLE, 1_000)).toBe(true);
		expect(isParentUnlocked("b", IDLE, 1_000)).toBe(false);
	});

	it("locks again after the idle time, and activity restarts the clock", () => {
		unlockParent("a", 0);
		expect(isParentUnlocked("a", IDLE, IDLE - 1)).toBe(true);
		expect(isParentUnlocked("a", IDLE, IDLE)).toBe(false);
		unlockParent("a", IDLE - 1);
		expect(isParentUnlocked("a", IDLE, 2 * IDLE - 2)).toBe(true);
	});

	it("treats a clock set backwards as locked", () => {
		unlockParent("a", 10_000);
		expect(isParentUnlocked("a", IDLE, 5_000)).toBe(false);
	});

	it("uses the idle time it's given", () => {
		unlockParent("a", 0);
		expect(isParentUnlocked("a", 60_000, 59_999)).toBe(true);
		expect(isParentUnlocked("a", 60_000, 60_000)).toBe(false);
		expect(isParentUnlocked("a", 30 * 60_000, 60_000)).toBe(true);
	});

	it("locks on demand and when the device forgets the family (sign-out)", async () => {
		unlockParent("a");
		lockParent();
		expect(isParentUnlocked("a", IDLE)).toBe(false);
		unlockParent("a");
		await forgetDevice();
		expect(isParentUnlocked("a", IDLE)).toBe(false);
	});

	it("ignores the old flag format", () => {
		sessionStorage.setItem("jade.parent-unlocked", "1");
		expect(isParentUnlocked("a", IDLE)).toBe(false);
	});
});
