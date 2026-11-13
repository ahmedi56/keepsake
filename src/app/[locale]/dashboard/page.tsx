import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { buttonStyles } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { listOwnedProjects } from "@/server/projects";
import { OccasionIcon } from "@/components/icons";

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });
  const t = await getTranslations("dashboard");
  const c = await getTranslations("common");
  const rows = await listOwnedProjects(session!.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-ink">{t("title")}</h1>
          {rows.length > 0 && <Link href="/dashboard/new" className={buttonStyles({ size: "sm" })}>{c("createMemory")}</Link>}
        </div>
        {rows.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="text-ink-soft">{t("empty")}</p>
            <Link href="/dashboard/new" className={buttonStyles({ className: "mt-5" })}>{t("emptyCta")}</Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map(({ project, total, pending }) => {
              const cap = PLAN_LIMITS[project.plan].maxContributions;
              return (
                <li key={project.id}>
                  <Link href={`/dashboard/${project.id}`} className="flex items-center gap-4 rounded-3xl border border-line bg-card p-5 transition-colors hover:bg-paper-2">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><OccasionIcon type={project.type} size={24} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{project.title}</span>
                      <span className="text-sm text-ink-soft">
                        {t("progress", { count: total })}{cap ? ` ${t("goal", { goal: cap })}` : ""}
                      </span>
                    </span>
                    {pending > 0 && <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-ink">{pending} {t("newContribution")}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
