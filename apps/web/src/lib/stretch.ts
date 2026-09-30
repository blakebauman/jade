/**
 * Change a clip's speed without changing its pitch (WSOLA: waveform-similarity overlap-add). Web Audio buffer
 * sources can only resample, which would drop "say it slowly" by half an octave; the <audio> element's
 * `preservesPitch` does this natively, so only the buffer path needs it.
 *
 * Frames of 40ms are overlap-added every 20ms of output under a Hann window (which sums to 1 at 50% overlap). Each
 * frame is taken from near where `rate` puts it in the input, nudged by up to 10ms to the spot that best continues
 * the previous frame's waveform, so voiced speech keeps its phase instead of warbling. The nudge means the last
 * ~10ms can come out early; Aura clips end in silence, so nothing audible is lost.
 */
export function stretch(input: Float32Array, rate: number, sampleRate: number): Float32Array {
	if (Math.abs(rate - 1) < 0.005) return input;
	const hop = Math.max(8, Math.round(sampleRate * 0.02));
	const n = hop * 2;
	const tol = Math.round(sampleRate * 0.01);
	const win = new Float32Array(n);
	for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);

	// Pad both ends by a frame so the first and last frames don't fade the clip's own edges.
	const x = new Float32Array(input.length + 2 * n + tol);
	x.set(input, n);
	const outLen = Math.ceil((input.length + 2 * n) / rate) + n;
	const y = new Float32Array(outLen);

	let prev = 0;
	for (let out = 0; out + n <= outLen; out += hop) {
		const nominal = Math.round(out * rate);
		if (nominal + n > x.length) break;
		let pos = nominal;
		if (out > 0) {
			// The input right after the previous frame's first half is what the output "expects" next.
			// Stays at `nominal` unless somewhere matches strictly better (in silence, nothing does).
			const target = prev + hop;
			const score = (p: number) => {
				let s = 0;
				for (let i = 0; i < hop; i += 2) s += x[target + i]! * x[p + i]!;
				return s;
			};
			let best = score(nominal);
			const lo = Math.max(0, nominal - tol);
			const hi = Math.min(x.length - n, nominal + tol);
			// Coarse pass every 4 samples, then the neighbours of the winner.
			const scan = (from: number, to: number, step: number) => {
				for (let p = Math.max(lo, from); p <= Math.min(hi, to); p += step) {
					const s = score(p);
					if (s > best) {
						best = s;
						pos = p;
					}
				}
			};
			scan(lo, hi, 4);
			scan(pos - 3, pos + 3, 1);
		}
		for (let i = 0; i < n; i++) y[out + i]! += x[pos + i]! * win[i]!;
		prev = pos;
	}

	const start = Math.round(n / rate);
	return y.slice(start, start + Math.round(input.length / rate));
}
