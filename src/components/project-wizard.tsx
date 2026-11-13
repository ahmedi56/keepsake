"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { createProjectAction } from "@/server/actions";
import { CONTRIBUTION_TYPES, PROJECT_TYPES, TEMPLATES, type ContributionType, type ProjectType } from "@/server/templates";
import { Button } from "./ui/button";
import { Input, Label, Textarea } from "./ui/field";
import { OccasionIcon } from "./icons";
import { ThemePicker } from "./appearance-form";
import { DEFAULT_THEME, type Theme } from "@/lib/themes";

const LANG_NAMES: Record<string, string> = { en: "English", fr: "Français", ar: "العربية", es: "Español" };

export function ProjectWizard() {
  const t = useTranslations("wizard");
  const types = useTranslations("types");
  const ct = useTranslations("contribTypes");
  const c = useTranslations("common");
  const uiLocale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ProjectType>("birthday");
  const [allowed, setAllowed] = useState<ContributionType[]>(TEMPLATES.birthday.suggested);
  const [lang, setLang] = useState(uiLocale);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME.birthday);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pickType(next: ProjectType) {
    setType(next);
    setTheme(DEFAULT_THEME[next]);
    setAllowed(TEMPLATES[next].suggested);
  }

  function toggle(k: ContributionType) {
    setAllowed((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  function submit(form: HTMLFormElement | null) {
    if (!form) return;
    const f = new FormData(form);
    setError(null);
    start(async () => {
      try {
        const { id } = await createProjectAction({
          type,
          recipientName: f.get("recipientName"),
          title: f.get("title"),
          eventDate: f.get("eventDate") || null,
          description: f.get("description") || null,
          relationship: f.get("relationship") || null,
          locale: lang,
          allowedTypes: allowed,
          theme,
          revealAt: f.get("revealAt") ? new Date(String(f.get("revealAt"))).toISOString() : null,
        });
        router.push(`/dashboard/${id}`);
      } catch {
        setError(c("genericError"));
      }
    });
  }

  return (
    <form
      className="mx-auto w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 3) return setStep(step + 1);
        if (allowed.length === 0) return setError(t("needOne"));
        submit(e.currentTarget);
      }}
    >
      <p className="text-sm text-ink-soft">{step} / 3</p>

      {/* All steps stay mounted so FormData sees every field; hidden ones are just not displayed. */}
      <section hidden={step !== 1}>
        <h1 className="font-display text-3xl text-ink">{t("step1")}</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PROJECT_TYPES.map((k) => (
            <button
              key={k} type="button" onClick={() => pickType(k)} aria-pressed={type === k}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border p-3 text-center transition-colors",
                type === k ? "border-accent bg-accent-soft" : "border-line bg-card hover:bg-paper-2",
              )}
            >
              <OccasionIcon type={k} size={30} className="text-accent" />
              <span className="text-sm font-medium text-ink">{types(k)}</span>
            </button>
          ))}
        </div>
      </section>

      <section hidden={step !== 2} className="space-y-4">
        <h1 className="font-display text-3xl text-ink">{t("step2")}</h1>
        <div>
          <Label htmlFor="recipientName">{t("recipientName")}</Label>
          <Input id="recipientName" name="recipientName" required={step >= 2} maxLength={80} placeholder={t("recipientPlaceholder")} />
        </div>
        <div>
          <Label htmlFor="title">{t("eventTitle")}</Label>
          <Input id="title" name="title" required={step >= 2} maxLength={120} placeholder={t("eventTitlePlaceholder")} />
        </div>
        <div>
          <Label htmlFor="eventDate">{t("eventDate")}</Label>
          <Input id="eventDate" name="eventDate" type="date" />
        </div>
        <div>
          <Label htmlFor="relationship">{t("relationship")}</Label>
          <Input id="relationship" name="relationship" maxLength={60} placeholder={t("relationshipPlaceholder")} />
        </div>
        <div>
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea id="description" name="description" maxLength={500} className="min-h-24" />
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-6">
        <h1 className="font-display text-3xl text-ink">{t("step3")}</h1>
        <div className="flex flex-wrap gap-3">
          {CONTRIBUTION_TYPES.filter((k) => k !== "video").map((k) => (
            <button
              key={k} type="button" onClick={() => toggle(k)} aria-pressed={allowed.includes(k)}
              className={cn(
                "rounded-full border px-5 py-3 text-base transition-colors",
                allowed.includes(k) ? "border-accent bg-accent-soft text-ink" : "border-line bg-card text-ink-soft",
              )}
            >
              {ct(k)}
            </button>
          ))}
        </div>
        <div>
          <Label>{t("themeLabel")}</Label>
          <ThemePicker value={theme} onChange={setTheme} />
        </div>
        <div>
          <Label htmlFor="revealAt">{t("revealLabel")}</Label>
          <Input id="revealAt" name="revealAt" type="datetime-local" />
          <p className="mt-1.5 text-sm text-ink-soft">{t("revealHelp")}</p>
        </div>
        <div>
          <Label htmlFor="lang">{t("language")}</Label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-card px-4">
            {locales.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 1 ? <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>{c("back")}</Button> : <span />}
        <Button type="submit" size="lg" disabled={pending}>{step < 3 ? c("next") : pending ? c("loading") : t("create")}</Button>
      </div>
    </form>
  );
}
