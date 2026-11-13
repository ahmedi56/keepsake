"use client";

import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";

export type Recording = { blob: Blob; mime: string; durationMs: number };

const MAX_MS = 5 * 60 * 1000;

/** iOS Safari records audio/mp4, Chrome/Firefox record webm/opus: pick the first the browser supports. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /(FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Snapchat|TikTok|musical_ly|GSA\/)/i.test(navigator.userAgent);
}

const noopSubscribe = () => () => {};
function readEnv(): string {
  const supported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  return `${supported ? 1 : 0}:${isInAppBrowser() ? 1 : 0}`;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Phase = "idle" | "recording" | "paused" | "review";

export function Recorder({ onUse, onFile }: { onUse: (r: Recording) => void; onFile: (f: File) => void }) {
  const t = useTranslations("contribute.recorder");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<"denied" | "unsupported" | null>(null);
  const [result, setResult] = useState<Recording | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const accumulatedRef = useRef(0); // ms recorded in finished segments (pauses excluded)
  const segmentStartRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);

  // Browser capabilities only exist on the client; useSyncExternalStore keeps SSR and hydration consistent.
  const envKey = useSyncExternalStore(noopSubscribe, readEnv, () => "pending");
  const env = envKey === "pending" ? null : { supported: envKey.startsWith("1"), inApp: envKey.endsWith("1") };
  const supported = env?.supported ?? true;

  const clearTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };
  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  useEffect(() => () => { clearTick(); releaseStream(); }, []);
  useEffect(() => () => { if (playUrl) URL.revokeObjectURL(playUrl); }, [playUrl]);

  const currentMs = () => accumulatedRef.current + (segmentStartRef.current ? Date.now() - segmentStartRef.current : 0);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    accumulatedRef.current = currentMs();
    segmentStartRef.current = 0;
    clearTick();
    rec.stop(); // onstop assembles the blob
  }, []);

  async function start() {
    setError(null);
    if (!supported) return setError("unsupported");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      return setError("denied");
    }
    streamRef.current = stream;
    mimeRef.current = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeRef.current ? { mimeType: mimeRef.current } : undefined);
    } catch {
      releaseStream();
      return setError("unsupported");
    }
    chunksRef.current = [];
    accumulatedRef.current = 0;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const mime = (rec.mimeType || mimeRef.current || "audio/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type: mime });
      releaseStream();
      const durationMs = Math.round(accumulatedRef.current);
      const r = { blob, mime, durationMs };
      setResult(r);
      setPlayUrl(URL.createObjectURL(blob));
      setPhase("review");
    };
    recorderRef.current = rec;
    rec.start(1000);
    segmentStartRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    tickRef.current = setInterval(() => {
      const ms = currentMs();
      setElapsed(ms);
      if (ms >= MAX_MS) stop();
    }, 250);
  }

  function pause() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulatedRef.current = currentMs();
    segmentStartRef.current = 0;
    setPhase("paused");
  }
  function resume() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    segmentStartRef.current = Date.now();
    setPhase("recording");
  }
  function discard() {
    setResult(null);
    setPlayUrl(null);
    setElapsed(0);
    setPhase("idle");
  }

  const fileInput = (
    <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line bg-card px-5 text-base text-ink hover:bg-paper-2">
      {t("uploadInstead")}
      <input
        type="file" accept="audio/*" capture className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </label>
  );

  if (phase === "review" && result && playUrl) {
    return (
      <div className="space-y-5 text-center">
        <p className="font-display text-2xl text-ink">{t("soundsGood")}</p>
        <audio controls src={playUrl} className="w-full" />
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => onUse(result)}>{t("use")}</Button>
          <Button variant="outline" size="lg" onClick={discard}><Trash2 size={18} />{t("again")}</Button>
        </div>
      </div>
    );
  }

  const active = phase === "recording" || phase === "paused";
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      {env?.inApp && <p role="note" className="rounded-2xl bg-accent-soft p-3 text-sm text-ink">{t("inAppBrowser")}</p>}
      <p className="font-display text-5xl tabular-nums text-ink" aria-live="off">{fmt(elapsed)}</p>
      <p className="h-5 text-sm text-ink-soft" role="status">{phase === "recording" ? t("recording") : phase === "paused" ? t("paused") : ""}</p>

      {!active ? (
        <button
          type="button" onClick={start} aria-label={t("start")}
          className="grid size-28 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition-transform active:scale-95"
        >
          <Mic size={44} />
        </button>
      ) : (
        <div className="flex items-center gap-5">
          <button
            type="button" onClick={phase === "recording" ? pause : resume}
            aria-label={phase === "recording" ? t("pause") : t("resume")}
            className="grid size-16 place-items-center rounded-full border border-line bg-card text-ink"
          >
            {phase === "recording" ? <Pause size={26} /> : <Play size={26} />}
          </button>
          <button
            type="button" onClick={stop} aria-label={t("stop")}
            className={cn("grid size-24 place-items-center rounded-full bg-danger text-white shadow-lg", phase === "recording" && "animate-pulse")}
          >
            <Square size={34} />
          </button>
        </div>
      )}
      {!active && <p className="text-base text-ink-soft">{t("start")}</p>}

      {error === "denied" && <p role="alert" className="text-sm text-danger">{t("micDenied")}</p>}
      {(error === "unsupported" || (env !== null && !env.supported && phase === "idle")) && <p role="alert" className="text-sm text-danger">{t("micUnsupported")}</p>}
      {!active && fileInput}
    </div>
  );
}
