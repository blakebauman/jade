// iOS launch screens (apple-touch-startup-image): the Jade's World mark on the jade page under the lamp, one PNG per
// iPhone and iPad screen in each orientation. iOS shows a blank page at launch without them, and picks the one whose
// media query matches exactly, so every size is listed. Night only: the manifest's colours are Night's page.
// Writes public/splash/*.png and prints the <link> tags for index.html. Needs rsvg-convert (brew install librsvg) and
// ImageMagick (brew install imagemagick): 256 colours, undithered, keeps the set near 3MB instead of 9 (dithering the
// lamp's gradient makes it bigger, not smaller).
// Usage: node scripts/splash.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** CSS width × height (portrait) and pixel ratio. */
const SCREENS = [
	// iPhone
	[440, 956, 3], // 16 Pro Max
	[402, 874, 3], // 16 Pro
	[430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
	[393, 852, 3], // 14 Pro, 15, 15 Pro, 16
	[428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
	[390, 844, 3], // 12, 13, 14, 16e
	[375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
	[414, 896, 3], // XS Max, 11 Pro Max
	[414, 896, 2], // XR, 11
	[375, 667, 2], // SE, 8
	// iPad
	[1032, 1376, 2], // Pro 13" (M4)
	[1024, 1366, 2], // Pro 12.9"
	[834, 1210, 2], // Pro 11" (M4)
	[834, 1194, 2], // Pro 11"
	[820, 1180, 2], // Air, 10th gen
	[810, 1080, 2], // 9th gen
	[744, 1133, 2], // mini
];

const dir = mkdtempSync(join(tmpdir(), "splash-"));
const markPath = join(dir, "mark.svg");
execFileSync("node", ["scripts/icon-mark.mjs", markPath, "mark"]);
const mark = Buffer.from(readFileSync(markPath)).toString("base64");
mkdirSync("public/splash", { recursive: true });

const links = [];
for (const [w, h, dpr] of SCREENS) {
	for (const orientation of ["portrait", "landscape"]) {
		const [cw, ch] = orientation === "portrait" ? [w, h] : [h, w];
		const [pw, ph] = [cw * dpr, ch * dpr];
		const size = Math.round(Math.min(pw, ph) * 0.36);
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${pw} ${ph}">
  <defs>
    <radialGradient id="lamp" cx="0.28" cy="0.2" r="0.95" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#1a6a5a"/>
      <stop offset="0.45" stop-color="#0e4f43"/>
      <stop offset="1" stop-color="#072e27"/>
    </radialGradient>
  </defs>
  <rect width="${pw}" height="${ph}" fill="url(#lamp)"/>
  <image x="${(pw - size) / 2}" y="${(ph - size) / 2}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${mark}"/>
</svg>`;
		const name = `${pw}x${ph}.png`;
		const src = join(dir, `${name}.svg`);
		writeFileSync(src, svg);
		const png = join("public/splash", name);
		execFileSync("rsvg-convert", ["-w", String(pw), "-h", String(ph), src, "-o", png]);
		execFileSync("magick", [png, "+dither", "-colors", "256", "-define", "png:compression-level=9", "-strip", `PNG8:${png}`]);
		links.push(
			`<link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})" />`,
		);
	}
}
rmSync(dir, { recursive: true });
console.log(links.join("\n"));
