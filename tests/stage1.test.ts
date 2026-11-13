import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { contributions, projects, rateLimits, user } from "@/db/schema";
import { DEFAULT_THEME, THEMES, themeFor } from "@/lib/themes";
import { ContributeError, contributePageData, submitContribution } from "@/server/contribute";
import { getKeepsakeView, keepsakeContributions, pendingCount } from "@/server/keepsake";
import { createProject } from "@/server/projects";

const OWNER = "stage1-owner";
const HOUR = 3600 * 1000;

async function newProject(extra: Record<string, unknown> = {}) {
  return createProject(OWNER, {
    type: "birthday", recipientName: "Sarah", title: "Sarah's 60th", locale: "en",
    allowedTypes: ["voice", "text", "photo"], ...extra,
  });
}

async function approvedNote(projectId: string, token: string, extra: Record<string, unknown> = {}) {
  const r = await submitContribution(token, "1.2.3.4", { type: "text", name: "Amira", text: "Happy birthday!", ...extra });
  await db.update(contributions).set({ moderation: "approved" }).where(eq(contributions.id, r.id));
  return r.id;
}

beforeAll(async () => {
  await db.insert(user).values({ id: OWNER, name: OWNER, email: `${OWNER}@example.com` }).onConflictDoNothing();
});
beforeEach(async () => {
  await db.delete(projects);
  await db.delete(rateLimits);
});

describe("stickers", () => {
  it("stores a valid sticker on a contribution", async () => {
    const p = await newProject();
    const r = await submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "Amira", text: "Hi", sticker: "heart" });
    const [row] = await db.select().from(contributions).where(eq(contributions.id, r.id));
    expect(row.sticker).toBe("heart");
  });

  it("rejects a sticker that is not in the allowed set (no arbitrary strings stored)", async () => {
    const p = await newProject();
    for (const bad of ["<script>", "heart; drop table", "😀", "", "x".repeat(300)]) {
      await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "A", text: "Hi", sticker: bad }))
        .rejects.toMatchObject({ code: "invalid" });
    }
  });

  it("accepts an allow-listed animated emoji and rejects look-alikes", async () => {
    const p = await newProject();
    const ok = await submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "A", text: "Hi", sticker: "e:1f973" });
    const [row] = await db.select().from(contributions).where(eq(contributions.id, ok.id));
    expect(row.sticker).toBe("e:1f973");
    for (const bad of ["e:", "e:ffff", "e:1f973/../x", "E:1f973", "e:1f973 ", "https://evil.example/x.gif"]) {
      await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "A", text: "Hi", sticker: bad }))
        .rejects.toMatchObject({ code: "invalid" });
    }
  });

  it("works without a sticker", async () => {
    const p = await newProject();
    const r = await submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "A", text: "Hi" });
    const [row] = await db.select().from(contributions).where(eq(contributions.id, r.id));
    expect(row.sticker).toBeNull();
  });
});

describe("themes", () => {
  it("uses the occasion's default theme when none is chosen", async () => {
    const p = await newProject();
    expect(p.theme).toBeNull();
    expect(themeFor(p)).toBe(DEFAULT_THEME.birthday);
    expect((await contributePageData(p.contributeToken)).theme).toBe(DEFAULT_THEME.birthday);
  });

  it("stores a chosen theme, and falls back safely if the stored value is unknown", async () => {
    const p = await newProject({ theme: "night" });
    expect(themeFor(p)).toBe("night");
    expect(themeFor({ theme: "not-a-theme", type: "wedding" })).toBe(DEFAULT_THEME.wedding);
  });

  it("rejects an unknown theme at creation", async () => {
    await expect(newProject({ theme: "hotpink" })).rejects.toThrow();
  });

  it("every occasion maps to a real theme", () => {
    for (const t of Object.values(DEFAULT_THEME)) expect(THEMES).toContain(t);
  });
});

describe("surprise reveal lock", () => {
  it("shows visitors NOTHING before the reveal: no contributions, no media URLs", async () => {
    const future = new Date(Date.now() + 2 * HOUR);
    const p = await newProject({ revealAt: future });
    await approvedNote(p.id, p.contributeToken);
    const view = await getKeepsakeView(p, false);
    expect(view.locked).toBe(true);
    expect(JSON.stringify(view)).not.toContain("Amira");
    expect(JSON.stringify(view)).not.toContain("Happy birthday");
    expect("items" in view).toBe(false);
  });

  it("lets the owner preview before the reveal and tells them it is sealed for others", async () => {
    const p = await newProject({ revealAt: new Date(Date.now() + 2 * HOUR) });
    await approvedNote(p.id, p.contributeToken);
    const view = await getKeepsakeView(p, true);
    expect(view.locked).toBe(false);
    if (!view.locked) {
      expect(view.sealedForOthers).toBe(true);
      expect(view.items).toHaveLength(1);
    }
  });

  it("opens for everyone once the reveal time has passed", async () => {
    const p = await newProject({ revealAt: new Date(Date.now() - HOUR) });
    await approvedNote(p.id, p.contributeToken);
    const view = await getKeepsakeView(p, false);
    expect(view.locked).toBe(false);
    if (!view.locked) expect(view.items).toHaveLength(1);
  });

  it("is open immediately when no reveal date is set", async () => {
    const p = await newProject();
    expect((await getKeepsakeView(p, false)).locked).toBe(false);
  });

  it("contributors can still add memories while the keepsake is sealed", async () => {
    const p = await newProject({ revealAt: new Date(Date.now() + 2 * HOUR) });
    await expect(submitContribution(p.contributeToken, "9.9.9.9", { type: "text", name: "Youssef", text: "Hi" })).resolves.toBeTruthy();
  });

  it("a closed project still rejects new contributions (unchanged behaviour)", async () => {
    const p = await newProject();
    await db.update(projects).set({ status: "closed" }).where(eq(projects.id, p.id));
    await expect(submitContribution(p.contributeToken, "1.1.1.1", { type: "text", name: "A", text: "Hi" })).rejects.toBeInstanceOf(ContributeError);
  });
});

describe("approval before anything appears", () => {
  it("a new message is pending and does NOT show on the keepsake until approved", async () => {
    const p = await newProject();
    expect(p.requireApproval).toBe(true);
    const r = await submitContribution(p.contributeToken, "2.2.2.2", { type: "text", name: "Amira", text: "Secret hello" });
    expect(await pendingCount(p.id)).toBe(1);
    expect(await keepsakeContributions(p.id)).toHaveLength(0);
    const view = await getKeepsakeView(p, false);
    expect(JSON.stringify(view)).not.toContain("Secret hello");
    const ownerView = await getKeepsakeView(p, true);
    expect(JSON.stringify(ownerView)).not.toContain("Secret hello");
    await db.update(contributions).set({ moderation: "approved" }).where(eq(contributions.id, r.id));
    expect(await pendingCount(p.id)).toBe(0);
    expect(await keepsakeContributions(p.id)).toHaveLength(1);
  });

  it("rejected and hidden messages never show either", async () => {
    const p = await newProject();
    for (const m of ["rejected", "hidden"] as const) {
      const r = await submitContribution(p.contributeToken, "3.3.3.3", { type: "text", name: "A", text: `x-${m}` });
      await db.update(contributions).set({ moderation: m }).where(eq(contributions.id, r.id));
    }
    expect(await keepsakeContributions(p.id)).toHaveLength(0);
  });

  it("with the switch turned off, messages appear straight away", async () => {
    const p = await newProject();
    await db.update(projects).set({ requireApproval: false }).where(eq(projects.id, p.id));
    const fresh = (await db.select().from(projects).where(eq(projects.id, p.id)))[0];
    await submitContribution(fresh.contributeToken, "4.4.4.4", { type: "text", name: "A", text: "Instant" });
    expect(await keepsakeContributions(p.id)).toHaveLength(1);
  });
});
