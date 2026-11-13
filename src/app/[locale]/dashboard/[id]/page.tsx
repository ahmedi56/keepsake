import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContributionList } from "@/components/contribution-list";
import { AppearanceForm } from "@/components/appearance-form";
import { ApprovalForm } from "@/components/approval-form";
import { PrivacyForm } from "@/components/privacy-form";
import { ShareCard } from "@/components/share-card";
import { SiteHeader } from "@/components/site-header";
import { buttonStyles } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { themeFor } from "@/lib/themes";
import { listForOwner } from "@/server/moderation";
import { contributionBreakdown, getOwnedProject } from "@/server/projects";
import { KindIcon, OccasionIcon } from "@/components/icons";
import type { ContributionType } from "@/server/templates";

export default async function ProjectPage({ params }: PageProps<"/[locale]/dashboard/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });
  const project = await getOwnedProject(session!.user.id, id);
  if (!project) notFound();

  const t = await getTranslations("dashboard");
  const ct = await getTranslations("contribTypes");
  const [items, breakdown] = await Promise.all([listForOwner(session!.user.id, project.id), contributionBreakdown(project.id)]);
  const cap = PLAN_LIMITS[project.plan].maxContributions;
  const total = items.length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-8">
        <header>
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><OccasionIcon type={project.type} size={26} /></span>
          <h1 className="mt-3 font-display text-3xl text-ink">{project.title}</h1>
        </header>

        <section className="rounded-3xl border border-line bg-card p-6">
          <p className="text-lg text-ink">
            <strong>{total}</strong>{cap ? <span className="text-ink-soft"> {t("goal", { goal: cap })}</span> : null}
            <span className="text-ink-soft"> · {t("progress", { count: total })}</span>
          </p>
          {cap && (
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={total} aria-valuemax={cap}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (total / cap) * 100)}%` }} />
            </div>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
            {(Object.entries(breakdown) as [ContributionType, number][]).map(([k, n]) => (
              <li key={k} className="flex items-center gap-1.5"><KindIcon kind={k} size={16} />{n} {ct(k)}</li>
            ))}
          </ul>
          {cap && total >= cap && <p className="mt-3 text-sm text-danger">{t("freeLimit", { limit: cap })}</p>}
        </section>

        <ShareCard path={`/${project.locale}/c/${project.contributeToken}`} title={project.title} />

        <div className="flex flex-wrap gap-2">
          <Link href={`/memory/${project.slug}`} className={buttonStyles({ variant: "soft" })}>{t("viewKeepsake")}</Link>
        </div>

        <ApprovalForm projectId={project.id} requireApproval={project.requireApproval} />
        <AppearanceForm projectId={project.id} theme={themeFor(project)} revealAt={project.revealAt?.toISOString() ?? null} />

        <PrivacyForm projectId={project.id} privacy={project.privacy} collecting={project.status === "collecting"} />

        <section>
          <h2 className="mb-3 font-display text-xl text-ink">{t("contributions")}</h2>
          <ContributionList
            items={items.map((x) => ({
              id: x.id, type: x.type, contributorName: x.contributorName, text: x.text, promptText: x.promptText,
              transcript: x.transcript, moderation: x.moderation, createdAt: x.createdAt.toISOString(), mediaUrl: x.mediaUrl, sticker: x.sticker,
            }))}
          />
        </section>
      </main>
    </>
  );
}
