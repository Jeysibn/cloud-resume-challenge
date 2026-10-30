import { useEffect, useRef, useState } from "react";
import { fetchVisitorCount, isApiConfigured, recordVisit } from "../api";

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const readController = useRef<AbortController | null>(null);
  const postController = useRef<AbortController | null>(null);
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
    const controller = new AbortController();
    readController.current = controller;
    if (configured) {
      fetchVisitorCount(controller.signal).then(value => {
        if (!controller.signal.aborted) { setCount(value); setLoading(false); }
      }).catch(() => {
        if (!controller.signal.aborted) {
          setError("Recorded visits unavailable. Please retry reading the count.");
          setLoading(false);
        }
      });
    }
    return () => {
      readController.current?.abort();
      postController.current?.abort();
    };
  }, [configured]);

  async function record() {
    if (locked.current || !configured) return;
    locked.current = true;
    setAttempted(true);
    setRecording(true);
    readController.current?.abort();
    setLoading(false);
    const controller = new AbortController();
    postController.current = controller;
    try {
      await recordVisit(controller.signal);
      if (controller.signal.aborted) return;
      setMessage("Your visit was recorded.");
      await refresh();
    } catch {
      if (!controller.signal.aborted) setMessage("Recording could not be confirmed. Your visit may already have been recorded. No further recording is allowed on this page; Retry only reads the count.");
    } finally {
      if (!controller.signal.aborted) setRecording(false);
    }
  }

  return (
    <div className="visitor-counter">
      <p className="visitor-count" role="status">
        Recorded visits · {!configured ? "unavailable: VITE_API_BASE_URL is not configured" : loading ? "loading" : count === null ? "unavailable" : count.toLocaleString()}
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {configured && (error || (attempted && !recording)) && <button type="button" className="visitor-button" disabled={loading || recording} onClick={() => void refresh()}>Retry</button>}
      <button type="button" className="visitor-button" disabled={!configured || attempted} onClick={() => void record()}>
        {recording ? "Recording…" : "Record My Visit"}
      </button>
    </div>
  );
}
