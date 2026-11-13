import {
  Apple, Bird, BookOpen, Cake, Camera, Crown, Flower2, Gift, GraduationCap, Hand, Heart, House, Gem,
  MessageCircle, Mic, Music, PartyPopper, Smile, Star, Sun, Video, Wine, type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { animatedChar, type Sticker } from "@/lib/themes";
import { AnimatedEmoji } from "./animated-emoji";
import type { ContributionType, ProjectType } from "@/server/templates";

/** One consistent line-icon set instead of emoji (emoji render differently on every device). */
const OCCASION: Record<ProjectType, ComponentType<LucideProps>> = {
  birthday: Cake,
  wedding: Gem,
  anniversary: Wine,
  retirement: PartyPopper,
  graduation: GraduationCap,
  farewell: Hand,
  memorial: Bird,
  teacher: Apple,
  family: House,
  custom: Heart,
};

const KIND: Record<ContributionType, ComponentType<LucideProps>> = {
  voice: Mic,
  text: MessageCircle,
  story: BookOpen,
  photo: Camera,
  video: Video,
};

export function OccasionIcon({ type, ...props }: { type: ProjectType } & LucideProps) {
  const Icon = OCCASION[type];
  return <Icon aria-hidden strokeWidth={1.6} {...props} />;
}

export function KindIcon({ kind, ...props }: { kind: ContributionType } & LucideProps) {
  const Icon = KIND[kind];
  return <Icon aria-hidden strokeWidth={1.8} {...props} />;
}

/** Brand mark: five voice-wave bars in a rounded square. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const bars = [5, 11, 17, 9, 13];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <rect width="28" height="28" rx="8" className="fill-accent" />
      {bars.map((h, i) => (
        <rect key={i} x={5 + i * 4} y={14 - h / 2} width="2.4" height={h} rx="1.2" className="fill-accent-ink" />
      ))}
    </svg>
  );
}

const STICKER_ICON: Record<Sticker, ComponentType<LucideProps>> = {
  heart: Heart, laugh: Smile, sun: Sun, star: Star, flower: Flower2, gift: Gift, crown: Crown, music: Music,
};

/** A reaction sticker: a themed round badge. `label` is the accessible name. */
export function StickerBadge({ id, label, size = 36 }: { id: string; label: string; size?: number }) {
  const animated = animatedChar(id);
  if (animated) {
    return (
      <span role="img" aria-label={animated} style={{ width: size, height: size }} className="inline-grid shrink-0 place-items-center">
        <AnimatedEmoji cp={id.slice(2)} char={animated} size={size} />
      </span>
    );
  }
  const Icon = STICKER_ICON[id as Sticker];
  if (!Icon) return null;
  return (
    <span role="img" aria-label={label} title={label} style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
      <Icon size={Math.round(size * 0.55)} strokeWidth={1.8} aria-hidden />
    </span>
  );
}
