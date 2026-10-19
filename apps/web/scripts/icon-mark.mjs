// Jade's World mark: a white "j" with a white star for its dot on one brand-red rounded square, like the badge on a
// console's lid; the wordmark's plate (Brand.tsx) uses the same red.
// Usage: node scripts/icon-mark.mjs <out.svg> <variant: rounded|bleed|maskable|small|mark>
// `mark` is the red tile alone with its own rounded corners on transparency, for the splash screens (scripts/splash.mjs).
import { writeFileSync } from "node:fs";

const [out, variant = "rounded"] = process.argv.slice(2);

const scale = variant === "maskable" ? 0.78 : 1; // keep everything inside the 80% safe circle
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
const ink = small ? 82 : 70;
// The favicon draws the star larger, since at 16px a small one blurs into a smudge.
const [R, r] = small ? [76, 39] : [62, 32];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>Jade's World</title>
  <!-- Jade's World mark: a white "j" dotted with a white star on a brand-red rounded square. Authored SVG, no external
       source or font. Generated with the PNG icons; regenerate with apps/web/scripts/icons.sh. -->
  <defs>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ee5a52"/>
      <stop offset="0.55" stop-color="#e5322d"/>
      <stop offset="1" stop-color="#c4231f"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur stdDeviation="${small ? 6 : 10}"/>
    </filter>
    <clipPath id="corner"><rect width="512" height="512" rx="${variant === "mark" ? 120 : 112}"/></clipPath>
  </defs>
  <g ${rounded ? 'clip-path="url(#corner)"' : ""}>
    <rect width="512" height="512" fill="url(#red)"/>
    ${small ? "" : '<rect width="512" height="10" fill="#fff" opacity="0.28"/>'}
  </g>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256) rotate(-6 256 270)">
    <g opacity="0.35" filter="url(#lift)" transform="translate(0 12)">
      <path d="${j}" fill="none" stroke="#5c0d0b" stroke-width="${ink}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${star(292, 128, R, r)}" fill="#5c0d0b" stroke="#5c0d0b" stroke-width="10" stroke-linejoin="round"/>
    </g>
    <path d="${j}" fill="none" stroke="#ffffff" stroke-width="${ink}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${star(292, 128, R, r)}" fill="#ffffff" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/>
  </g>
</svg>
`;
writeFileSync(out, svg);
