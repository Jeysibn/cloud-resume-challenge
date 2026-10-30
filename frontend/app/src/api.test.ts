import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_REQUEST_TIMEOUT_MS,
  ChatRequestAbortedError,
  ChatRequestTimeoutError,
  sendChatMessage,
} from "./api";

describe("assistant API request lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("passes the caller signal and normalizes a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ reply: " Grounded answer ", sources: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendChatMessage("Question", [], "session")).resolves.toMatchObject({
      reply: "Grounded answer",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/AiChatAssistant"),
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("turns an application timeout into a controlled timeout error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }),
      ),
    );
    const request = sendChatMessage("Question", [], "session");
    const expectation = expect(request).rejects.toBeInstanceOf(ChatRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(CHAT_REQUEST_TIMEOUT_MS);
    await expectation;
  });

  it("preserves a caller cancellation as an abort error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }),
      ),
    );
    const controller = new AbortController();
    const request = sendChatMessage("Question", [], "session", controller.signal);
    controller.abort();
    await expect(request).rejects.toBeInstanceOf(ChatRequestAbortedError);
  });

  it("rejects malformed successful payloads instead of creating an empty answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ sources: [] }),
    }));

    await expect(sendChatMessage("Question", [], "session")).rejects.toThrow(
      "The AI assistant returned an empty response",
    );
  });
});
