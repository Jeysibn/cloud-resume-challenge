import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { fetchVisitorCount, isChatRequestAborted, sendChatMessage } from "../api";
import type { ChatMessage } from "../portfolio";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { projectNavigationUrl, resolveAssistantLink, type AssistantLink } from "./assistantLinks";

const KEY = "jeysibn_chat_history";
const SESSION_KEY = "jeysibn_chat_session";
const STARTER_QUESTIONS = [
  "Which projects best demonstrate Jerome's skills?",
  "Is Jerome a good fit for a junior DevOps role?",
  "How does Jerome use Terraform and Kubernetes?",
  "Tell me about MoniKey.",
  "Tell me about the NOC Report Builder.",
];
type UiMessage = ChatMessage & { error?: boolean };

function navigateToSection(event: MouseEvent<HTMLAnchorElement>, target: string) {
  const section = document.getElementById(target);
  if (!section) return;

  event.preventDefault();
  // The section's scroll margin accounts for the fixed header. Native anchors
  // remain the semantic control; this handler only makes the scroll and hash
  // update deterministic when activated from the fixed assistant panel.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  section.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  window.history.pushState({}, "", `#${target}`);
}

function navigateToProject(event: MouseEvent<HTMLAnchorElement>, projectSlug: string) {
  event.preventDefault();
  window.history.pushState(
    { project: projectSlug },
    "",
    projectNavigationUrl(projectSlug),
  );
  // App already owns the project query-parameter state. Dispatching the same
  // browser event used for back/forward keeps the assistant on that path
  // instead of creating a second project-selection state machine.
  window.dispatchEvent(new PopStateEvent("popstate"));

  const projectsSection = document.getElementById("projects");
  if (!projectsSection) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  projectsSection.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function AssistantSources({ sources }: { sources: ChatMessage["sources"] }) {
  const links = (sources ?? [])
    .map((source) => resolveAssistantLink(source))
    .filter((link): link is AssistantLink => link !== null);
  const projectLinks = links.filter((link): link is Extract<AssistantLink, { type: "project" }> => link.type === "project");
  const otherLinks = links.filter((link) => link.type !== "project");

  if (!links.length) return null;

  return (
    <nav className="message-sources" aria-label="Related portfolio links">
      {projectLinks.length ? (
        <div className="message-source-group">
          <span className="message-sources-label">Related projects</span>
          <ul className="message-project-list">
            {projectLinks.map((link) => (
              <li key={`${link.type}-${link.projectSlug}`}>
                <a
                  href={projectNavigationUrl(link.projectSlug)}
                  onClick={(event) => navigateToProject(event, link.projectSlug)}
                >
                  {link.label}
                </a>
                <a
                  className="message-repository-link"
                  href={link.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${link.label} repository on GitHub`}
                >
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {otherLinks.length ? (
        <div className="message-source-group">
          <span className="message-sources-label">Related</span>
          <ul>
            {otherLinks.map((link) =>
              link.type === "section" ? (
                // Native hash links preserve keyboard activation, browser history,
                // visible focus, and the site's existing smooth-scroll behavior.
                <li key={`${link.type}-${link.target}`}>
                  <a href={`#${link.target}`} onClick={(event) => navigateToSection(event, link.target)}>
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={`${link.type}-${link.url}`}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

function loadChatSessionId(): string {
  const valid = (value: string | null): value is string =>
    Boolean(value && /^[A-Za-z0-9._:-]{1,128}$/.test(value));

  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (valid(existing)) return existing;

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function load(): UiMessage[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(value)
      ? value.filter(
          (x): x is UiMessage =>
            typeof x === "object" &&
            x !== null &&
            "role" in x &&
            "content" in x &&
            ((x as { role?: unknown }).role === "user" ||
              (x as { role?: unknown }).role === "assistant") &&
            typeof (x as { content?: unknown }).content === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchVisitorCount(controller.signal)
      .then(setCount)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <p className="visitor-count" aria-live="polite">
      Visitors · {failed ? "unavailable" : count === null ? "checking" : count.toLocaleString()}
    </p>
  );
}

export function PortfolioAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>(load);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const requestController = useRef<AbortController | null>(null);
  const chatSessionId = useRef(loadChatSessionId());
  const wasOpen = useRef(false);

  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(messages.filter((message) => !message.error)));
    } catch {
      // Chat history is a convenience; the assistant remains usable when storage is blocked.
    }
    if (typeof end.current?.scrollIntoView === "function") {
      end.current.scrollIntoView({ block: "nearest" });
    }
  }, [messages, sending]);

  useEffect(() => {
    if (open) {
      input.current?.focus();
    } else if (wasOpen.current) {
      trigger.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  function clearConversation() {
    setMessages([]);
    setValue("");
    setRemaining(null);
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
    chatSessionId.current = loadChatSessionId();
    input.current?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || sending) return;
    const user: ChatMessage = { role: "user", content: text };
    const previousHistory = messages.filter((message) => !message.error);
    const nextMessages = [...previousHistory, user];
    setMessages(nextMessages);
    setValue("");
    setSending(true);
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const result = await sendChatMessage(
        text,
        previousHistory.slice(-8),
        chatSessionId.current,
        controller.signal,
      );
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: result.reply || "The assistant returned an empty response.",
          sources: result.sources,
        },
      ]);
      if (result.usage) setRemaining(result.usage.remaining);
    } catch (err) {
      if (isChatRequestAborted(err)) {
        setMessages(nextMessages);
        setValue(text);
        return;
      }
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "The assistant is temporarily unavailable.",
          error: true,
        },
      ]);
    } finally {
      if (requestController.current === controller) requestController.current = null;
      setSending(false);
    }
  }

  function cancelRequest() {
    requestController.current?.abort();
  }

  return (
    <aside
      className={open ? "portfolio-assistant is-open" : "portfolio-assistant"}
      aria-label="Ask this portfolio"
    >
      <button
        ref={trigger}
        className="portfolio-assistant-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="portfolio-assistant-panel"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span aria-hidden="true">?</span> Ask this portfolio
      </button>
      <div
        id="portfolio-assistant-panel"
        className="portfolio-assistant-panel"
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <header>
          <div>
            <small>Portfolio guide</small>
            <h2>Ask this portfolio</h2>
            <p className="assistant-subtitle">A concise guide to Jerome's documented work.</p>
          </div>
          <div className="assistant-actions">
            {messages.length > 0 && (
              <button type="button" onClick={clearConversation} aria-label="Clear conversation">
                Clear
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
              Close
            </button>
          </div>
        </header>
        <div
          className="messages"
          role="log"
          aria-live="polite"
          aria-busy={sending}
          aria-label="Assistant conversation"
        >
          {messages.length === 0 && (
            <div className="assistant-empty">
              <p>Ask about Jerome's projects, experience, skills, or fit for an entry-level role.</p>
              <div className="assistant-suggestions" aria-label="Suggested questions">
                {STARTER_QUESTIONS.map((question) => (
                  <button key={question} type="button" onClick={() => { setValue(question); input.current?.focus(); }}>
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`message ${message.role} ${message.error ? "error" : ""}`}
            >
              <strong className="message-label">
                {message.role === "user" ? "You" : "Portfolio guide"}
              </strong>
              <AssistantMessageContent content={message.content} />
              {message.role === "assistant" && !message.error ? (
                <AssistantSources sources={message.sources} />
              ) : null}
            </div>
          ))}
          {sending && <p className="assistant-loading" role="status">Preparing a grounded answer…</p>}
          <div ref={end} />
        </div>
        <form onSubmit={submit}>
          <label htmlFor="assistant-input">Your question</label>
          <div>
            <input
              ref={input}
              id="assistant-input"
              name="portfolio-question"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={2000}
              autoComplete="off"
              aria-describedby="assistant-usage"
            />
            {sending ? (
              <button type="button" onClick={cancelRequest}>
                Cancel
              </button>
            ) : (
              <button type="submit" disabled={!value.trim()}>
                Send
              </button>
            )}
          </div>
          <p id="assistant-usage" className="assistant-usage">
            10 assistant questions per hour{remaining === null ? "" : ` · ${remaining} remaining`}
          </p>
        </form>
      </div>
    </aside>
  );
}
