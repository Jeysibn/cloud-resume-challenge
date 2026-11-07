import { cleanup, render, screen } from "@testing-library/react";
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

it("renders the footer without privacy controls while visitor registration runs automatically", async () => {
 render(<><VisitorCounter/><SiteFooter/></>);
 expect(await screen.findByText("9 recorded visits")).toBeInTheDocument();
 expect(screen.queryByText("Privacy Settings")).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: /recognition|counting/i })).not.toBeInTheDocument();
 expect(registerVisit).toHaveBeenCalledTimes(1);
});
