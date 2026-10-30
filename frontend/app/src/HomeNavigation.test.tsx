import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./components/SiteChrome";
import {
  Contact,
  Credentials,
  Experience,
  Hero,
  Projects,
  Resume,
  Skills,
} from "./sections/PortfolioSections";

afterEach(cleanup);

describe("home navigation", () => {
  it("keeps the wordmark as a relative link to the top anchor", () => {
    render(<SiteHeader activeSection="" theme="light" onTheme={vi.fn()} />);

    const wordmark = screen.getByRole("link", { name: "Jerome Ibon, home" });
    expect(wordmark).toHaveAttribute("href", "#top");
    expect(wordmark).not.toHaveAttribute("href", "https://jeysibn.github.io/");
  });

  it("provides one top anchor on the hero", () => {
    render(<Hero />);

    expect(document.querySelectorAll("#top")).toHaveLength(1);
    expect(document.querySelector("#top")).toHaveClass("hero");
  });

  it("exposes four primary destinations plus Resume with stable anchors", () => {
    render(<SiteHeader activeSection="" theme="light" onTheme={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Work", "#projects"],
      ["Experience", "#experience"],
      ["Toolkit", "#skills"],
      ["Contact", "#contact"],
      ["Resume", "#resume"],
    ]);
  });

  it("marks Toolkit current for both the skills and credentials sections", () => {
    const { rerender } = render(
      <SiteHeader activeSection="skills" theme="light" onTheme={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Toolkit" })).toHaveAttribute("aria-current", "location");

    rerender(<SiteHeader activeSection="credentials" theme="light" onTheme={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Toolkit" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Work" })).not.toHaveAttribute("aria-current");
  });

  it("keeps every legacy section anchor present in the page", () => {
    render(
      <>
        <Projects onOpen={vi.fn()} />
        <Experience />
        <Skills onOpen={vi.fn()} />
        <Credentials />
        <Resume />
        <Contact />
      </>,
    );
    for (const id of ["projects", "experience", "skills", "credentials", "resume", "contact"]) {
      expect(document.getElementById(id), `#${id}`).not.toBeNull();
    }
    expect(document.getElementById("about")).toBeNull();
  });
});

describe("hero", () => {
  it("names the engineer and offers work, resume and profile links", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1, name: "Jerome Christian Ibon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View work/ })).toHaveAttribute("href", "#projects");
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute("href", "#resume");
    expect(screen.getByRole("link", { name: "GitHub (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://github.com/Jeysibn",
    );
    expect(screen.getByRole("link", { name: "LinkedIn (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/jeromeibon",
    );
  });

  it("keeps the API status out of the hero", () => {
    render(<Hero />);

    expect(screen.queryByText(/API (checking|online|unavailable)/)).not.toBeInTheDocument();
  });
});
