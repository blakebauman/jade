import { ArrowUpFromDot } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import type { DriveInput } from "./world/drive.ts";

/** How far the knob travels from the middle, in px. */
const TRAVEL = 34;

/**
 * Walking on a touch screen: a stick bottom-left and Hop bottom-right, both writing into the same input the keyboard
 * does. Shown on touch screens and narrow windows; tap-to-walk keeps working beside them.
 */
export function TouchControls({ drive }: { drive: RefObject<DriveInput> }) {
	const stick = useRef<HTMLButtonElement>(null);
	const held = useRef<{ id: number; cx: number; cy: number } | null>(null);
	const [knob, setKnob] = useState({ x: 0, y: 0, held: false });
	const [hopping, setHopping] = useState(false);

	const move = (clientX: number, clientY: number) => {
		const h = held.current;
		if (!h) return;
		let dx = clientX - h.cx;
		let dy = clientY - h.cy;
		const len = Math.hypot(dx, dy);
		if (len > TRAVEL) {
			dx = (dx / len) * TRAVEL;
			dy = (dy / len) * TRAVEL;
		}
		setKnob({ x: dx, y: dy, held: true });
		// A small dead zone in the middle, so resting a thumb on it doesn't drift.
		const live = len > 6;
		drive.current.x = live ? dx / TRAVEL : 0;
		drive.current.y = live ? -dy / TRAVEL : 0;
	};
	const release = () => {
		held.current = null;
		setKnob({ x: 0, y: 0, held: false });
		drive.current.x = 0;
		drive.current.y = 0;
	};

	return (
		<div className="pointer-events-none flex items-end justify-between">
			<button
				ref={stick}
				type="button"
				aria-label="Move"
				className="joystick glass pointer-events-auto"
				data-held={knob.held}
				style={{ "--stick-x": `${knob.x}px`, "--stick-y": `${knob.y}px` } as React.CSSProperties}
				onPointerDown={(e) => {
					if (held.current) return;
					const r = e.currentTarget.getBoundingClientRect();
					held.current = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
					e.currentTarget.setPointerCapture?.(e.pointerId);
					move(e.clientX, e.clientY);
				}}
				onPointerMove={(e) => {
					if (held.current?.id === e.pointerId) move(e.clientX, e.clientY);
				}}
				onPointerUp={(e) => {
					if (held.current?.id === e.pointerId) release();
				}}
				onPointerCancel={(e) => {
					if (held.current?.id === e.pointerId) release();
				}}
			>
				<span className="joystick-knob" aria-hidden />
			</button>
			<button
				type="button"
				aria-label="Hop"
				className="hop glass pointer-events-auto"
				data-held={hopping}
				onPointerDown={() => {
					setHopping(true);
					drive.current.hop = true;
				}}
				onPointerUp={() => {
					setHopping(false);
					drive.current.hop = false;
				}}
				onPointerCancel={() => {
					setHopping(false);
					drive.current.hop = false;
				}}
			>
				<ArrowUpFromDot className="size-6" aria-hidden />
				<span>Hop</span>
			</button>
		</div>
	);
}
