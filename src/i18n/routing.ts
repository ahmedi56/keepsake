import { defineRouting } from "next-intl/routing";

export const locales = ["en", "fr", "ar", "es"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});

export const isRtl = (locale: string) => locale === "ar";
export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);
