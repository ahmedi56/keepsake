import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import es from "../messages/es.json";
import fr from "../messages/fr.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("message catalogs", () => {
  const base = keys(en).sort();
  for (const [name, cat] of Object.entries({ fr, ar, es })) {
    it(`${name} has exactly the same keys (and prompt counts) as en`, () => {
      expect(keys(cat).sort()).toEqual(base);
    });
  }
  it("keeps ICU placeholders consistent across locales", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
    const flat = (o: unknown, p = ""): Record<string, string> =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.assign({}, ...Object.entries(o).map(([k, v]) => flat(v, p ? `${p}.${k}` : k)))
        : typeof o === "string" ? { [p]: o } : {};
    const e = flat(en);
    for (const cat of [fr, ar, es]) {
      const c = flat(cat);
      for (const k of Object.keys(e)) {
        const want = placeholders(e[k]).filter((x) => x !== "count" || e[k].includes("plural") === false);
        const got = placeholders(c[k]).filter((x) => x !== "count" || c[k].includes("plural") === false);
        expect(got.filter((x) => x !== "plural" && x !== "one" && x !== "other")).toEqual(
          want.filter((x) => x !== "plural" && x !== "one" && x !== "other"),
        );
      }
    }
  });
});
