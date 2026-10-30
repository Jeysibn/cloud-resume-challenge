import { describe, expect, it } from "vitest";
import { projectNavigationUrl, resolveAssistantLink } from "./assistantLinks";

describe("assistant link resolution", () => {
  it("maps same-site section sources to current-page hash links", () => {
    expect(
      resolveAssistantLink(
        { id: "professional-experience", label: "Professional experience", url: "https://jeysibn.github.io/#experience" },
        "https://jeysibn.github.io/",
      ),
    ).toEqual({ type: "section", label: "Professional experience", target: "experience" });

    expect(
      resolveAssistantLink(
        { id: "certifications", label: "Certifications", url: "https://jeysibn.github.io/#credentials-title" },
        "http://localhost:5173/",
      ),
    ).toEqual({ type: "section", label: "Certifications", target: "credentials" });

    expect(
      resolveAssistantLink(
        { id: "profile", label: "Portfolio profile", url: "https://jeysibn.github.io/" },
        "https://jeysibn.github.io/",
      ),
    ).toEqual({ type: "section", label: "Portfolio profile", target: "top" });
  });

  it("sends links to the removed #about section to the top of the page", () => {
    expect(
      resolveAssistantLink(
        { id: "approach", label: "Approach", url: "https://jeysibn.github.io/#about" },
        "https://jeysibn.github.io/",
      ),
    ).toEqual({ type: "section", label: "Approach", target: "top" });
  });

  it("maps approved project source IDs to canonical portfolio projects", () => {
    expect(
      resolveAssistantLink(
        { id: "project-monikey", label: "Untrusted label", url: "https://example.com/wrong" },
        "https://jeysibn.github.io/",
      ),
    ).toEqual({
      type: "project",
      label: "MoniKey",
      projectSlug: "monikey",
      repositoryUrl: "https://github.com/Jeysibn/monikey",
    });

    expect(projectNavigationUrl("monikey", "https://jeysibn.github.io/#experience"))
      .toBe("/?project=monikey");
  });

  it("keeps unknown external repositories external and safely rejects malformed URLs", () => {
    expect(
      resolveAssistantLink(
        { id: "repository-homelab", label: "Homelab repository", url: "https://github.com/Jeysibn/homelab-gitops" },
        "https://jeysibn.github.io/",
      ),
    ).toEqual({
      type: "external",
      label: "Homelab repository",
      url: "https://github.com/Jeysibn/homelab-gitops",
    });

    expect(
      resolveAssistantLink(
        { id: "bad", label: "Bad link", url: "not a url" },
        "https://jeysibn.github.io/",
      ),
    ).toBeNull();

    expect(
      resolveAssistantLink(
        { id: "unknown", label: "Unknown section", url: "https://jeysibn.github.io/#not-a-section" },
        "https://jeysibn.github.io/",
      ),
    ).toBeNull();
  });
});
