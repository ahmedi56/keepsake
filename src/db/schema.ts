import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- Better Auth tables (organizer accounts only) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // "user" | "admin"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ---------- Product tables ---------- */

export const projectType = pgEnum("project_type", [
  "birthday",
  "wedding",
  "anniversary",
  "retirement",
  "graduation",
  "farewell",
  "memorial",
  "teacher",
  "family",
  "custom",
]);

export const privacyMode = pgEnum("privacy_mode", ["link", "password", "private"]);
export const projectStatus = pgEnum("project_status", ["collecting", "closed", "archived"]);
export const planTier = pgEnum("plan_tier", ["free", "memory", "premium"]);

export const contributionType = pgEnum("contribution_type", [
  "voice",
  "text",
  "photo",
  "video",
  "story",
]);
export const moderationStatus = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
]);
export const processingStatus = pgEnum("processing_status", [
  "none",
  "queued",
  "processing",
  "done",
  "failed",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    relationship: text("relationship"),
    title: text("title").notNull(),
    type: projectType("type").notNull().default("custom"),
    description: text("description"),
    eventDate: timestamp("event_date"),
    coverKey: text("cover_key"),
    locale: text("locale").notNull().default("en"),
    // Contributors hold the contribute token (write-only). The keepsake is reached via the
    // unguessable slug, so the two capabilities are independent.
    contributeToken: text("contribute_token").notNull(),
    slug: text("slug").notNull(),
    privacy: privacyMode("privacy").notNull().default("link"),
    passwordHash: text("password_hash"),
    contributeExpiresAt: timestamp("contribute_expires_at"),
    viewExpiresAt: timestamp("view_expires_at"),
    allowedTypes: text("allowed_types").array().notNull().default(["voice", "text", "photo"]),
    plan: planTier("plan").notNull().default("free"),
    status: projectStatus("status").notNull().default("collecting"),
    requireApproval: boolean("require_approval").notNull().default(true),
    // Visual theme (see src/lib/themes.ts). Null = the default theme for the occasion.
    theme: text("theme"),
    // Surprise mode: before this moment only the owner can open the keepsake.
    revealAt: timestamp("reveal_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("projects_contribute_token_idx").on(t.contributeToken),
    uniqueIndex("projects_slug_idx").on(t.slug),
    index("projects_owner_idx").on(t.ownerId),
  ],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contributorName: text("contributor_name").notNull(),
    contributorEmail: text("contributor_email"),
    type: contributionType("type").notNull(),
    promptText: text("prompt_text"),
    text: text("text"),
    mediaKey: text("media_key"),
    processedKey: text("processed_key"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    transcript: text("transcript"),
    transcriptHidden: boolean("transcript_hidden").notNull().default(false),
    // Optional reaction sticker chosen by the contributor (see src/lib/themes.ts).
    sticker: text("sticker"),
    moderation: moderationStatus("moderation").notNull().default("pending"),
    processing: processingStatus("processing").notNull().default("none"),
    // Lets a contributor delete/edit their own entry later without an account.
    editSecretHash: text("edit_secret_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("contributions_project_idx").on(t.projectId, t.moderation, t.createdAt),
  ],
);

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("prompts_project_idx").on(t.projectId, t.position)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at"),
  },
  (t) => [index("invitations_project_idx").on(t.projectId)],
);

/* Rate limiting without Redis: fixed-window counters keyed by bucket string. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start").notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id"),
    projectId: uuid("project_id"),
    action: text("action").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_project_idx").on(t.projectId, t.createdAt)],
);
