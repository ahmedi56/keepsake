import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "@/i18n/navigation";
import { getSession, googleEnabled } from "@/lib/auth";

export default async function Page({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getSession()) redirect({ href: "/dashboard", locale });
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-5 py-10">
        <AuthForm mode="signup" googleEnabled={googleEnabled} />
      </main>
    </>
  );
}
