import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisitorCounter } from "./VisitorCounter";
import { fetchVisitorStatus, registerVisit } from "../api";

vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), fetchVisitorStatus: vi.fn(), registerVisit: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
  vi.stubGlobal("crypto", { randomUUID: () => "123e4567-e89b-42d3-a456-426614174000" });
  window.localStorage.clear();
  vi.mocked(fetchVisitorStatus).mockResolvedValue({ count: 42, supportsBrowserRegistration: true });
  vi.mocked(registerVisit).mockResolvedValue({ counted: true, count: 43, returning: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("loads and registers automatically, without consent controls", async () => {
  render(<VisitorCounter />);
  await screen.findByText("43 recorded visits");
  expect(fetchVisitorStatus).toHaveBeenCalledTimes(1);
  expect(registerVisit).toHaveBeenCalledExactlyOnceWith("123e4567-e89b-42d3-a456-426614174000");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("deduplicates StrictMode effect replay and preserves the identifier", async () => {
  render(<StrictMode><VisitorCounter /></StrictMode>);
  await screen.findByText("43 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBe("123e4567-e89b-42d3-a456-426614174000");
});

it("keeps the portfolio usable when registration fails", async () => {
  vi.mocked(registerVisit).mockRejectedValue(new Error("offline"));
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
});
