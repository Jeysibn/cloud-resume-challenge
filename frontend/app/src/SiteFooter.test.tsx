import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "./components/SiteChrome";
import { fetchHealth, fetchVisitorCount } from "./api";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchHealth: vi.fn(),
  fetchVisitorCount: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("site footer", () => {
  it("shows the API status and visitor count outside the hero", async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: "healthy",
      service: "portfolio-api",
      version: "test",
      revision: "",
      environment: "",
    });
    vi.mocked(fetchVisitorCount).mockResolvedValue(42);

    render(<SiteFooter />);

    expect(screen.getByText("JEYSIBN · Jerome Christian Ibon")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/API online/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Visitors · 42/)).toBeInTheDocument());
  });

  it("reports an unavailable API with text, not color alone", async () => {
    vi.mocked(fetchHealth).mockRejectedValue(new Error("down"));
    vi.mocked(fetchVisitorCount).mockRejectedValue(new Error("down"));

    render(<SiteFooter />);

    await waitFor(() => expect(screen.getByText(/API unavailable/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Visitors · unavailable/)).toBeInTheDocument());
  });
});
