import { and, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { contributions, projects, prompts } from "@/db/schema";
import { locales } from "@/i18n/routing";
import { newSlug, newToken } from "@/lib/tokens";
import { THEMES } from "@/lib/themes";
import { CONTRIBUTION_TYPES, PROJECT_TYPES, defaultPrompts } from "./templates";

export const createProjectSchema = z.object({
  type: z.enum(PROJECT_TYPES),
  recipientName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  eventDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  relationship: z.string().trim().max(60).optional().nullable(),
  locale: z.enum(locales),
  allowedTypes: z.array(z.enum(CONTRIBUTION_TYPES)).min(1).max(5),
  theme: z.enum(THEMES).optional().nullable(),
  revealAt: z.coerce.date().optional().nullable(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export async function createProject(ownerId: string, raw: unknown) {
  const input = createProjectSchema.parse(raw);
  const [project] = await db
    .insert(projects)
    .values({
      ownerId,
      type: input.type,
      recipientName: input.recipientName,
      title: input.title,
      eventDate: input.eventDate ?? null,
      description: input.description || null,
      relationship: input.relationship || null,
      locale: input.locale,
      allowedTypes: [...new Set(input.allowedTypes)],
      theme: input.theme ?? null,
      revealAt: input.revealAt ?? null,
      contributeToken: newToken(),
      slug: newSlug(input.recipientName),
    })
    .returning();

  const texts = defaultPrompts(input.type, input.locale);
  await db.insert(prompts).values(texts.map((text, position) => ({ projectId: project.id, text, position })));
  return project;
}

/** Every owner-facing query is scoped by ownerId, so an ID alone never grants access. */
export async function getOwnedProject(ownerId: string, projectId: string) {
  if (!z.uuid().safeParse(projectId).success) return null;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  return project ?? null;
}

export async function listOwnedProjects(ownerId: string) {
  return db
    .select({
      project: projects,
      total: sql<number>`count(${contributions.id}) filter (where ${contributions.deletedAt} is null)`.mapWith(Number),
      pending: sql<number>`count(${contributions.id}) filter (where ${contributions.deletedAt} is null and ${contributions.moderation} = 'pending')`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(contributions, eq(contributions.projectId, projects.id))
    .where(eq(projects.ownerId, ownerId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));
}

export async function contributionBreakdown(projectId: string) {
  const rows = await db
    .select({ type: contributions.type, n: count() })
    .from(contributions)
    .where(and(eq(contributions.projectId, projectId), isNull(contributions.deletedAt), ne(contributions.moderation, "rejected")))
    .groupBy(contributions.type);
  return Object.fromEntries(rows.map((r) => [r.type, r.n])) as Partial<Record<(typeof CONTRIBUTION_TYPES)[number], number>>;
}

export async function listProjectPrompts(projectId: string) {
  return db.select().from(prompts).where(eq(prompts.projectId, projectId)).orderBy(prompts.position);
}
