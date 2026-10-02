// Jade's World mark: the wordmark's lifted maple "j" tile, die-cut as the first sticker in the album, with a silver foil
// star stuck on its corner, on the jade page under the lamp.
// The maple keeps its grain; the page's paper tooth is left out, since it disappears at icon size and triples the PNGs.
// Usage: node scripts/icon-mark.mjs <out.svg> <variant: rounded|bleed|maskable|small>
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
	variant === "rounded" || variant === "small"
		? `<rect width="512" height="512" rx="112" fill="url(#lamp)"/>`
		: `<rect width="512" height="512" fill="url(#lamp)"/>`;
const clip = variant === "rounded" || variant === "small" ? `clip-path="url(#corner)"` : "";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>Jade's World</title>
  <!-- Jade's World mark: the wordmark's lifted maple "j" tile, die-cut as the album's first sticker, with a silver foil star
       stuck on its corner, on the jade page under the lamp. Authored SVG, no external source or font.
       Generated with the PNG icons; regenerate with apps/web/scripts/icons.sh. -->
  <defs>
    <radialGradient id="lamp" cx="0.28" cy="0.2" r="0.95">
      <stop offset="0" stop-color="#1a6a5a"/>
      <stop offset="0.45" stop-color="#0e4f43"/>
      <stop offset="1" stop-color="#072e27"/>
    </radialGradient>
    <linearGradient id="maple" x1="0" y1="0" x2="0.18" y2="1">
      <stop offset="0" stop-color="#f9e0b3"/>
      <stop offset="0.6" stop-color="#f1c98a"/>
      <stop offset="1" stop-color="#e9bb79"/>
    </linearGradient>
    <linearGradient id="foil" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#e6eaee"/>
      <stop offset="0.24" stop-color="#c3cff4"/>
      <stop offset="0.46" stop-color="#e6caee"/>
      <stop offset="0.68" stop-color="#c3ecda"/>
      <stop offset="1" stop-color="#eceff1"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="0.33" stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="0.34" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="lift-sm" x="-40%" y="-40%" width="180%" height="190%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.22" numOctaves="1" seed="3"/>
      <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.36  0 0 0 0 0.16  0 0 0 0.16 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <clipPath id="corner"><rect width="512" height="512" rx="112"/></clipPath>
  </defs>

  ${bg}

  <g ${clip}>
  <g transform="translate(256 262) scale(${scale}) translate(-270 -254)">
    <!-- the j sticker, tilted the way the wordmark lifts it -->
    <g transform="rotate(-7 256 262)">
      <!-- lift shadow: offset down, soft -->
      <rect x="92" y="122" width="328" height="334" rx="78" fill="#021612" opacity="0.6" filter="url(#lift)"/>
      <!-- white vinyl die-cut rim -->
      <rect x="92" y="96" width="328" height="334" rx="78" fill="#f4f8f6"/>
      <rect x="93" y="97" width="326" height="332" rx="77" fill="none" stroke="#9fb4ac" stroke-opacity="0.6" stroke-width="2"/>
      <!-- maple tile: bevel, then face -->
      <rect x="114" y="118" width="284" height="290" rx="58" fill="#c9965a"/>
      <rect x="114" y="118" width="284" height="266" rx="58" fill="url(#maple)"/>
      ${small ? "" : `<rect x="114" y="118" width="284" height="266" rx="58" fill="#fff" filter="url(#grain)"/>`}
      <!-- the j, pressed ink, rounded like Fredoka -->
      <circle cx="281" cy="173" r="${small ? 27 : 24}" fill="#23180f"/>
      <path d="M281 226 V300 Q281 350 236 350 Q214 350 202 340" fill="none" stroke="#23180f" stroke-width="${small ? 52 : 44}" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- vinyl gloss across the top of the sticker -->
      <rect x="92" y="96" width="328" height="334" rx="78" fill="url(#gloss)"/>
    </g>

    <!-- the silver foil star, stuck over the sticker's top right corner -->
    <g transform="rotate(14 384 136)">
      <path d="${star(384, 146, 76, 39)}" fill="#021612" opacity="0.55" filter="url(#lift-sm)" stroke="#021612" stroke-width="22" stroke-linejoin="round"/>
      <path d="${star(384, 136, 76, 39)}" fill="#f4f8f6" stroke="#f4f8f6" stroke-width="24" stroke-linejoin="round"/>
      <path d="${star(384, 136, 76, 39)}" fill="none" stroke="#9fb4ac" stroke-opacity="0.7" stroke-width="2" stroke-linejoin="round" transform="translate(384 136) scale(1.2) translate(-384 -136)"/>
      <path d="${star(384, 136, 76, 39)}" fill="url(#foil)" stroke="#8d97b5" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${star(384, 136, 76, 39)}" fill="url(#gloss)"/>
    </g>
  </g>
  </g>
</svg>
`;
writeFileSync(out, svg);
