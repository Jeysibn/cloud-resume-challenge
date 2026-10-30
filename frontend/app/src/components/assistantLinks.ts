import type { ChatSource } from "../portfolio";
import { portfolioUrl, projects } from "../portfolio";

export type AssistantLink =
  | { type: "section"; label: string; target: string }
  | { type: "project"; label: string; projectSlug: string; repositoryUrl: string }
  | { type: "external"; label: string; url: string };

const SECTION_IDS = new Set([
  "top",
  "projects",
  "experience",
  "skills",
  "credentials",
  "resume",
  "contact",
]);

const LEGACY_SECTION_IDS: Record<string, string> = {
  about: "top",
  "credentials-title": "credentials",
};

const SOURCE_SECTION_TARGETS: Record<string, string> = {
  profile: "top",
  "professional-experience": "experience",
  education: "credentials",
  certifications: "credentials",
};

const canonicalPortfolio = new URL(portfolioUrl);

export function projectNavigationUrl(
  projectSlug: string,
  currentUrl = typeof window === "undefined" ? portfolioUrl : window.location.href,
) {
  const url = new URL(currentUrl);
  url.searchParams.set("project", projectSlug);
  url.hash = "";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveAssistantLink(
  source: ChatSource,
  currentUrl = typeof window === "undefined" ? portfolioUrl : window.location.href,
): AssistantLink | null {
  const project = projects.find((candidate) => source.id === `project-${candidate.slug}`);
  if (project) {
    return {
      type: "project",
      label: project.title,
      projectSlug: project.slug,
      repositoryUrl: project.repositoryUrl,
    };
  }

  if (/\s/.test(source.url)) return null;

  let url: URL;
  try {
    url = new URL(source.url, currentUrl);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(url.protocol)) return null;

  const current = new URL(currentUrl);
  const isPortfolioPage =
    (url.origin === current.origin && url.pathname === current.pathname) ||
    (url.origin === canonicalPortfolio.origin && url.pathname === canonicalPortfolio.pathname);

  if (isPortfolioPage) {
    let rawTarget: string;
    try {
      rawTarget = decodeURIComponent(url.hash.slice(1));
    } catch {
      return null;
    }
    const target = SOURCE_SECTION_TARGETS[source.id] ?? LEGACY_SECTION_IDS[rawTarget] ?? rawTarget;
    if (SECTION_IDS.has(target)) {
      return { type: "section", label: source.label, target };
    }
    if (!rawTarget && url.origin === canonicalPortfolio.origin && url.pathname === canonicalPortfolio.pathname) {
      return { type: "section", label: source.label, target: "top" };
    }
    return null;
  }

  return { type: "external", label: source.label, url: url.href };
}
