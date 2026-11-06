import { useEffect, useRef, useState } from "react";
import { fetchVisitorCount, fetchVisitorStatus, isApiConfigured, registerVisit } from "../api";

const CONSENT_KEY = "jeysibn.visitor-counting-consent.v1";
const VISITOR_KEY = "jeysibn.visitor-id.v1";
const REGISTRATION_CACHE_WINDOW_MS = 86_400_000;
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Consent = "accepted" | "declined" | null;

type RegistrationEntry = {
  promise: ReturnType<typeof registerVisit>;
  startedAt: number;
  settled: boolean;
};

const registrations = new Map<string, RegistrationEntry>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readConsent(): Consent {
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(CONSENT_KEY);
    if (value === "declined") return "declined";
    if (value !== "accepted") return null;
    const visitorId = store.getItem(VISITOR_KEY);
    return visitorId ? "accepted" : null;
  } catch {
    return null;
  }
}

function canReadStorage(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.getItem(CONSENT_KEY);
    store.getItem(VISITOR_KEY);
    return true;
  } catch {
    return false;
  }
}

function visitorIdForOptedInBrowser(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    if (store.getItem(CONSENT_KEY) !== "accepted") return null;
    const saved = store.getItem(VISITOR_KEY);
    const visitorId = saved && VISITOR_ID_PATTERN.test(saved)
      ? saved
      : typeof crypto === "undefined" || typeof crypto.randomUUID !== "function"
        ? null
        : crypto.randomUUID();
    if (!visitorId) return null;
    if (visitorId !== saved) {
      store.setItem(VISITOR_KEY, visitorId);
      if (store.getItem(VISITOR_KEY) !== visitorId) return null;
    }
    store.setItem(CONSENT_KEY, "accepted");
    return store.getItem(CONSENT_KEY) === "accepted" ? visitorId : null;
  } catch {
    return null;
  }
}

function registerOnce(visitorId: string) {
  const now = Date.now();
  const existing = registrations.get(visitorId);
  if (existing && (!existing.settled || now - existing.startedAt < REGISTRATION_CACHE_WINDOW_MS)) {
    return existing.promise;
  }
  if (existing) registrations.delete(visitorId);

  const entry: RegistrationEntry = { promise: registerVisit(visitorId), startedAt: now, settled: false };
  registrations.set(visitorId, entry);
  void entry.promise.then(
    () => {
      if (registrations.get(visitorId) === entry) entry.settled = true;
    },
    () => {
      if (registrations.get(visitorId) === entry) registrations.delete(visitorId);
    },
  );
  return entry.promise;
}

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState<Consent>(readConsent);
  const consentRef = useRef(consent);
  const [registrationUnavailable, setRegistrationUnavailable] = useState(false);
  const [consentWarning, setConsentWarning] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(
    () => !canReadStorage() || (readConsent() === "accepted" && (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function")),
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
          if (!active || controller.signal.aborted || consentRef.current !== "accepted") return;
          setCount(status.count);
          setLoading(false);
          if (!status.supportsBrowserRegistration) {
            setRegistrationUnavailable(true);
            return;
          }

          setRegistrationUnavailable(false);
          if (consentRef.current !== "accepted") return;
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
    if (next === "declined") {
      consentRef.current = "declined";
      setConsent("declined");
      let consentSaved = false;
      let visitorIdRemoved = false;
      if (store) {
        try {
          store.setItem(CONSENT_KEY, "declined");
          consentSaved = store.getItem(CONSENT_KEY) === "declined";
        } catch {
          consentSaved = false;
        }
        try {
          store.removeItem(VISITOR_KEY);
          visitorIdRemoved = store.getItem(VISITOR_KEY) === null;
        } catch {
          visitorIdRemoved = false;
        }
      }
      setStorageUnavailable(!consentSaved || !visitorIdRemoved);
      setConsentWarning(
        !consentSaved
          ? "Visit counting is off for this page, but the browser could not save your choice. It may not stay off after reload. Clear this site's stored data or disable browser storage to prevent a saved acceptance from being used."
          : !visitorIdRemoved
            ? "Your choice to keep visit counting off was saved, but the browser could not remove the saved browser ID."
            : "",
      );
      return;
    }
    if (!store) {
      setStorageUnavailable(true);
      setConsentWarning("Your opt-in could not be saved. Visit counting remains off until browser storage is available.");
      return;
    }
    try {
      if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
        throw new Error("Secure UUID generation is unavailable.");
      }
      const current = store.getItem(VISITOR_KEY);
      const visitorId = current && VISITOR_ID_PATTERN.test(current) ? current : crypto.randomUUID();
      store.setItem(VISITOR_KEY, visitorId);
      store.setItem(CONSENT_KEY, next);
      if (store.getItem(VISITOR_KEY) !== visitorId || store.getItem(CONSENT_KEY) !== next) {
        throw new Error("Browser storage did not confirm the saved choice.");
      }
      setStorageUnavailable(false);
      setConsentWarning("");
      consentRef.current = next;
      setConsent(next);
    } catch {
      setStorageUnavailable(true);
      setConsentWarning("Your opt-in could not be saved. Visit counting remains off until browser storage is available.");
    }
  }

  return (
    <div className="visitor-counter" aria-label="Visitor count">
      <p className="visitor-count" role="status" aria-busy={loading}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        <span>{!configured ? "Recorded visits unavailable" : loading ? "Loading recorded visits" : count === null ? "Recorded visits unavailable" : `${count.toLocaleString()} recorded visits`}</span>
      </p>
      {consent === null && <div className="visitor-consent">
        <p>Used for aggregate visit counting. Opt-in stores a random browser ID until you turn it off or clear site data; the server retains a pseudonymous HMAC record for 90 days of inactivity. Database cleanup may be delayed. Privacy: <a href="mailto:jeysibn@gmail.com">jeysibn@gmail.com</a>.</p>
        <button type="button" className="visitor-button" onClick={() => chooseConsent("accepted")}>Allow anonymous counting</button>
        <button type="button" className="visitor-text-button" onClick={() => chooseConsent("declined")}>Keep counting off</button>
      </div>}
      {consent === "accepted" && <button type="button" className="visitor-text-button" onClick={() => chooseConsent("declined")}>Turn off visit counting</button>}
      {consent === "declined" && <button type="button" className="visitor-text-button" onClick={() => chooseConsent("accepted")}>Enable anonymous counting</button>}
      {consent === "declined" && <p className="visitor-message" role="status">Visit counting is off for this page. A request already sent before you turned it off may still complete.</p>}
      {consent === "accepted" && registrationUnavailable && <p className="visitor-message" role="status">This counter service does not support browser registration yet. The public count is available; no visit was registered.</p>}
      {storageUnavailable && <p className="visitor-message" role="status">Browser storage is unavailable. The public count remains available; registration requires a saved opt-in.</p>}
      {consentWarning && <p className="visitor-message" role="status">{consentWarning}</p>}
      {error && <p role="alert">{error}</p>}
      {configured && error && <button type="button" className="visitor-button" disabled={loading} onClick={() => void refresh()}>Retry reading count</button>}
    </div>
  );
}
