import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContributeFlow } from "@/components/contribute-flow";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeBackdrop } from "@/components/theme-backdrop";
import { ContributeError, contributePageData } from "@/server/contribute";

// Contributor links are secrets: never index or cache them, and don't leak them via Referer.
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

export default async function ContributePage({ params }: PageProps<"/[locale]/c/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contribute");

  let data: Awaited<ReturnType<typeof contributePageData>> | null = null;
  let problem: "closed" | "notFound" | null = null;
  try {
    data = await contributePageData(token);
  } catch (e) {
    if (e instanceof ContributeError) problem = e.code === "closed" ? "closed" : "notFound";
    else throw e;
  }

  return (
    <div data-theme={data?.theme} className="relative isolate flex flex-1 flex-col">
    {data && <ThemeBackdrop />}
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
      {data ? (
        <ContributeFlow
          token={token} recipientName={data.recipientName} allowedTypes={data.allowedTypes}
          prompts={data.prompts} description={data.description} requireApproval={data.requireApproval}
        />
      ) : (
        <p className="my-auto rounded-3xl border border-line bg-card p-8 text-center text-lg text-ink-soft">{t(problem ?? "notFound")}</p>
      )}
    </main>
    </div>
  );
}
