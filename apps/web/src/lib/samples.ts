/**
 * Recorded game sounds: a game passes its `audio/*.mp3` (from `import.meta.glob`) and which of them loop. `name.mp3`
 * is a one-shot, and `name-1.mp3`, `name-2.mp3`… are takes of the same one, played at random. Loops carry 0.1s of
 * wrap-around either side of `loopStart`–`loopEnd`, so an MP3 decoder's padding never lands on the seam.
 *
 * Nothing loads until `load()` (after the game's sound is unlocked by a tap). Until a recording has arrived, or if it
 * never does, `shot` and `loop` return null and the game makes that sound itself.
 */
export type LoopTimes = { loopStart: number; loopEnd: number };

export function samples<S extends string, L extends string>(
	files: Record<string, string>,
	shotIds: readonly S[],
	loopTimes: Record<L, LoopTimes>,
) {
	const shotUrls = new Map<string, string[]>();
	const loopUrls = new Map<string, string>();
	for (const [path, url] of Object.entries(files)) {
		const name = path.slice(path.lastIndexOf("/") + 1, -".mp3".length);
		if (name in loopTimes) loopUrls.set(name, url);
		else {
			const id = name.replace(/-\d+$/, "");
			shotUrls.set(id, [...(shotUrls.get(id) ?? []), url]);
		}
	}

	const shots = new Map<S, AudioBuffer[]>();
	const loops = new Map<L, AudioBuffer>();
	let started = false;
	const warn = (e: unknown) => console.warn("[game sound]", e);

	return {
		shotUrls,
		loopUrls,
		/** Fetches and decodes everything, once. Failures are left out quietly: those sounds stay synthesised. */
		load(c: BaseAudioContext) {
			if (started || typeof fetch !== "function") return;
			started = true;
			for (const id of shotIds) {
				for (const url of shotUrls.get(id) ?? []) decode(c, url).then((b) => shots.set(id, [...(shots.get(id) ?? []), b]), warn);
			}
			for (const id of Object.keys(loopTimes) as L[]) {
				const url = loopUrls.get(id);
				if (url) decode(c, url).then((b) => loops.set(id, b), warn);
			}
		},
		/** One of a one-shot's takes, or null while none has loaded. */
		shot(id: S) {
			const all = shots.get(id);
			return all?.length ? all[Math.floor(Math.random() * all.length)]! : null;
		},
		loop: (id: L) => loops.get(id) ?? null,
	};
}

async function decode(c: BaseAudioContext, url: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const data = await res.arrayBuffer();
	// The callback form too: older Safari never resolves the promise one.
	return new Promise<AudioBuffer>((resolve, reject) => {
		const p = c.decodeAudioData(data, resolve, reject);
		if (p) p.then(resolve, reject);
	});
}
