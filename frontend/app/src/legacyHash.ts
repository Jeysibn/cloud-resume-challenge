import { useEffect } from "react";

/**
 * Anchors that older links or assistant replies may still use, mapped to the
 * section that now holds the closest content. The About section was removed
 * (docs/redesign/DECISIONS.md D21); its identity content lives at the top. The
 * Resume section was removed (D31); the resume links now live in the hero,
 * header and Contact.
 */
const LEGACY_HASHES: Record<string, string> = {
  about: "top",
  resume: "contact",
  "credentials-title": "credentials",
};

export function resolveLegacyHash(hash: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  return LEGACY_HASHES[id] ?? null;
}

function redirectLegacyHash() {
  const target = resolveLegacyHash(window.location.hash);
  if (!target) return;
  const url = new URL(window.location.href);
  url.hash = target;
  window.history.replaceState(window.history.state, "", url);
  document.getElementById(target)?.scrollIntoView();
}

export function useLegacyHashRedirect() {
  useEffect(() => {
    redirectLegacyHash();
    window.addEventListener("hashchange", redirectLegacyHash);
    return () => window.removeEventListener("hashchange", redirectLegacyHash);
  }, []);
}
