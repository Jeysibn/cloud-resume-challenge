import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchVisitorCount, registerVisit } from "./api";

beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "https://example.test///"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([0, 42])("reads valid count %s", async count => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count })));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchVisitorCount()).resolves.toBe(count);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits", { method: "GET", signal: undefined });
});

it.each([null, {}, { count: -1 }, { count: 1.5 }, { count: "2" }])("rejects invalid count %j", async payload => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
  await expect(fetchVisitorCount()).rejects.toThrow("invalid count");
});

it("does not fetch without configuration", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(fetchVisitorCount()).rejects.toThrow("VITE_API_BASE_URL");
  expect(fetch).not.toHaveBeenCalled();
});

it("handles network and HTTP failure", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockRejectedValueOnce(new TypeError())
    .mockResolvedValueOnce(new Response(null, { status: 503 })));
  await expect(fetchVisitorCount()).rejects.toThrow("could not be reached");
  await expect(fetchVisitorCount()).rejects.toThrow("HTTP 503");
});

it("registers a visit and validates the response", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ counted: true, count: 43 })));
  vi.stubGlobal("fetch", fetch);
  await expect(registerVisit()).resolves.toEqual({ counted: true, count: 43 });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits", { method: "POST", signal: undefined });
});

it.each([null, {}, { counted: 1, count: 1 }, { counted: true, count: -1 }, { counted: false, count: 1.2 }])(
  "rejects invalid registration payload %j", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(registerVisit()).rejects.toThrow("invalid registration");
  },
);
