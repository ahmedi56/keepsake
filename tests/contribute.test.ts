import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { contributions, projects, rateLimits, user } from "@/db/schema";
import { storageRoot } from "@/lib/storage";
import {
  ContributeError,
  contributePageData,
  createUploadUrl,
  projectForToken,
  submitContribution,
} from "@/server/contribute";
import { createProject } from "@/server/projects";

const OWNER = "test-owner";
const OTHER_OWNER = "test-owner-2";

// Minimal real files: a 1x1 PNG and a WAV header with a little PCM data.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
function wav(): Buffer {
  const data = Buffer.alloc(2000);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function putFile(key: string, data: Buffer) {
  const p = path.join(storageRoot(), key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

async function newProject(ownerId = OWNER, over: Partial<typeof projects.$inferInsert> = {}) {
  const p = await createProject(ownerId, {
    type: "birthday", recipientName: "Sarah", title: "Sarah's 60th", locale: "en",
    allowedTypes: ["voice", "text", "photo"],
  });
  if (Object.keys(over).length) await db.update(projects).set(over).where(eq(projects.id, p.id));
  return { ...p, ...over };
}

beforeAll(async () => {
  for (const id of [OWNER, OTHER_OWNER]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.com` }).onConflictDoNothing();
  }
});
beforeEach(async () => {
  await db.delete(projects);
  await db.delete(rateLimits);
});

describe("contribute token resolution", () => {
  it("resolves a valid token and exposes only minimal public data", async () => {
    const p = await newProject();
    const data = await contributePageData(p.contributeToken);
    expect(data.recipientName).toBe("Sarah");
    expect(data.prompts.length).toBe(3);
    expect(JSON.stringify(data)).not.toContain(p.id);
    expect(JSON.stringify(data)).not.toContain(p.contributeToken);
  });
  it("rejects unknown and malformed tokens identically", async () => {
    for (const t of ["nope", "x".repeat(30), "../../etc/passwd", ""]) {
      await expect(projectForToken(t)).rejects.toMatchObject({ code: "not_found", status: 404 });
    }
  });
  it("rejects closed and expired projects", async () => {
    const closed = await newProject(OWNER, { status: "closed" });
    await expect(projectForToken(closed.contributeToken)).rejects.toMatchObject({ code: "closed" });
    const expired = await newProject(OWNER, { contributeExpiresAt: new Date(Date.now() - 1000) });
    await expect(projectForToken(expired.contributeToken)).rejects.toMatchObject({ code: "closed" });
  });
});

describe("text contributions", () => {
  it("stores a pending text contribution and returns an edit secret once", async () => {
    const p = await newProject();
    const r = await submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "Ahmed", text: "Happy birthday!" });
    const [row] = await db.select().from(contributions).where(eq(contributions.id, r.id));
    expect(row.moderation).toBe("pending");
    expect(row.editSecretHash).not.toBe(r.editSecret); // only the hash is stored
    expect(row.editSecretHash).toHaveLength(64);
  });
  it("rejects empty text, missing name and a key on a text contribution", async () => {
    const p = await newProject();
    for (const body of [
      { type: "text", name: "A" },
      { type: "text", name: "", text: "hi" },
      { type: "text", name: "A", text: "hi", key: "x" },
    ]) {
      await expect(submitContribution(p.contributeToken, "1.1.1.1", body)).rejects.toMatchObject({ code: "invalid" });
    }
  });
  it("rejects a type the organizer did not enable", async () => {
    const p = await newProject();
    await expect(
      createUploadUrl(p.contributeToken, "1.1.1.1", { type: "video", mime: "video/mp4", size: 1000 }),
    ).rejects.toMatchObject({ code: "wrong_type" });
  });
});

describe("media uploads and the project boundary", () => {
  it("accepts a real image uploaded under the project's own key", async () => {
    const p = await newProject();
    const { key } = await createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "image/png", size: PNG.length });
    await putFile(key, PNG);
    const r = await submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "Lina", key });
    const [row] = await db.select().from(contributions).where(eq(contributions.id, r.id));
    expect(row.mime).toBe("image/png");
  });
  it("accepts a real audio file", async () => {
    const p = await newProject();
    const w = wav();
    const { key } = await createUploadUrl(p.contributeToken, "1.1.1.1", { type: "voice", mime: "audio/wav", size: w.length });
    await putFile(key, w);
    await expect(
      submitContribution(p.contributeToken, "1.1.1.1", { type: "voice", name: "Karim", key, durationMs: 30000 }),
    ).resolves.toHaveProperty("id");
  });
  it("rejects a file whose bytes are not what its name/declared type claims", async () => {
    const p = await newProject();
    const evil = Buffer.from("<?php system($_GET['c']); ?>");
    const { key } = await createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "image/jpeg", size: evil.length });
    await putFile(key, evil);
    await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "X", key })).rejects.toMatchObject({ code: "wrong_type" });
    // and the bad object is deleted
    const { size } = await import("node:fs/promises").then((fs) => fs.stat(path.join(storageRoot(), key)).then((s) => s, () => ({ size: -1 })));
    expect(size).toBe(-1);
  });
  it("rejects an audio file submitted as a photo (kind mismatch)", async () => {
    const p = await newProject();
    const w = wav();
    const { key } = await createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "image/png", size: w.length });
    await putFile(key, w);
    await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "X", key })).rejects.toMatchObject({ code: "wrong_type" });
  });
  it("NEVER lets a contributor attach a file key belonging to another project", async () => {
    const a = await newProject();
    const b = await newProject(OTHER_OWNER);
    const { key: keyOfB } = await createUploadUrl(b.contributeToken, "2.2.2.2", { type: "photo", mime: "image/png", size: PNG.length });
    await putFile(keyOfB, PNG);
    await expect(
      submitContribution(a.contributeToken, "1.1.1.1", { type: "photo", name: "Attacker", key: keyOfB }),
    ).rejects.toMatchObject({ code: "invalid" });
    const rows = await db.select().from(contributions).where(eq(contributions.projectId, a.id));
    expect(rows).toHaveLength(0);
  });
  it("rejects path traversal and nonexistent keys", async () => {
    const p = await newProject();
    for (const key of [`projects/${p.id}/incoming/image/../../../x.png`, `projects/${p.id}/incoming/image/missing.png`]) {
      await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "X", key })).rejects.toMatchObject({ code: "invalid" });
    }
  });
  it("does not let the same file back two contributions", async () => {
    const p = await newProject();
    const { key } = await createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "image/png", size: PNG.length });
    await putFile(key, PNG);
    await submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "A", key });
    await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "photo", name: "B", key })).rejects.toMatchObject({ code: "invalid" });
  });
  it("refuses oversized uploads before issuing a URL, and bad declared types", async () => {
    const p = await newProject();
    await expect(createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "image/png", size: 11 * 1024 * 1024 })).rejects.toMatchObject({ code: "too_large" });
    await expect(createUploadUrl(p.contributeToken, "1.1.1.1", { type: "photo", mime: "application/x-sh", size: 100 })).rejects.toMatchObject({ code: "wrong_type" });
  });
});

describe("plan limits and abuse controls", () => {
  it("enforces the free plan cap of 10 contributions", async () => {
    const p = await newProject();
    for (let i = 0; i < 10; i++) {
      await submitContribution(p.contributeToken, `9.9.9.${i}`, { type: "text", name: `P${i}`, text: "hi" });
    }
    await expect(submitContribution(p.contributeToken, "9.9.9.99", { type: "text", name: "Late", text: "hi" })).rejects.toMatchObject({ code: "limit_reached", status: 402 });
  });
  it("does not cap paid projects at 10", async () => {
    const p = await newProject(OWNER, { plan: "memory" });
    for (let i = 0; i < 12; i++) {
      await submitContribution(p.contributeToken, `8.8.8.${i}`, { type: "text", name: `P${i}`, text: "hi" });
    }
    const rows = await db.select().from(contributions).where(eq(contributions.projectId, p.id));
    expect(rows).toHaveLength(12);
  });
  it("rate-limits one IP hammering the submit endpoint", async () => {
    const p = await newProject(OWNER, { plan: "memory" });
    let blocked = false;
    for (let i = 0; i < 25; i++) {
      try {
        await submitContribution(p.contributeToken, "7.7.7.7", { type: "text", name: "Spam", text: "x" });
      } catch (e) {
        expect(e).toBeInstanceOf(ContributeError);
        if ((e as ContributeError).code === "rate_limited") blocked = true;
      }
    }
    expect(blocked).toBe(true);
  });
});
