import { useEffect, useRef, useState } from "react";
import { fetchVisitorCount, isApiConfigured, registerVisit } from "../api";

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const registration = useRef<ReturnType<typeof registerVisit> | null>(null);
  const readController = useRef<AbortController | null>(null);
  const configured = isApiConfigured();

  async function refresh() {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setLoading(true);
    setError("");
    try {
      const value = await fetchVisitorCount(controller.signal);
      if (!controller.signal.aborted) setCount(value);
    } catch {
      if (!controller.signal.aborted) setError("Recorded visits unavailable. Please retry reading the count.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (configured) {
      registration.current ??= registerVisit();
      registration.current.then(result => {
        if (active) {
          setCount(result.count);
          setLoading(false);
        }
      }).catch(async () => {
        if (!active) return;
        const controller = new AbortController();
        readController.current = controller;
        try {
          const value = await fetchVisitorCount(controller.signal);
          if (active && !controller.signal.aborted) setCount(value);
        } catch {
          if (active && !controller.signal.aborted) setError("Recorded visits unavailable. Please retry reading the count.");
        } finally {
          if (active && !controller.signal.aborted) setLoading(false);
        }
      });
    }
    return () => {
      active = false;
      readController.current?.abort();
    };
  }, [configured]);

  return (
    <div className="visitor-counter">
      <p className="visitor-count" role="status">
        Recorded visits · {!configured ? "unavailable: VITE_API_BASE_URL is not configured" : loading ? "loading" : count === null ? "unavailable" : count.toLocaleString()}
      </p>
      {error && <p role="alert">{error}</p>}
      {configured && error && <button type="button" className="visitor-button" disabled={loading} onClick={() => void refresh()}>Retry</button>}
    </div>
  );
}
