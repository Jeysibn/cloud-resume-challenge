import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

import type { ThemePreference } from "./portfolio";

const THEME_STORAGE_KEY = "color-theme";

function getInitialTheme(): ThemePreference {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "dark" ? "#0a0a0a" : "#f2efe9";
}

/** Viewport point the theme change spreads from (the switch's centre). */
export type ThemeOrigin = { x: number; y: number };

export function useTheme() {
  const [preference, setPreference] =
    useState<ThemePreference>(getInitialTheme);
  const effectiveTheme = preference;

  useEffect(() => {
    applyTheme(effectiveTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The theme still applies for the current session when storage is blocked.
    }
  }, [effectiveTheme, preference]);

  /**
   * Switches theme with a "water drop" reveal: the new theme spreads in a soft
   * circle from `origin`. Uses the View Transitions API; without it, or with
   * reduced motion, the theme changes instantly.
   */
  const switchTheme = useCallback((next: ThemePreference, origin?: ThemeOrigin) => {
    const root = document.documentElement;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    if (!origin || reduced || typeof document.startViewTransition !== "function") {
      setPreference(next);
      return;
    }

    // Radius that reaches the farthest viewport corner from the origin.
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    root.style.setProperty("--theme-x", `${origin.x}px`);
    root.style.setProperty("--theme-y", `${origin.y}px`);
    root.style.setProperty("--theme-r", `${Math.ceil(radius)}px`);
    root.classList.add("theme-switching");

    const transition = document.startViewTransition(() => {
      flushSync(() => setPreference(next));
      applyTheme(next);
    });
    transition.finished.finally(() => {
      root.classList.remove("theme-switching");
      for (const name of ["--theme-x", "--theme-y", "--theme-r"]) root.style.removeProperty(name);
    });
  }, []);

  return { preference, effectiveTheme, setPreference, switchTheme };
}

export function useActiveSection(sectionIds: readonly string[]) {
  const [activeSection, setActiveSection] = useState("");
  const sectionKey = sectionIds.join("\u0000");

  useEffect(() => {
    let frame = 0;
    const stableSectionIds = sectionKey ? sectionKey.split("\u0000") : [];

    const resolveSections = () =>
      stableSectionIds
        .map((id) => {
          const anchor = document.getElementById(id);
          const section = anchor?.closest<HTMLElement>("section") ?? anchor;
          return section ? { id, section } : null;
        })
        .filter(
          (item): item is { id: string; section: HTMLElement } => item !== null,
        );

    const updateActiveSection = () => {
      const sections = resolveSections();
      if (!sections.length) {
        setActiveSection("");
        return;
      }

      const headerHeight =
        document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
      const probe = headerHeight + Math.min(180, window.innerHeight * 0.28);

      const active = sections.find(({ section }) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= probe && rect.bottom > probe;
      });

      setActiveSection(active?.id ?? "");
    };

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [sectionKey]);

  return activeSection;
}

/**
 * Reveals `[data-reveal]` elements once as they enter the viewport. Content is
 * only hidden (via `html.reveal-on`) after this hook has confirmed that
 * IntersectionObserver exists and reduced motion is off, so without JavaScript,
 * with reduced motion, or if anything here fails, the page stays fully visible.
 * Anything on screen, even a sliver, is revealed, so visible content is never
 * left hidden at the edge of the viewport.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !window.matchMedia) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const root = document.documentElement;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0 },
    );

    const stop = () => {
      observer.disconnect();
      root.classList.remove("reveal-on");
    };
    reduced.addEventListener("change", stop);
    root.classList.add("reveal-on");
    targets.forEach((target) => observer.observe(target));

    return () => {
      reduced.removeEventListener("change", stop);
      stop();
      targets.forEach((target) => target.classList.remove("is-revealed"));
    };
  }, []);
}
