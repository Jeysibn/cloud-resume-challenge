import { useEffect, useRef, useState } from "react";
import { fetchVisitorCount, fetchVisitorStatus, isApiConfigured, registerVisit } from "../api";

const CONSENT_KEY = "jeysibn.visitor-counting-consent.v1";
const VISITOR_KEY = "jeysibn.visitor-id.v1";
type Consent = "accepted" | "declined" | null;

const registrations = new Map<string, ReturnType<typeof registerVisit>>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readConsent(): Consent {
  try {
    const value = storage()?.getItem(CONSENT_KEY);
    return value === "accepted" ? "accepted" : value === "declined" ? "declined" : null;
  } catch {
    return null;
  }
}

function canReadStorage(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.getItem(CONSENT_KEY);
    return true;
  } catch {
    return false;
  }
}

function visitorIdForOptedInBrowser(): string | null {
  const store = storage();
  if (!store || typeof crypto.randomUUID !== "function") return null;
  try {
    const saved = store.getItem(VISITOR_KEY);
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) {
      return saved;
    }
    const created = crypto.randomUUID();
    store.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return null;
  }
}

function registerOnce(visitorId: string) {
  let registration = registrations.get(visitorId);
  if (!registration) {
    registration = registerVisit(visitorId);
    registrations.set(visitorId, registration);
  }
  return registration;
}

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState<Consent>(readConsent);
  const [registrationUnavailable, setRegistrationUnavailable] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(
    () => !canReadStorage() || (readConsent() === "accepted" && typeof crypto.randomUUID !== "function"),
  );
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
    const controller = new AbortController();
    readController.current?.abort();
    readController.current = controller;

    const showCountFallback = async () => {
      try {
        const value = await fetchVisitorCount(controller.signal);
        if (active && !controller.signal.aborted) setCount(value);
      } catch {
        if (active && !controller.signal.aborted) setError("Recorded visits unavailable. Please retry reading the count.");
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    };

    if (configured) {
      const visitorId = consent === "accepted" ? visitorIdForOptedInBrowser() : null;
      if (consent === "accepted" && visitorId === null) {
        Promise.resolve().then(() => {
          if (active) setStorageUnavailable(true);
        });
      }

      if (visitorId) {
        fetchVisitorStatus(controller.signal).then(async status => {
          if (!active || controller.signal.aborted) return;
          setCount(status.count);
          setLoading(false);
          if (!status.supportsBrowserRegistration) {
            setRegistrationUnavailable(true);
            return;
          }

          setRegistrationUnavailable(false);
          try {
            const result = await registerOnce(visitorId);
            if (active) setCount(result.count);
          } catch {
            if (active) await showCountFallback();
          }
        }).catch(() => {
          if (active) void showCountFallback();
        });
      } else {
        void showCountFallback();
      }
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [configured, consent]);

  function chooseConsent(next: Exclude<Consent, null>) {
    const store = storage();
    if (!store) {
      setStorageUnavailable(true);
      return;
    }
    try {
      if (next === "declined") {
        store.removeItem(VISITOR_KEY);
        store.setItem(CONSENT_KEY, next);
      } else {
        if (typeof crypto.randomUUID !== "function") throw new Error("Secure UUID generation is unavailable.");
        const current = store.getItem(VISITOR_KEY);
        const visitorId = current && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current)
          ? current
          : crypto.randomUUID();
        store.setItem(VISITOR_KEY, visitorId);
        store.setItem(CONSENT_KEY, next);
      }
      setStorageUnavailable(false);
      setConsent(next);
    } catch {
      setStorageUnavailable(true);
    }
  }

  return (
    <div className="visitor-counter" aria-label="Visitor count">
      <p className="visitor-count" role="status" aria-busy={loading}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        <span>{!configured ? "Recorded visits unavailable" : loading ? "Loading recorded visits" : count === null ? "Recorded visits unavailable" : `${count.toLocaleString()} recorded visits`}</span>
      </p>
      {consent === null && <div className="visitor-consent">
        <p>Portfolio owner Jerome Ibon uses this for aggregate visit counting. Opt-in stores a random browser ID; the server keeps a pseudonymous HMAC-derived ID for 90 days after your last visit, so it is not fully anonymous. You can turn it off anytime. Privacy requests: <a href="mailto:jeysibn@gmail.com">jeysibn@gmail.com</a>.</p>
        <button type="button" className="visitor-button" onClick={() => chooseConsent("accepted")}>Allow anonymous counting</button>
        <button type="button" className="visitor-text-button" onClick={() => chooseConsent("declined")}>Keep counting off</button>
      </div>}
      {consent === "accepted" && <button type="button" className="visitor-text-button" onClick={() => chooseConsent("declined")}>Turn off visit counting</button>}
      {consent === "declined" && <button type="button" className="visitor-text-button" onClick={() => chooseConsent("accepted")}>Enable anonymous counting</button>}
      {consent === "accepted" && registrationUnavailable && <p className="visitor-message" role="status">This counter service does not support browser registration yet. The public count is available; no visit was registered.</p>}
      {storageUnavailable && <p className="visitor-message" role="status">Browser storage is unavailable. The public count can still be read, but this visit was not registered.</p>}
      {error && <p role="alert">{error}</p>}
      {configured && error && <button type="button" className="visitor-button" disabled={loading} onClick={() => void refresh()}>Retry reading count</button>}
    </div>
  );
}
