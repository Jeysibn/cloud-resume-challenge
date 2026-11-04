import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisitorCounter } from "./VisitorCounter";
import { fetchVisitorCount, registerVisit } from "../api";

vi.mock("../api", async original => ({
  ...await original<typeof import("../api")>(),
  fetchVisitorCount: vi.fn(),
  registerVisit: vi.fn(),
}));

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
  vi.mocked(registerVisit).mockResolvedValue({ counted: true, count: 42 });
  vi.mocked(fetchVisitorCount).mockResolvedValue(42);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("automatically registers on mount and displays the returned count", async () => {
  render(<VisitorCounter />);
  expect(screen.getByText(/Recorded visits · loading/)).toBeInTheDocument();
  await screen.findByText(/Recorded visits · 42/);
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Record My Visit/ })).not.toBeInTheDocument();
});

it("only registers once when StrictMode replays the mount effect", async () => {
  render(<StrictMode><VisitorCounter /></StrictMode>);
  await screen.findByText(/Recorded visits · 42/);
  expect(registerVisit).toHaveBeenCalledTimes(1);
});

it("falls back to GET when automatic registration fails", async () => {
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("POST failed"));
  vi.mocked(fetchVisitorCount).mockResolvedValueOnce(41);
  render(<VisitorCounter />);
  await screen.findByText(/Recorded visits · 41/);
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("Retry only re-reads the count after registration and fallback read fail", async () => {
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("POST failed"));
  vi.mocked(fetchVisitorCount).mockRejectedValueOnce(Error("GET failed")).mockResolvedValueOnce(42);
  render(<VisitorCounter />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText(/Recorded visits · 42/);
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(fetchVisitorCount).toHaveBeenCalledTimes(2);
});

it("does not call the API when the base URL is missing", () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  render(<VisitorCounter />);
  expect(screen.getByText(/not configured/)).toBeInTheDocument();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).not.toHaveBeenCalled();
});

it("aborts a retry GET when unmounted", async () => {
  let finish!: (count: number) => void;
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("POST failed"));
  vi.mocked(fetchVisitorCount).mockImplementationOnce((_signal?: AbortSignal) => new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<VisitorCounter />);
  await screen.findByText(/Recorded visits · loading/);
  const signal = vi.mocked(fetchVisitorCount).mock.calls[0][0];
  unmount();
  expect(signal?.aborted).toBe(true);
  finish(42);
});
