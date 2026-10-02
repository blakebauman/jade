import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Something that didn't work, set apart from ordinary status text without borrowing a law colour: a recessed felt note
 * with an alert mark. Coral stays reserved for wrong letters.
 */
export function Problem({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
	return (
		<p
			id={id}
			role="alert"
			className={`flex items-start gap-2 rounded-[0.8rem] bg-page-deep/80 px-3 py-2 text-sm text-page-ink ${className}`}
		>
			<AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
			<span>{children}</span>
		</p>
	);
}
