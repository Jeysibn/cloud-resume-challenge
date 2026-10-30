import appSource from "../App.tsx?raw";
import { expect, it } from "vitest";
it("does not render the unavailable assistant in AWS version 1", () => {
  expect(appSource).not.toContain("PortfolioAssistant");
});
