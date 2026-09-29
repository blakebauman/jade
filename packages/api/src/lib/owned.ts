import { type Db, schema } from "@jade/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

export async function ownedChild(db: Db, parentId: string, childId: string) {
	const child = await db.query.children.findFirst({ where: and(eq(schema.children.id, childId), eq(schema.children.parentId, parentId)) });
	if (!child) throw new HTTPException(404, { message: "Child not found" });
	return child;
}

export async function ownedList(db: Db, ownerId: string, listId: string) {
	const list = await db.query.wordLists.findFirst({ where: and(eq(schema.wordLists.id, listId), eq(schema.wordLists.ownerId, ownerId)) });
	if (!list) throw new HTTPException(404, { message: "List not found" });
	return list;
}
