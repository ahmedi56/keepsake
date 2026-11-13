"use client";

import { useState } from "react";

/**
 * An animated emoji (Noto animated emoji, CC BY 4.0). If the image cannot load (offline, blocked CDN),
 * the ordinary static emoji character is shown instead, so nothing ever looks broken.
 */
export function AnimatedEmoji({ cp, char, size = 36 }: { cp: string; char: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden style={{ fontSize: size * 0.8, lineHeight: 1 }}>{char}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party animated image, no optimisation wanted
    <img
      src={`https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.webp`}
      alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async"
      onError={() => setFailed(true)} style={{ width: size, height: size }}
    />
  );
}
