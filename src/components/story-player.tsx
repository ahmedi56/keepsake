"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { StickerBadge } from "./icons";
import { isPresetSticker } from "@/lib/themes";

export type StoryItem = {
  id: string;
  type: "voice" | "text" | "story" | "photo" | "video";
  name: string;
  text: string | null;
  promptText: string | null;
  transcript: string | null;
  mediaUrl: string | null;
  sticker: string | null;
};

const textMs = (s: string) => Math.min(16000, Math.max(4500, 3000 + s.length * 55));
const PHOTO_MS = 5500;
const TICK = 100;

/**
 * "Play all": voices, notes and photos one after another, like a story.
 * One persistent <audio> element is reused for every voice so mobile browsers (which only allow
 * audio after a tap) keep playing after the first tap.
 */
export function StoryPlayer({ items }: { items: StoryItem[] }) {
  const t = useTranslations("memory");
  const st = useTranslations("stickers");
  const audio = useRef<HTMLAudioElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const elapsed = useRef(0);
  const lastSignal = useRef(0);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);

  const item = items[i];
  const isVoice = item?.type === "voice" && !!item.mediaUrl;
  const slideMs = !item ? 0 : item.type === "photo" ? PHOTO_MS : textMs(item.text ?? "");

  function load(idx: number, autoplay = true) {
    const a = audio.current;
    const it = items[idx];
    elapsed.current = 0;
    lastSignal.current = performance.now();
    setProgress(0);
    if (!a) return;
    if (it?.type === "voice" && it.mediaUrl) {
      a.src = it.mediaUrl;
      if (autoplay) a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }

  function start() {
    setI(0); setEnded(false); setPlaying(true); setOpen(true);
    load(0); // inside the tap handler, so audio is allowed to start
  }
  function go(idx: number) {
    if (idx < 0) idx = 0;
    if (idx >= items.length) {
      audio.current?.pause();
      setEnded(true); setProgress(1);
      return;
    }
    setI(idx); setEnded(false);
    load(idx, playing);
  }
  function close() {
    audio.current?.pause();
    setOpen(false);
  }
  function toggle() {
    const next = !playing;
    setPlaying(next);
    if (isVoice) { if (next) audio.current?.play().catch(() => setPlaying(false)); else audio.current?.pause(); }
  }

  // Timer for text and photo slides (voice slides follow the audio element instead).
  useEffect(() => {
    if (!open || ended || !playing || isVoice) return;
    const id = setInterval(() => {
      elapsed.current += TICK;
      const p = Math.min(1, elapsed.current / slideMs);
      setProgress(p);
      if (p >= 1) { clearInterval(id); go(i + 1); }
    }, TICK);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() only reads the values listed
  }, [open, ended, playing, isVoice, i, slideMs]);

  // A voice that never starts or stalls (bad network, unsupported file) must not freeze the story.
  useEffect(() => {
    if (!open || ended || !playing || !isVoice) return;
    const id = setInterval(() => {
      if (performance.now() - lastSignal.current > 10000) { clearInterval(id); go(i + 1); }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() only reads the values listed
  }, [open, ended, playing, isVoice, i]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (items.length === 0) return null;

  const overall = ended ? 1 : (i + progress) / items.length;

  return (
    <>
      <button
        type="button" onClick={start}
        className="mx-auto mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium text-accent-ink transition-[filter] hover:brightness-110"
      >
        <Play size={18} fill="currentColor" aria-hidden />{t("playAll")}
      </button>

      <audio
        ref={audio} preload="auto"
        onTimeUpdate={(e) => { const a = e.currentTarget; lastSignal.current = performance.now(); if (isVoice && a.duration) setProgress(a.currentTime / a.duration); }}
        onEnded={() => go(i + 1)}
        onError={() => { if (isVoice) go(i + 1); }}
      />

      {open && item && (
        <div role="dialog" aria-modal="true" aria-label={t("playAll")} className={`fixed inset-0 z-50 flex flex-col bg-night text-night-ink ${playing ? "" : "story-paused"}`}>
          <div className="flex items-center gap-3 px-5 pt-5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall * 100)}>
              <div className="h-full rounded-full bg-sun" style={{ width: `${overall * 100}%` }} />
            </div>
            <span className="text-sm tabular-nums text-night-ink/70">{t("storyCount", { current: Math.min(i + 1, items.length), total: items.length })}</span>
            <button ref={closeBtn} type="button" onClick={close} aria-label={t("storyClose")} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
              <X size={22} aria-hidden />
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-6 text-center">
            {ended ? (
              <>
                <p className="font-display text-4xl">{t("storyEnd")}</p>
                <button type="button" onClick={() => { setPlaying(true); setEnded(false); setI(0); load(0); }} className="inline-flex h-12 items-center gap-2 rounded-full bg-sun px-6 font-semibold text-night">
                  <RotateCcw size={18} aria-hidden />{t("storyReplay")}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {item.sticker && <StickerBadge id={item.sticker} label={isPresetSticker(item.sticker) ? st(item.sticker) : ""} size={40} />}
                  <p className="font-display text-3xl sm:text-4xl">{item.name}</p>
                </div>
                {item.promptText && <p className="max-w-md italic text-night-ink/70">{item.promptText}</p>}

                {item.type === "photo" && item.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img src={item.mediaUrl} alt={item.text ?? item.name} className="max-h-[52vh] max-w-full rounded-3xl object-contain" />
                )}
                {item.type === "voice" && (
                  <div aria-hidden className="flex h-24 items-center gap-1.5">
                    {Array.from({ length: 21 }, (_, n) => (
                      <span key={n} className="story-bar w-1.5 rounded-full bg-sun" style={{ height: 24 + ((n * 37) % 56), animationDelay: `${-(n * 0.13)}s` }} />
                    ))}
                  </div>
                )}
                {item.text && item.type !== "photo" && <p className="whitespace-pre-wrap text-2xl leading-snug sm:text-3xl">{item.text}</p>}
                {item.type === "photo" && item.text && <p className="text-lg text-night-ink/80">{item.text}</p>}
                {item.type === "voice" && item.transcript && <p className="max-w-lg text-lg text-night-ink/75">“{item.transcript}”</p>}
              </>
            )}
          </div>

          {!ended && (
            <div className="flex items-center justify-center gap-6 pb-8">
              <button type="button" onClick={() => go(i - 1)} aria-label={t("storyPrev")} className="grid size-12 place-items-center rounded-full hover:bg-white/10">
                <ChevronLeft size={26} className="rtl:rotate-180" aria-hidden />
              </button>
              <button type="button" onClick={toggle} aria-label={playing ? t("storyPause") : t("storyPlay")} className="grid size-16 place-items-center rounded-full bg-sun text-night">
                {playing ? <Pause size={26} fill="currentColor" aria-hidden /> : <Play size={26} fill="currentColor" className="ms-1" aria-hidden />}
              </button>
              <button type="button" onClick={() => go(i + 1)} aria-label={t("storyNext")} className="grid size-12 place-items-center rounded-full hover:bg-white/10">
                <ChevronRight size={26} className="rtl:rotate-180" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
