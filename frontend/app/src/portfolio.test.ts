import { describe, expect, it } from "vitest";
import { navigation, projects } from "./portfolio";

describe("portfolio content contract", () => {
  it("keeps the section order with no About or Resume section", () => {
    expect(navigation.map((item) => item.id)).toEqual([
      "projects",
      "experience",
      "skills",
      "credentials",
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

it("describes the live AWS V2 project and retains MoniKey diagram paths", () => {
  const portfolio = projects.find(project => project.slug === "aws-cloud-resume-challenge")!;
  expect(portfolio.statusLabel).toBe("AWS LIVE · V2");
  expect(portfolio.repositoryUrl).toBe("https://github.com/Jeysibn/cloud-resume-challenge");
  expect(portfolio.details.summary).toContain("Terraform");
  expect(portfolio.details.technologies).toContain("DynamoDB");
  expect(portfolio.details.technologies).not.toContain("Azure Functions");
  const monikey = projects.find(project => project.slug === "monikey")!;
  expect(monikey.architecture.diagrams.map(diagram => diagram.svg)).toEqual([
    "/architecture/monikey/application.svg",
    "/architecture/monikey/gitops.svg",
    "/architecture/monikey/database.svg",
  ]);
});
