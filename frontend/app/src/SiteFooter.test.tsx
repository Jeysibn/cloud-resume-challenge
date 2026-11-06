import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SiteFooter } from "./components/SiteChrome";
import { VisitorCounter } from "./components/VisitorCounter";
import { fetchVisitorStatus, registerVisit } from "./api";

vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), fetchVisitorStatus: vi.fn(), registerVisit: vi.fn() }));
beforeEach(() => {
 vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
 window.localStorage.clear();
 vi.mocked(fetchVisitorStatus).mockResolvedValue({ count: 8, supportsBrowserRegistration: true });
 vi.mocked(registerVisit).mockResolvedValue({ counted: true, count: 9, returning: false });
});
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllEnvs();});

it("places an accessible privacy settings disclosure in the footer, outside the hero", async () => {
 render(<><VisitorCounter/><SiteFooter/></>);
 expect(await screen.findByText("9 recorded visits")).toBeInTheDocument();
 const summary = screen.getByText("Privacy Settings");
 expect(summary.closest("details")).toBeInTheDocument();
 fireEvent.click(summary);
 expect(screen.getByRole("button", { name: "Disable browser recognition" })).toBeInTheDocument();
 expect(registerVisit).toHaveBeenCalledTimes(1);
});

it("lets the visitor enable and disable recognition from the settings panel", async () => {
 render(<><VisitorCounter/><SiteFooter/></>);
 await screen.findByText("9 recorded visits");
 fireEvent.click(screen.getByText("Privacy Settings"));
 fireEvent.click(screen.getByRole("button", { name: "Disable browser recognition" }));
 expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("declined");
 expect(screen.getByText(/Browser recognition is disabled/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Enable browser recognition" }));
 expect(window.localStorage.getItem("jeysibn.visitor-counting-consent.v1")).toBe("accepted");
 expect(screen.getByText("enabled")).toBeInTheDocument();
 await vi.waitFor(() => expect(registerVisit).toHaveBeenCalled());
});

it("removes the saved UUID when disabling recognition", () => {
 window.localStorage.setItem("jeysibn.visitor-id.v1", "123e4567-e89b-42d3-a456-426614174000");
 render(<SiteFooter/>);
 fireEvent.click(screen.getByText("Privacy Settings"));
 fireEvent.click(screen.getByRole("button", { name: "Disable browser recognition" }));
 expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
});

it("does not register without affirmative preference under the opt-in policy", async () => {
 vi.stubEnv("VITE_VISITOR_RECOGNITION_POLICY", "opt-in");
 render(<><VisitorCounter/><SiteFooter/></>);
 expect(await screen.findByText("8 recorded visits")).toBeInTheDocument();
 expect(registerVisit).not.toHaveBeenCalled();
 expect(window.localStorage.getItem("jeysibn.visitor-id.v1")).toBeNull();
});

it("aborts in-flight registration on disable and does not resume it", async () => {
 let resolveRegistration!: (result: { counted: boolean; count: number; returning: boolean }) => void;
 vi.mocked(registerVisit).mockReturnValueOnce(new Promise(resolve => { resolveRegistration = resolve; }));
 render(<><VisitorCounter/><SiteFooter/></>);
 await vi.waitFor(() => expect(registerVisit).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByText("Privacy Settings"));
 fireEvent.click(screen.getByRole("button", { name: "Disable browser recognition" }));
 await vi.waitFor(() => expect(vi.mocked(registerVisit).mock.calls[0][1]?.aborted).toBe(true));
 resolveRegistration({ counted: true, count: 99, returning: false });
 expect(await screen.findByText("8 recorded visits")).toBeInTheDocument();
 expect(registerVisit).toHaveBeenCalledTimes(1);
});

it("keeps recognition off for this page when localStorage operations fail", () => {
 vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
 render(<SiteFooter/>);
 fireEvent.click(screen.getByText("Privacy Settings"));
 fireEvent.click(screen.getByRole("button", { name: "Disable browser recognition" }));
 expect(screen.getByText(/storage could not save/)).toBeInTheDocument();
});
