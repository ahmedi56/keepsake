import type { Locale } from "@/i18n/routing";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import ar from "../../messages/ar.json";

export const PROJECT_TYPES = [
  "birthday", "wedding", "anniversary", "retirement", "graduation",
  "farewell", "memorial", "teacher", "family", "custom",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const CONTRIBUTION_TYPES = ["voice", "text", "photo", "video", "story"] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

/** Per-event design + defaults. Copy lives in messages/*.json so every locale gets its own. */
export const TEMPLATES: Record<ProjectType, { accent: string; suggested: ContributionType[] }> = {
  birthday: { accent: "#c2410c", suggested: ["voice", "text", "photo"] },
  wedding: { accent: "#9f1239", suggested: ["voice", "text", "photo"] },
  anniversary: { accent: "#a16207", suggested: ["voice", "text", "photo"] },
  retirement: { accent: "#0f766e", suggested: ["voice", "text", "photo"] },
  graduation: { accent: "#1d4ed8", suggested: ["voice", "text", "photo"] },
  farewell: { accent: "#6d28d9", suggested: ["voice", "text", "photo"] },
  memorial: { accent: "#475569", suggested: ["voice", "text", "photo"] },
  teacher: { accent: "#b45309", suggested: ["voice", "text", "photo"] },
  family: { accent: "#15803d", suggested: ["voice", "text", "photo"] },
  custom: { accent: "#1d4ed8", suggested: ["voice", "text", "photo"] },
};

const CATALOGS = { en, fr, ar, es } as const;

export function defaultPrompts(type: ProjectType, locale: Locale): string[] {
  const prompts = CATALOGS[locale].prompts as Record<string, string[]>;
  return prompts[type] ?? prompts.custom;
}
