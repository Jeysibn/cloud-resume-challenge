import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchVisitorCount, fetchVisitorStatus, registerVisit } from "./api";

beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "https://example.test///"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([0, 42])("reads valid count %s", async count => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count })));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchVisitorCount()).resolves.toBe(count);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits", {
    method: "GET", signal: undefined, cache: "no-store", headers: undefined, body: undefined,
  });
});

it("uses the new capability marker and treats an old backend as read-only", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ count: 42, registrationSupported: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ count: 42 }))));
  await expect(fetchVisitorStatus()).resolves.toEqual({
    count: 42,
    supportsBrowserRegistration: true,
  });
  await expect(fetchVisitorStatus()).resolves.toEqual({
    count: 42,
    supportsBrowserRegistration: false,
  });
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

it("registers a visit with its browser identifier and validates the response", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ counted: true, count: 43, returning: false })));
  vi.stubGlobal("fetch", fetch);
  const visitorId = "123e4567-e89b-42d3-a456-426614174000";
  await expect(registerVisit(visitorId)).resolves.toEqual({ counted: true, count: 43, returning: false });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits", {
    method: "POST", signal: undefined, cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
});

it.each([null, {}, { counted: 1, count: 1, returning: false }, { counted: true, count: -1, returning: false }, { counted: false, count: 1.2, returning: false }, { counted: true, count: 1 }])(
  "rejects invalid registration payload %j", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(registerVisit("123e4567-e89b-42d3-a456-426614174000")).rejects.toThrow("invalid registration");
  },
);
