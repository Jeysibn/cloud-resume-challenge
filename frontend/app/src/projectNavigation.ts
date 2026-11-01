import { projects } from "./portfolio";

export function projectFromSearch(search: string) {
  const slug = new URLSearchParams(search).get("project");
  // Preserve links shared before the AWS V2 case-study rename.
  const canonicalSlug = slug === "cloud-portfolio" ? "aws-cloud-resume-challenge" : slug;
  return projects.find((project) => project.slug === canonicalSlug) ?? null;
}
