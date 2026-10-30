import { projects } from "./portfolio";

export function projectFromSearch(search: string) {
  const slug = new URLSearchParams(search).get("project");
  return projects.find((project) => project.slug === slug) ?? null;
}
