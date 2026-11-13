import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ContributeError } from "@/server/contribute";

/** Maps domain errors to JSON responses without leaking internals. */
export function handleError(err: unknown) {
  if (err instanceof ContributeError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  console.error("[api] unhandled error", err instanceof Error ? err.message : "unknown");
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ContributeError("too_large", 413);
  try {
    return await req.json();
  } catch {
    throw new ContributeError("invalid", 400);
  }
}
