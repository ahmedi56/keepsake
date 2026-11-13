import { randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { contributions, projects, prompts } from "@/db/schema";
import { LIMITS, extensionFor, isDeclaredMimeAllowed, sniffAllowed, type MediaKind } from "@/lib/media";
import { PLAN_LIMITS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { newToken, sha256 } from "@/lib/tokens";
import { isStickerId, themeFor } from "@/lib/themes";

/** Domain errors the API layer maps to HTTP statuses. Messages are safe to show to contributors via i18n keys. */
export class ContributeError extends Error {
  constructor(
    public code:
      | "not_found"
      | "closed"
      | "rate_limited"
      | "too_large"
      | "wrong_type"
      | "invalid"
      | "limit_reached",
    public status: number,
  ) {
    super(code);
  }
}

const KIND_OF_TYPE = { voice: "audio", photo: "image", video: "video" } as const satisfies Record<string, MediaKind>;
const MEDIA_TYPES = ["voice", "photo", "video"] as const;

/** Resolve a contribute token to its project. Same error for unknown, expired and malformed tokens. */
export async function projectForToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new ContributeError("not_found", 404);
  const [project] = await db.select().from(projects).where(eq(projects.contributeToken, token));
  if (!project) throw new ContributeError("not_found", 404);
  if (project.status !== "collecting") throw new ContributeError("closed", 410);
  if (project.contributeExpiresAt && project.contributeExpiresAt < new Date()) throw new ContributeError("closed", 410);
  return project;
}

async function assertCapacity(project: typeof projects.$inferSelect) {
  const cap = PLAN_LIMITS[project.plan].maxContributions;
  if (cap === null) return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(contributions)
    .where(and(eq(contributions.projectId, project.id), isNull(contributions.deletedAt)));
  if (n >= cap) throw new ContributeError("limit_reached", 402);
}

const uploadRequestSchema = z.object({
  type: z.enum(MEDIA_TYPES),
  mime: z.string().min(3).max(100),
  size: z.number().int().positive(),
});

export async function createUploadUrl(token: string, ip: string, raw: unknown) {
  const project = await projectForToken(token);
  if (!(await rateLimit(`upload:${project.id}:${ip}`, 30, 600))) throw new ContributeError("rate_limited", 429);

  const parsed = uploadRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ContributeError("invalid", 400);
  const { type, mime, size } = parsed.data;

  if (!project.allowedTypes.includes(type)) throw new ContributeError("wrong_type", 400);
  const kind = KIND_OF_TYPE[type];
  if (!isDeclaredMimeAllowed(kind, mime)) throw new ContributeError("wrong_type", 400);
  if (size > LIMITS[kind].maxBytes) throw new ContributeError("too_large", 413);
  await assertCapacity(project);

  // The key embeds project and kind: submission later proves the file belongs to *this* project.
  const key = `projects/${project.id}/incoming/${kind}/${randomUUID()}.${extensionFor(mime)}`;
  const uploadUrl = await getStorage().presignPut(key, mime.split(";")[0].trim());
  return { key, uploadUrl };
}

const submitSchema = z
  .object({
    type: z.enum(["voice", "text", "photo", "video", "story"]),
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    text: z.string().trim().max(5000).optional(),
    promptText: z.string().trim().max(300).optional(),
    key: z.string().max(300).optional(),
    durationMs: z.number().int().min(0).max(30 * 60 * 1000).optional(),
    sticker: z.string().refine(isStickerId).optional(),
  })
  .superRefine((v, ctx) => {
    const isMedia = (MEDIA_TYPES as readonly string[]).includes(v.type);
    if (isMedia && !v.key) ctx.addIssue({ code: "custom", message: "key required", path: ["key"] });
    if (!isMedia && !v.text) ctx.addIssue({ code: "custom", message: "text required", path: ["text"] });
    if (!isMedia && v.key) ctx.addIssue({ code: "custom", message: "key not allowed", path: ["key"] });
  });

export async function submitContribution(token: string, ip: string, raw: unknown) {
  const project = await projectForToken(token);
  if (!(await rateLimit(`submit:${project.id}:${ip}`, 20, 600))) throw new ContributeError("rate_limited", 429);

  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) throw new ContributeError("invalid", 400);
  const v = parsed.data;
  if (!project.allowedTypes.includes(v.type) && !(v.type === "story" && project.allowedTypes.includes("text"))) {
    throw new ContributeError("wrong_type", 400);
  }
  await assertCapacity(project);

  let mediaKey: string | null = null;
  let mime: string | null = null;
  let sizeBytes: number | null = null;

  if (v.key) {
    const kind = KIND_OF_TYPE[v.type as (typeof MEDIA_TYPES)[number]];
    const storage = getStorage();
    // 1) Ownership: the key must live under this project's incoming/<kind>/ prefix.
    const prefix = `projects/${project.id}/incoming/${kind}/`;
    if (!v.key.startsWith(prefix) || v.key.includes("..")) throw new ContributeError("invalid", 400);
    // 2) A file can back at most one contribution.
    const [used] = await db.select({ id: contributions.id }).from(contributions).where(eq(contributions.mediaKey, v.key));
    if (used) throw new ContributeError("invalid", 400);
    // 3) It must exist and respect the size limit (the browser could have lied before uploading).
    const size = await storage.size(v.key);
    if (size === null || size === 0) throw new ContributeError("invalid", 400);
    if (size > LIMITS[kind].maxBytes) {
      await storage.remove(v.key);
      throw new ContributeError("too_large", 413);
    }
    // 4) Content must really be what the kind says: sniff the magic bytes, ignore extension/declared type.
    const sniffed = await sniffAllowed(kind, await storage.readHead(v.key, 4100));
    if (!sniffed) {
      await storage.remove(v.key);
      throw new ContributeError("wrong_type", 400);
    }
    mediaKey = v.key;
    mime = sniffed;
    sizeBytes = size;
  }

  const editSecret = newToken();
  const [row] = await db
    .insert(contributions)
    .values({
      projectId: project.id,
      contributorName: v.name,
      contributorEmail: v.email || null,
      type: v.type,
      text: v.text || null,
      promptText: v.promptText || null,
      mediaKey,
      mime,
      sizeBytes,
      durationMs: v.durationMs ?? null,
      sticker: v.sticker ?? null,
      moderation: project.requireApproval ? "pending" : "approved",
      editSecretHash: sha256(editSecret),
    })
    .returning({ id: contributions.id });

  // The edit secret is returned once; it lets the contributor delete their own entry without an account.
  return { id: row.id, editSecret };
}

/** Public, minimal view of a project for the contribution page: nothing about other contributions. */
export async function contributePageData(token: string) {
  const project = await projectForToken(token);
  const promptRows = await db.select().from(prompts).where(eq(prompts.projectId, project.id)).orderBy(prompts.position);
  return {
    recipientName: project.recipientName,
    title: project.title,
    type: project.type,
    description: project.description,
    allowedTypes: project.allowedTypes,
    prompts: promptRows.map((p) => p.text),
    coverKey: project.coverKey,
    theme: themeFor(project),
    requireApproval: project.requireApproval,
  };
}
