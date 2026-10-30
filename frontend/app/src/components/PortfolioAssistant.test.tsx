import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioAssistant } from "./PortfolioAssistant";

const mocks = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));

vi.mock("../api", () => ({
  fetchVisitorCount: vi.fn(),
  sendChatMessage: mocks.sendChatMessage,
  isChatRequestAborted: (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError",
}));

describe("portfolio assistant", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    mocks.sendChatMessage.mockReset();
  });

  it("keeps starter questions under visitor control", () => {
    render(<PortfolioAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /Ask this portfolio/ }));
    const question = "Tell me about MoniKey.";

    fireEvent.click(screen.getByRole("button", { name: question }));

    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(question);
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();
  });

  it("renders sources and usage returned by the API", async () => {
    const experienceSection = document.createElement("section");
    experienceSection.id = "experience";
    document.body.appendChild(experienceSection);
    const projectsSection = document.createElement("section");
    projectsSection.id = "projects";
    document.body.appendChild(projectsSection);
    mocks.sendChatMessage.mockResolvedValue({
      reply: "Jerome currently has four documented projects:\n\n- **Cloud-Backed Portfolio** — Azure Functions and Cosmos DB.\n- `MoniKey` — PostgreSQL-backed durable jobs.",
      sources: [
        { id: "profile", label: "Portfolio profile", url: "https://jeysibn.github.io/" },
        { id: "professional-experience", label: "Professional experience", url: "https://jeysibn.github.io/#experience" },
        { id: "certifications", label: "Certifications", url: "https://jeysibn.github.io/#credentials-title" },
        { id: "project-cloud-portfolio", label: "Cloud-Backed Portfolio", url: "https://github.com/Jeysibn/portfolio" },
        { id: "project-homelab-gitops", label: "Homelab GitOps", url: "https://github.com/Jeysibn/homelab-gitops" },
        { id: "project-monikey", label: "MoniKey", url: "https://github.com/Jeysibn/monikey" },
        { id: "project-noc-report", label: "NOC Report Builder", url: "https://github.com/Jeysibn/noc-report" },
        { id: "bad", label: "Bad link", url: "not a url" },
      ],
      usage: { limit: 10, remaining: 9 },
    });
    render(<PortfolioAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /Ask this portfolio/ }));
    const input = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(input, { target: { value: "Tell me about MoniKey." } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getByText("MoniKey", { selector: "code" })).toBeInTheDocument());
    const projectDescription = screen.getByText("Cloud-Backed Portfolio", { selector: "strong" });
    expect(projectDescription).toBeInTheDocument();
    expect(projectDescription.closest("ul")).toBeInTheDocument();
    expect(projectDescription.closest("strong")).toBeInTheDocument();
    expect(screen.getByText("MoniKey", { selector: "code" })).toBeInTheDocument();
    const experienceLink = screen.getByRole("link", { name: "Professional experience" });
    expect(experienceLink).toHaveAttribute("href", "#experience");
    expect(experienceLink).not.toHaveAttribute("target");
    fireEvent.click(experienceLink);
    expect(window.location.hash).toBe("#experience");
    expect(screen.getByRole("link", { name: "Certifications" })).toHaveAttribute("href", "#credentials");
    for (const [label, slug] of [
      ["Cloud-Backed Portfolio", "cloud-portfolio"],
      ["Homelab GitOps Environment", "homelab-gitops"],
      ["MoniKey", "monikey"],
      ["NOC Report Builder", "noc-report"],
    ]) {
      const projectLink = screen.getByRole("link", { name: label });
      expect(projectLink).toHaveAttribute("href", `/?project=${slug}`);
      expect(projectLink).not.toHaveAttribute("target");
      fireEvent.click(projectLink);
      expect(new URLSearchParams(window.location.search).get("project")).toBe(slug);
    }
    const repositoryLink = screen.getByRole("link", { name: "Open MoniKey repository on GitHub" });
    expect(repositoryLink).toHaveAttribute("href", "https://github.com/Jeysibn/monikey");
    expect(repositoryLink).toHaveAttribute("target", "_blank");
    expect(repositoryLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "Bad link" })).not.toBeInTheDocument();
    expect(screen.getByText("10 assistant questions per hour · 9 remaining")).toBeInTheDocument();
  });

  it("clears the conversation and restores the empty state", async () => {
    mocks.sendChatMessage.mockResolvedValue({ reply: "A grounded answer.", sources: [], usage: { limit: 10, remaining: 9 } });
    render(<PortfolioAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /Ask this portfolio/ }));
    const input = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(input, { target: { value: "Tell me about Jerome." } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("A grounded answer.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));

    expect(screen.queryByText("A grounded answer.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tell me about MoniKey." })).toBeInTheDocument();
    expect(within(screen.getByRole("log", { name: "Assistant conversation" })).getByText(/Ask about Jerome/)).toBeInTheDocument();
  });

  it("shows a controlled failure and can recover on a later request", async () => {
    mocks.sendChatMessage
      .mockRejectedValueOnce(new Error("The assistant request timed out. Please try again."))
      .mockResolvedValueOnce({ reply: "A recovered answer.", sources: [] });
    render(<PortfolioAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /Ask this portfolio/ }));
    const input = screen.getByRole("textbox", { name: "Your question" });

    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("The assistant request timed out. Please try again.")).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "Second question" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("A recovered answer.")).toBeInTheDocument());
  });

  it("cancels an active request without adding a provider error", async () => {
    let rejectRequest: ((error: unknown) => void) | undefined;
    mocks.sendChatMessage.mockImplementation(
      (_message: string, _history: unknown[], _session: string, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }),
    );
    render(<PortfolioAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /Ask this portfolio/ }));
    const input = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(input, { target: { value: "Cancel this question" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument());
    expect(screen.queryByText("The assistant request was cancelled.")).not.toBeInTheDocument();
    expect(input).toHaveValue("Cancel this question");
    expect(rejectRequest).toBeDefined();
  });
});
