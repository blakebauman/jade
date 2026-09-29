import { Flame, Grid3x3, Library, Medal, PieChart, Sparkles, Sprout, Star, Trophy } from "lucide-react";

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
} as const;

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
	const I = ICONS[icon as keyof typeof ICONS] ?? Star;
	return <I className={className} aria-hidden strokeWidth={2.2} />;
}
