import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { career, certifications, currentLearning, experience } from "./portfolio";
import { Contact, Credentials, Experience, Projects } from "./sections/PortfolioSections";

afterEach(cleanup);

describe("Contact", () => {
  it("renders the email, availability and profile links without extra copy", () => {
    render(<Contact />);

    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /print|save/i })).not.toBeInTheDocument();
    expect(screen.getByText("Open to opportunities. Available to start immediately.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email jeysibn@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:jeysibn@gmail.com",
    );
    expect(screen.getByRole("link", { name: /Send email/ })).toHaveAttribute(
      "href",
      "mailto:jeysibn@gmail.com",
    );
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/jeromeibon",
    );
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/Jeysibn",
    );
    expect(screen.getByRole("link", { name: /Resume/ })).toHaveAttribute(
      "download",
      "Jerome-Ibon-Resume.pdf",
    );
  });

  it("copies the canonical email and announces copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<Contact />);

    await user.click(screen.getByRole("button", { name: "Copy email" }));

    expect(writeText).toHaveBeenCalledWith("jeysibn@gmail.com");
    expect(screen.getByRole("button", { name: "Email copied" })).toHaveTextContent(
      "Copied",
    );
    expect(screen.getByText("Email copied.")).toBeVisible();
  });
});

describe("Credential metadata", () => {
  it("renders canonical issuer and credential status", () => {
    render(<Credentials />);

    expect(screen.getByText("Oracle ·", { exact: false }).parentElement).toHaveTextContent(
      "Oracle · Earned",
    );
    expect(screen.getByText("HashiCorp ·", { exact: false }).parentElement).toHaveTextContent(
      "HashiCorp · In progress",
    );
  });
});

describe("Credentials layout", () => {
  it("shows each certification with its issuer logo and a distinct in-progress state", () => {
    render(<Credentials />);

    const items = Array.from(document.querySelectorAll(".cert"));
    expect(items).toHaveLength(certifications.length);
    for (const [index, certification] of certifications.entries()) {
      const item = items[index];
      expect(item).toHaveTextContent(certification.name);
      expect(item.querySelector(".cert-logo use")?.getAttribute("href")).toMatch(/skill-icons\.svg#/);
      expect(item.classList.contains("is-in-progress")).toBe(certification.status === "in-progress");
    }
  });

  it("lists what is currently being learned from the canonical content", () => {
    render(<Credentials />);

    const learning = screen.getByRole("region", { name: "Currently learning" });
    expect(within(learning).getAllByRole("listitem").map((item) => item.textContent)).toEqual(currentLearning);
  });
});

describe("Contact card", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the local time in Manila and the target roles", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    render(<Contact />);

    const card = screen.getByRole("complementary", { name: "Location and local time" });
    expect(card).toHaveTextContent("8:00 PM");
    expect(card).toHaveTextContent("PHT · UTC+8");
    for (const role of career.target_roles) expect(card).toHaveTextContent(role);
  });
});

describe("Experience timeline", () => {
  it("marks only the current role and bolds the figures in highlights", () => {
    render(<Experience />);

    const roles = document.querySelectorAll(".experience-list > li");
    expect(roles).toHaveLength(experience.length);
    expect(document.querySelectorAll(".experience-list > li.is-current")).toHaveLength(
      experience.filter((item) => /present$/i.test(item.period)).length,
    );
    expect(screen.getByText("Current")).toBeInTheDocument();
    const figures = Array.from(document.querySelectorAll(".experience-body strong"), (node) => node.textContent);
    expect(figures).toEqual(expect.arrayContaining(["80+", "640 hours"]));
    expect(screen.getByRole("heading", { level: 3, name: "DevOps Platform Engineer (technical support scope)" })).toBeInTheDocument();
  });
});

describe("Section headings", () => {
  it("keeps lifecycle stages out of content headings and removed signal markup out of the page", () => {
    render(<Projects onOpen={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Selected work" })).toBeInTheDocument();
    expect(document.querySelectorAll(".chapter-signal")).toHaveLength(0);
    expect(document.querySelectorAll("[data-signal-stage]")).toHaveLength(0);
  });
});
