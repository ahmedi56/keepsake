/** Decorative top-of-page pattern + slowly moving motif. Shape/motion come from [data-theme] CSS. */
const ITEMS = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 96,
  d: -((i * 1.9) % 13), // negative delay: already mid-flight when the page loads
  t: 15 + ((i * 3) % 9),
  s: 8 + ((i * 5) % 10),
  y: (i * 23) % 88,
}));

export function ThemeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10">
      <div className="theme-pattern" />
      <div className="motif-layer">
        {ITEMS.map((m, i) => (
          <span
            key={i}
            className="motif"
            style={{ "--x": `${m.x}%`, "--d": `${m.d}s`, "--t": `${m.t}s`, "--s": `${m.s}px`, "--y": `${m.y}%` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
