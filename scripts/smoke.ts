/**
 * API smoke test: exercises every public endpoint against a RUNNING server and prints PASS/FAIL.
 *
 *   npm run smoke                       (server on http://localhost:3000)
 *   SMOKE_URL=http://localhost:3100 npm run smoke
 *
 * It creates a throwaway organizer + projects in the database from .env and deletes them at the end.
 */
import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { contributions, projects, rateLimits, user } from "@/db/schema";
import { hashPassword } from "@/server/keepsake";
import { createProject } from "@/server/projects";

const BASE = (process.env.SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = process.env.BETTER_AUTH_URL ?? BASE;
const results: { name: string; ok: boolean; detail?: string }[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}
function expectEq<T>(actual: T, expected: T, what: string) {
  if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`);
}
function expectTrue(cond: unknown, what: string) {
  if (!cond) throw new Error(what);
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
function wav(): Buffer {
  const data = Buffer.alloc(2000);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const json = (body: unknown, ip = "10.0.0.1") => ({
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body),
});
const html = async (p: string, cookie?: string) => {
  const res = await fetch(`${BASE}${p}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: res.status, body: await res.text() };
};
/** The auth library rate-limits sign-up/sign-in per IP (a feature). On 429 wait out the window and retry. */
async function authFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, 11_000));
  }
  return fetch(url, init);
}
/** The server may be reached through a tunnel; upload URLs it hands out must still be PUT to our BASE. */
const localize = (u: string) => { const x = new URL(u); const b = new URL(BASE); x.protocol = b.protocol; x.host = b.host; return x.toString(); };

async function upload(token: string, type: "photo" | "voice", mime: string, bytes: Buffer, ip = "10.0.0.1") {
  const res = await fetch(`${BASE}/api/c/${token}/uploads`, json({ type, mime, size: bytes.length }, ip));
  if (!res.ok) return { res, key: "", put: null as Response | null };
  const { key, uploadUrl } = (await res.json()) as { key: string; uploadUrl: string };
  const put = await fetch(localize(uploadUrl), { method: "PUT", headers: { "content-type": mime }, body: new Uint8Array(bytes) });
  return { res, key, put };
}

async function main() {
  const stamp = Date.now();
  const email = `smoke-${stamp}@example.com`;
  const password = `Smoke-${stamp}-pw`;
  let userId = "";
  let cookie = "";
  const projectIds: string[] = [];

  console.log(`Keepsake API smoke test against ${BASE}\n`);

  // ---- public pages in all four languages
  for (const l of ["en", "fr", "ar", "es"]) {
    await check(`page /${l} renders`, async () => {
      const r = await html(`/${l}`);
      expectEq(r.status, 200, "status");
      expectTrue(r.body.includes(`lang="${l}"`), "html lang attribute");
    });
  }
  await check("Arabic page is right-to-left", async () => expectTrue((await html("/ar")).body.includes('dir="rtl"'), "dir=rtl"));

  // ---- auth API
  await check("auth: sign up", async () => {
    const res = await authFetch(`${BASE}/api/auth/sign-up/email`, { ...json({ name: "Smoke Test", email, password }), headers: { "content-type": "application/json", origin: ORIGIN } });
    expectEq(res.status, 200, "status");
    userId = ((await res.json()) as { user: { id: string } }).user.id;
    expectTrue(userId, "user id returned");
  });
  await check("auth: sign in and read session", async () => {
    const res = await authFetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email, password }) });
    expectEq(res.status, 200, "sign-in status");
    cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const s = await fetch(`${BASE}/api/auth/get-session`, { headers: { cookie, origin: ORIGIN } });
    expectEq(((await s.json()) as { user?: { email: string } })?.user?.email, email, "session email");
  });
  await check("auth: wrong password is refused", async () => {
    const res = await authFetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email, password: "nope-nope-nope" }) });
    expectTrue(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  });
  await check("dashboard requires sign-in", async () => {
    const r = await html("/en/dashboard");
    expectTrue(r.status === 307 || r.status === 302 || r.status === 308, `expected redirect, got ${r.status}`);
  });

  if (!userId) throw new Error("cannot continue without a user");

  const A = await createProject(userId, { type: "birthday", recipientName: "Quillfeather", title: "Smoke A", locale: "en", allowedTypes: ["voice", "text", "photo"] });
  const B = await createProject(userId, { type: "wedding", recipientName: "Karim", title: "Smoke B", locale: "en", allowedTypes: ["voice", "text", "photo"] });
  projectIds.push(A.id, B.id);

  // ---- contributor page
  await check("contribute page shows the recipient and the occasion theme", async () => {
    const r = await html(`/en/c/${A.contributeToken}`);
    expectEq(r.status, 200, "status");
    expectTrue(r.body.includes("Quillfeather"), "recipient name");
    expectTrue(r.body.includes('data-theme="sunrise"'), "birthday theme");
  });
  await check("contribute page with a wrong token reveals nothing", async () => {
    const r = await html(`/en/c/${"a".repeat(24)}`);
    expectTrue(!r.body.includes("Quillfeather"), "must not leak any project");
  });

  // ---- contributions API
  let photoKey = "";
  let voiceKey = "";
  await check("api: upload + submit a photo (with sticker)", async () => {
    const up = await upload(A.contributeToken, "photo", "image/png", PNG);
    expectEq(up.res.status, 200, "upload-url status");
    expectTrue(up.put?.ok, `PUT failed: ${up.put?.status}`);
    photoKey = up.key;
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "photo", name: "Lina", key: up.key, sticker: "star" }));
    expectEq(res.status, 201, "submit status");
    expectTrue(((await res.json()) as { editSecret?: string }).editSecret, "edit secret returned once");
  });
  await check("api: upload + submit a voice message", async () => {
    const up = await upload(A.contributeToken, "voice", "audio/wav", wav());
    expectTrue(up.put?.ok, `PUT failed: ${up.put?.status}`);
    voiceKey = up.key;
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "voice", name: "Amira", key: up.key, durationMs: 4200, sticker: "heart" }));
    expectEq(res.status, 201, "submit status");
  });
  await check("api: submit a text message with a sticker", async () => {
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "text", name: "Youssef", text: "We still laugh about that summer.", sticker: "sun" }));
    expectEq(res.status, 201, "status");
  });

  // ---- bad input and attacks
  await check("rejects an unknown sticker", async () => {
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "text", name: "X", text: "hi", sticker: "<script>" }));
    expectEq(res.status, 400, "status");
  });
  await check("rejects an empty text and a missing name", async () => {
    expectEq((await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "text", name: "X", text: "" }))).status, 400, "empty text");
    expectEq((await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "text", name: "", text: "hi" }))).status, 400, "no name");
  });
  await check("unknown contribute token gets 404 on every endpoint", async () => {
    const t = "b".repeat(24);
    expectEq((await fetch(`${BASE}/api/c/${t}/uploads`, json({ type: "photo", mime: "image/png", size: 10 }))).status, 404, "uploads");
    expectEq((await fetch(`${BASE}/api/c/${t}/contributions`, json({ type: "text", name: "x", text: "y" }))).status, 404, "contributions");
  });
  await check("refuses a 500 MB 'photo' before issuing an upload URL", async () => {
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/uploads`, json({ type: "photo", mime: "image/png", size: 500 * 1024 * 1024 }));
    expectEq(res.status, 413, "status");
  });
  await check("refuses a disallowed file type (HTML as a photo)", async () => {
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/uploads`, json({ type: "photo", mime: "text/html", size: 100 }));
    expectEq(res.status, 400, "status");
  });
  await check("rejects a fake image (HTML bytes uploaded as image/png)", async () => {
    const up = await upload(A.contributeToken, "photo", "image/png", Buffer.from("<html><script>alert(1)</script></html>"));
    expectTrue(up.put?.ok, "PUT should succeed (the check happens on submit)");
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "photo", name: "Evil", key: up.key }));
    expectEq(res.status, 400, "status");
  });
  await check("cannot attach another project's file", async () => {
    const res = await fetch(`${BASE}/api/c/${B.contributeToken}/contributions`, json({ type: "photo", name: "Thief", key: photoKey }));
    expectEq(res.status, 400, "status");
  });
  await check("the same file cannot back two contributions", async () => {
    const res = await fetch(`${BASE}/api/c/${A.contributeToken}/contributions`, json({ type: "photo", name: "Dup", key: photoKey }));
    expectEq(res.status, 400, "status");
  });
  await check("storage: tampered or missing signature is refused", async () => {
    expectTrue([401, 403].includes((await fetch(`${BASE}/api/storage/${photoKey}`)).status), "no signature must be refused");
    const up = await fetch(`${BASE}/api/c/${A.contributeToken}/uploads`, json({ type: "photo", mime: "image/png", size: 10 }));
    const { uploadUrl } = (await up.json()) as { uploadUrl: string };
    const bad = localize(uploadUrl).replace(/sig=[0-9a-f]+/, "sig=" + "0".repeat(64));
    const put = await fetch(bad, { method: "PUT", body: "x" });
    expectTrue([401, 403].includes(put.status), `bad signature got ${put.status}`);
  });

  // ---- keepsake: moderation gate, privacy, surprise lock
  await check("keepsake hides unapproved contributions", async () => {
    const r = await html(`/en/memory/${A.slug}`);
    expectEq(r.status, 200, "status");
    expectTrue(!r.body.includes("Amira") && !r.body.includes("Youssef"), "pending items must not be visible");
  });
  await db.update(contributions).set({ moderation: "approved" }).where(eq(contributions.projectId, A.id));
  await check("keepsake shows approved contributions, stickers and the theme", async () => {
    const r = await html(`/en/memory/${A.slug}`);
    expectTrue(r.body.includes("Amira") && r.body.includes("Youssef") && r.body.includes("Lina"), "names");
    expectTrue(r.body.includes('data-theme="sunrise"'), "theme");
    expectTrue(r.body.includes("Play all"), "play-all button");
    expectTrue(r.body.includes('aria-label="Love"'), "sticker badge");
  });
  await check("keepsake audio plays through a signed URL", async () => {
    const r = await html(`/en/memory/${A.slug}`);
    const m = r.body.match(/<audio[^>]*src="([^"]+)"/);
    expectTrue(m, "audio element with src");
    const res = await fetch(localize(m![1].replace(/&amp;/g, "&")));
    expectEq(res.status, 200, "audio status");
    expectTrue((await res.arrayBuffer()).byteLength > 1000, "audio bytes");
  });
  await check("audio supports Range requests (needed by iPhone Safari)", async () => {
    const r = await html(`/en/memory/${A.slug}`);
    const m = r.body.match(/<audio[^>]*src="([^"]+)"/);
    expectTrue(m, "audio element with src");
    const url = localize(m![1].replace(/&amp;/g, "&"));
    const part = await fetch(url, { headers: { range: "bytes=0-99" } });
    expectEq(part.status, 206, "partial status");
    expectEq((await part.arrayBuffer()).byteLength, 100, "partial length");
    expectTrue(/^bytes 0-99\/\d+$/.test(part.headers.get("content-range") ?? ""), "content-range header");
    const bad = await fetch(url, { headers: { range: "bytes=99999999-" } });
    expectEq(bad.status, 416, "out-of-range status");
  });
  await check("privacy: password-protected keepsake shows the lock, not the content", async () => {
    await db.update(projects).set({ privacy: "password", passwordHash: hashPassword("secret-123") }).where(eq(projects.id, A.id));
    const r = await html(`/en/memory/${A.slug}`);
    expectTrue(r.body.includes("protected") && !r.body.includes("Amira"), "content must be hidden");
  });
  await check("privacy: private keepsake is unavailable to visitors", async () => {
    await db.update(projects).set({ privacy: "private", passwordHash: null }).where(eq(projects.id, A.id));
    const r = await html(`/en/memory/${A.slug}`);
    expectTrue(r.body.includes("isn&#x27;t available") || r.body.includes("isn't available"), "unavailable message");
    expectTrue(!r.body.includes("Amira"), "no content");
  });
  await check("surprise reveal: sealed keepsake leaks nothing before the date", async () => {
    await db.update(projects).set({ privacy: "link", revealAt: new Date(Date.now() + 3 * 3600 * 1000) }).where(eq(projects.id, A.id));
    const r = await html(`/en/memory/${A.slug}`);
    expectTrue(r.body.includes("A surprise is on its way"), "countdown screen");
    expectTrue(!r.body.includes("Amira") && !r.body.includes("/api/storage/"), "no names, no media URLs");
  });
  await check("surprise reveal: opens once the date has passed", async () => {
    await db.update(projects).set({ revealAt: new Date(Date.now() - 1000) }).where(eq(projects.id, A.id));
    expectTrue((await html(`/en/memory/${A.slug}`)).body.includes("Amira"), "content visible");
  });
  await check("keepsake page for an unknown slug reveals nothing", async () => {
    const r = await html(`/en/memory/does-not-exist-12345678`);
    expectTrue(!r.body.includes("Smoke"), "no project data");
  });

  // ---- abuse control (paid plan so the free cap of 10 does not hide the rate limit)
  await db.update(projects).set({ plan: "memory" }).where(eq(projects.id, B.id));
  await check("rate limit: one IP hammering submit gets 429", async () => {
    let limited = false;
    for (let i = 0; i < 30 && !limited; i++) {
      const res = await fetch(`${BASE}/api/c/${B.contributeToken}/contributions`, json({ type: "text", name: "Bot", text: `spam ${i}` }, "203.0.113.7"));
      if (res.status === 429) limited = true;
    }
    expectTrue(limited, "never rate limited after 30 requests");
  });

  // ---- cleanup
  for (const id of projectIds) {
    await db.delete(rateLimits).where(like(rateLimits.key, `%${id}%`)).catch(() => {});
    if ((process.env.STORAGE_DRIVER ?? "local") === "local") {
      await rm(path.resolve(process.env.LOCAL_STORAGE_DIR ?? "./.storage", "projects", id), { recursive: true, force: true }).catch(() => {});
    }
  }
  await db.delete(user).where(eq(user.id, userId)); // cascades to projects and contributions
  void voiceKey;

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      -> ${r.detail}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? ` ${failed.length} FAILED.` : " Everything works."}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  console.error("\nSmoke test could not finish:", e instanceof Error ? e.message : e);
  console.error(`Is the app running at ${BASE}? Start it with: npm run start`);
  process.exit(1);
});
