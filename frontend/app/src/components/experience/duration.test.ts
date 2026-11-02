import { describe, expect, it } from "vitest";
import { isCurrent, periodLength } from "./duration";

describe("periodLength", () => {
  const today = new Date(2026, 10, 2); // 2 November 2026

  it("counts both end months, like LinkedIn", () => {
    expect(periodLength("August 2025 – February 2026", today)).toBe("7 mos");
    expect(periodLength("March 2025 – May 2025", today)).toBe("3 mos");
    expect(periodLength("May 2025 – May 2025", today)).toBe("1 mo");
  });

  it("measures a current role up to this month and formats years", () => {
    expect(periodLength("July 2026 – Present", today)).toBe("5 mos");
    expect(periodLength("January 2024 – February 2025", today)).toBe("1 yr 2 mos");
    expect(periodLength("January 2023 – December 2024", today)).toBe("2 yrs");
  });

  it("returns null for periods it cannot read", () => {
    expect(periodLength("Summer 2025", today)).toBeNull();
    expect(periodLength("Smarch 2025 – May 2025", today)).toBeNull();
  });

  it("recognises the current role", () => {
    expect(isCurrent("July 2026 – Present")).toBe(true);
    expect(isCurrent("March 2025 – May 2025")).toBe(false);
  });
});
