const glyphs = { out: "↗", down: "↓", right: "→" } as const;

/** Decorative arrow that nudges in its own direction when its link or button is hovered or focused. */
export function Arrow({ dir }: { dir: keyof typeof glyphs }) {
  return (
    <span className="arrow" data-dir={dir} aria-hidden="true">
      {glyphs[dir]}
    </span>
  );
}
