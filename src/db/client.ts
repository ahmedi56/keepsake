import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  // `next build` imports routes to collect config but never queries; Pool doesn't connect until first query.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (!url && !building) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString: url ?? "postgres://build:build@localhost:5432/build", max: 10 });
}

// Reuse one pool across hot reloads in development.
const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
