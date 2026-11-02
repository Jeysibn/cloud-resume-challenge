import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { skillGroups } from "../../portfolio";
import { SkillGroups } from "./SkillGroups";
import { skillMarks } from "./skillMarks";
import sprite from "../../../public/skill-icons.svg?raw";

afterEach(cleanup);

describe("skill groups", () => {
  it("lists every canonical group and skill as readable text", () => {
    render(<SkillGroups onOpen={vi.fn()} />);

    for (const group of skillGroups) {
      expect(screen.getByRole("heading", { level: 3, name: group.label })).toBeVisible();
      for (const item of group.items) {
        expect(screen.getByRole("button", { name: `${item} — inspect ${group.label}` })).toBeVisible();
      }
    }
    expect(document.querySelectorAll(".skill-chip")).toHaveLength(
      skillGroups.reduce((total, group) => total + group.items.length, 0),
    );
  });

  it("opens a skill or a whole group for inspection", () => {
    const onOpen = vi.fn();
    render(<SkillGroups onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /^Terraform — inspect/ }));
    expect(onOpen).toHaveBeenCalledWith({
      group: skillGroups.find((group) => group.label === "Infrastructure & delivery"),
      item: "Terraform",
    });

    fireEvent.click(screen.getByRole("button", { name: "Group details: Observability" }));
    expect(onOpen).toHaveBeenLastCalledWith({
      group: skillGroups.find((group) => group.label === "Observability"),
    });
  });

  it("draws the four layers bottom-up between the two cross-cutting pillars", () => {
    render(<SkillGroups onOpen={vi.fn()} />);

    const order = Array.from(document.querySelectorAll(".skill-group"), (group) => [
      group.classList.contains("skill-pillar") ? "pillar" : "layer",
      group.querySelector("h3")?.textContent,
      group.querySelector(".skill-group-place")?.textContent,
    ]);
    expect(order).toEqual([
      ["pillar", "Scripting, security & tools", "Across every layer"],
      ["layer", "Infrastructure & delivery", "Layer 4"],
      ["layer", "Containers & orchestration", "Layer 3"],
      ["layer", "Cloud & virtualization", "Layer 2"],
      ["layer", "Systems & networking", "Layer 1"],
      ["pillar", "Observability", "Across every layer"],
    ]);
  });

  it("gives every skill a decorative mark that exists in the sprite", () => {
    for (const group of skillGroups) {
      for (const item of group.items) {
        const mark = skillMarks[item];
        expect(mark, item).toBeDefined();
        if (mark.kind === "logo") expect(sprite, item).toContain(`<symbol id="${mark.id}"`);
      }
    }

    render(<SkillGroups onOpen={vi.fn()} />);
    for (const mark of document.querySelectorAll(".skill-mark")) {
      expect(mark).toHaveAttribute("aria-hidden", "true");
    }
  });
});
