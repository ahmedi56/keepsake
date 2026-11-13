import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { LIMITS, type MediaKind } from "@/lib/media";
import { localPath, storageRoot, verifyLocal } from "@/lib/storage";

/**
 * Dev / self-host storage endpoint (STORAGE_DRIVER=local).
 * Every request needs an unexpired HMAC signature bound to method + key.
 * In production with STORAGE_DRIVER=s3 this route is never used.
 */
export const runtime = "nodejs";

function parse(req: NextRequest, segments: string[]) {
  const key = segments.map(decodeURIComponent).join("/");
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  return { key, exp, sig };
}

function kindOfKey(key: string): MediaKind | null {
  // keys look like projects/<id>/incoming/<kind>/<uuid>.<ext>
  const part = key.split("/")[3];
  return part === "audio" || part === "image" || part === "video" ? part : null;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (process.env.STORAGE_DRIVER === "s3") return new NextResponse(null, { status: 404 });
  const { key: segs } = await ctx.params;
  const { key, exp, sig } = parse(req, segs);
  if (!verifyLocal("PUT", key, exp, sig)) return new NextResponse("Forbidden", { status: 403 });

  const kind = kindOfKey(key);
  if (!kind || !req.body) return new NextResponse("Bad request", { status: 400 });
  const max = LIMITS[kind].maxBytes;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return new NextResponse("Too large", { status: 413 });

  const dest = localPath(storageRoot(), key);
  await mkdir(path.dirname(dest), { recursive: true });

  let received = 0;
  const source = Readable.fromWeb(req.body as import("node:stream/web").ReadableStream);
  source.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > max) source.destroy(new Error("too large"));
  });
  try {
    await pipeline(source, createWriteStream(dest));
  } catch {
    await rm(dest, { force: true });
    return new NextResponse("Too large", { status: 413 });
  }
  return new NextResponse(null, { status: 200 });
}

const CONTENT_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (process.env.STORAGE_DRIVER === "s3") return new NextResponse(null, { status: 404 });
  const { key: segs } = await ctx.params;
  const { key, exp, sig } = parse(req, segs);
  if (!verifyLocal("GET", key, exp, sig)) return new NextResponse("Forbidden", { status: 403 });

  const file = localPath(storageRoot(), key);
  let info;
  try {
    info = await stat(file);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const type = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const base = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
  };

  // iPhone Safari (and seeking in every browser) needs HTTP Range support for audio and video.
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = m && m[1] !== "" ? Number(m[1]) : NaN;
    let end = m && m[2] !== "" ? Number(m[2]) : NaN;
    if (m && Number.isNaN(start) && !Number.isNaN(end)) {
      start = Math.max(0, info.size - end); // "last N bytes"
      end = info.size - 1;
    } else if (m && !Number.isNaN(start) && Number.isNaN(end)) {
      end = info.size - 1;
    }
    if (!m || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= info.size) {
      return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    }
    end = Math.min(end, info.size - 1);
    const part = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(part, {
      status: 206,
      headers: { ...base, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${info.size}` },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...base, "content-length": String(info.size) } });
}
