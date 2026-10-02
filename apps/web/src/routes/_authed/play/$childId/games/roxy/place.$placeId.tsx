import { FIND_BY_ID, FINDS, PLACE_INFO, PLACES, type PlaceId } from "@jade/core/roxy";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Calculator, Gift, PawPrint, Search } from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useId, useRef, useState } from "react";
import { z } from "zod";
import { GameScreen } from "#/components/roxy/GameScreen.tsx";
import type { Hotspot } from "#/components/roxy/world/PlaceScene.tsx";
import { useChild } from "#/lib/child.ts";
import { useOnline } from "#/lib/hooks.ts";
import { roxyApi, roxyQuery, type Studio, shownLook } from "#/lib/roxy.ts";
import { speaker } from "#/lib/speaker.ts";

const scene = () => import("#/components/roxy/world/PlaceScene.tsx");
// three.js only loads on game screens.
const PlaceScene = lazy(() => scene().then((m) => ({ default: m.PlaceScene })));

export const Route = createFileRoute("/_authed/play/$childId/games/roxy/place/$placeId")({
	params: {
		parse: (p) => ({ placeId: z.enum(PLACES).parse(p.placeId) }),
		stringify: (p) => ({ placeId: p.placeId }),
	},
	loader: ({ context, params }) => context.queryClient.ensureQueryData(roxyQuery(params.childId)),
	component: PlaceScreen,
});

/** If this device can't draw 3D, say so; the finds and buttons below still work. */
class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		if (this.state.failed)
			return (
				<p className="grid size-full place-items-center p-6 text-center text-page-muted">
					This device can’t show the 3D town, but the buttons below still work.
				</p>
			);
		return this.props.children;
	}
}

function PlaceScreen() {
	const child = useChild();
	const { placeId } = Route.useParams();
	const { data } = useSuspenseQuery(roxyQuery(child.id));
	return <Place key={`${child.id}-${placeId}`} childId={child.id} place={placeId} data={data} />;
}

function Place({ childId, place, data }: { childId: string; place: PlaceId; data: Studio }) {
	const qc = useQueryClient();
	const online = useOnline();
	const id = useId();
	const info = PLACE_INFO[place];
	const look = shownLook(childId, data);
	const finds = FINDS.filter((f) => f.place === place);
	const [found, setFound] = useState(() => new Set(data.finds));
	const [walkTo, setWalkTo] = useState<{ x: number; z: number } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [panel, setPanel] = useState<Hotspot | null>(null);
	/** The find Roxy is walking over to pick up. */
	const heading = useRef<string | null>(null);

	async function walkToFind(findId: string) {
		const { findSpot } = await scene();
		const spot = findSpot(place, findId);
		if (!spot) return;
		heading.current = findId;
		setWalkTo({ ...spot });
	}

	function pickUp(findId: string) {
		const find = FIND_BY_ID.get(findId);
		if (!find || found.has(findId)) return;
		setFound((s) => new Set([...s, findId]));
		const left = finds.filter((f) => f.id !== findId && !found.has(f.id)).length;
		setMessage(`You found the ${find.label.toLowerCase()}! ${left === 0 ? "That’s everything here!" : `${left} more hiding here.`}`);
		// Saved now if online; if not, it's found again next visit (finding twice changes nothing).
		void roxyApi
			.find(childId, findId)
			.then(() => qc.invalidateQueries({ queryKey: roxyQuery(childId).queryKey }))
			.catch(() => {});
	}

	const hidden = finds.filter((f) => !found.has(f.id));

	return (
		<GameScreen
			panelLabel="What’s here"
			scene={
				<NoWebGL>
					<Suspense fallback={<p className="grid size-full place-items-center text-page-muted">On the way…</p>}>
						<PlaceScene
							place={place}
							look={look}
							found={found}
							walkTo={walkTo}
							label={`${info.label}. ${hidden.length} things still hidden.`}
							onGround={(spot) => {
								heading.current = null;
								setWalkTo(spot);
							}}
							onFind={(findId) => void walkToFind(findId)}
							onHotspot={setPanel}
							onArrive={() => {
								if (heading.current) {
									const findId = heading.current;
									heading.current = null;
									pickUp(findId);
								}
							}}
						/>
					</Suspense>
				</NoWebGL>
			}
			start={
				<>
					<Link to="/play/$childId/games/roxy/town" params={{ childId }} className="key" data-variant="felt">
						<ArrowLeft className="size-5" aria-hidden /> Town
					</Link>
					<h1 className="foil px-4 py-1.5 font-display text-2xl font-semibold">{info.label}</h1>
				</>
			}
			end={
				<>
					<p className="foil px-3.5 py-1.5 text-sm">
						{finds.length - hidden.length} of {finds.length} found
					</p>
				</>
			}
			actions={
				<div className="patch max-w-md px-4 py-2 text-center">
					<p role="status" className="mt-3 text-page-muted">
						{message ?? "Tap the ground to walk. Some things are hidden: tap one to pick it up."}
					</p>
				</div>
			}
			panel={
				<div className="space-y-6">
					{(place === "school" || panel === "chalkboard") && (
						<section aria-labelledby={`${id}-board`} className="patch space-y-3 p-4">
							<h2 id={`${id}-board`} className="font-display text-xl font-semibold">
								The chalkboard
							</h2>
							<p className="text-page-muted">Practice earns stars for Roxy’s wardrobe and home.</p>
							<div className="flex flex-wrap gap-2">
								<Link to="/play/$childId/spelling" params={{ childId }} className="key" onClick={() => speaker.unlock()}>
									<BookOpen className="size-5" aria-hidden /> Spelling
								</Link>
								<Link to="/play/$childId/math" params={{ childId }} className="key" onClick={() => speaker.unlock()}>
									<Calculator className="size-5" aria-hidden /> Math
								</Link>
							</div>
						</section>
					)}
					{(place === "petshop" || panel === "adopt") && (
						<section aria-labelledby={`${id}-adopt`} className="patch space-y-3 p-4">
							<h2 id={`${id}-adopt`} className="font-display text-xl font-semibold">
								Adopt a pet
							</h2>
							<p className="text-page-muted">Cats, dogs, bunnies, lizards and more. Pick one to walk with Roxy.</p>
							<Link to="/play/$childId/games/roxy" params={{ childId }} search={{ tab: "pets" }} className="key">
								<PawPrint className="size-5" aria-hidden /> Choose a pet
							</Link>
						</section>
					)}

					<section aria-labelledby={`${id}-finds`} className="space-y-3">
						<h2 id={`${id}-finds`} className="font-display text-xl font-semibold">
							Hidden here
						</h2>
						<ul className="flex flex-wrap gap-2">
							{finds.map((f) => (
								<li
									key={f.id}
									className={found.has(f.id) ? "foil gap-1.5 px-3 py-1.5 text-sm" : "slot px-3 py-1.5 text-sm text-page-muted"}
								>
									{found.has(f.id) ? (
										<>
											<Gift className="size-4" aria-hidden /> {f.label}
										</>
									) : (
										<>Still hidden</>
									)}
								</li>
							))}
						</ul>
						{hidden.length > 0 && (
							<button type="button" className="key" onClick={() => void walkToFind(hidden[0]!.id)}>
								<Search className="size-5" aria-hidden /> Help me look
							</button>
						)}
						{!online && <p className="text-sm text-page-muted">You’re offline. Finds are kept when you’re back online and visit again.</p>}
					</section>
				</div>
			}
		/>
	);
}
