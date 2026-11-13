"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { THEMES, THEME_SWATCH, type Theme } from "@/lib/themes";
import { setAppearanceAction } from "@/server/actions";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/field";

/** ISO instant -> value for <input type="datetime-local"> in the viewer's own timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  const tt = useTranslations("themes");
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {THEMES.map((k) => (
        <button
          key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-sm transition-colors",
            value === k ? "border-accent bg-accent-soft text-ink" : "border-line bg-card text-ink-soft hover:bg-paper-2",
          )}
        >
          <span className="relative flex size-9 overflow-hidden rounded-full ring-1 ring-line">
            <span className="w-1/2" style={{ background: THEME_SWATCH[k][0] }} />
            <span className="w-1/2" style={{ background: THEME_SWATCH[k][1] }} />
            {value === k && <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" aria-hidden />}
          </span>
          {tt(k)}
        </button>
      ))}
    </div>
  );
}

export function AppearanceForm({ projectId, theme, revealAt }: { projectId: string; theme: Theme; revealAt: string | null }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const [chosen, setChosen] = useState<Theme>(theme);
  const [reveal, setReveal] = useState(toLocalInput(revealAt));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setSaved(false); setError(false);
    start(async () => {
      const ok = await setAppearanceAction(projectId, { theme: chosen, revealAt: reveal ? new Date(reveal).toISOString() : null });
      if (ok) setSaved(true); else setError(true);
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-card p-6">
      <h2 className="font-display text-xl text-ink">{t("appearanceTitle")}</h2>
      <div>
        <Label>{t("themeLabel")}</Label>
        <ThemePicker value={chosen} onChange={setChosen} />
      </div>
      <div>
        <Label htmlFor="reveal">{t("revealLabel")}</Label>
        <div className="flex gap-2">
          <Input id="reveal" type="datetime-local" value={reveal} onChange={(e) => setReveal(e.target.value)} />
          {reveal && <Button type="button" variant="ghost" onClick={() => setReveal("")}>{t("clearReveal")}</Button>}
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">{t("revealHelp")}</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{c("genericError")}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{c("save")}</Button>
        {saved && <span role="status" className="flex items-center gap-1 text-sm text-ok"><Check size={16} aria-hidden />{t("saved")}</span>}
      </div>
    </section>
  );
}
