/**
 * Built-in starter lists. K–3 are the Dolch sight-word lists (public domain, 1936/1948); single-letter words
 * ("a", "I") are left out because there is nothing to spell. Grades 4–5 are a curated set of words commonly
 * taught at those levels (tricky vowels, silent letters, doubled consonants).
 */
export type Pack = { id: string; name: string; grade: number; words: string[] };

const w = (s: string) => s.trim().split(/\s+/);

export const PACKS: Pack[] = [
	{
		id: "dolch-preprimer",
		name: "Kindergarten · Sight words 1",
		grade: 0,
		words: w(`and away big blue can come down find for funny go help here in is it jump little look make me my not one
			play red run said see the three to two up we where yellow you`),
	},
	{
		id: "dolch-primer",
		name: "Kindergarten · Sight words 2",
		grade: 0,
		words: w(`all am are at ate be black brown but came did do eat four get good have he into like must new no now on our
			out please pretty ran ride saw say she so soon that there they this too under want was well went what white who will with yes`),
	},
	{
		id: "dolch-first",
		name: "1st grade · Sight words",
		grade: 1,
		words: w(`after again an any as ask by could every fly from give going had has her him his how just know let live may
			of old once open over put round some stop take thank them then think walk were when`),
	},
	{
		id: "dolch-second",
		name: "2nd grade · Sight words",
		grade: 2,
		words: w(`always around because been before best both buy call cold does don't fast first five found gave goes green its
			made many off or pull read right sing sit sleep tell their these those upon us use very wash which why wish work would write your`),
	},
	{
		id: "dolch-third",
		name: "3rd grade · Sight words",
		grade: 3,
		words: w(`about better bring carry clean cut done draw drink eight fall far full got grow hold hot hurt if keep kind laugh
			light long much myself never only own pick seven shall show six small start ten today together try warm`),
	},
	{
		id: "grade4-core",
		name: "4th grade · Tricky words",
		grade: 4,
		words: w(`although answer beautiful believe bicycle breathe brought caught certain choose climb country different early
			enough especially favorite friend guess happened heard important island library minute neighbor ocean often people
			question quiet really remember science special straight surprise thought through tomorrow weigh whole whose women`),
	},
	{
		id: "grade5-core",
		name: "5th grade · Bee challenge",
		grade: 5,
		words: w(`accident achieve address apparent calendar category committee conscience curious definite describe desperate
			dictionary disappear embarrass environment exaggerate excellent experience february foreign government guarantee
			height immediately independent interrupt judgment knowledge license lightning mischievous necessary occasion
			opportunity parallel persuade privilege receive recommend rhythm schedule separate sincerely vacuum wednesday`),
	},
];
