"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAMES: Record<string, string> = { en: "English", fr: "Français", ar: "العربية", es: "Español" };

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={t("language")}
      value={locale}
      disabled={pending}
      onChange={(e) => start(() => router.replace(pathname, { locale: e.target.value as (typeof routing.locales)[number] }))}
      className="h-9 rounded-full border border-line bg-card px-3 text-sm text-ink"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>{NAMES[l]}</option>
      ))}
    </select>
  );
}
