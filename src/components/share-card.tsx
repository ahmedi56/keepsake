"use client";

import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonStyles } from "./ui/button";

export function ShareCard({ path, title }: { path: string; title: string }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const text = `${title} ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyLink"), url);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-card p-6">
      <h2 className="font-display text-xl text-ink">{t("shareTitle")}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t("shareHint")}</p>
      <p dir="ltr" className="mt-4 break-all rounded-2xl bg-paper-2 px-4 py-3 text-sm text-ink">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={copy} aria-live="polite">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? c("copied") : t("copyLink")}
        </Button>
        <a
          className={buttonStyles({ variant: "soft" })}
          href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
        >
          <MessageCircle size={18} /> {t("whatsapp")}
        </a>
        <a className={buttonStyles({ variant: "outline" })} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`}>
          <Mail size={18} /> {t("email")}
        </a>
      </div>
    </section>
  );
}
