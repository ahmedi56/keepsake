"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { unlockKeepsakeAction } from "@/server/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/field";

export function UnlockForm({ slug }: { slug: string }) {
  const t = useTranslations("memory");
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="mx-auto mt-8 flex max-w-xs flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = await unlockKeepsakeAction(slug, pw);
          if (ok) router.refresh();
          else setWrong(true);
        });
      }}
    >
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" aria-label={t("passwordTitle")} />
      {wrong && <p role="alert" className="text-sm text-danger">{t("passwordWrong")}</p>}
      <Button type="submit" disabled={pending}>{t("passwordSubmit")}</Button>
    </form>
  );
}
