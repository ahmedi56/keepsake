"use client";

import { Smile } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const I18N = {
  en: () => import("emoji-picker-element/i18n/en.js"),
  fr: () => import("emoji-picker-element/i18n/fr.js"),
  es: () => import("emoji-picker-element/i18n/es.js"),
  ar: () => import("emoji-picker-element/i18n/ar.js"),
} as const;
// Emoji search data is self-hosted in /public/emoji-data (no third-party request). Arabic and Spanish use the English names.
const DATA: Record<string, string> = { en: "en", fr: "fr", es: "en", ar: "en" };

type PickerEl = HTMLElement & { i18n?: unknown; dataSource?: string; locale?: string };

/** Open-source emoji picker (emoji-picker-element, Apache-2.0). Inserts the chosen emoji at the cursor of the textarea `targetId`. */
export function EmojiPickerButton({ targetId, onInsert }: { targetId: string; onInsert: (next: string) => void }) {
  const t = useTranslations("contribute");
  const locale = useLocale() as keyof typeof I18N;
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !host.current) return;
    let cancelled = false;
    const el = host.current;
    let picker: PickerEl | null = null;
    (async () => {
      await import("emoji-picker-element");
      const i18n = (await (I18N[locale] ?? I18N.en)()).default;
      if (cancelled) return;
      picker = document.createElement("emoji-picker") as PickerEl;
      picker.i18n = i18n;
      picker.dataSource = `/emoji-data/${DATA[locale] ?? "en"}.json`;
      picker.locale = DATA[locale] ?? "en";
      picker.style.width = "100%";
      picker.addEventListener("emoji-click", (e) => {
        const unicode = (e as CustomEvent<{ unicode?: string }>).detail.unicode;
        if (!unicode) return;
        const ta = document.getElementById(targetId) as HTMLTextAreaElement | null;
        const value = ta?.value ?? "";
        const a = ta?.selectionStart ?? value.length;
        const b = ta?.selectionEnd ?? value.length;
        onInsert(value.slice(0, a) + unicode + value.slice(b));
        requestAnimationFrame(() => { ta?.focus(); const pos = a + unicode.length; ta?.setSelectionRange(pos, pos); });
      });
      el.replaceChildren(picker);
    })();
    return () => { cancelled = true; el.replaceChildren(); };
  }, [open, locale, targetId, onInsert]);

  return (
    <div className="mt-2">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm text-ink-soft hover:bg-paper-2"
      >
        <Smile size={18} aria-hidden />{t("addEmoji")}
      </button>
      {open && <div ref={host} className="mt-2 overflow-hidden rounded-2xl border border-line" dir="ltr" />}
    </div>
  );
}
