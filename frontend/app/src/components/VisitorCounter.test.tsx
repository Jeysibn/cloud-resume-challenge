import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisitorCounter } from "./VisitorCounter";
import { fetchVisitorCount, fetchVisitorStatus, registerVisit } from "../api";

vi.mock("../api", async original => ({
  ...await original<typeof import("../api")>(),
  fetchVisitorCount: vi.fn(),
  fetchVisitorStatus: vi.fn(),
  registerVisit: vi.fn(),
}));

let idSequence = 1;
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `123e4567-e89b-42d3-a456-${String(idSequence++).padStart(12, "0")}`) });
  window.localStorage.clear();
  vi.mocked(registerVisit).mockResolvedValue({ counted: true, count: 42, returning: false });
  vi.mocked(fetchVisitorCount).mockResolvedValue(42);
  vi.mocked(fetchVisitorStatus).mockResolvedValue({ count: 42, supportsBrowserRegistration: true });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("shows the public count without creating an identifier before opt-in", async () => {
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(screen.getByText(/Portfolio owner Jerome Ibon/)).toBeInTheDocument();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorStatus).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("registers only after opt-in and keeps the chosen identifier", async () => {
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  fireEvent.click(screen.getByRole("button", { name: "Allow anonymous counting" }));
  await screen.findByRole("button", { name: "Turn off visit counting" });
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorStatus).toHaveBeenCalledTimes(1);
  const visitorId = window.localStorage.getItem("jeysibn.visitor-id.v1");
  expect(visitorId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(vi.mocked(registerVisit).mock.calls[0][0]).toBe(visitorId);
  expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("accepted");
});

it("reuses stored consent and identifier on a later mount", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174010");
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).toHaveBeenCalledExactlyOnceWith("123e4567-e89b-42d3-a456-426614174010");
  expect(fetchVisitorStatus).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).not.toHaveBeenCalled();
});

it("does not duplicate a registration when StrictMode replays the effect", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174011");
  render(<StrictMode><VisitorCounter /></StrictMode>);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorStatus).toHaveBeenCalledTimes(2);
});

it("turns off tracking and removes the persistent identifier", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174012");
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));
  await screen.findByRole("button", { name: "Enable anonymous counting" });
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
  expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("declined");
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("does not POST to a legacy backend that lacks browser registration support", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174016");
  vi.mocked(fetchVisitorStatus).mockResolvedValueOnce({
    count: 42,
    supportsBrowserRegistration: false,
  });
  render(<VisitorCounter />);
  await screen.findByText(/does not support browser registration yet/);
  expect(screen.getByText("42 recorded visits")).toBeInTheDocument();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).not.toHaveBeenCalled();
});

it("falls back to GET without POST when capability detection fails", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174017");
  vi.mocked(fetchVisitorStatus).mockRejectedValueOnce(Error("GET unavailable"));
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("falls back to GET when registration fails", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174013");
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("POST failed"));
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("retry reads the public count without repeating registration", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174014");
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("POST failed"));
  vi.mocked(fetchVisitorCount).mockRejectedValueOnce(Error("GET failed")).mockResolvedValueOnce(43);
  render(<VisitorCounter />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry reading count" }));
  await screen.findByText("43 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).toHaveBeenCalledTimes(2);
});

it("keeps the public count available when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked"); });
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  fireEvent.click(screen.getByRole("button", { name: "Allow anonymous counting" }));
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

it("falls back to GET and explains when saved consent cannot be read", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174015");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked"); });
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

it("does not call the API when the base URL is missing", () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  render(<VisitorCounter />);
  expect(screen.getByText("Recorded visits unavailable")).toBeInTheDocument();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).not.toHaveBeenCalled();
});
