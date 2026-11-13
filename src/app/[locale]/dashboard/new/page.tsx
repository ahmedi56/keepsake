import { setRequestLocale } from "next-intl/server";
import { ProjectWizard } from "@/components/project-wizard";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";

export default async function NewProjectPage({ params }: PageProps<"/[locale]/dashboard/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getSession())) redirect({ href: "/signup", locale });
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-5 py-8"><ProjectWizard /></main>
    </>
  );
}
