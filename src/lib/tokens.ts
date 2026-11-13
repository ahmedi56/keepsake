import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 144 bits of entropy, URL-safe. Used for contribute/view tokens. */
export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Readable slug with a random suffix so slugs can't be enumerated or collide. */
export function newSlug(recipientName: string): string {
  const base = recipientName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  // 64 bits of randomness: the slug itself is the unguessable capability for the keepsake page.
  const suffix = randomBytes(8).toString("hex");
  return base ? `${base}-${suffix}` : suffix;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
