"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setCollectingAction, setPrivacyAction } from "@/server/actions";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/field";
import { Check } from "lucide-react";

export function PrivacyForm({
  projectId, privacy, collecting,
}: { projectId: string; privacy: "link" | "password" | "private"; collecting: boolean }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const [mode, setMode] = useState(privacy);
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-3xl border border-line bg-card p-6">
      <h2 className="font-display text-xl text-ink">{t("privacy")}</h2>
      <div className="mt-4 space-y-2">
        {(["link", "password", "private"] as const).map((m) => (
          <label key={m} className="flex min-h-11 items-center gap-3 text-ink">
            <input type="radio" name="privacy" checked={mode === m} onChange={() => setMode(m)} className="size-5 accent-[var(--accent)]" />
            {t(m === "link" ? "privacyLink" : m === "password" ? "privacyPassword" : "privacyPrivate")}
          </label>
        ))}
      </div>
      {mode === "password" && (
        <div className="mt-3">
          <Label htmlFor="pw">{t("password")}</Label>
          <Input id="pw" type="password" minLength={6} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm" disabled={pending}
          onClick={() => start(async () => {
            setError(false); setSaved(false);
            try {
              const ok = await setPrivacyAction(projectId, { privacy: mode, password: password || undefined });
              if (ok) { setSaved(true); setPassword(""); } else setError(true);
            } catch { setError(true); }
          })}
        >
          {c("save")}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await setCollectingAction(projectId, !collecting); })}>
          {collecting ? t("closeCollecting") : t("reopen")}
        </Button>
        {saved && <span role="status" className="text-ok"><Check size={18} aria-hidden /><span className="sr-only">OK</span></span>}
        {error && <span role="alert" className="text-sm text-danger">{c("genericError")}</span>}
      </div>
    </section>
  );
}
