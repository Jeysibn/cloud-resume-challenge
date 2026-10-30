import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLegacyHash, useLegacyHashRedirect } from "./legacyHash";

function Probe() {
  useLegacyHashRedirect();
  return <section id="top">top</section>;
}

describe("legacy hash redirect", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("maps removed anchors to the section that now holds the content", () => {
    expect(resolveLegacyHash("#about")).toBe("top");
    expect(resolveLegacyHash("#resume")).toBe("contact");
    expect(resolveLegacyHash("#credentials-title")).toBe("credentials");
    expect(resolveLegacyHash("#projects")).toBeNull();
    expect(resolveLegacyHash("#%E0%A4%A")).toBeNull();
  });

  it("rewrites a legacy hash on load and scrolls to its replacement", () => {
    window.history.replaceState(null, "", "/#about");
    render(<Probe />);

    expect(window.location.hash).toBe("#top");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("leaves current anchors untouched", () => {
    window.history.replaceState(null, "", "/#experience");
    render(<Probe />);

    expect(window.location.hash).toBe("#experience");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
