import { useCallback, useEffect, useState } from "react";
import { fetchVisitorStatus, isApiConfigured, registerVisit } from "../api";
import { CONSENT_KEY, PREFERENCE_EVENT, recognitionAllowed, VISITOR_KEY } from "../visitorRecognition";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const registrations = new Map<string, Promise<Awaited<ReturnType<typeof registerVisit>>>>();

function visitorId(): string | null {
  try {
    if (!recognitionAllowed()) return null;
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && UUID_V4.test(existing)) return existing;
    if (typeof crypto === "undefined" || !crypto.randomUUID) return null;
    const next = crypto.randomUUID();
    if (!UUID_V4.test(next)) return null;
    window.localStorage.setItem(VISITOR_KEY, next);
    return window.localStorage.getItem(VISITOR_KEY) === next ? next : null;
  } catch {
    return null;
  }
}

function registerOnce(id: string, signal?: AbortSignal) {
  const pending = registrations.get(id);
  if (pending) return pending;
  const request = registerVisit(id, signal);
  registrations.set(id, request);
  void request.finally(() => {
    if (registrations.get(id) === request) registrations.delete(id);
  }).catch(() => {});
  return request;
}

export function VisitorCounter() {
  const configured = isApiConfigured();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState(false);
  const [preferenceRevision, setPreferenceRevision] = useState(0);

  const loadCount = useCallback(async (signal?: AbortSignal, register = true) => {
    try {
      const status = await fetchVisitorStatus(signal);
      if (signal?.aborted) return;
      setCount(status.count);
      if (register && status.supportsBrowserRegistration) {
        const id = visitorId();
        if (id) {
          try {
            const result = await registerOnce(id, signal);
            if (!signal?.aborted) setCount(result.count);
          } catch {
            // Keep the successfully fetched total visible if registration fails.
          }
        }
      }
    } catch {
      if (!signal?.aborted) setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPreferenceChange = () => setPreferenceRevision(revision => revision + 1);
    window.addEventListener(PREFERENCE_EVENT, onPreferenceChange);
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === VISITOR_KEY || event.key === null) onPreferenceChange();
    };
    window.addEventListener("storage", onStorageChange);
    const controller = configured ? new AbortController() : null;
    if (controller) void Promise.resolve().then(() => loadCount(controller.signal));
    return () => {
      controller?.abort();
      window.removeEventListener(PREFERENCE_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [configured, loadCount, preferenceRevision]);

  function retryCount() {
    setLoading(true);
    setError(false);
    void loadCount(undefined, false);
  }

  return (
    <div className="visitor-counter" aria-label="Visitor count">
      <p className="visitor-count" role="status" aria-busy={loading}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        <span>{!configured || error && count === null ? "Recorded visits unavailable" : loading && count === null ? "Loading recorded visits" : count === null ? "Recorded visits unavailable" : `${count.toLocaleString()} recorded visits`}</span>
      </p>
      {error && <div className="visitor-message" role="alert">The visitor count could not be loaded. <button type="button" className="visitor-text-button" onClick={retryCount}>Retry</button></div>}
    </div>
  );
}
