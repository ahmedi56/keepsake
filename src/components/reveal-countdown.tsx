"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

/** "Opens on {date}" / "Only you can see this until {date}", with the date shown in the viewer's own timezone. */
export function RevealNote({ revealAtMs, kind, className }: { revealAtMs: number; kind: "body" | "owner"; className?: string }) {
  const t = useTranslations("memory");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(revealAtMs);
  // The server renders in its own timezone, the browser in the viewer's: the text intentionally differs.
  return <p className={className} suppressHydrationWarning>{kind === "body" ? t("revealBody", { date }) : t("revealOwner", { date })}</p>;
}

/** Counts down to the reveal moment, then refreshes the page so the (now unlocked) keepsake appears. */
export function RevealCountdown({ revealAtMs, serverNowMs }: { revealAtMs: number; serverNowMs: number }) {
  const t = useTranslations("memory");
  const router = useRouter();
  const nowSec = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => Math.floor(serverNowMs / 1000));
  const left = Math.max(0, Math.floor(revealAtMs / 1000) - nowSec);
  const refreshed = useRef(false);

  useEffect(() => {
    if (left === 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left, router]);

  const parts = [
    [Math.floor(left / 86400), t("days")],
    [Math.floor((left % 86400) / 3600), t("hours")],
    [Math.floor((left % 3600) / 60), t("minutes")],
    [left % 60, t("seconds")],
  ] as const;

  return (
    <div className="mt-8 grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
      {parts.map(([n, label]) => (
        <div key={label} className="rounded-2xl border border-line bg-card px-2 py-4">
          <p className="font-display text-3xl tabular-nums text-ink sm:text-4xl">{String(n).padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-ink-soft sm:text-sm">{label}</p>
        </div>
      ))}
    </div>
  );
}
