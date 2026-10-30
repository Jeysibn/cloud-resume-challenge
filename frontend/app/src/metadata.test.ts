import { describe, expect, it } from "vitest";
import template from "../index.html?raw";
import content from "../../../content/portfolio.json";

describe("AWS production metadata", () => {
  it("uses the intended public URL as canonical content", () => {
    expect(content.profile.portfolio).toBe("https://d31yy7ezo2w9ph.cloudfront.net/");
  });

  it("uses shared URL placeholders rather than old hardcoded hosts", () => {
    const document = new DOMParser().parseFromString(template, "text/html");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("__PORTFOLIO_URL__");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("__PORTFOLIO_URL__");
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(document.querySelector(selector)?.getAttribute("content")).toBe("__PORTFOLIO_IMAGE_URL__");
    }
    expect(template).not.toContain("jeysibn.github.io");
    expect(template).not.toContain("Terraform-managed");
    expect(template).not.toContain("GitHub Actions delivery");
    expect(template).toContain("manually configured infrastructure");
  });

  it("preserves the Azure project URL as labeled historical work", () => {
    const project = content.projects.find(project => project.slug === "cloud-portfolio")!;
    expect(project.statusLabel).toBe("AZURE HISTORY");
    expect(project.liveUrl).toBe("https://jeysibn.github.io/");
  });
});
