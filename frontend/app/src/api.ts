/** API Gateway base URL includes any stage, but excludes /visits. Public configuration only. */
export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
}

async function requestVisits(method: "GET" | "POST", signal?: AbortSignal): Promise<Response> {
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Recorded visits unavailable: configure VITE_API_BASE_URL.");
  let response: Response;
  try {
    response = await fetch(`${base}/visits`, { method, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The visits API could not be reached.", { cause: error });
  }
  if (!response.ok) throw new Error(`Visits API returned HTTP ${response.status}.`);
  return response;
}

// Assumed contract pending confirmation from the deployed AWS Lambda: { count: number }.
export async function fetchVisitorCount(signal?: AbortSignal): Promise<number> {
  const response = await requestVisits("GET", signal);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("count" in payload) ||
      typeof payload.count !== "number" || !Number.isSafeInteger(payload.count) || payload.count < 0) {
    throw new Error("Visits API returned an invalid count.");
  }
  return payload.count;
}

/** Never retry this request automatically: a failed response may hide a successful increment. */
export async function recordVisit(signal?: AbortSignal): Promise<void> {
  await requestVisits("POST", signal);
}
