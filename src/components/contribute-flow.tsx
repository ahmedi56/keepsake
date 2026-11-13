"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Heart, Mic, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ANIMATED_EMOJI, STICKERS } from "@/lib/themes";
import { UploadError, prepareImage, submitToProject } from "@/lib/upload-client";
import { AnimatedEmoji } from "./animated-emoji";
import { EmojiPickerButton } from "./emoji-picker-button";
import { StickerBadge } from "./icons";
import { Recorder, type Recording } from "./recorder";
import { Button } from "./ui/button";
import { Input, Label, Textarea } from "./ui/field";

const noopSubscribe = () => () => {};
function readSavedName(): string {
  try { return localStorage.getItem("keepsake:name") ?? ""; } catch { return ""; }
}

type Mode = "home" | "record" | "write" | "photo" | "done";
type Draft =
  | { kind: "voice"; blob: Blob; mime: string; durationMs: number }
  | { kind: "photo"; blob: Blob; mime: string; previewUrl: string }
  | null;

type Props = { token: string; recipientName: string; allowedTypes: string[]; prompts: string[]; description: string | null; requireApproval?: boolean };

export function ContributeFlow({ token, recipientName, allowedTypes, prompts, description, requireApproval = true }: Props) {
  const t = useTranslations("contribute");
  const common = useTranslations("common");
  const st = useTranslations("stickers");
  const [mode, setMode] = useState<Mode>("home");
  const [draft, setDraft] = useState<Draft>(null);
  // Saved name from a previous contribution on this device; the contributor's own typing wins.
  const savedName = useSyncExternalStore(noopSubscribe, readSavedName, () => "");
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? savedName;
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState<string | undefined>();
  const [sticker, setSticker] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (draft?.kind === "photo") URL.revokeObjectURL(draft.previewUrl); }, [draft]);

  const can = (k: string) => allowedTypes.includes(k);
  const errText = (code: string) =>
    ({ too_large: t("tooLarge"), wrong_type: t("wrongType"), rate_limited: t("rateLimited"), closed: t("closed"), limit_reached: t("closed"), not_found: t("notFound") } as Record<string, string>)[code] ?? common("genericError");

  function reset(next: Mode) {
    setDraft(null); setText(""); setPrompt(undefined); setSticker(null); setError(null); setMode(next);
  }

  async function send() {
    setError(null);
    if (!name.trim()) return setError(t("nameRequired"));
    const isMedia = mode === "record" || mode === "photo";
    if (isMedia && !draft) return setError(t("contentRequired"));
    if (mode === "write" && !text.trim()) return setError(t("contentRequired"));
    setBusy(true);
    try {
      try { localStorage.setItem("keepsake:name", name.trim()); } catch { /* ignore */ }
      if (mode === "write") await submitToProject(token, { type: "text", name: name.trim(), text: text.trim(), promptText: prompt, sticker: sticker ?? undefined });
      else if (draft?.kind === "voice") await submitToProject(token, { type: "voice", name: name.trim(), promptText: prompt, durationMs: draft.durationMs, sticker: sticker ?? undefined, media: draft });
      else if (draft?.kind === "photo") await submitToProject(token, { type: "photo", name: name.trim(), text: text.trim() || undefined, sticker: sticker ?? undefined, media: draft });
      setMode("done");
    } catch (e) {
      setError(e instanceof UploadError ? errText(e.code) : common("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onFileAsVoice(f: File) {
    setError(null);
    setDraft({ kind: "voice", blob: f, mime: f.type || "audio/mp4", durationMs: 0 });
  }
  async function onPhoto(f: File) {
    setError(null);
    const { blob, mime } = await prepareImage(f);
    setDraft({ kind: "photo", blob, mime, previewUrl: URL.createObjectURL(blob) });
  }

  const sendBar = (
    <div className="mt-6 space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-soft">{t("stickerLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {STICKERS.map((s) => (
            <button
              key={s} type="button" onClick={() => setSticker(sticker === s ? null : s)} aria-pressed={sticker === s} aria-label={st(s)}
              className={cn("grid size-12 place-items-center rounded-full border-2 transition-colors", sticker === s ? "border-accent" : "border-transparent hover:bg-paper-2")}
            >
              <StickerBadge id={s} label={st(s)} size={38} />
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-4 text-sm font-medium text-ink-soft">{t("animatedLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {ANIMATED_EMOJI.map(([cp, ch]) => {
            const id = `e:${cp}`;
            const on = sticker === id;
            return (
              <button
                key={cp} type="button" onClick={() => setSticker(on ? null : id)} aria-pressed={on} aria-label={ch}
                className={cn("grid size-12 place-items-center rounded-full border-2 text-2xl transition-colors", on ? "border-accent bg-accent-soft" : "border-transparent hover:bg-paper-2")}
              >
                {on ? <AnimatedEmoji cp={cp} char={ch} size={34} /> : <span aria-hidden>{ch}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="name">{t("yourName")}</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder={t("yourNamePlaceholder")} />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="lg" className="w-full" onClick={send} disabled={busy}>{busy ? t("sending") : t("send")}</Button>
    </div>
  );

  const promptChips = prompts.length > 0 && (
    <div className="mb-5">
      <p className="mb-2 text-sm text-ink-soft">{t("usePrompt")}</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p} type="button" onClick={() => setPrompt(p === prompt ? undefined : p)} aria-pressed={p === prompt}
            className={cn("rounded-2xl border px-4 py-2.5 text-start text-base", p === prompt ? "border-accent bg-accent-soft text-ink" : "border-line bg-card text-ink-soft")}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  const back = mode !== "home" && mode !== "done" && (
    <button type="button" onClick={() => reset("home")} className="mb-4 min-h-11 text-sm text-ink-soft underline">←</button>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        {back}
        {mode === "home" && (
          <div className="text-center">
            <h1 className="font-display text-4xl leading-tight text-ink">{t("title", { name: recipientName })}</h1>
            <p className="mx-auto mt-4 max-w-sm text-lg text-ink-soft">{t("subtitle")}</p>
            {description && <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-paper-2 p-4 text-ink-soft">{description}</p>}
            <div className="mt-8 flex flex-col gap-3">
              {can("voice") && <Button size="lg" className="h-16 text-xl" onClick={() => reset("record")}><Mic size={24} />{t("record")}</Button>}
              {(can("text") || can("story")) && <Button size="lg" variant="soft" className="h-16 text-xl" onClick={() => reset("write")}><PenLine size={24} />{t("write")}</Button>}
              {can("photo") && <Button size="lg" variant="outline" className="h-16 text-xl" onClick={() => reset("photo")}><Camera size={24} />{t("photo")}</Button>}
            </div>
          </div>
        )}

        {mode === "record" && (
          <div>
            {promptChips}
            {prompt && <p className="mb-5 rounded-2xl bg-accent-soft p-4 text-center font-display text-xl text-ink">{prompt}</p>}
            {!draft ? (
              <Recorder onUse={(r: Recording) => setDraft({ kind: "voice", ...r })} onFile={onFileAsVoice} />
            ) : (
              <div className="text-center">
                <p className="flex items-center justify-center gap-2 text-ink-soft"><Check size={18} className="text-ok" aria-hidden />{t("recorder.use")}</p>
                <button type="button" className="mt-2 min-h-11 text-sm text-ink-soft underline" onClick={() => setDraft(null)}>{t("recorder.again")}</button>
                {sendBar}
              </div>
            )}
          </div>
        )}

        {mode === "write" && (
          <div>
            {promptChips}
            {prompt && <p className="mb-3 font-display text-xl text-ink">{prompt}</p>}
            <Label htmlFor="msg">{t("messageLabel")}</Label>
            <Textarea id="msg" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder={t("messagePlaceholder")} className="min-h-52 text-lg" />
            <EmojiPickerButton targetId="msg" onInsert={setText} />
            {sendBar}
          </div>
        )}

        {mode === "photo" && (
          <div className="text-center">
            {draft?.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={draft.previewUrl} alt="" className="mx-auto max-h-80 rounded-3xl object-cover" />
            ) : null}
            <label className="mt-4 inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-card px-7 text-lg text-ink hover:bg-paper-2">
              <Camera size={22} />{draft ? t("photoChange") : t("photoChoose")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }} />
            </label>
            {draft && (
              <div className="mt-5 text-start">
                <Label htmlFor="cap">{t("messageLabel")}</Label>
                <Textarea id="cap" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className="min-h-24" />
                <EmojiPickerButton targetId="cap" onInsert={setText} />
                {sendBar}
              </div>
            )}
          </div>
        )}

        {mode === "done" && (
          <div className="py-10 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-accent-soft text-accent"><Heart size={36} aria-hidden /></span>
            <h1 className="mt-4 font-display text-4xl text-ink">{t("thanksTitle")}</h1>
            <p className="mt-3 text-lg text-ink-soft">{t("thanksBody", { name: recipientName })}</p>
            {requireApproval && <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-accent-soft px-4 py-3 text-base text-ink">{t("pendingNote")}</p>}
            <Button className="mt-8" variant="outline" size="lg" onClick={() => reset("home")}>{t("addAnother")}</Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
