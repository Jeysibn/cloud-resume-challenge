import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { skillGroups } from "../../portfolio";
import { SkillGroups } from "./SkillGroups";

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
});
