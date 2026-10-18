// Jade's World mark: a "j" cut from white vinyl with a silver foil star for its dot, stuck over the three places stacked
// one above another as the hub shows them (Spelling jade, Play berry, Math grape), so the mark holds Learn and Play alike.
// Usage: node scripts/icon-mark.mjs <out.svg> <variant: rounded|bleed|maskable|small|mark>
// `mark` is the sticker and star alone on transparency, for the splash screens (scripts/splash.mjs).
import { writeFileSync } from "node:fs";

const [out, variant = "rounded"] = process.argv.slice(2);

const scale = variant === "maskable" ? 0.78 : 1; // keep everything inside the 80% safe circle
const small = variant === "small";

const star = (cx, cy, R, r) => {
	const pts = [];
	for (let i = 0; i < 10; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const rad = i % 2 ? r : R;
		pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
	}
	return `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L")}Z`;
};

const bg =
	variant === "mark"
		? ""
		: `<g ${variant === "rounded" || variant === "small" ? 'clip-path="url(#corner)"' : ""}>
    <rect width="512" height="171" fill="#17795e"/>
    <rect y="171" width="512" height="170" fill="#b8326f"/>
    <rect y="341" width="512" height="171" fill="#5b4bc4"/>
    ${small ? "" : `<rect y="167" width="512" height="8" fill="#f4fbf7" opacity="0.9"/><rect y="337" width="512" height="8" fill="#f4fbf7" opacity="0.9"/>`}
    <rect width="512" height="512" fill="url(#gloss)" opacity="0.6"/>
  </g>`;

// The j as one rounded stroke, like Fredoka's: a stem that hooks left at the foot.
const j = "M292 214 V318 Q292 388 226 388 Q196 388 178 372";
const ink = small ? 78 : 66;
// The favicon draws the star larger, since at 16px a small one blurs into a smudge.
const [R, r] = small ? [74, 38] : [60, 31];
const cut = ink + (small ? 52 : 46);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>Jade's World</title>
  <!-- Jade's World mark: a white vinyl "j" with a holographic foil star for its dot, over the three places stacked as the
       hub shows them. Authored SVG, no external source or font. Generated with the PNG icons; regenerate with
       apps/web/scripts/icons.sh. -->
  <defs>
    <linearGradient id="foil" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#e6eaee"/>
      <stop offset="0.24" stop-color="#c3cff4"/>
      <stop offset="0.46" stop-color="#e6caee"/>
      <stop offset="0.68" stop-color="#c3ecda"/>
      <stop offset="1" stop-color="#eceff1"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.4"/>
      <stop offset="0.33" stop-color="#fff" stop-opacity="0.08"/>
      <stop offset="0.34" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur stdDeviation="${small ? 8 : 12}"/>
    </filter>
    <clipPath id="corner"><rect width="512" height="512" rx="112"/></clipPath>
  </defs>

  ${bg}

  <g transform="translate(256 256) scale(${scale}) translate(-256 -256) rotate(-6 256 270)">
    <!-- lift shadow under the whole cut -->
    <g opacity="0.45" filter="url(#lift)" transform="translate(0 14)">
      <path d="${j}" fill="none" stroke="#06140f" stroke-width="${cut}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${star(292, 128, R, r)}" fill="#06140f" stroke="#06140f" stroke-width="${small ? 52 : 46}" stroke-linejoin="round"/>
    </g>
    <!-- the white vinyl cut, following the letter and the star as one sticker -->
    <path d="${j}" fill="none" stroke="#fbfdfb" stroke-width="${cut}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${star(292, 128, R, r)}" fill="#fbfdfb" stroke="#fbfdfb" stroke-width="${small ? 52 : 46}" stroke-linejoin="round"/>
    <path d="M292 160 V214" stroke="#fbfdfb" stroke-width="${cut * 0.7}" stroke-linecap="round"/>
    <!-- ink letter and foil dot -->
    <path d="${j}" fill="none" stroke="#1d2430" stroke-width="${ink}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${star(292, 128, R, r)}" fill="${small ? "#d6dcf6" : "url(#foil)"}" stroke="#1d2430" stroke-width="${small ? 9 : 6}" stroke-linejoin="round"/>
  </g>
</svg>
`;
writeFileSync(out, svg);
