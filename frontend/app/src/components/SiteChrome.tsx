import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { ThemeOrigin } from "../hooks";
import type { ThemePreference } from "../portfolio";
import { updateRecognitionPreference, useRecognitionPreference } from "../visitorRecognition";
import { JiMark } from "./hero/Monogram";

/**
 * One header destination per numbered section (01-05), in page order. A
 * destination is current while any of its sections is active.
 */
const primaryNav = [
  { label: "Work", ids: ["projects"] },
  { label: "Experience", ids: ["experience"] },
  { label: "Toolkit", ids: ["skills"] },
  { label: "Credentials", ids: ["credentials"] },
  { label: "Contact", ids: ["contact"] },
] as const;

export function SiteHeader({
  activeSection,
  theme,
  onTheme,
}: {
  activeSection: string;
  theme: ThemePreference;
  onTheme: (t: ThemePreference, origin?: ThemeOrigin) => void;
}) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const cycle = (event: MouseEvent<HTMLButtonElement>) => {
    // The new theme spreads from the switch's glyph (or the button on small screens).
    const glyph = event.currentTarget.querySelector("span") ?? event.currentTarget;
    const rect = glyph.getBoundingClientRect();
    onTheme(theme === "dark" ? "light" : "dark", {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

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
        <JiMark className="wordmark-mark" />
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
      </nav>
      <div className="header-tools">
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
  const preference = useRecognitionPreference();
  const enabled = preference.startsWith("1:");
  const previouslyDeclined = preference.endsWith(":1");
  const [message, setMessage] = useState("");
  const optInRequired = import.meta.env.VITE_VISITOR_RECOGNITION_POLICY === "opt-in";

  function setRecognition(next: boolean) {
    const saved = updateRecognitionPreference(next);
    setMessage(saved
      ? next ? "Browser recognition is enabled." : "Browser recognition is disabled. A request already sent may finish; stored server records expire after 90 days of inactivity."
      : next ? "The preference could not be saved, so recognition remains off for this page." : "Recognition is off for this page, but browser storage could not save the preference or remove the browser ID.");
  }

  return (
    <footer className="site-footer">
      <p className="footer-brand">JEYSIBN · Jerome Christian Ibon</p>
      <p>React + TypeScript</p>
      <details className="privacy-settings">
        <summary>Privacy Settings</summary>
        <section aria-labelledby="privacy-settings-title">
          <h2 id="privacy-settings-title">Visitor recognition</h2>
          <p>The public aggregate count loads without creating a browser identifier. When recognition is enabled, this site stores a random UUID in localStorage and sends it to the visitor API to recognize this browser on later visits. It does not identify a person.</p>
          <p>The backend stores a keyed HMAC digest and limited visit metadata, not the raw UUID. Records have a 90-day inactivity retention deadline; DynamoDB removes expired records asynchronously. The total is recorded eligible visits, not unique people.</p>
          <p>Disabling recognition removes the local UUID when possible. A request already sent may complete, and disabling does not immediately delete the retained server record.</p>
          {optInRequired && <p>Recognition requires your affirmative choice under the current site policy.</p>}
          <p>Current preference: <strong>{enabled ? "enabled" : "disabled"}</strong>{previouslyDeclined ? " (your earlier choice is preserved)" : ""}</p>
          {enabled
            ? <button type="button" className="visitor-text-button" onClick={() => setRecognition(false)}>Disable browser recognition</button>
            : <button type="button" className="visitor-text-button" onClick={() => setRecognition(true)}>Enable browser recognition</button>}
          {message && <p role="status">{message}</p>}
        </section>
      </details>
    </footer>
  );
}
