import { describe, expect, it } from "vitest";
import { navigation, projects } from "./portfolio";

describe("portfolio content contract", () => {
  it("keeps the section order and no longer has an About section", () => {
    expect(navigation.map((item) => item.id)).toEqual([
      "projects",
      "experience",
      "skills",
      "credentials",
      "resume",
      "contact",
    ]);
  });

  it("keeps every project linked to a real repository and architecture evidence", () => {
    expect(projects).toHaveLength(4);
    for (const project of projects) {
      expect(project.slug).toBeTruthy();
      expect(project.repositoryUrl).toMatch(/^https:\/\/github\.com\//);
      expect(project.architecture.diagrams.length).toBeGreaterThan(0);
      expect(project.details.outcomes.length).toBeGreaterThan(0);
      expect(project.preview.flow.nodes.length).toBeGreaterThan(1);
    }
  });
});
