import { fileTypeFromBuffer } from "file-type";

export type MediaKind = "audio" | "image" | "video";

export const LIMITS: Record<MediaKind, { maxBytes: number; maxDurationMs?: number }> = {
  audio: { maxBytes: 25 * 1024 * 1024, maxDurationMs: 10 * 60 * 1000 },
  image: { maxBytes: 10 * 1024 * 1024 },
  video: { maxBytes: 200 * 1024 * 1024, maxDurationMs: 3 * 60 * 1000 },
};

/**
 * Declared (client-claimed) MIME types we accept per kind. These only decide whether
 * we hand out an upload URL; the real check is sniffing the stored bytes (see below).
 */
const DECLARED: Record<MediaKind, string[]> = {
  audio: ["audio/webm", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"],
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

/** Container MIME types the sniffer may return for each kind (webm/mp4 audio sniff as video/*). */
const SNIFFED: Record<MediaKind, string[]> = {
  audio: ["audio/webm", "video/webm", "audio/mp4", "audio/x-m4a", "video/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac"],
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

/** Strip codec parameters: "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function isDeclaredMimeAllowed(kind: MediaKind, mime: string): boolean {
  return DECLARED[kind].includes(baseMime(mime));
}

export function extensionFor(mime: string): string {
  const m = baseMime(mime);
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[m] ?? "bin";
}

/**
 * Never trust the extension or the declared Content-Type: inspect magic bytes.
 * Returns the sniffed MIME if it is acceptable for `kind`, otherwise null.
 */
export async function sniffAllowed(kind: MediaKind, head: Uint8Array): Promise<string | null> {
  const ft = await fileTypeFromBuffer(head);
  if (!ft) return null;
  return SNIFFED[kind].includes(ft.mime) ? ft.mime : null;
}
