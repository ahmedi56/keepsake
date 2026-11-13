"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function TranscriptToggle({ transcript }: { transcript: string }) {
  const t = useTranslations("memory");
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button type="button" className="min-h-11 text-sm text-accent underline" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? t("hideTranscript") : t("showTranscript")}
      </button>
      {open && <p className="mt-1 rounded-2xl bg-paper-2 p-4 text-ink-soft">“{transcript}”</p>}
    </div>
  );
}
