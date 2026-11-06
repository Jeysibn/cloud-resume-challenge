/** API Gateway base URL includes any stage, but excludes /visits. Public configuration only. */
export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
}

async function requestVisits(
  method: "GET" | "POST",
  signal?: AbortSignal,
  visitorId?: string,
): Promise<Response> {
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Recorded visits unavailable: configure VITE_API_BASE_URL.");
  let response: Response;
  try {
    response = await fetch(`${base}/visits`, {
      method,
      signal,
      cache: "no-store",
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({ visitorId }) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The visits API could not be reached.", { cause: error });
  }
  if (!response.ok) throw new Error(`Visits API returned HTTP ${response.status}.`);
  return response;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export type VisitorApiStatus = {
  count: number;
  supportsBrowserRegistration: boolean;
};

export async function fetchVisitorStatus(signal?: AbortSignal): Promise<VisitorApiStatus> {
  const response = await requestVisits("GET", signal);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("count" in payload) || !isCount(payload.count)) {
    throw new Error("Visits API returned an invalid count.");
  }
  return {
    count: payload.count,
    supportsBrowserRegistration: "registrationSupported" in payload &&
      payload.registrationSupported === true,
  };
}

export async function fetchVisitorCount(signal?: AbortSignal): Promise<number> {
  return (await fetchVisitorStatus(signal)).count;
}

export type VisitRegistration = { counted: boolean; count: number; returning: boolean };

/** The server deduplicates by opaque browser identifier and rolling inactivity window. */
export async function registerVisit(visitorId: string, signal?: AbortSignal): Promise<VisitRegistration> {
  const response = await requestVisits("POST", signal, visitorId);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null ||
      !("counted" in payload) || typeof payload.counted !== "boolean" ||
      !("count" in payload) || !isCount(payload.count) ||
      !("returning" in payload) || typeof payload.returning !== "boolean") {
    throw new Error("Visits API returned an invalid registration.");
  }
  return { counted: payload.counted, count: payload.count, returning: payload.returning };
}
