import { NextRequest, NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { submitContribution } from "@/server/contribute";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const result = await submitContribution(token, clientIp(req.headers), await readJson(req));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
