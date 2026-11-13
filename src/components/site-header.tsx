import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { LogoMark } from "./icons";
import { buttonStyles } from "./ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const t = await getTranslations("common");
  const session = await getSession();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-5">
      <Link href="/" className="flex items-center gap-2.5 font-display text-xl tracking-tight text-ink">
        <LogoMark />
        <span className="max-[400px]:sr-only">{t("appName")}</span>
      </Link>
      <nav className="flex items-center gap-2">
        <LanguageSwitcher />
        {session ? (
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: "ghost", size: "sm" })}>{t("dashboard")}</Link>
            <SignOutButton label={t("signOut")} />
          </>
        ) : (
          <Link href="/login" className={buttonStyles({ variant: "outline", size: "sm" })}>{t("signIn")}</Link>
        )}
      </nav>
    </header>
  );
}
