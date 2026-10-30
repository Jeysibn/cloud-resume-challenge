import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchVisitorCount, recordVisit } from "./api";
beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "https://example.test///"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each([0, 42])("reads valid count %s", async count => {
 const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count }))); vi.stubGlobal("fetch", fetch);
 await expect(fetchVisitorCount()).resolves.toBe(count);
 expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits", {method:"GET", signal:undefined});
});
it.each([null, {}, {count:-1}, {count:1.5}, {count:"2"}])("rejects invalid %j", async payload => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
 await expect(fetchVisitorCount()).rejects.toThrow("invalid count");
});
it("does not fetch without configuration", async () => {
 vi.stubEnv("VITE_API_BASE_URL", ""); const fetch=vi.fn(); vi.stubGlobal("fetch", fetch);
 await expect(fetchVisitorCount()).rejects.toThrow("VITE_API_BASE_URL"); expect(fetch).not.toHaveBeenCalled();
});
it("handles network and HTTP failure", async () => {
 vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError()).mockResolvedValueOnce(new Response(null,{status:503})));
 await expect(fetchVisitorCount()).rejects.toThrow("could not be reached"); await expect(fetchVisitorCount()).rejects.toThrow("HTTP 503");
});
it("POST does not require a response shape", async () => {
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:204})); vi.stubGlobal("fetch",fetch); await recordVisit();
 expect(fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/visits",{method:"POST",signal:undefined});
});
