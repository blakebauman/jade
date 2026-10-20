// Jade's World mark: the wordmark's j as a die-cut sticker (a red j and its star dot inside one white cut line), stuck
// on a brand-red rounded square a little crooked, with a soft shadow under it. The wordmark (Brand.tsx) is the same
// sticker, spelt out.
// Usage: node scripts/icon-mark.mjs <out.svg> <variant: rounded|bleed|maskable|small|mark>
// `mark` is the red tile alone with its own rounded corners on transparency, for the splash screens (scripts/splash.mjs).
import { writeFileSync } from "node:fs";

const [out, variant = "rounded"] = process.argv.slice(2);

const scale = variant === "maskable" ? 0.76 : 1; // keep everything inside the 80% safe circle
const small = variant === "small";
const rounded = variant === "rounded" || variant === "small" || variant === "mark";

const star = (cx, cy, R, r) => {
	const pts = [];
	for (let i = 0; i < 10; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const rad = i % 2 ? r : R;
		pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
	}
	return `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L")}Z`;
};

// The j as one rounded stroke, like Fredoka's: a stem that hooks left at the foot.
const j = "M292 214 V318 Q292 388 226 388 Q196 388 178 372";
// Ink is the red letter; cut is the white line round it. The favicon draws both heavier, so they hold at 16px.
const [ink, cut] = small ? [84, 156] : [72, 140];
const s = star(292, 128, small ? 70 : 62, small ? 36 : 32);
// The star's cut line is a stroke on the star, so it matches the j's: (cut - ink) / 2 a side, plus the star's own.
const starCut = cut - ink + 10;

const shape = (color, j_w, star_w) =>
	`<path d="${j}" fill="none" stroke="${color}" stroke-width="${j_w}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${s}" fill="${color}" stroke="${color}" stroke-width="${star_w}" stroke-linejoin="round"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>Jade's World</title>
  <!-- Jade's World mark: a red "j" dotted with a red star, cut out as one white-edged sticker on a brand-red rounded
       square. Authored SVG, no external source or font. Generated with the PNG icons; regenerate with
       apps/web/scripts/icons.sh. -->
  <defs>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <!-- A shade under brand red, so the sticker's brand-red j reads as a letter, not a white outline. -->
      <stop offset="0" stop-color="#bf2a25"/>
      <stop offset="1" stop-color="#8f1814"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur stdDeviation="${small ? 6 : 10}"/>
    </filter>
    <clipPath id="corner"><rect width="512" height="512" rx="${variant === "mark" ? 120 : 112}"/></clipPath>
  </defs>
  <g ${rounded ? 'clip-path="url(#corner)"' : ""}>
    <rect width="512" height="512" fill="url(#red)"/>
    ${small ? "" : '<rect width="512" height="8" fill="#fff" opacity="0.22"/>'}
  </g>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256) rotate(-8 256 256) translate(-22 6)">
    <g opacity="0.32" filter="url(#lift)" transform="translate(6 16)">
    ${shape("#5c0d0b", cut, starCut)}
    </g>
    ${shape("#ffffff", cut, starCut)}
    ${shape("#d62c27", ink, 10)}
  </g>
</svg>
`;
writeFileSync(out, svg);
