import { type Db, schema } from "@jade/db";
import { and, eq, or } from "drizzle-orm";

/** A link is stored once, smaller user id first. */
export const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function linked(db: Db, a: string, b: string) {
	const [userA, userB] = pair(a, b);
	const row = await db.query.friendLinks.findFirst({
		where: and(eq(schema.friendLinks.userA, userA), eq(schema.friendLinks.userB, userB)),
	});
	return !!row;
}

/** What a family is called to its friends: the label its parent chose, or the parent's name. */
export async function familyLabel(db: Db, userId: string) {
	const [settings, user] = await Promise.all([
		db.query.parentSettings.findFirst({ where: eq(schema.parentSettings.userId, userId) }),
		db.query.user.findFirst({ where: eq(schema.user.id, userId) }),
	]);
	return settings?.familyLabel || (user ? `${user.name}’s family` : "A friend’s family");
}

/** Every family this one is linked with, with what they're called and since when. */
export async function friendsOf(db: Db, userId: string) {
	const rows = await db.query.friendLinks.findMany({
		where: or(eq(schema.friendLinks.userA, userId), eq(schema.friendLinks.userB, userId)),
	});
	return Promise.all(
		rows.map(async (r) => {
			const id = r.userA === userId ? r.userB : r.userA;
			return { userId: id, label: await familyLabel(db, id), since: r.createdAt.getTime() };
		}),
	);
}
