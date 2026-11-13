"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setRequireApprovalAction } from "@/server/actions";

/** One switch: approve every message first (default) or let them appear on the keepsake straight away. */
export function ApprovalForm({ projectId, requireApproval }: { projectId: string; requireApproval: boolean }) {
  const t = useTranslations("dashboard");
  const [on, setOn] = useState(requireApproval);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setError(false);
    start(async () => {
      const ok = await setRequireApprovalAction(projectId, next);
      if (ok) setOn(next); else setError(true);
    });
  }

  return (
    <section className="space-y-3 rounded-3xl border border-line bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-xl text-ink"><ShieldCheck size={20} aria-hidden />{t("approvalTitle")}</h2>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" checked={on} onChange={toggle} disabled={pending} className="mt-1 size-5 accent-[var(--color-accent)]" />
        <span>
          <span className="block text-ink">{t("approvalLabel")}</span>
          <span className="mt-1 block text-sm text-ink-soft">{on ? t("approvalOn") : t("approvalOff")}</span>
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{t("approvalError")}</p>}
    </section>
  );
}
