import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("shows the public count without creating an identifier before opt-in", async () => {
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(screen.getByText(/Used for aggregate visit counting/)).toBeInTheDocument();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorStatus).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("keeps GET-only display when a declined preference is loaded", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "declined");
  render(<VisitorCounter />);

  await screen.findByText("42 recorded visits");

  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
  expect(fetchVisitorStatus).not.toHaveBeenCalled();
  expect(registerVisit).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
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

it("replaces a non-canonical stored UUID so the backend contract stays valid", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123E4567-E89B-42D3-A456-426614174010");
  render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  await vi.waitFor(() => expect(registerVisit).toHaveBeenCalledTimes(1));
  const replacement = window.localStorage.getItem("jeysibn.visitor-id.v1");
  expect(replacement).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(replacement).not.toBe("123E4567-E89B-42D3-A456-426614174010");
  expect(registerVisit).toHaveBeenCalledExactlyOnceWith(replacement);
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
  expect(screen.getByText(/A request already sent before you turned it off may still complete/)).toBeInTheDocument();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
});

it("keeps the page opted out if a registration sent before opt-out later resolves", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174027");
  let resolveRegistration!: (result: { counted: boolean; count: number; returning: boolean }) => void;
  vi.mocked(registerVisit).mockReturnValueOnce(new Promise(resolve => { resolveRegistration = resolve; }));
  render(<VisitorCounter />);

  await vi.waitFor(() => expect(registerVisit).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));
  await screen.findByRole("button", { name: "Enable anonymous counting" });

  await act(async () => {
    resolveRegistration({ counted: true, count: 43, returning: false });
  });

  expect(screen.getByRole("button", { name: "Enable anonymous counting" })).toBeInTheDocument();
  expect(screen.getByText(/A request already sent before you turned it off may still complete/)).toBeInTheDocument();
  expect(screen.queryByText("43 recorded visits")).not.toBeInTheDocument();
  expect(registerVisit).toHaveBeenCalledTimes(1);
});

it("does not start registration when consent is withdrawn while capability lookup is pending", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174020");
  let resolveStatus!: (value: { count: number; supportsBrowserRegistration: boolean }) => void;
  vi.mocked(fetchVisitorStatus).mockReturnValueOnce(new Promise(resolve => { resolveStatus = resolve; }));
  render(<VisitorCounter />);

  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));
  await screen.findByRole("button", { name: "Enable anonymous counting" });
  resolveStatus({ count: 42, supportsBrowserRegistration: true });
  await Promise.resolve();

  expect(registerVisit).not.toHaveBeenCalled();
});

it("keeps tracking off for this page and saves the choice when ID removal fails", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174021");
  render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Turn off visit counting" });
  const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new DOMException("Blocked");
  });

  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));

  await screen.findByRole("button", { name: "Enable anonymous counting" });
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("declined");
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBe("123e4567-e89b-42d3-a456-426614174021");
  expect(screen.getByText(/could not remove/i)).toBeInTheDocument();
  removeItem.mockRestore();
});

it("does not resume tracking after decline persistence fails but ID removal succeeds", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174022");
  const view = render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Turn off visit counting" });
  const originalSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === "jeysibn.visitor-counting-consent.v1" && value === "declined") {
      throw new DOMException("Blocked");
    }
    return originalSetItem.call(this, key, value);
  });

  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));

  await screen.findByRole("button", { name: "Enable anonymous counting" });
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
  expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("accepted");
  expect(screen.getByText(/may not stay off after reload/i)).toBeInTheDocument();
  const registrationCount = vi.mocked(registerVisit).mock.calls.length;

  view.unmount();
  render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Allow anonymous counting" });
  expect(registerVisit).toHaveBeenCalledTimes(registrationCount);
});

it("fails closed when both opt-out storage operations fail", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174023");
  render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Turn off visit counting" });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("Blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked"); });

  fireEvent.click(screen.getByRole("button", { name: "Turn off visit counting" }));

  await screen.findByRole("button", { name: "Enable anonymous counting" });
  expect(registerVisit).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("accepted");
  expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBe("123e4567-e89b-42d3-a456-426614174023");
  expect(screen.getByText(/may not stay off after reload/i)).toBeInTheDocument();
});

it("does not register stored acceptance when storage is readable but not writable", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174024");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked"); });
  render(<VisitorCounter />);

  await screen.findByText("42 recorded visits");
  expect(registerVisit).not.toHaveBeenCalled();
  expect(fetchVisitorCount).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

it("retries a rejected registration after the component remounts", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174025");
  vi.mocked(registerVisit).mockRejectedValueOnce(Error("Transient failure"));
  const view = render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);

  view.unmount();
  render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Turn off visit counting" });
  expect(registerVisit).toHaveBeenCalledTimes(2);
});

it("allows a new eligible registration after the successful cache window", async () => {
  window.localStorage.setItem("jeysibn.visitor-counting-consent.v1", "accepted");
  window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174026");
  let now = 10_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const view = render(<VisitorCounter />);
  await screen.findByText("42 recorded visits");
  expect(registerVisit).toHaveBeenCalledTimes(1);

  view.unmount();
  now += 86_400_001;
  render(<VisitorCounter />);
  await screen.findByRole("button", { name: "Turn off visit counting" });
  expect(registerVisit).toHaveBeenCalledTimes(2);
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
