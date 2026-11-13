"use client";

import { Check, EyeOff, Mic, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { moderateAction } from "@/server/actions";
import { StickerBadge } from "./icons";
import { isPresetSticker } from "@/lib/themes";
import { Button } from "./ui/button";

export type OwnerContribution = {
  id: string;
  type: "voice" | "text" | "photo" | "video" | "story";
  contributorName: string;
  text: string | null;
  promptText: string | null;
  transcript: string | null;
  moderation: "pending" | "approved" | "rejected" | "hidden";
  createdAt: string;
  mediaUrl: string | null;
  sticker: string | null;
};

const STATUS_STYLE: Record<OwnerContribution["moderation"], string> = {
  pending: "bg-accent-soft text-ink",
  approved: "bg-ok/15 text-ok",
  rejected: "bg-danger/10 text-danger",
  hidden: "bg-paper-2 text-ink-soft",
};

export function ContributionList({ items }: { items: OwnerContribution[] }) {
  const t = useTranslations("dashboard");
  const ct = useTranslations("contribTypes");
  const c = useTranslations("common");
  const st = useTranslations("stickers");
  const locale = useLocale();
  const [local, setLocal] = useState(items);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function act(id: string, action: "approve" | "reject" | "hide" | "delete") {
    setError(false);
    start(async () => {
      const ok = await moderateAction(id, action);
      if (!ok) return setError(true);
      setLocal((cur) =>
        action === "delete"
          ? cur.filter((x) => x.id !== id)
          : cur.map((x) => (x.id === id ? { ...x, moderation: ({ approve: "approved", reject: "rejected", hide: "hidden" } as const)[action] } : x)),
      );
    });
  }

  if (local.length === 0) return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-ink-soft">{t("noContributions")}</p>;

  return (
    <ul className="space-y-3">
      {error && <li role="alert" className="text-sm text-danger">{c("genericError")}</li>}
      {[...local].reverse().map((x) => (
        <li key={x.id} className="rounded-3xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{x.contributorName}</span>
            {x.sticker && <StickerBadge id={x.sticker} label={isPresetSticker(x.sticker) ? st(x.sticker) : ""} size={26} />}
            <span className="text-sm text-ink-soft">· {ct(x.type)} · {new Date(x.createdAt).toLocaleDateString(locale)}</span>
            <span className={cn("ms-auto rounded-full px-3 py-1 text-xs font-medium", STATUS_STYLE[x.moderation])}>{t(`status.${x.moderation}`)}</span>
          </div>
          {x.promptText && <p className="mt-2 text-sm italic text-ink-soft">{x.promptText}</p>}
          {x.text && <p className="mt-3 whitespace-pre-wrap text-ink">{x.text}</p>}
          {x.type === "voice" && x.mediaUrl && (
            <div className="mt-3 flex items-center gap-3">
              <Mic size={18} className="text-accent" aria-hidden />
              <audio controls preload="none" src={x.mediaUrl} className="w-full" />
            </div>
          )}
          {x.type === "photo" && x.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL, not optimizable by next/image
            <img src={x.mediaUrl} alt="" className="mt-3 max-h-72 rounded-2xl object-cover" loading="lazy" />
          )}
          {x.transcript && <p className="mt-3 rounded-2xl bg-paper-2 p-3 text-sm text-ink-soft">“{x.transcript}”</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || x.moderation === "approved"} onClick={() => act(x.id, "approve")}><Check size={16} />{t("approve")}</Button>
            <Button size="sm" variant="outline" disabled={pending || x.moderation === "rejected"} onClick={() => act(x.id, "reject")}><X size={16} />{t("reject")}</Button>
            <Button size="sm" variant="outline" disabled={pending || x.moderation === "hidden"} onClick={() => act(x.id, "hide")}><EyeOff size={16} />{t("hide")}</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(c("delete") + "?") && act(x.id, "delete")}><Trash2 size={16} />{c("delete")}</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
