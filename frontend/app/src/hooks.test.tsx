import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollReveal } from "./hooks";

type Callback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

let callback: Callback;
const observed: Element[] = [];
const disconnect = vi.fn();

function Probe() {
  useScrollReveal();
  return (
    <>
      <h2 data-reveal>one</h2>
      <article data-reveal>two</article>
    </>
  );
}

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("scroll reveal", () => {
  beforeEach(() => {
    observed.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe = (el: Element) => observed.push(el);
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    disconnect.mockClear();
  });

  it("hides content only once observing, reveals each target once, and cleans up", () => {
    mockReducedMotion(false);
    const { unmount } = render(<Probe />);

    expect(document.documentElement).toHaveClass("reveal-on");
    expect(observed).toHaveLength(2);

    act(() => callback([{ target: observed[0], isIntersecting: true }, { target: observed[1], isIntersecting: false }]));
    expect(observed[0]).toHaveClass("is-revealed");
    expect(observed[1]).not.toHaveClass("is-revealed");

    unmount();
    expect(document.documentElement).not.toHaveClass("reveal-on");
    expect(disconnect).toHaveBeenCalled();
  });

  it("does nothing under reduced motion, so content is never hidden", () => {
    mockReducedMotion(true);
    render(<Probe />);

    expect(document.documentElement).not.toHaveClass("reveal-on");
    expect(observed).toHaveLength(0);
  });

  it("does nothing without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    mockReducedMotion(false);
    render(<Probe />);

    expect(document.documentElement).not.toHaveClass("reveal-on");
  });
});
