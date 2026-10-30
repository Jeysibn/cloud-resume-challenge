import { describe, expect, it } from "vitest";
import { projects } from "./portfolio";
import { projectFromSearch } from "./projectNavigation";

describe("portfolio project deep links", () => {
  it("resolves canonical project slugs used by assistant navigation", () => {
    expect(projectFromSearch("?project=cloud-portfolio")).toBe(projects[0]);
    expect(projectFromSearch("?project=homelab-gitops")).toBe(projects[1]);
    expect(projectFromSearch("?project=monikey")).toBe(projects[2]);
    expect(projectFromSearch("?project=noc-report")).toBe(projects[3]);
  });

  it("fails gracefully for an invalid project slug", () => {
    expect(projectFromSearch("?project=not-a-project")).toBeNull();
  });
});
