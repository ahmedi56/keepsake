import { Lock, MessageCircle, Play } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OccasionIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PROJECT_TYPES } from "@/server/templates";

/** Deterministic pseudo-waveform so the hero looks like a real voice note. */
const BARS = Array.from({ length: 42 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.9) * 0.6 + Math.sin(i * 0.37 + 1) * 0.5);
  return Math.round(8 + v * 24);
});

function Wave({ className }: { className: string }) {
  return (
    <div className={`flex h-10 w-full items-center justify-between ${className}`}>
      {BARS.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-current" style={{ height: h }} />
      ))}
    </div>
  );
}

/** Whitewashed wall, painted door, sun: a small nod to the places these voices come from. */
function DoorPhoto() {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="90" fill="#cfe0ff" />
      <circle cx="94" cy="22" r="10" fill="#f2b01e" />
      <rect y="40" width="120" height="50" fill="#fbfbf8" />
      <path d="M46 90V63a14 14 0 0 1 28 0v27z" fill="#1d4ed8" />
      <circle cx="68" cy="76" r="1.6" fill="#f2b01e" />
      <rect x="8" y="52" width="22" height="14" rx="7" fill="#1d4ed8" opacity=".18" />
    </svg>
  );
}

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const c = await getTranslations("common");
  const types = await getTranslations("types");
  const steps = [1, 2, 3, 4] as const;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: the product's real subject is a voice, so the hero is a stack of voice messages. */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-28 lg:pt-16">
          <div>
            <h1 className="font-display text-[2.6rem] leading-[1.04] tracking-[-0.03em] text-ink sm:text-6xl">{t("title")}</h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">{t("subtitle")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/new" className={buttonStyles({ size: "lg" })}>{c("createMemory")}</Link>
              <a href="#how" className={buttonStyles({ variant: "outline", size: "lg" })}>{c("seeHow")}</a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
              <Lock size={16} aria-hidden />{t("trust")}
            </p>
          </div>

          <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative rounded-3xl border border-line bg-card p-5 shadow-[0_24px_60px_-28px_rgba(14,28,51,.45)]">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sun text-night">
                  <Play size={18} fill="currentColor" className="ms-0.5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight text-ink">Amira</p>
                  <p className="text-sm text-ink-soft">{t("demoVoice")} · 0:42</p>
                </div>
              </div>
              <div className="relative mt-5">
                <Wave className="text-ink/20" />
                <Wave className="wave-played absolute inset-0 text-accent" />
              </div>
            </div>

            <div className="relative -mt-3 ms-8 rounded-3xl border border-line bg-card p-5 shadow-[0_20px_50px_-30px_rgba(14,28,51,.4)] sm:ms-14">
              <p className="flex items-center gap-2 font-display text-lg leading-tight text-ink">
                <MessageCircle size={18} className="text-accent" />Youssef
              </p>
              <p className="mt-2 text-ink">{t("demoNote")}</p>
            </div>

            <div className="relative -mt-3 me-6 flex items-center gap-4 rounded-3xl border border-line bg-card p-3 shadow-[0_20px_50px_-30px_rgba(14,28,51,.4)] sm:me-12">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl"><DoorPhoto /></div>
              <div>
                <p className="font-display text-lg leading-tight text-ink">Lina</p>
                <p className="mt-1 inline-block rounded-full bg-accent-soft px-3 py-1 text-sm text-ink">{t("demoCount")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* The steps ARE a sequence, so they are numbered and joined by a line. */}
        <section id="how" className="border-t border-line bg-paper-2 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">{t("howTitle")}</h2>
            <ol className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {steps.map((n) => (
                <li key={n} className="relative border-t border-ink/25 pt-7">
                  <span className="absolute -top-4 start-0 grid size-8 place-items-center rounded-full bg-accent font-display text-sm text-accent-ink">{n}</span>
                  <h3 className="font-display text-xl text-ink">{t(`step${n}Title`)}</h3>
                  <p className="mt-2 text-ink-soft">{t(`step${n}Body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">{t("occasionsTitle")}</h2>
          <ul className="mt-10 grid grid-cols-2 border-s border-t border-line sm:grid-cols-5">
            {PROJECT_TYPES.map((type) => (
              <li key={type} className="flex flex-col gap-4 border-b border-e border-line p-5 transition-colors hover:bg-accent-soft sm:p-6">
                <OccasionIcon type={type} size={28} className="text-accent" />
                <span className="font-medium text-ink">{types(type)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-night text-night-ink">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg font-display text-3xl leading-tight tracking-tight sm:text-4xl">{t("footer")}</p>
            <Link href="/dashboard/new" className="inline-flex h-14 items-center justify-center rounded-full bg-sun px-8 text-lg font-semibold text-night transition-[filter] hover:brightness-105">
              {c("createMemory")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
