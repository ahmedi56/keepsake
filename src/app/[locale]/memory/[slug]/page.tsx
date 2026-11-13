import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { KindIcon, OccasionIcon, StickerBadge } from "@/components/icons";
import { isPresetSticker } from "@/lib/themes";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RevealCountdown, RevealNote } from "@/components/reveal-countdown";
import { StoryPlayer } from "@/components/story-player";
import { ThemeBackdrop } from "@/components/theme-backdrop";
import { TranscriptToggle } from "@/components/transcript-toggle";
import { UnlockForm } from "@/components/unlock-form";
import { getSession } from "@/lib/auth";
import { themeFor, type Theme } from "@/lib/themes";
import { safeEqual } from "@/lib/tokens";
import { currentTimeMs, getKeepsakeView, pendingCount, projectBySlug, unlockCookieValue } from "@/server/keepsake";
import { TEMPLATES } from "@/server/templates";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

export default async function MemoryPage({ params }: PageProps<"/[locale]/memory/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("memory");
  const st = await getTranslations("stickers");
  const project = await projectBySlug(slug);
  const theme: Theme | undefined = project ? themeFor(project) : undefined;

  const shell = (children: React.ReactNode) => (
    <div data-theme={theme} className="relative isolate flex-1">
      {theme && <ThemeBackdrop />}
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <div className="mb-8 flex justify-end"><LanguageSwitcher /></div>
        {children}
      </main>
    </div>
  );
  if (!project) return shell(<p className="text-center text-lg text-ink-soft">{t("unavailable")}</p>);

  // Access: the owner always sees it; everyone else depends on the privacy mode.
  const session = await getSession();
  const isOwner = session?.user.id === project.ownerId;
  if (!isOwner) {
    if (project.privacy === "private") return shell(<p className="text-center text-lg text-ink-soft">{t("unavailable")}</p>);
    if (project.privacy === "password") {
      const cookie = (await cookies()).get(`ks_${project.id}`)?.value ?? "";
      if (!safeEqual(cookie, unlockCookieValue(project))) {
        return shell(
          <div className="text-center">
            <h1 className="font-display text-3xl text-ink">{t("passwordTitle")}</h1>
            <UnlockForm slug={slug} />
          </div>,
        );
      }
    }
  }

  const tpl = TEMPLATES[project.type];
  const now = currentTimeMs();

  // Surprise mode: nothing about the contributions is even loaded for visitors before the reveal.
  const view = await getKeepsakeView(project, isOwner, new Date(now));
  if (view.locked) {
    return shell(
      <div className="text-center">
        <OccasionIcon type={project.type} size={44} className="mx-auto text-accent" />
        <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{t("revealTitle")}</h1>
        <RevealNote revealAtMs={view.revealAt.getTime()} kind="body" className="mt-3 text-lg text-ink-soft" />
        <RevealCountdown revealAtMs={view.revealAt.getTime()} serverNowMs={now} />
      </div>,
    );
  }

  const items = view.items;
  const waiting = isOwner ? await pendingCount(project.id) : 0;
  const messages = items.filter((i) => i.type === "voice" || i.type === "text" || i.type === "story");
  const photos = items.filter((i) => i.type === "photo" && i.mediaUrl);
  const date = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const verb = { voice: t("recordedMessage"), text: t("wroteMessage"), story: t("sharedMemory"), photo: t("sharedPhoto"), video: t("sharedMemory") } as const;
  const story = items
    .filter((i) => i.type !== "video")
    .map((i) => ({ id: i.id, type: i.type, name: i.name, text: i.text, promptText: i.promptText, transcript: i.transcript, mediaUrl: i.mediaUrl, sticker: i.sticker }));

  return shell(
    <>
      <header className="text-center">
        <OccasionIcon type={project.type} size={44} className="mx-auto" style={{ color: tpl.accent }} />
        <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{project.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t("subtitle")}</p>
        <p className="mt-2 font-medium text-accent">{t("count", { count: items.length })}</p>
        {waiting > 0 && (
          <p className="mx-auto mt-4 max-w-md rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
            {t("pendingOwner", { count: waiting })}{" "}
            <Link href={`/dashboard/${project.id}`} className="font-medium underline">{t("pendingOwnerLink")}</Link>
          </p>
        )}
        {view.sealedForOthers && view.revealAt && (
          <RevealNote revealAtMs={view.revealAt.getTime()} kind="owner" className="mx-auto mt-4 max-w-md rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink" />
        )}
        <div className="flex"><StoryPlayer items={story} /></div>
      </header>

      {items.length === 0 && <p className="mt-12 text-center text-ink-soft">{t("empty")}</p>}

      {messages.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl text-ink">{t("messages")}</h2>
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="rounded-3xl border border-line bg-card p-6 shadow-sm">
                <p className="flex items-center gap-2 font-display text-xl text-ink">
                  <KindIcon kind={m.type === "voice" ? "voice" : "text"} size={20} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">{m.name}</span>
                  {m.sticker && <StickerBadge id={m.sticker} label={isPresetSticker(m.sticker) ? st(m.sticker) : ""} size={34} />}
                </p>
                {m.promptText && <p className="mt-1 text-sm italic text-ink-soft">{m.promptText}</p>}
                {m.type === "voice" && m.mediaUrl && <audio controls preload="none" src={m.mediaUrl} className="mt-4 w-full" />}
                {m.text && <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink">{m.text}</p>}
                {m.transcript && <TranscriptToggle transcript={m.transcript} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl text-ink">{t("photos")}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {photos.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-3xl border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                <img src={p.mediaUrl!} alt={p.text ?? p.name} loading="lazy" className="aspect-square w-full object-cover" />
                {p.sticker && <span className="absolute end-2 top-2"><StickerBadge id={p.sticker} label={isPresetSticker(p.sticker) ? st(p.sticker) : ""} size={34} /></span>}
                <p className="px-4 py-3 text-sm text-ink-soft">{p.name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl text-ink">{t("timeline")}</h2>
          <ol className="border-s-2 border-line ps-5">
            {items.map((i) => (
              <li key={i.id} className="relative pb-5">
                <span className="absolute -start-[1.65rem] top-1.5 size-3 rounded-full bg-accent" aria-hidden />
                <p className="text-sm font-medium text-ink-soft">{date(i.createdAt)}</p>
                <p className="text-ink">{i.name} {verb[i.type]}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>,
  );
}
