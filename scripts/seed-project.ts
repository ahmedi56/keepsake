/**
 * Dev helper: creates a sample project for an existing organizer and prints its tokens as JSON.
 *   npx tsx scripts/seed-project.ts organizer@example.com
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { createProject } from "@/server/projects";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: tsx scripts/seed-project.ts <organizer-email>");
  const [u] = await db.select().from(user).where(eq(user.email, email));
  if (!u) throw new Error(`no user with email ${email}`);
  const p = await createProject(u.id, {
    type: "birthday", recipientName: "Sarah", title: "Mom's 60th Birthday", locale: "en",
    allowedTypes: ["voice", "text", "photo"],
  });
  console.log(JSON.stringify({ id: p.id, token: p.contributeToken, slug: p.slug, owner: u.id }));
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
