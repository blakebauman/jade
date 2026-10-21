import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import * as sound from "./sound.ts";

/**
 * A Roxy screen's sound: which music and background it plays (`scene`), and the corner button that mutes all of it
 * (remembered on the device). Put it in the screen's `orbs`.
 */
export function SoundOrb({ scene }: { scene: sound.Scene }) {
	const [muted, setMuted] = useState(sound.isMuted);
	useEffect(() => {
		sound.scene(scene);
		return () => sound.leave();
	}, [scene]);
	return (
		<button
			type="button"
			className="orb glass"
			onClick={() => {
				sound.setMuted(!muted);
				setMuted(!muted);
			}}
			aria-pressed={muted}
			aria-label={muted ? "Sound on" : "Sound off"}
			title={muted ? "Sound on" : "Sound off"}
		>
			{muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
		</button>
	);
}
