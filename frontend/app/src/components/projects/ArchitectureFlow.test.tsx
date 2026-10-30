import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { projects } from "../../portfolio";
import { ArchitectureFlow } from "./ArchitectureFlow";

afterEach(cleanup);

describe("architecture flow", () => {
  it("lists every repository-derived flow as an ordered list in source order", () => {
    const homelab = projects.find((project) => project.slug === "homelab-gitops")!;
    render(<ArchitectureFlow flows={homelab.details.architectureFlows} />);

    const flows = screen.getAllByRole("list");
    expect(flows).toHaveLength(homelab.details.architectureFlows.length);
    homelab.details.architectureFlows.forEach((flow, index) => {
      expect(screen.getByRole("heading", { name: flow.label })).toBeInTheDocument();
      expect(within(flows[index]).getAllByRole("listitem").map((item) => item.textContent)).toEqual(flow.nodes);
    });
  });

  it("renders nothing when a project has no flows", () => {
    const { container } = render(<ArchitectureFlow flows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
