export class UploadError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError((data as { error?: string }).error ?? "server_error");
  return data as T;
}

/** PUT with retries: mobile connections drop. Retries only network errors / 5xx, never 4xx. */
async function putWithRetry(url: string, blob: Blob, mime: string, attempts = 3) {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { "content-type": mime }, body: blob });
      if (res.ok) return;
      if (res.status < 500) throw new UploadError(res.status === 413 ? "too_large" : "wrong_type");
      last = new UploadError("server_error");
    } catch (e) {
      if (e instanceof UploadError) throw e;
      last = e;
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw last instanceof Error ? last : new UploadError("network");
}

export type SubmitInput = {
  type: "voice" | "text" | "photo" | "video" | "story";
  name: string;
  text?: string;
  promptText?: string;
  durationMs?: number;
  sticker?: string;
  media?: { blob: Blob; mime: string };
};

export async function submitToProject(token: string, input: SubmitInput): Promise<{ id: string; editSecret: string }> {
  let key: string | undefined;
  if (input.media) {
    const mime = input.media.mime.split(";")[0];
    const up = await postJson<{ key: string; uploadUrl: string }>(`/api/c/${token}/uploads`, {
      type: input.type, mime, size: input.media.blob.size,
    });
    await putWithRetry(up.uploadUrl, input.media.blob, mime);
    key = up.key;
  }
  return postJson(`/api/c/${token}/contributions`, {
    type: input.type, name: input.name, text: input.text || undefined,
    promptText: input.promptText || undefined, durationMs: input.durationMs, sticker: input.sticker, key,
  });
}

/** Downscale + re-encode as JPEG. Cuts upload size on mobile and strips EXIF (incl. GPS) from shared photos. */
export async function prepareImage(file: File, maxSide = 2000): Promise<{ blob: Blob; mime: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (blob) return { blob, mime: "image/jpeg" };
  } catch {
    /* fall through to the original file */
  }
  return { blob: file, mime: file.type || "image/jpeg" };
}
