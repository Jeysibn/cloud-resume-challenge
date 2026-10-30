import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisitorCounter } from "./VisitorCounter";
import { fetchVisitorCount, recordVisit } from "../api";
vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), fetchVisitorCount:vi.fn(), recordVisit:vi.fn() }));
beforeEach(() => { vi.stubEnv("VITE_API_BASE_URL","https://example.test"); vi.mocked(fetchVisitorCount).mockResolvedValue(42); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); });
it("GET on mount without POST", async () => {
 render(<VisitorCounter/>); expect(screen.getByText(/loading/)).toBeInTheDocument(); await screen.findByText(/Recorded visits · 42/); expect(recordVisit).not.toHaveBeenCalled();
});
it("manually retries failed GET", async () => {
 vi.mocked(fetchVisitorCount).mockRejectedValueOnce(Error()); render(<VisitorCounter/>); await screen.findByRole("alert");
 fireEvent.click(screen.getByText("Retry")); await screen.findByText(/Recorded visits · 42/); expect(fetchVisitorCount).toHaveBeenCalledTimes(2);
});
it("explicit POST prevents duplicates and refreshes", async () => {
 let finish!:()=>void; vi.mocked(recordVisit).mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(<VisitorCounter/>); await screen.findByText(/Recorded visits · 42/);
 fireEvent.click(screen.getByText("Record My Visit")); const button=screen.getByText("Recording…"); expect(button).toBeDisabled(); fireEvent.click(button);
 vi.mocked(fetchVisitorCount).mockResolvedValue(43); finish(); await screen.findByText(/Recorded visits · 43/); expect(recordVisit).toHaveBeenCalledTimes(1);
 expect(screen.getByText("Record My Visit")).toBeDisabled();
});
it("failed POST is never automatically retried", async () => {
 vi.mocked(recordVisit).mockRejectedValue(Error()); render(<VisitorCounter/>); await screen.findByText(/Recorded visits · 42/);
 fireEvent.click(screen.getByText("Record My Visit")); await screen.findByText(/Recording could not be confirmed/);
 fireEvent.click(screen.getByText("Retry")); await screen.findByText(/Recorded visits · 42/); expect(recordVisit).toHaveBeenCalledTimes(1);
});
it("missing config makes no calls", () => {
 vi.stubEnv("VITE_API_BASE_URL",""); render(<VisitorCounter/>); expect(screen.getByText(/not configured/)).toBeInTheDocument(); expect(fetchVisitorCount).not.toHaveBeenCalled();
});
it("aborts on unmount", () => {
 const {unmount}=render(<VisitorCounter/>); const signal=vi.mocked(fetchVisitorCount).mock.calls[0][0]; unmount(); expect(signal?.aborted).toBe(true);
});
it("cancels a pending POST on unmount", async () => {
 vi.mocked(recordVisit).mockImplementation(()=>new Promise<void>(()=>{}));
 const {unmount}=render(<VisitorCounter/>); await screen.findByText(/Recorded visits · 42/);
 fireEvent.click(screen.getByText("Record My Visit"));
 const signal=vi.mocked(recordVisit).mock.calls[0][0]; unmount(); expect(signal?.aborted).toBe(true);
});
it("keeps a successful recording locked when its GET refresh fails", async () => {
 vi.mocked(recordVisit).mockResolvedValue(); render(<VisitorCounter/>); await screen.findByText(/Recorded visits · 42/);
 vi.mocked(fetchVisitorCount).mockRejectedValueOnce(Error()); fireEvent.click(screen.getByText("Record My Visit"));
 await screen.findByRole("alert"); expect(screen.getByText("Your visit was recorded.")).toBeInTheDocument();
 expect(screen.getByText("Record My Visit")).toBeDisabled(); expect(recordVisit).toHaveBeenCalledTimes(1);
});
