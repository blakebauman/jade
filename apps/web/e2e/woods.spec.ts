import { expect, type Page, test } from "@playwright/test";
import { openLanding } from "./helpers.ts";

type Peek = {
	status: string;
	inv: Record<number, number>;
	others: { label: string; p: number[] }[];
	body?: [number, number, number];
	target: { cell: number[]; normal: number[] } | null;
	look: { yaw: number; pitch: number };
};
type Hooks = {
	peek: () => Peek;
	block: (x: number, y: number, z: number) => number;
	lookAt: (x: number, y: number, z: number) => boolean;
	mine: (on: boolean) => void;
	place: () => void;
	select: (b: number) => void;
	setState: (name: string) => Promise<unknown>;
};
type Diagnostics = { renderer: { calls: number; triangles: number }; columns: number };

const DIRT = 2;
const WOOL_RED = 18;

async function family(page: Page) {
	await openLanding(page);
	const h = { Origin: new URL(page.url()).origin };
	await page.request.post("/api/auth/sign-up/email", {
		headers: h,
		data: { email: `woods-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: "spelling-bee-1", name: "P" },
	});
	const kid = async (name: string) =>
		(await (await page.request.post("/api/children", { headers: h, data: { name } })).json()).id as string;
	return { kid };
}

async function open(page: Page, childId: string, go = true) {
	if (go) await page.goto(`/play/${childId}/games/woods`);
	await expect(page.getByRole("heading", { name: "Campfire Woods" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Start" })).toBeEnabled();
	await page.getByRole("button", { name: "Start" }).click();
	await page.waitForFunction(() => {
		const d = (window as unknown as { __THREE_GAME_DIAGNOSTICS__?: Diagnostics }).__THREE_GAME_DIAGNOSTICS__;
		return !!d && d.renderer.calls > 0 && d.columns > 20;
	});
}

const hooks = <T>(page: Page, fn: (h: Hooks, arg: unknown) => T, arg?: unknown) =>
	page.evaluate(
		([src, a]) =>
			new Function("h", "a", `return (${src})(h, a)`)(
				(window as unknown as { __THREE_GAME_TEST_HOOKS__: Hooks }).__THREE_GAME_TEST_HOOKS__,
				a,
			),
		[fn.toString(), arg] as const,
	) as Promise<Awaited<T>>;

test("dig and build on the family's island, and see a brother or sister do it too", async ({ page }) => {
	test.skip(test.info().project.name !== "laptop", "the two-screen check runs on the laptop; touch is checked below");
	const f = await family(page);
	const jade = await f.kid("Jade");
	const sam = await f.kid("Sam");
	await open(page, jade);

	// A second screen, signed in to the same family, as Sam.
	const other = await page.context().newPage();
	await open(other, sam);
	await expect.poll(() => hooks(page, (h) => h.peek().others.map((o) => o.label))).toEqual(["Sam"]);

	// Dig the grass two steps ahead.
	const at = (await hooks(page, (h) => h.peek().body))!;
	const [x, y, z] = [Math.floor(at[0]), Math.floor(at[1]) - 1, Math.floor(at[2]) + 2];
	expect(await hooks(page, (h, a) => h.block(...(a as [number, number, number])), [x, y, z])).toBe(1);
	await hooks(page, (h, a) => h.lookAt(...(a as [number, number, number])), [x, y, z]);
	await hooks(page, (h) => h.mine(true));
	await expect.poll(() => hooks(page, (h, d) => h.peek().inv[d as number] ?? 0, DIRT), { timeout: 5000 }).toBe(1);
	await hooks(page, (h) => h.mine(false));
	await expect.poll(() => hooks(other, (h, a) => h.block(...(a as [number, number, number])), [x, y, z])).toBe(0);

	// Build red wool back in the hole, on the dirt below it.
	await hooks(page, (h, b) => h.select(b as number), WOOL_RED);
	await hooks(page, (h, a) => h.lookAt(...(a as [number, number, number])), [x, y - 1, z]);
	const aim = (await hooks(page, (h) => h.peek().target))!;
	const spot = [0, 1, 2].map((k) => aim.cell[k]! + aim.normal[k]!);
	await hooks(page, (h) => h.place());
	await expect.poll(() => hooks(other, (h, a) => h.block(...(a as [number, number, number])), spot)).toBe(WOOL_RED);
	await expect.poll(() => hooks(page, (h, b) => h.peek().inv[b as number], WOOL_RED)).toBe(63);
	// The dug-up dirt is on the hotbar to build with (one, or two if the dig went on into the block below).
	await expect(page.getByRole("button", { name: /^Dirt, [12]$/ })).toBeVisible();
	await other.close();
});

test("the island grows dark at night, with the fire still on the status", async ({ page }) => {
	const f = await family(page);
	await open(page, await f.kid("Ava"));
	await hooks(page, (h) => h.setState("night"));
	await expect(page.getByText(/Night 1 · dawn in \d min/)).toBeVisible();
	await expect(page.getByRole("meter", { name: "Campfire" })).toBeVisible();
});

test("a parent links with a friend's family, and their kid visits our island", async ({ page, browser }) => {
	test.skip(test.info().project.name !== "laptop", "two families on one laptop");
	// Family one: names itself and makes a code.
	const ours = await family(page);
	const jade = await ours.kid("Jade");
	const origin = new URL(page.url()).origin;
	await page.request.put("/api/parent/friends", { headers: { Origin: origin }, data: { label: "The Rivers" } });
	const { code } = await (await page.request.post("/api/parent/friends/code", { headers: { Origin: origin } })).json();

	// Family two, in its own browser: enters the code in Friends.
	const theirs = await browser.newContext();
	const other = await theirs.newPage();
	const friend = await family(other);
	const theo = await friend.kid("Theo");
	await other.goto("/parent/friends");
	await other.getByLabel("A code from a friend").fill(`${code.slice(0, 4)}-${code.slice(4)}`);
	await other.getByRole("button", { name: "Look it up" }).click();
	await expect(other.getByText("This code is from The Rivers.")).toBeVisible();
	await other.getByRole("button", { name: "Be friends" }).click();
	await expect(other.getByRole("status").filter({ hasText: "You’re friends with The Rivers." })).toBeVisible();

	// Jade is on her island; Theo picks it and joins, shown to her by his initial.
	await open(page, jade);
	await other.goto(`/play/${theo}/games/woods`);
	await other.getByRole("radio", { name: /The Rivers/ }).check();
	await open(other, theo, false);
	await expect(other.getByText("You’re visiting The Rivers!")).toBeVisible();
	await expect.poll(() => hooks(page, (h) => h.peek().others.map((o) => o.label))).toEqual(["T"]);
	await theirs.close();
});

test("a finger drags to look round, holds to dig and taps to build", async ({ browser, browserName }, info) => {
	test.skip(browserName !== "chromium" || info.project.name !== "laptop", "touch events are sent through Chromium's protocol");
	test.slow();
	const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
	const page = await context.newPage();
	const f = await family(page);
	const id = await f.kid("Ava");
	await page.goto(`/play/${id}/games/woods`);
	await expect(page.getByRole("button", { name: "Start" })).toBeEnabled();
	await page.getByRole("button", { name: "Start" }).tap();
	await page.waitForFunction(
		() => ((window as unknown as { __THREE_GAME_DIAGNOSTICS__?: Diagnostics }).__THREE_GAME_DIAGNOSTICS__?.columns ?? 0) > 20,
	);
	const cdp = await context.newCDPSession(page);
	// iOS can hand a finger a negative id.
	const finger = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number) =>
		cdp.send("Input.dispatchTouchEvent", { type, touchPoints: x === undefined ? [] : [{ x, y: y!, id: -3 }] });
	const peek = () => hooks(page, (h) => h.peek());

	// A drag across turns the view.
	const yaw = (await peek()).look.yaw;
	await finger("touchStart", 600, 500);
	for (const x of [580, 540, 480, 420]) await finger("touchMove", x, 500);
	await finger("touchEnd");
	expect((await peek()).look.yaw).not.toBeCloseTo(yaw, 2);

	// Look down at the ground, then hold a finger on it: it's dug up.
	await hooks(page, (h) => {
		const p = h.peek().body!;
		h.lookAt(Math.floor(p[0]), Math.floor(p[1]) - 1, Math.floor(p[2]) - 2);
	});
	await finger("touchStart", 410, 590);
	await expect.poll(async () => (await peek()).inv[DIRT] ?? 0, { timeout: 8000 }).toBeGreaterThan(0);
	await finger("touchEnd");

	// A quick tap builds with the block in hand.
	const wool = (await peek()).inv[WOOL_RED];
	await finger("touchStart", 410, 640);
	await finger("touchEnd");
	await expect.poll(async () => (await peek()).inv[WOOL_RED]).toBe(wool! - 1);
	await context.close();
});

test("the Play home has a Campfire Woods card", async ({ page }) => {
	const f = await family(page);
	const id = await f.kid("Ava");
	await page.goto(`/play/${id}/games`);
	await page.getByRole("link", { name: /Campfire Woods/ }).click();
	await expect(page.getByRole("heading", { name: "Campfire Woods" })).toBeVisible();
});
