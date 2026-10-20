import { hex, ITEM, type Look, type Pose } from "@jade/core/roxy";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, memo, type ReactNode, useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { Static } from "../world/batch.tsx";
import { useWake } from "../world/pace.tsx";
import { Bag, bagPlace, Earrings, Glasses, Hat, HIDES_HAIR_3D, Necklace } from "./accessories.tsx";
import { AnimalHead, Ears, fur3, Pet3D, Tail } from "./animals.tsx";
import { DIMS3, Face, HEAD_R, HEAD_SCALE, type Shape3, Torso, Y } from "./body.tsx";
import { Dress, Foot, Hips, LegWear, Outer, Sleeve, Sock, sleeveFor, Top, topFixed, topPattern } from "./clothes.tsx";
import { Hair3D, hairSwing } from "./hair.tsx";
import { Ball, colours, fabric, Hang, M, roxyBaked } from "./shapes.tsx";
import { Sparkle } from "./sparkle.tsx";

/**
 * Roxy as a 3D toy, built from the same look the studio saves. Arms, legs and the head hang from pivots so she can
 * walk, breathe, wave and twirl. `walking` (0 standing, 1 walking) is set from outside, every frame, by the world.
 */

const ARM_LEN = 0.52;
const LEG_LEN = Y.hip - Y.ankle;

type Props = { look: Look; pose?: Pose; walking?: MutableRefObject<number> };

function RoxyModelBase({ look, pose, walking }: Props) {
	const shape = (look.slots.body?.item.replace("body-", "") ?? "mid") as Shape3;
	const d = DIMS3[shape];
	const form = look.slots.form && ITEM.get(look.slots.form.item);
	const animal = form?.animal;
	const formC = colours(look, "form").c1;
	const fur = animal ? fur3(animal, formC) : undefined;
	const patch = animal === "panda" ? (formC === fur ? "#2b2b33" : formC) : "#2b2b33";
	const skin = fur ?? hex("skin", look.skin);
	const hairC = colours(look, "hair").c1;
	const hat = look.slots.hat?.item;
	const hideHair = !!animal || (!!hat && HIDES_HAIR_3D.has(hat));
	const gem = look.slots.gem && ITEM.get(look.slots.gem.item);
	const gemC = colours(look, "gem").c1;
	const top = look.slots.top?.item;
	const dress = look.slots.dress?.item;
	const outer = look.slots.outer?.item;
	const sleeve = sleeveFor(top, dress, outer);
	const sleeveC = sleeve
		? sleeve.c === "outer"
			? colours(look, "outer")
			: sleeve.c === "dress"
				? colours(look, "dress")
				: (topFixed(top) ?? colours(look, "top"))
		: null;
	const sleeveMap = sleeve?.c === "top" && sleeveC ? fabric(topPattern(top) ?? "plain", sleeveC.c1, sleeveC.c2, [2, 2]) : null;
	const bag = look.slots.bag?.item;
	const bagAt = bagPlace(bag);
	const reduced = useMemo(() => prefersReducedMotion(), []);

	const spin = useRef<Group>(null);
	const body = useRef<Group>(null);
	const head = useRef<Group>(null);
	const arms = [useRef<Group>(null), useRef<Group>(null)];
	const legs = [useRef<Group>(null), useRef<Group>(null)];
	const swings = useRef<(Group | null)[]>([]);
	const p = pose ?? look.pose ?? "stand";
	const wake = useWake();
	const hairItem = !hideHair ? look.slots.hair?.item : undefined;
	const swingHair = hairItem ? hairSwing(hairItem, hairC) : [];

	// Where the arms are heading for this pose, eased there rather than snapped; and how far round a twirl has gone.
	const now = useRef({ arms: [0, 0, 0, 0], primed: false, twirl: 0, tryOn: -1 });
	// Something new on: a little hop of delight. Not for the look she arrives in, only when it changes after that.
	const worn = JSON.stringify(look.slots);
	const lastWorn = useRef<string | null>(null);
	useEffect(() => {
		if (lastWorn.current !== null && worn !== lastWorn.current) now.current.tryOn = performance.now();
		lastWorn.current = worn;
	}, [worn]);

	useFrame((state, dt) => {
		const t = state.clock.elapsedTime;
		const k = Math.min(1, dt * 10);
		const n = now.current;
		const walk = walking?.current ?? 0;
		const swing = reduced ? 0 : Math.sin(t * 9) * walk;
		const sway = reduced ? 0 : 1;
		const twirling = p === "twirl" && !walk && !reduced;

		// The hop after trying something on: up and down in under half a second, squashing as she lands.
		const since = n.tryOn < 0 || reduced ? 1 : (performance.now() - n.tryOn) / 450;
		const hop = since < 1 ? Math.sin(Math.PI * since) : 0;
		const squash = since < 1 ? Math.sin(Math.PI * 2 * since) * (1 - since) * 0.07 : 0;

		// Waving, twirling, hopping and settling need every frame; breathing is slow enough for the idle tick.
		let busy = since < 1 || (!reduced && !walk && (p === "twirl" || p === "wave"));

		if (body.current) {
			const b = body.current;
			b.scale.y = 1 + Math.sin(t * 2) * 0.008 * sway - squash;
			b.scale.x = b.scale.z = 1 + squash * 0.6;
			// Each step lifts her a little, and walking leans her into it.
			b.position.y = reduced ? 0 : Math.abs(Math.sin(t * 9)) * 0.05 * walk + hop * 0.16;
			b.rotation.x = reduced ? 0 : 0.07 * walk;
		}
		if (head.current) {
			const h = head.current;
			h.rotation.z = Math.sin(t * 1.3) * 0.03 * sway;
			// Left alone, she glances about now and then.
			h.rotation.y = reduced || walk ? 0 : Math.sin(t * 0.45) * Math.sin(t * 0.23) * 0.22;
			h.rotation.x = reduced ? 0 : -0.05 * walk;
		}
		if (spin.current) {
			if (twirling) n.twirl += dt * 2.2;
			else {
				// Ease back round to face the front, the short way.
				const home = Math.round(n.twirl / (Math.PI * 2)) * Math.PI * 2;
				if (Math.abs(home - n.twirl) > 0.002) busy = true;
				n.twirl += (home - n.twirl) * k * 0.6;
			}
			spin.current.rotation.y = n.twirl;
		}
		legs.forEach((l, i) => {
			if (l.current) l.current.rotation.x = (i ? 1 : -1) * swing * 0.55;
		});
		arms.forEach((a, i) => {
			const g = a.current;
			if (!g) return;
			const s = i ? 1 : -1;
			let z = s * 0.14;
			let x = 0;
			if (!walk) {
				if (p === "cheer") z = s * 2.6;
				if (p === "hips") {
					z = s * 0.75;
					x = -0.25;
				}
				if (p === "twirl") z = s * 1.25;
				if (p === "wave" && i === 0) z = -2.5 + (reduced ? 0 : Math.sin(t * 6) * 0.3);
			}
			// A hop throws the arms out a little.
			z += s * hop * 0.35;
			const at = n.arms;
			const from = [at[i * 2]!, at[i * 2 + 1]!];
			if (Math.abs(from[0]! - z) + Math.abs(from[1]! - x) > 0.002) busy = true;
			// The first frame puts them straight where the pose has them: she arrives already posed.
			const snap = reduced || !n.primed;
			at[i * 2] = snap ? z : from[0]! + (z - from[0]!) * k;
			at[i * 2 + 1] = snap ? x : from[1]! + (x - from[1]!) * k;
			g.rotation.z = at[i * 2]!;
			g.rotation.x = at[i * 2 + 1]! + (i ? -1 : 1) * swing * 0.45;
		});
		// Ponytails and pigtails swing with her steps, fly out in a twirl and drift a little at rest.
		swings.current.forEach((g, i) => {
			if (!g) return;
			const side = swingHair.length > 1 ? (i ? 1 : -1) : 0;
			g.rotation.x = reduced ? 0 : 0.3 * walk + Math.sin(t * 1.7 + i) * 0.04 + (twirling ? 0.25 : 0);
			g.rotation.z = reduced ? 0 : Math.sin(t * 9 + i) * 0.16 * walk + side * (twirling ? 0.5 : 0) - hop * side * 0.3;
		});
		n.primed = true;
		if (busy && !reduced) wake();
	});

	// Built once per look: a change of pose alone moves the arms in the frame loop, so it mustn't rebake her parts.
	return useMemo(
		() => (
			<group>
				<Sparkle burst={now} />
				<group ref={spin}>
					<group ref={body}>
						<Part>
							<Torso d={d} skin={skin} />
							{top && <Top item={top} d={d} w={colours(look, "top")} />}
							{dress && <Dress item={dress} d={d} w={colours(look, "dress")} />}
							{look.slots.bottom && <Hips item={look.slots.bottom.item} d={d} w={colours(look, "bottom")} />}
							{outer && <Outer item={outer} d={d} w={colours(look, "outer")} />}
							{look.slots.necklace && <Necklace item={look.slots.necklace.item} c1={colours(look, "necklace").c1} d={d} />}
							{bag && bagAt === "back" && <Bag item={bag} c1={colours(look, "bag").c1} d={d} />}
							{bag && bagAt === "hip" && (
								<>
									<M c={colours(look, "bag").c1} p={[0, 1.3, 0]} r={[0, 0, 0.6]} s={[1, 1, d.depth + 0.06]}>
										<torusGeometry args={[d.shoulder + 0.06, 0.015, 6, 28]} />
									</M>
									<group position={[d.hip + 0.1, Y.hip, 0.05]}>
										<Bag item={bag} c1={colours(look, "bag").c1} d={d} />
									</group>
								</>
							)}
							{gem?.animal && !animal && <Tail animal={gem.animal} fur={gemC} patch="#2b2b33" />}
							{animal && <Tail animal={animal} fur={fur!} patch={patch} />}
						</Part>

						{/* Arms hang from the shoulders: 0 is her right (the viewer's left), 1 her left. */}
						{[-1, 1].map((s, i) => (
							<group key={s} ref={arms[i]} position={[s * (d.shoulder + d.arm * 0.3), Y.shoulder - 0.03, 0]}>
								<Part>
									<Hang r={d.arm} len={ARM_LEN} c={skin} />
									<Hand r={d.arm} side={s} skin={skin} />
									{sleeve && sleeveC && (
										<Sleeve
											len={sleeve.len}
											armLen={ARM_LEN}
											armR={d.arm}
											c={sleeveC.c1}
											map={sleeveMap}
											{...(sleeve.puffy && { puffy: true })}
										/>
									)}
									{bag && bagAt === "hand" && i === 1 && (
										<group position={[0, -ARM_LEN - 0.05, 0]}>
											<Bag item={bag} c1={colours(look, "bag").c1} d={d} />
										</group>
									)}
								</Part>
							</group>
						))}

						{/* Legs hang from the hips, with whatever's on them. */}
						{[-1, 1].map((s, i) => (
							<group key={s} ref={legs[i]} position={[s * d.legX, Y.hip, 0]}>
								<Part>
									<Hang r={d.leg} len={LEG_LEN} c={skin} />
									{look.slots.socks && <Sock item={look.slots.socks.item} d={d} w={colours(look, "socks")} />}
									<LegWear
										{...(look.slots.bottom && { bottom: look.slots.bottom.item })}
										{...(dress && { dress })}
										d={d}
										w={colours(look, "bottom")}
										dressW={colours(look, "dress")}
									/>
									<Foot {...(look.slots.shoes && { item: look.slots.shoes.item })} d={d} w={colours(look, "shoes")} skin={skin} />
								</Part>
							</group>
						))}

						<group ref={head} position={[0, Y.head, 0]}>
							<Part>
								{animal ? (
									<AnimalHead animal={animal} fur={fur!} patch={patch} />
								) : (
									<group scale={HEAD_SCALE[look.slots.face?.item ?? "face-oval"] ?? [1, 1, 1]}>
										<Ball r={HEAD_R} c={skin} />
										{[-1, 1].map((s) => (
											<Ball key={s} r={0.1} p={[s * HEAD_R * 0.98, -0.05, 0]} c={skin} s={[0.5, 0.75, 0.45]} />
										))}
									</group>
								)}
								<Face look={look} />
								{hairItem && <Hair3D item={hairItem} c={hairC} />}
								{!animal && gem?.animal && (
									<Ears
										animal={gem.animal}
										fur={gem.animal === "panda" ? "#f4f1ea" : gemC}
										patch={gem.animal === "panda" ? gemC : "#2b2b33"}
									/>
								)}
								{!animal && look.slots.earrings && <Earrings item={look.slots.earrings.item} />}
								{look.slots.glasses && <Glasses item={look.slots.glasses.item} c={colours(look, "glasses").c1} />}
								{hat && <Hat item={hat} {...colours(look, "hat")} />}
							</Part>
							{swingHair.map((h, i) => (
								<group
									key={i}
									position={h.at}
									ref={(g) => {
										swings.current[i] = g;
									}}
								>
									<Part>{h.node}</Part>
								</group>
							))}
						</group>
					</group>
				</group>
			</group>
		),
		[look.skin, worn],
	);
}

/** A mitten hand: a soft palm with the thumb forward and in, towards her. */
function Hand({ r, side, skin }: { r: number; side: number; skin: string }) {
	return (
		<group position={[0, -ARM_LEN - 0.02, 0]}>
			<Ball r={r * 1.22} c={skin} s={[0.9, 1.12, 0.78]} />
			<Ball r={r * 0.55} p={[-side * r * 0.62, r * 0.25, r * 0.55]} c={skin} s={[1, 1.25, 1]} />
		</group>
	);
}

/**
 * One moving part of her (the body, an arm, a leg, the head), baked into a single mesh: she's dozens of small toon
 * shapes, and drawn one by one she'd cost as much as a whole town place. Patterned fabric and the face stay separate.
 */
const Part = ({ children }: { children: ReactNode }) => (
	<Static cast={false} twoSided material={roxyBaked()}>
		{children}
	</Static>
);

/** The pet from a look, on its own, so it can walk separately. */
function PetModelBase({ look }: { look: Look }) {
	const pet = look.slots.pet;
	if (!pet) return null;
	const { c1, c2 } = colours(look, "pet");
	return (
		<Pet3D
			item={pet.item}
			c1={c1}
			c2={c2}
			{...(look.slots.petwear && { wear: look.slots.petwear.item })}
			wearC={colours(look, "petwear").c1}
		/>
	);
}

// Memoised: a tap in a place re-renders the scene, and rebuilding her shapes each time is wasted work.
export const RoxyModel = memo(RoxyModelBase);
export const PetModel = memo(PetModelBase);
