import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Contact, Credentials, Projects, Resume } from "./sections/PortfolioSections";

afterEach(cleanup);

describe("Contact handoff", () => {
  it("renders the primary email actions and engineering presence links", () => {
    render(<Contact />);

    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interested in working together?" })).toBeInTheDocument();
    expect(screen.getByText("Open to opportunities")).toBeInTheDocument();
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

describe("Resume actions", () => {
  it("keeps the PDF download while removing the print/save action", () => {
    render(<Resume />);

    expect(screen.queryByRole("button", { name: /print|save/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "download",
      "Jerome-Ibon-Resume.pdf",
    );
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

describe("Section headings", () => {
  it("keeps lifecycle stages out of content headings and removed signal markup out of the page", () => {
    render(<Projects onOpen={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Work" })).toBeInTheDocument();
    expect(document.querySelectorAll(".chapter-signal")).toHaveLength(0);
    expect(document.querySelectorAll("[data-signal-stage]")).toHaveLength(0);
  });
});
