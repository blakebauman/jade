import { hex, ITEM, type Look, type Pose } from "@jade/core/roxy";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, memo, useMemo, useRef } from "react";
import type { Group } from "three";
import { prefersReducedMotion } from "#/lib/hooks.ts";
import { useWake } from "../world/pace.tsx";
import { Bag, bagPlace, Earrings, Glasses, Hat, HIDES_HAIR_3D, Necklace } from "./accessories.tsx";
import { AnimalHead, Ears, fur3, Pet3D, Tail } from "./animals.tsx";
import { DIMS3, Face, HEAD_R, HEAD_SCALE, type Shape3, Torso, Y } from "./body.tsx";
import { Dress, Foot, Hips, LegWear, Outer, Sleeve, Sock, sleeveFor, Top, topFixed, topPattern } from "./clothes.tsx";
import { Hair3D } from "./hair.tsx";
import { Ball, colours, fabric, Hang, M } from "./shapes.tsx";

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
	const p = pose ?? look.pose ?? "stand";
	const wake = useWake();

	useFrame((state) => {
		const t = state.clock.elapsedTime;
		const walk = walking?.current ?? 0;
		const swing = reduced ? 0 : Math.sin(t * 9) * walk;
		// Breathing is slow enough for the idle tick; a wave or a twirl needs every frame.
		if (!reduced && !walk && (p === "twirl" || p === "wave")) wake();
		const sway = reduced ? 0 : 1;
		if (body.current) body.current.scale.y = 1 + Math.sin(t * 2) * 0.008 * sway;
		if (head.current) head.current.rotation.z = Math.sin(t * 1.3) * 0.03 * sway;
		if (spin.current) spin.current.rotation.y = p === "twirl" && !walk && !reduced ? t * 2.2 : 0;
		legs.forEach((l, i) => {
			if (l.current) l.current.rotation.x = (i ? 1 : -1) * swing * 0.55;
		});
		arms.forEach((a, i) => {
			const g = a.current;
			if (!g) return;
			const s = i ? 1 : -1;
			let z = s * 0.14;
			let x = (i ? -1 : 1) * swing * 0.45;
			if (!walk) {
				if (p === "cheer") z = s * 2.6;
				if (p === "hips") {
					z = s * 0.75;
					x = -0.25;
				}
				if (p === "twirl") z = s * 1.25;
				if (p === "wave" && i === 0) z = -2.5 + (reduced ? 0 : Math.sin(t * 6) * 0.3);
			}
			g.rotation.z = z;
			g.rotation.x = x;
		});
	});

	return (
		<group ref={spin}>
			<group ref={body}>
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

				{/* Arms hang from the shoulders: 0 is her right (the viewer's left), 1 her left. */}
				{[-1, 1].map((s, i) => (
					<group key={s} ref={arms[i]} position={[s * (d.shoulder + d.arm * 0.3), Y.shoulder - 0.03, 0]}>
						<Hang r={d.arm} len={ARM_LEN} c={skin} />
						<Ball r={d.arm * 1.3} p={[0, -ARM_LEN, 0]} c={skin} />
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
					</group>
				))}

				{/* Legs hang from the hips, with whatever's on them. */}
				{[-1, 1].map((s, i) => (
					<group key={s} ref={legs[i]} position={[s * d.legX, Y.hip, 0]}>
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
					</group>
				))}

				<group ref={head} position={[0, Y.head, 0]}>
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
					{!hideHair && look.slots.hair && <Hair3D item={look.slots.hair.item} c={hairC} />}
					{!animal && gem?.animal && (
						<Ears animal={gem.animal} fur={gem.animal === "panda" ? "#f4f1ea" : gemC} patch={gem.animal === "panda" ? gemC : "#2b2b33"} />
					)}
					{!animal && look.slots.earrings && <Earrings item={look.slots.earrings.item} />}
					{look.slots.glasses && <Glasses item={look.slots.glasses.item} c={colours(look, "glasses").c1} />}
					{hat && <Hat item={hat} {...colours(look, "hat")} />}
				</group>
			</group>
		</group>
	);
}

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
