import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditLog, contributions, projects } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const moderationAction = z.enum(["approve", "reject", "hide", "delete"]);
export type ModerationAction = z.infer<typeof moderationAction>;

/**
 * Loads a contribution only if it belongs to a project owned by `ownerId`.
 * Guessing a contribution UUID gets you nothing: ownership is checked in the query itself.
 */
async function ownedContribution(ownerId: string, contributionId: string) {
  if (!z.uuid().safeParse(contributionId).success) return null;
  const [row] = await db
    .select({ c: contributions, p: projects })
    .from(contributions)
    .innerJoin(projects, eq(projects.id, contributions.projectId))
    .where(and(eq(contributions.id, contributionId), eq(projects.ownerId, ownerId), isNull(contributions.deletedAt)));
  return row ?? null;
}

export async function moderate(ownerId: string, contributionId: string, action: ModerationAction) {
  const row = await ownedContribution(ownerId, contributionId);
  if (!row) return false;

  if (action === "delete") {
    await db.update(contributions).set({ deletedAt: new Date() }).where(eq(contributions.id, row.c.id));
    // Remove media immediately: deleted means gone.
    const storage = getStorage();
    for (const key of [row.c.mediaKey, row.c.processedKey]) if (key) await storage.remove(key).catch(() => {});
  } else {
    const moderation = { approve: "approved", reject: "rejected", hide: "hidden" }[action] as "approved" | "rejected" | "hidden";
    await db.update(contributions).set({ moderation }).where(eq(contributions.id, row.c.id));
  }
  await db.insert(auditLog).values({ actorId: ownerId, projectId: row.p.id, action: `contribution.${action}`, meta: { contributionId } });
  return true;
}

export async function setTranscriptHidden(ownerId: string, contributionId: string, hidden: boolean) {
  const row = await ownedContribution(ownerId, contributionId);
  if (!row) return false;
  await db.update(contributions).set({ transcriptHidden: hidden }).where(eq(contributions.id, row.c.id));
  return true;
}

/** Contributions for the organizer's dashboard, each with a short-lived signed URL for private media. */
export async function listForOwner(ownerId: string, projectId: string) {
  if (!z.uuid().safeParse(projectId).success) return [];
  const rows = await db
    .select({ c: contributions })
    .from(contributions)
    .innerJoin(projects, eq(projects.id, contributions.projectId))
    .where(and(eq(contributions.projectId, projectId), eq(projects.ownerId, ownerId), isNull(contributions.deletedAt)))
    .orderBy(asc(contributions.createdAt));
  const storage = getStorage();
  return Promise.all(
    rows.map(async ({ c }) => ({
      ...c,
      editSecretHash: undefined,
      mediaUrl: c.processedKey || c.mediaKey ? await storage.presignGet((c.processedKey ?? c.mediaKey)!) : null,
    })),
  );
}
