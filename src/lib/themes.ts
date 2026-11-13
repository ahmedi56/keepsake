import type { ProjectType } from "@/server/templates";

/**
 * Themes recolor the accent and add a pattern + animated motif. Paper/ink stay the same so
 * contrast and dark mode keep working. The CSS lives in globals.css under [data-theme="…"].
 */
export const THEMES = ["sidi", "jasmine", "sunrise", "night", "olive", "gold"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Record<ProjectType, Theme> = {
  birthday: "sunrise",
  wedding: "jasmine",
  anniversary: "jasmine",
  retirement: "gold",
  graduation: "gold",
  farewell: "sidi",
  memorial: "night",
  teacher: "olive",
  family: "olive",
  custom: "sidi",
};

export function themeFor(project: { theme: string | null; type: ProjectType }): Theme {
  return (THEMES as readonly string[]).includes(project.theme ?? "") ? (project.theme as Theme) : DEFAULT_THEME[project.type];
}

/** Swatch colors for the theme picker (accent, secondary). */
export const THEME_SWATCH: Record<Theme, [string, string]> = {
  sidi: ["#1d4ed8", "#f2b01e"],
  jasmine: ["#166534", "#d4a017"],
  sunrise: ["#c2410c", "#f59e0b"],
  night: ["#3b4d7a", "#c7cde0"],
  olive: ["#4d6b1f", "#d9a520"],
  gold: ["#92400e", "#f2b01e"],
};

/** Reaction stickers a contributor can attach. Ids are stored in the DB, so never rename them. */
export const STICKERS = ["heart", "laugh", "sun", "star", "flower", "gift", "crown", "music"] as const;
export type Sticker = (typeof STICKERS)[number];

/**
 * Animated reactions: Google's open-source Noto animated emoji (CC BY 4.0), loaded from Google's font CDN.
 * Stored as "e:<codepoint>". Only this allow-list is accepted, so no arbitrary string or URL is ever stored.
 */
export const ANIMATED_EMOJI = [
  ["1f973", "🥳"], ["1f602", "😂"], ["1f60d", "😍"], ["1f970", "🥰"], ["1f62d", "😭"], ["1f525", "🔥"],
  ["1f389", "🎉"], ["1f44f", "👏"], ["1f64f", "🙏"], ["1f4af", "💯"], ["1f60e", "😎"], ["1f917", "🤗"],
  ["1f607", "😇"], ["1f31f", "🌟"], ["1f48c", "💌"], ["1f381", "🎁"], ["1f451", "👑"], ["1f339", "🌹"],
  ["1f622", "😢"], ["1f929", "🤩"], ["1f60a", "😊"], ["1f618", "😘"], ["1f64c", "🙌"], ["1f49b", "💛"],
] as const;

export const ANIMATED_IDS: readonly string[] = ANIMATED_EMOJI.map(([cp]) => `e:${cp}`);

export function animatedChar(id: string): string | null {
  return ANIMATED_EMOJI.find(([cp]) => `e:${cp}` === id)?.[1] ?? null;
}

/** A preset sticker id or an allow-listed animated emoji id. */
export function isStickerId(v: unknown): v is string {
  return typeof v === "string" && ((STICKERS as readonly string[]).includes(v) || ANIMATED_IDS.includes(v));
}

export function isPresetSticker(v: string): v is Sticker {
  return (STICKERS as readonly string[]).includes(v);
}
