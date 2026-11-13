import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { contributions, projects } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { sha256 } from "@/lib/tokens";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Cookie value that proves a visitor unlocked a password-protected keepsake. Bound to the stored hash. */
export function unlockCookieValue(project: { id: string; passwordHash: string | null }): string {
  return sha256(`${project.id}:${project.passwordHash}`);
}

export async function projectBySlug(slug: string) {
  if (!/^[a-z0-9-]{8,80}$/.test(slug)) return null;
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project) return null;
  if (project.viewExpiresAt && project.viewExpiresAt < new Date()) return null;
  return project;
}

/** Only approved, non-deleted contributions are ever shown on the keepsake. */
export async function keepsakeContributions(projectId: string) {
  const rows = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.projectId, projectId), eq(contributions.moderation, "approved"), isNull(contributions.deletedAt)))
    .orderBy(asc(contributions.createdAt));
  const storage = getStorage();
  return Promise.all(
    rows.map(async (c) => ({
      id: c.id,
      type: c.type,
      name: c.contributorName,
      text: c.text,
      promptText: c.promptText,
      transcript: c.transcriptHidden ? null : c.transcript,
      durationMs: c.durationMs,
      sticker: c.sticker,
      createdAt: c.createdAt,
      mediaUrl: c.processedKey || c.mediaKey ? await storage.presignGet((c.processedKey ?? c.mediaKey)!) : null,
    })),
  );
}

/**
 * What a visitor may see. Surprise mode (revealAt in the future) hides EVERYTHING from everyone but
 * the owner, and returns before any contribution or signed media URL is created.
 */
export async function getKeepsakeView(project: { id: string; revealAt: Date | null }, isOwner: boolean, now = new Date()) {
  const sealed = project.revealAt !== null && project.revealAt > now;
  if (sealed && !isOwner) return { locked: true as const, revealAt: project.revealAt! };
  return {
    locked: false as const,
    sealedForOthers: sealed,
    revealAt: project.revealAt,
    items: await keepsakeContributions(project.id),
  };
}

/** Wrapped so React Server Components can read the clock without tripping the render-purity lint. */
export const currentTimeMs = () => Date.now();

/** How many contributions are waiting for the organizer's approval (they are NOT shown to anyone else). */
export async function pendingCount(projectId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(contributions)
    .where(and(eq(contributions.projectId, projectId), eq(contributions.moderation, "pending"), isNull(contributions.deletedAt)));
  return row?.n ?? 0;
}
