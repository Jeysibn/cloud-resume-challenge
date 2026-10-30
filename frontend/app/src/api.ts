import type { ChatMessage, ChatSource } from "./portfolio";

const DEFAULT_API_BASE_URL = "https://func-jeysibn-portfolio.azurewebsites.net/api";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");

export const CHAT_REQUEST_TIMEOUT_MS = 25_000;

export class ChatRequestTimeoutError extends Error {
  constructor() {
    super("The assistant request timed out. Please try again.");
    this.name = "ChatRequestTimeoutError";
  }
}

export class ChatRequestAbortedError extends Error {
  constructor() {
    super("The assistant request was cancelled.");
    this.name = "ChatRequestAbortedError";
  }
}

export function isChatRequestAborted(error: unknown): boolean {
  return error instanceof ChatRequestAbortedError ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError");
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  revision: string;
  environment: string;
}

export interface VisitorCountResponse {
  count: number;
}

export interface ChatResponse {
  reply?: string;
  error?: string;
  sources?: ChatSource[];
  usage?: {
    limit: number;
    remaining: number;
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") || "";

  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { error: text } : {};
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const payload = await requestJson<HealthResponse>(`${API_BASE_URL}/health`, { signal });

  if (payload.status !== "healthy" || !payload.service) {
    throw new Error("Health API returned an unexpected response");
  }

  return {
    ...payload,
    version: payload.version?.trim() || "live",
  };
}

export async function fetchVisitorCount(signal?: AbortSignal): Promise<number> {
  const payload = await requestJson<VisitorCountResponse>(`${API_BASE_URL}/GetVisitorCount`, { signal });

  if (!Number.isInteger(payload.count) || payload.count < 0) {
    throw new Error("Visitor API returned an invalid count");
  }

  return payload.count;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, CHAT_REQUEST_TIMEOUT_MS);
  const abortCaller = () => timeoutController.abort();
  signal?.addEventListener("abort", abortCaller, { once: true });
  if (signal?.aborted) abortCaller();

  try {
    const payload = await requestJson<ChatResponse>(`${API_BASE_URL}/AiChatAssistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenCode-Session": sessionId,
      },
      body: JSON.stringify({ message, history }),
      signal: timeoutController.signal,
    });

    if (!payload.reply?.trim()) {
      throw new Error(payload.error || "The AI assistant returned an empty response");
    }

    return {
      ...payload,
      reply: payload.reply.trim(),
      sources: Array.isArray(payload.sources)
        ? payload.sources.filter(
            (source): source is ChatSource =>
              typeof source?.id === "string" &&
              typeof source.label === "string" &&
              typeof source.url === "string" &&
              /^https:\/\//.test(source.url),
          )
        : [],
    };
  } catch (error) {
    if (timedOut) throw new ChatRequestTimeoutError();
    if (signal?.aborted) throw new ChatRequestAbortedError();
    if (error instanceof TypeError) {
      throw new Error("The assistant could not be reached. Please try again.", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortCaller);
  }
}
