import { Check, Delete } from "lucide-react";

/**
 * On-screen number pad. Real buttons, never a text input, so the iPad keyboard never opens during math.
 * Extra keys (/, ., <, =, >) appear only when the problem needs them.
 */
export function Keypad({
	extra,
	onKey,
	onBackspace,
	onCheck,
	canCheck,
	disabled,
	compact,
}: {
	extra: string[];
	onKey: (k: string) => void;
	onBackspace: () => void;
	onCheck: () => void;
	canCheck: boolean;
	disabled?: boolean;
	compact?: boolean;
}) {
	const size = compact ? "!min-h-12 !text-xl" : "!min-h-14 !text-2xl";
	const choice = extra.includes("<");
	const digits = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
	return (
		<fieldset className="m-0 w-full max-w-sm border-0 p-0" disabled={disabled}>
			<legend className="sr-only">Answer keypad</legend>
			{choice ? (
				<div className="grid grid-cols-3 gap-2">
					{["<", "=", ">"].map((k) => (
						<button
							key={k}
							type="button"
							className={`key ${size}`}
							data-variant="tile"
							onClick={() => onKey(k)}
							aria-label={k === "<" ? "less than" : k === ">" ? "greater than" : "equal to"}
						>
							{k}
						</button>
					))}
				</div>
			) : (
				<div className="grid grid-cols-3 gap-2">
					{digits.map((k) => (
						<button key={k} type="button" className={`key ${size}`} data-variant="tile" onClick={() => onKey(k)}>
							{k}
						</button>
					))}
					<button
						type="button"
						className={`key ${size}`}
						data-variant="tile"
						onClick={() => onKey(extra[0] ?? "0")}
						aria-label={extra[0] === "/" ? "fraction bar" : extra[0] === "." ? "decimal point" : "0"}
						hidden={!extra[0]}
					>
						{extra[0]}
					</button>
					<button
						type="button"
						className={`key ${size}`}
						data-variant="tile"
						onClick={() => onKey("0")}
						style={extra[0] ? undefined : { gridColumn: "1 / span 2" }}
					>
						0
					</button>
					<button type="button" className={`key ${size}`} onClick={onBackspace} aria-label="Delete">
						<Delete className="size-6" aria-hidden />
					</button>
				</div>
			)}
			<button type="button" className={`key mt-2 w-full ${size}`} data-variant="check" disabled={!canCheck} onClick={onCheck}>
				<Check className="size-6" aria-hidden /> Check
			</button>
			{choice && (
				<button type="button" className="key mt-2 w-full" onClick={onBackspace} aria-label="Clear">
					<Delete className="size-5" aria-hidden /> Clear
				</button>
			)}
		</fieldset>
	);
}
