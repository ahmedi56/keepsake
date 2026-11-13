"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { THEMES } from "@/lib/themes";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { newToken } from "@/lib/tokens";
import { hashPassword, projectBySlug, unlockCookieValue, verifyPassword } from "./keepsake";
import { moderate, moderationAction, setTranscriptHidden } from "./moderation";
import { createProject, getOwnedProject } from "./projects";

export async function createProjectAction(input: unknown): Promise<{ id: string }> {
  const user = await requireUser();
  const project = await createProject(user.id, input);
  revalidatePath("/[locale]/dashboard", "page");
  return { id: project.id };
}

export async function moderateAction(contributionId: string, action: string): Promise<boolean> {
  const user = await requireUser();
  const ok = await moderate(user.id, contributionId, moderationAction.parse(action));
  if (ok) revalidatePath("/[locale]/dashboard/[id]", "page");
  return ok;
}

export async function transcriptVisibilityAction(contributionId: string, hidden: boolean) {
  const user = await requireUser();
  return setTranscriptHidden(user.id, contributionId, hidden);
}

const privacySchema = z.object({
  privacy: z.enum(["link", "password", "private"]),
  password: z.string().min(6).max(128).optional(),
});

export async function setPrivacyAction(projectId: string, raw: unknown): Promise<boolean> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return false;
  const v = privacySchema.parse(raw);
  const passwordHash = v.privacy === "password" ? (v.password ? hashPassword(v.password) : project.passwordHash) : null;
  if (v.privacy === "password" && !passwordHash) return false;
  await db.update(projects).set({ privacy: v.privacy, passwordHash, updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.ownerId, user.id)));
  revalidatePath("/[locale]/dashboard/[id]", "page");
  return true;
}

export async function setCollectingAction(projectId: string, collecting: boolean): Promise<boolean> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return false;
  await db.update(projects).set({ status: collecting ? "collecting" : "closed", updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.ownerId, user.id)));
  revalidatePath("/[locale]/dashboard/[id]", "page");
  return true;
}

/** Issues a new contribution link and invalidates the old one (e.g. if it leaked). */
export async function rotateContributeLinkAction(projectId: string): Promise<boolean> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return false;
  await db.update(projects).set({ contributeToken: newToken(), updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.ownerId, user.id)));
  revalidatePath("/[locale]/dashboard/[id]", "page");
  return true;
}

/** Unlocks a password-protected keepsake for this browser. Rate limited per keepsake + IP. */
export async function unlockKeepsakeAction(slug: string, password: string): Promise<boolean> {
  const project = await projectBySlug(slug);
  if (!project || project.privacy !== "password" || !project.passwordHash) return false;
  if (!(await rateLimit(`unlock:${project.id}:${clientIp(await headers())}`, 10, 600))) return false;
  if (typeof password !== "string" || !verifyPassword(password, project.passwordHash)) return false;
  (await cookies()).set(`ks_${project.id}`, unlockCookieValue(project), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

const appearanceSchema = z.object({
  theme: z.enum(THEMES).nullable(),
  // Reveal date as ISO string, or null to show the keepsake immediately. Capped at 5 years ahead.
  revealAt: z.coerce.date().refine((d) => d.getTime() < Date.now() + 5 * 365 * 24 * 3600 * 1000).nullable(),
});

export async function setAppearanceAction(projectId: string, raw: unknown): Promise<boolean> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (!project) return false;
  const v = appearanceSchema.safeParse(raw);
  if (!v.success) return false;
  await db.update(projects).set({ theme: v.data.theme, revealAt: v.data.revealAt, updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.ownerId, user.id)));
  revalidatePath("/[locale]/dashboard/[id]", "page");
  return true;
}

/** "Approve each message before it appears" on or off. On (the default) means nothing shows on the keepsake until the organizer approves it. */
export async function setRequireApprovalAction(projectId: string, value: boolean): Promise<boolean> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (!project || typeof value !== "boolean") return false;
  await db.update(projects).set({ requireApproval: value, updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.ownerId, user.id)));
  revalidatePath("/[locale]/dashboard/[id]", "page");
  return true;
}
