/**
 * Everything in Gobble Town a hole can swallow, smallest first. `r` is the radius of the circle the thing stands in
 * (its footprint, in world units: a road is 4 wide), and a hole swallows it once the hole is wide enough for it to
 * fit (`fits` in sim.ts). `h` is how tall it's drawn. `value` is what it adds to the score, and so to the hole's size.
 * `tint` kinds take a colour per copy (a red car, a blue car) on the parts marked tintable in props.ts.
 */

export const KIND_IDS = [
	"flower",
	"cone",
	"ball",
	"hydrant",
	"bin",
	"postbox",
	"bush",
	"lamp",
	"bench",
	"sign",
	"tree",
	"car",
	"kiosk",
	"slide",
	"fountain",
	"bus",
	"cottage",
	"petshop",
	"school",
	"tower",
] as const;
export type KindId = (typeof KIND_IDS)[number];

export type Kind = {
	id: KindId;
	/** Plural, for "Now you can gobble cars!". */
	label: string;
	r: number;
	h: number;
	value: number;
	/** Colours a copy can be painted (props.ts marks which parts take it). */
	tint?: readonly string[];
	/** Whether reaching this size is announced ("Now you can gobble trees!"). */
	milestone?: boolean;
};

const PETALS = ["#e85d75", "#f2c94c", "#f6f1ff", "#b388eb", "#ff9f6b"];
const PAINT = ["#e85d75", "#3d74c9", "#f2c94c", "#7dbf52", "#f08a3c", "#8a5bd1", "#4cc3c7"];

export const KINDS: Record<KindId, Kind> = {
	flower: { id: "flower", label: "flowers", r: 0.16, h: 0.35, value: 1, tint: PETALS },
	cone: { id: "cone", label: "cones", r: 0.2, h: 0.45, value: 1 },
	ball: { id: "ball", label: "balls", r: 0.22, h: 0.44, value: 1, tint: PAINT },
	hydrant: { id: "hydrant", label: "fire hydrants", r: 0.24, h: 0.6, value: 2 },
	bin: { id: "bin", label: "bins", r: 0.3, h: 0.75, value: 2, tint: ["#5aa469", "#3d74c9", "#6d7484"] },
	postbox: { id: "postbox", label: "post boxes", r: 0.28, h: 0.9, value: 3 },
	bush: { id: "bush", label: "bushes", r: 0.5, h: 0.7, value: 3 },
	lamp: { id: "lamp", label: "lamp posts", r: 0.4, h: 2.6, value: 4 },
	bench: { id: "bench", label: "benches", r: 0.62, h: 0.75, value: 5 },
	sign: { id: "sign", label: "signs", r: 0.55, h: 1.6, value: 4 },
	tree: { id: "tree", label: "trees", r: 0.8, h: 2.8, value: 9, milestone: true },
	car: { id: "car", label: "cars", r: 0.95, h: 0.95, value: 12, tint: PAINT, milestone: true },
	kiosk: { id: "kiosk", label: "ice-cream stands", r: 1.1, h: 2, value: 15, tint: ["#f6a6c1", "#9fd8f0", "#f9d36b"] },
	slide: { id: "slide", label: "slides", r: 1.2, h: 1.7, value: 15 },
	fountain: { id: "fountain", label: "fountains", r: 1.5, h: 1.5, value: 22 },
	bus: { id: "bus", label: "buses", r: 1.6, h: 1.5, value: 26, tint: ["#f2b33d", "#e85d75", "#3d74c9"], milestone: true },
	cottage: { id: "cottage", label: "houses", r: 2.4, h: 3.2, value: 45, milestone: true },
	petshop: { id: "petshop", label: "the pet shop", r: 3.1, h: 3.6, value: 80, milestone: true },
	school: { id: "school", label: "the school", r: 3.7, h: 4.2, value: 110, milestone: true },
	tower: { id: "tower", label: "the clock tower", r: 4.4, h: 8, value: 160, milestone: true },
};
