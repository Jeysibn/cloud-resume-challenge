import { describe, expect, it } from "vitest";
import { projectNavigationUrl, resolveAssistantLink } from "./assistantLinks";

describe("assistant link resolution", () => {
  it("maps same-site section sources to current-page hash links", () => {
    expect(
      resolveAssistantLink(
        { id: "professional-experience", label: "Professional experience", url: "https://d31yy7ezo2w9ph.cloudfront.net/#experience" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({ type: "section", label: "Professional experience", target: "experience" });

    expect(
      resolveAssistantLink(
        { id: "certifications", label: "Certifications", url: "https://d31yy7ezo2w9ph.cloudfront.net/#credentials-title" },
        "http://localhost:5173/",
      ),
    ).toEqual({ type: "section", label: "Certifications", target: "credentials" });

    expect(
      resolveAssistantLink(
        { id: "profile", label: "Portfolio profile", url: "https://d31yy7ezo2w9ph.cloudfront.net/" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({ type: "section", label: "Portfolio profile", target: "top" });
  });

  it("sends links to the removed #about section to the top of the page", () => {
    expect(
      resolveAssistantLink(
        { id: "approach", label: "Approach", url: "https://d31yy7ezo2w9ph.cloudfront.net/#about" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({ type: "section", label: "Approach", target: "top" });
  });

  it("sends links to the removed #resume section to Contact", () => {
    expect(
      resolveAssistantLink(
        { id: "resume", label: "Resume", url: "https://d31yy7ezo2w9ph.cloudfront.net/#resume" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({ type: "section", label: "Resume", target: "contact" });
  });

  it("maps approved project source IDs to canonical portfolio projects", () => {
    expect(
      resolveAssistantLink(
        { id: "project-monikey", label: "Untrusted label", url: "https://example.com/wrong" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({
      type: "project",
      label: "MoniKey",
      projectSlug: "monikey",
      repositoryUrl: "https://github.com/Jeysibn/monikey",
    });

    expect(projectNavigationUrl("monikey", "https://d31yy7ezo2w9ph.cloudfront.net/#experience"))
      .toBe("/?project=monikey");
  });

  it("keeps unknown external repositories external and safely rejects malformed URLs", () => {
    expect(
      resolveAssistantLink(
        { id: "repository-homelab", label: "Homelab repository", url: "https://github.com/Jeysibn/homelab-gitops" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toEqual({
      type: "external",
      label: "Homelab repository",
      url: "https://github.com/Jeysibn/homelab-gitops",
    });

    expect(
      resolveAssistantLink(
        { id: "bad", label: "Bad link", url: "not a url" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toBeNull();

    expect(
      resolveAssistantLink(
        { id: "unknown", label: "Unknown section", url: "https://d31yy7ezo2w9ph.cloudfront.net/#not-a-section" },
        "https://d31yy7ezo2w9ph.cloudfront.net/",
      ),
    ).toBeNull();
  });
});
