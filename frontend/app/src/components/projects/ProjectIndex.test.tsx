import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projects } from "../../portfolio";
import { ProjectIndex } from "./ProjectIndex";

afterEach(cleanup);

describe("project index", () => {
  it("shows all four canonical projects without any selector or hover", () => {
    render(<ProjectIndex projects={projects} onInspect={vi.fn()} />);

    for (const project of projects) {
      expect(screen.getByRole("heading", { level: 4, name: project.title })).toBeVisible();
      expect(screen.getByText(project.preview.summary)).toBeVisible();
      expect(screen.getByText(project.preview.primaryOutcome)).toBeVisible();
    }
    expect(screen.getAllByRole("button", { name: /^View case study:/ })).toHaveLength(projects.length);
  });

  it("features Homelab GitOps and AWS Cloud Resume Challenge and lists the others as in progress", () => {
    render(<ProjectIndex projects={projects} onInspect={vi.fn()} />);

    const [featured, building] = screen.getAllByRole("list").filter((list) =>
      list.classList.contains("project-list"),
    );
    expect(within(featured).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "AWS Cloud Resume Challenge",
      "Homelab GitOps Environment",
    ]);
    expect(within(building).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "MoniKey",
      "NOC Report Builder",
    ]);
    expect(screen.getByRole("heading", { level: 3, name: "Selected work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Currently building" })).toBeInTheDocument();
  });

  it("opens the matching case study and keeps public repository links", () => {
    const onInspect = vi.fn();
    render(<ProjectIndex projects={projects} onInspect={onInspect} />);

    fireEvent.click(screen.getByRole("button", { name: "View case study: MoniKey" }));
    expect(onInspect).toHaveBeenCalledWith(projects.find((project) => project.slug === "monikey"));

    for (const project of projects) {
      expect(
        screen.getByRole("link", { name: `${project.title} source repository (opens in a new tab)` }),
      ).toHaveAttribute("href", project.repositoryUrl);
    }
  });

  it("links the live site only for the project that has one", () => {
    render(<ProjectIndex projects={projects} onInspect={vi.fn()} />);

    const live = screen.getAllByRole("link", { name: /live site/ });
    expect(live).toHaveLength(projects.filter((project) => project.liveUrl).length);
    expect(live[0]).toHaveAttribute("href", "https://jeysibn.dev/");
  });
});
