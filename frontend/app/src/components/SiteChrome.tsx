import { useEffect, useRef, useState } from "react";
import type { ThemePreference } from "../portfolio";
import { VisitorCounter } from "./VisitorCounter";

/**
 * Header destinations group the page anchors; every section keeps its own
 * anchor ID. A destination is current while any of its sections is active.
 */
const primaryNav = [
  { label: "Work", ids: ["projects"] },
  { label: "Experience", ids: ["experience"] },
  { label: "Toolkit", ids: ["skills", "credentials"] },
  { label: "Contact", ids: ["contact"] },
] as const;

export function SiteHeader({
  activeSection,
  theme,
  onTheme,
}: {
  activeSection: string;
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
}) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const cycle = () => onTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      navToggleRef.current?.focus();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <header className="site-header" ref={headerRef}>
      <a className="wordmark" href="#top" aria-label="Jerome Ibon, home">
        <span>JI</span>
        <small>JEYSIBN</small>
      </a>
      <nav
        id="primary-nav"
        className={open ? "site-nav is-open" : "site-nav"}
        aria-label="Primary navigation"
      >
        {primaryNav.map((item) => (
          <a
            key={item.label}
            href={`#${item.ids[0]}`}
            aria-current={
              (item.ids as readonly string[]).includes(activeSection) ? "location" : undefined
            }
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
        <a
          className="nav-resume"
          href="./resume.pdf"
          download="Jerome-Ibon-Resume.pdf"
          onClick={() => setOpen(false)}
        >
          Resume
        </a>
      </nav>
      <div className="header-tools">
        <a
          className="header-resume"
          href="./resume.pdf"
          download="Jerome-Ibon-Resume.pdf"
        >
          Resume
        </a>
        <button
          className="theme-switch"
          type="button"
          onClick={cycle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <span aria-hidden="true" />
          {theme}
        </button>
        <button
          ref={navToggleRef}
          className="nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-brand">JEYSIBN · Jerome Christian Ibon</p>
      <p>React + TypeScript</p>
      <VisitorCounter />
    </footer>
  );
}
