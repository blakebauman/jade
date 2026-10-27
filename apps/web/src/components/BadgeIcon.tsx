import { Flame, Grid3x3, Library, Medal, PieChart, Repeat, Sparkles, Sprout, Star, Trophy, Turtle, Wand } from "lucide-react";

const ICONS = {
	sprout: Sprout,
	sparkles: Sparkles,
	flame: Flame,
	medal: Medal,
	star: Star,
	trophy: Trophy,
	library: Library,
	grid: Grid3x3,
	pie: PieChart,
	repeat: Repeat,
	wand: Wand,
	turtle: Turtle,
} as const;

/**
 * Each badge's printed sticker face. The big milestones (a week's practice, star collector, 100 right) are foil; the rest
 * take the album's place hues. A law colour is never a face.
 */
const FACE: Record<string, "foil" | "spell" | "math" | "roxy" | "code"> = {
	sprout: "spell",
	sparkles: "roxy",
	flame: "roxy",
	medal: "foil",
	star: "math",
	trophy: "foil",
	library: "foil",
	grid: "math",
	pie: "math",
	repeat: "code",
	wand: "code",
	turtle: "code",
};

export const badgeFace = (icon: string) => FACE[icon] ?? "spell";

/** Props that print a badge's face on a `.sticker`. */
export const badgeSticker = (icon: string) =>
	badgeFace(icon) === "foil" ? { className: "foil" } : { className: "", "data-place": badgeFace(icon) };

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
	const I = ICONS[icon as keyof typeof ICONS] ?? Star;
	return <I className={className} aria-hidden strokeWidth={2.2} />;
}
