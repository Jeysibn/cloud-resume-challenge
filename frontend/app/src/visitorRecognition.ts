export const VISITOR_KEY = "jeysibn.visitor-id.v1";
export const CONSENT_KEY = "jeysibn.visitor-counting-consent.v1";
export const PREFERENCE_EVENT = "jeysibn:visitor-recognition-change";

let sessionOverride: boolean | null = null;

export function preferenceValue(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function recognitionAllowed(): boolean {
  if (sessionOverride !== null) return sessionOverride;
  try {
    const preference = window.localStorage.getItem(CONSENT_KEY);
    if (preference === "declined") return false;
    if (!window.localStorage) return false;
    return import.meta.env.VITE_VISITOR_RECOGNITION_POLICY !== "opt-in" || preference === "accepted";
  } catch {
    return false;
  }
}

export function updateRecognitionPreference(enabled: boolean): boolean {
  sessionOverride = false;
  if (!enabled) {
    try { window.localStorage.removeItem(VISITOR_KEY); } catch { /* Current-page disable still takes effect. */ }
  }
  try {
    if (enabled) {
      window.localStorage.setItem(CONSENT_KEY, "accepted");
      if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") throw new Error("Preference not saved");
    } else {
      window.localStorage.setItem(CONSENT_KEY, "declined");
      if (window.localStorage.getItem(CONSENT_KEY) !== "declined") throw new Error("Preference not saved");
    }
  } catch {
    sessionOverride = false;
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
    return false;
  }
  sessionOverride = null;
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
  return true;
}
