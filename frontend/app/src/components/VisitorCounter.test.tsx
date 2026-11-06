import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisitorCounter } from "./VisitorCounter";
import { fetchVisitorStatus, registerVisit } from "../api";

vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), fetchVisitorStatus: vi.fn(), registerVisit: vi.fn() }));
const UUID = "123e4567-e89b-42d3-a456-426614174000";
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
  vi.stubGlobal("crypto", { randomUUID: () => UUID });
  window.localStorage.clear();
  vi.mocked(registerVisit).mockResolvedValue({ counted: true, count: 43, returning: false });
  vi.mocked(fetchVisitorStatus).mockResolvedValue({ count: 42, supportsBrowserRegistration: true });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("loads the count and registers automatically without hero controls", async () => {
  render(<VisitorCounter />);
  await screen.findByText("43 recorded visits");
  expect(fetchVisitorStatus).toHaveBeenCalled();
  expect(registerVisit).toHaveBeenCalledExactlyOnceWith(UUID);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("deduplicates StrictMode replay but registers again after a later remount", async () => {
  const first = render(<StrictMode><VisitorCounter /></StrictMode>);
  await screen.findByText("43 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);
  first.unmount();
  render(<VisitorCounter />);
  await vi.waitFor(() => expect(registerVisit).toHaveBeenCalledTimes(2));
});

it("replaces an invalid stored UUID with a canonical UUID v4", async () => {
  window.localStorage.setItem("jeysibn.visitor-id.v1", "not-a-uuid");
  render(<VisitorCounter />);
  await screen.findByText("43 recorded visits");
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBe(UUID);
  expect(registerVisit).toHaveBeenCalledExactlyOnceWith(UUID);
});

it("does not track when localStorage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
});

it("honors a legacy saved decline without showing consent controls", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "declined");
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("uses legacy backend capability detection for display only", async () => {
  vi.mocked(fetchVisitorStatus).mockResolvedValue({ count: 77, supportsBrowserRegistration: false });
  render(<VisitorCounter />);
  await screen.findByText("77 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
});

it("keeps a successful GET count visible when POST fails", async () => {
  vi.mocked(registerVisit).mockRejectedValue(new Error("offline"));
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
});

it("offers a GET-only retry after initial API failure", async () => {
  vi.mocked(fetchVisitorStatus).mockRejectedValueOnce(new Error("offline"));
  render(<VisitorCounter />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorStatus).toHaveBeenCalledTimes(2);
});
