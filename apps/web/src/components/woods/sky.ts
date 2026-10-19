import {
	BackSide,
	BoxGeometry,
	CanvasTexture,
	Color,
	DynamicDrawUsage,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	NearestFilter,
	PlaneGeometry,
	ShaderMaterial,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
} from "three";

/**
 * The sky over the island: a dome that fades from a deep top colour to a soft horizon (the fog takes the horizon's
 * colour, so the far woods melt into it), a square pixel sun by day and a moon by night that cross the sky with the
 * clock, and a layer of chunky clouds drifting overhead. Everything follows the camera, so it's always "far away".
 */

const TOP_DAY = new Color("#4f9fe6");
const HORIZON_DAY = new Color("#cfe9f7");
const TOP_DUSK = new Color("#5a5c9e");
const HORIZON_DUSK = new Color("#f2b48a");
const TOP_NIGHT = new Color("#070d24");
const HORIZON_NIGHT = new Color("#1b2a4e");

export type SkyColours = { top: Color; horizon: Color };

/** The sky's two colours for a daylight level, 0 (night) to 1 (day), through a warm dusk in between. */
export function skyColours(sun: number, out: SkyColours): SkyColours {
	if (sun >= 0.5) {
		const k = (sun - 0.5) * 2;
		out.top.copy(TOP_DUSK).lerp(TOP_DAY, k);
		out.horizon.copy(HORIZON_DUSK).lerp(HORIZON_DAY, k);
	} else {
		const k = sun * 2;
		out.top.copy(TOP_NIGHT).lerp(TOP_DUSK, k);
		out.horizon.copy(HORIZON_NIGHT).lerp(HORIZON_DUSK, k);
	}
	return out;
}

const pixelDisc = (size: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const ctx = c.getContext("2d");
	if (ctx) paint(ctx);
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	return t;
};

function sunTexture() {
	return pixelDisc(16, (ctx) => {
		ctx.fillStyle = "rgba(255,240,180,0.35)";
		ctx.fillRect(0, 0, 16, 16);
		ctx.fillStyle = "#fff4c4";
		ctx.fillRect(3, 3, 10, 10);
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(5, 5, 6, 6);
	});
}

function moonTexture() {
	return pixelDisc(16, (ctx) => {
		ctx.fillStyle = "#e8eef8";
		ctx.fillRect(3, 3, 10, 10);
		ctx.fillStyle = "#c2cbdc";
		for (const [x, y, w] of [
			[5, 5, 2],
			[9, 7, 2],
			[6, 10, 1],
			[10, 4, 1],
		] as const)
			ctx.fillRect(x, y, w, w);
	});
}

const CLOUD_WHITE = new Color(1, 1, 1);
const OVERCAST_TOP = new Color("#7c8794");
const OVERCAST_HORIZON = new Color("#b4bcc4");
const CLOUDS = 26;
const CLOUD_HEIGHT = 62;
const CLOUD_RANGE = 150;

export class Sky {
	readonly group = new Group();
	private dome: Mesh<SphereGeometry, ShaderMaterial>;
	private sun: Mesh;
	private moon: Mesh;
	private clouds: InstancedMesh;
	private cloudBase: { x: number; z: number; w: number; d: number }[] = [];
	private m = new Matrix4();
	private v = new Vector3();
	readonly colours: SkyColours = { top: new Color(), horizon: new Color() };

	constructor() {
		this.group.userData.noCast = true;
		this.dome = new Mesh(
			new SphereGeometry(120, 24, 12),
			new ShaderMaterial({
				side: BackSide,
				depthWrite: false,
				fog: false,
				uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
				vertexShader: /* glsl */ `
					varying float vUp;
					void main() {
						vUp = normalize(position).y;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform vec3 top;
					uniform vec3 horizon;
					varying float vUp;
					void main() {
						float k = smoothstep(-0.05, 0.55, vUp);
						gl_FragColor = vec4(mix(horizon, top, k), 1.0);
					}`,
			}),
		);
		this.dome.renderOrder = -10;
		this.dome.frustumCulled = false;

		const disc = new PlaneGeometry(1, 1);
		const flat = (map: CanvasTexture) => new MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false });
		this.sun = new Mesh(disc, flat(sunTexture()));
		this.sun.scale.setScalar(16);
		this.moon = new Mesh(disc, flat(moonTexture()));
		this.moon.scale.setScalar(9);
		for (const t of [this.sun.material, this.moon.material] as MeshBasicMaterial[]) if (t.map) t.map.magFilter = NearestFilter;
		this.sun.renderOrder = this.moon.renderOrder = -9;

		this.clouds = new InstancedMesh(
			new BoxGeometry(1, 1, 1),
			new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
			CLOUDS,
		);
		this.clouds.instanceMatrix.setUsage(DynamicDrawUsage);
		this.clouds.frustumCulled = false;
		this.clouds.renderOrder = -8;
		// Same clouds every visit: placed from a fixed little sequence.
		let s = 7;
		const r = () => {
			s = (s * 16807) % 2147483647;
			return s / 2147483647;
		};
		for (let k = 0; k < CLOUDS; k++)
			this.cloudBase.push({ x: (r() - 0.5) * CLOUD_RANGE * 2, z: (r() - 0.5) * CLOUD_RANGE * 2, w: 8 + r() * 18, d: 6 + r() * 12 });

		this.group.add(this.dome, this.sun, this.moon, this.clouds);
	}

	/**
	 * `sun` 0–1 daylight; `arc` 0–1 how far the sun (by day) or moon (by night) has crossed the sky; `time` seconds, for
	 * the clouds' drift.
	 */
	update(camera: { position: Vector3 }, sun: number, arc: number, night: boolean, time: number, wet = 0) {
		const c = camera.position;
		this.group.position.copy(c);
		skyColours(sun, this.colours);
		// A shower: an overcast grey over the colours.
		if (wet > 0) {
			this.colours.top.lerp(OVERCAST_TOP, wet * 0.75);
			this.colours.horizon.lerp(OVERCAST_HORIZON, wet * 0.75);
		}
		this.dome.material.uniforms.top!.value.copy(this.colours.top);
		this.dome.material.uniforms.horizon!.value.copy(this.colours.horizon);

		// Rises in the east, sets in the west, a little to the south so it's in view from camp.
		const a = Math.PI * (0.08 + 0.84 * arc);
		this.v.set(Math.cos(a) * 90, Math.sin(a) * 70 + 4, -30);
		const body = night ? this.moon : this.sun;
		const other = night ? this.sun : this.moon;
		body.visible = true;
		other.visible = false;
		body.position.copy(this.v);
		body.lookAt(c.x, c.y, c.z);
		(body.material as MeshBasicMaterial).opacity = night ? Math.min(1, (1 - sun) * 1.6) : Math.min(1, sun * 1.6);

		// Clouds: white by day, warm at dusk, faint blue-grey at night; they drift east and wrap round.
		const cm = this.clouds.material as MeshBasicMaterial;
		cm.color.copy(this.colours.horizon).lerp(CLOUD_WHITE, sun * 0.8);
		// Barely there at night, so they never cover the stars.
		cm.opacity = Math.min(0.95, 0.08 + 0.77 * sun + 0.3 * wet);
		for (let k = 0; k < CLOUDS; k++) {
			const b = this.cloudBase[k]!;
			let x = b.x + time * 1.2;
			x = ((((x + CLOUD_RANGE) % (CLOUD_RANGE * 2)) + CLOUD_RANGE * 2) % (CLOUD_RANGE * 2)) - CLOUD_RANGE;
			this.m.makeScale(b.w, 2.4, b.d);
			this.m.setPosition(x, CLOUD_HEIGHT - c.y, b.z);
			this.clouds.setMatrixAt(k, this.m);
		}
		this.clouds.instanceMatrix.needsUpdate = true;
	}
}
