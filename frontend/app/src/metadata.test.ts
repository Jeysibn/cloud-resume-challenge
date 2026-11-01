import { describe, expect, it } from "vitest";
import template from "../index.html?raw";
import content from "../../../content/portfolio.json";

describe("AWS production metadata", () => {
  it("uses the intended public URL as canonical content", () => {
    expect(content.profile.portfolio).toBe("https://jeysibn.dev/");
  });

  it("uses shared URL placeholders rather than old hardcoded hosts", () => {
    const document = new DOMParser().parseFromString(template, "text/html");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("__PORTFOLIO_URL__");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("__PORTFOLIO_URL__");
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(document.querySelector(selector)?.getAttribute("content")).toBe("__PORTFOLIO_IMAGE_URL__");
    }
    expect(template).not.toContain("jeysibn.github.io");
    expect(template).toContain("Terraform");
    expect(template).toContain("GitHub Actions OIDC");
    expect(template).not.toContain("manually configured infrastructure");
  });

  it("links the live AWS Cloud Resume Challenge rather than the retired Azure deployment", () => {
    const project = content.projects.find(project => project.slug === "aws-cloud-resume-challenge")!;
    expect(project.title).toBe("AWS Cloud Resume Challenge");
    expect(project.statusLabel).toBe("AWS LIVE · V2");
    expect(project.repositoryUrl).toBe("https://github.com/Jeysibn/cloud-resume-challenge");
    expect(project.liveUrl).toBe("https://jeysibn.dev/");
    expect(project.details.technologies).toContain("AWS Lambda");
    expect(project.details.technologies).not.toContain("Azure Functions");
  });
});
