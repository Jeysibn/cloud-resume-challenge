import { useEffect, useState } from "react";
import { fetchVisitorStatus, isApiConfigured, registerVisit } from "../api";

const VISITOR_KEY = "jeysibn.visitor-id.v1";
const registrations = new Map<string, Promise<Awaited<ReturnType<typeof registerVisit>>>>();

function visitorId(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(existing)) return existing;
    if (typeof crypto === "undefined" || !crypto.randomUUID) return null;
    const next = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, next);
    return window.localStorage.getItem(VISITOR_KEY) === next ? next : null;
  } catch {
    return null;
  }
}

function registerOnce(id: string) {
  const pending = registrations.get(id);
  if (pending) return pending;
  const request = registerVisit(id);
  registrations.set(id, request);
  void request.finally(() => {
    if (registrations.get(id) === request) registrations.delete(id);
  }).catch(() => {});
  return request;
}

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isApiConfigured();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (configured) {
      void (async () => {
        try {
          const status = await fetchVisitorStatus(controller.signal);
          if (!active) return;
          setCount(status.count);
          setLoading(false);
          const id = status.supportsBrowserRegistration ? visitorId() : null;
          if (id) {
            const result = await registerOnce(id);
            if (active) setCount(result.count);
          }
        } catch {
          // A failed registration leaves the last successfully read total visible.
        } finally {
          if (active) setLoading(false);
        }
      })();
    } else setLoading(false);
    return () => { active = false; controller.abort(); };
  }, [configured]);

  return (
    <div className="visitor-counter" aria-label="Visitor count">
      <p className="visitor-count" role="status" aria-busy={loading}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        <span>{!configured || count === null && !loading ? "Recorded visits unavailable" : loading ? "Loading recorded visits" : `${count!.toLocaleString()} recorded visits`}</span>
      </p>
    </div>
  );
}
