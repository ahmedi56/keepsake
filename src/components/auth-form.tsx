"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/field";

export function AuthForm({ mode, googleEnabled }: { mode: "signin" | "signup"; googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: String(f.get("name")) })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) return setError(t("invalid"));
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-card p-7">
      <h1 className="font-display text-3xl text-ink">{mode === "signup" ? t("signUpTitle") : t("signInTitle")}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" required maxLength={80} autoComplete="name" />
          </div>
        )}
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password" name="password" type="password" required minLength={8} maxLength={128}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {mode === "signup" && <p className="mt-1 text-sm text-ink-soft">{t("passwordHint")}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "signup" ? c("signUp") : c("signIn")}
        </Button>
      </form>
      {googleEnabled && (
        <>
          <p className="my-4 text-center text-sm text-ink-soft">{t("or")}</p>
          <Button
            variant="outline" className="w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + "/" })}
          >
            {t("google")}
          </Button>
        </>
      )}
      <p className="mt-6 text-center text-sm text-ink-soft">
        {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
        <Link className="font-medium text-accent underline" href={mode === "signup" ? "/login" : "/signup"}>
          {mode === "signup" ? c("signIn") : c("signUp")}
        </Link>
      </p>
    </div>
  );
}
