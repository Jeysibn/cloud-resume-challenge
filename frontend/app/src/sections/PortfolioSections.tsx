import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  career,
  certifications,
  currentLearning,
  education,
  experience,
  profile,
  professionalSummary,
  projects,
} from "../portfolio";
import type { Project } from "../portfolio";
import { SkillGroups } from "../components/capabilities/SkillGroups";
import type { SkillSelection } from "../components/capabilities/SkillGroups";
import { Arrow } from "../components/Arrow";
import { isCurrent, periodLength } from "../components/experience/duration";
import { SKILL_SPRITE, issuerMarks } from "../components/capabilities/skillMarks";
import { ProjectIndex } from "../components/projects/ProjectIndex";
import { Magnet } from "../components/hero/Magnet";
import { Monogram } from "../components/hero/Monogram";
import { VisitorCounter } from "../components/VisitorCounter";

function Section({
  id,
  title,
  eyebrow,
  number,
  children,
  className = "",
}: {
  id: string;
  title: string;
  eyebrow?: string;
  number?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`section ${className}`}
      aria-labelledby={`${id}-title`}
    >
      <header className="section-heading" data-number={number} data-reveal>
        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
        <h2 id={`${id}-title`}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function Hero() {
  const actionsRef = useRef<HTMLDivElement>(null);

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <Monogram />
      <h1 className="hero-name" id="hero-title" translate="no">
        <span className="hero-name-line">Jerome</span>{" "}
        <span className="hero-name-line">Christian Ibon</span>
      </h1>
      <p className="hero-role">Cloud Support · DevOps · Cloud Engineering</p>
      <p className="hero-statement">
        Computer Engineering graduate building cloud infrastructure, automated
        delivery pipelines, Kubernetes environments, and observable systems.
      </p>
      <div className="hero-actions" ref={actionsRef}>
        <Magnet field={actionsRef}>
          <a className="action-primary" href="#projects">
            View work <Arrow dir="down" />
          </a>
        </Magnet>
        <a className="action-secondary" href="./resume.pdf" download="Jerome-Ibon-Resume.pdf">
          Resume <Arrow dir="down" />
        </a>
        <a
          className="hero-link"
          href={profile.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub (opens in a new tab)"
        >
          GitHub <Arrow dir="out" />
        </a>
        <a
          className="hero-link"
          href={profile.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn (opens in a new tab)"
        >
          LinkedIn <Arrow dir="out" />
        </a>
      </div>
      <VisitorCounter />
      <dl className="hero-facts">
        <div>
          <dt>Based in</dt>
          <dd>Malolos · Philippines</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Open to opportunities. {career.availability}</dd>
        </div>
      </dl>
    </section>
  );
}

export function Projects({ onOpen }: { onOpen: (p: Project) => void }) {
  return (
    <Section
      id="projects"
      title="Selected work"
      number="01"
      className="projects-section"
    >
      <ProjectIndex projects={projects} onInspect={onOpen} />
    </Section>
  );
}

/** Bold the figures in a highlight ("80+", "640 hours") so the evidence scans. */
function emphasiseFigures(text: string) {
  const parts = text.split(/(\b\d[\d,]*\+?(?:\s(?:hours|cases))?)/);
  return parts.map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
}

export function Experience() {
  return (
    <Section id="experience" title="Experience" eyebrow="Career" number="02">
      <ol className="experience-list">
        {experience.map((item) => {
          const [, title, scope] = item.role.match(/^(.*?)\s*\((.*)\)$/) ?? [null, item.role, ""];
          const current = isCurrent(item.period);
          const length = periodLength(item.period);
          return (
            <li key={item.role} className={current ? "is-current" : undefined}>
              <article data-reveal aria-labelledby={`role-${item.organization.replace(/\W+/g, "-")}`}>
                <aside>
                  <time>{item.period}</time>
                  <p className="experience-length">
                    {current ? <span className="experience-now">Current</span> : null}
                    {length ? <span>{length}</span> : null}
                  </p>
                </aside>
                <div className="experience-body">
                  <span className="experience-node" aria-hidden="true" />
                  <h3
                    id={`role-${item.organization.replace(/\W+/g, "-")}`}
                    // The scope shows as a tag; the label keeps the original wording.
                    aria-label={scope ? item.role : undefined}
                  >
                    {title}
                    {scope ? (
                      <>
                        {" "}
                        <span className="role-scope">{scope}</span>
                      </>
                    ) : null}
                  </h3>
                  <p className="org">
                    {item.organization} · {item.location}
                  </p>
                  <p className="experience-summary">{item.summary}</p>
                  <ul>
                    {item.highlights.map((x) => (
                      <li key={x}>{emphasiseFigures(x)}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function Skills({
  onOpen,
}: {
  onOpen: (selection: SkillSelection) => void;
}) {
  return (
    <Section id="skills" title="Toolkit" eyebrow="Skills" number="03" className="skills-section">
      <p className="skills-copy">
        Read the stack from the bottom up, from foundations to delivery; the
        side pillars run across every layer. Select any skill to see how I use it.
      </p>
      <SkillGroups onOpen={onOpen} />
    </Section>
  );
}

export function Credentials() {
  return (
    <Section
      id="credentials"
      title="Credentials"
      eyebrow="Education and certifications"
      number="04"
      className="credentials-section"
    >
      <div className="credential-layout">
        <article className="credential-education" aria-labelledby="education-title">
          <p className="credential-kicker">Education</p>
          <h3 id="education-title">{education.degree}</h3>
          <dl className="credential-facts">
            <div>
              <dt>School</dt>
              <dd>
                {education.school} · {education.location}
              </dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{education.period}</dd>
            </div>
            <div>
              <dt>Thesis</dt>
              <dd>{education.thesis}</dd>
            </div>
          </dl>
        </article>
        <div className="credential-side">
          <section aria-labelledby="certifications-title">
            <h3 className="credential-kicker" id="certifications-title">
              Certifications
            </h3>
            <ol className="cert-list">
              {certifications.map((certification) => {
                const inProgress = certification.status === "in-progress";
                const logo = certification.issuer ? issuerMarks[certification.issuer] : undefined;
                return (
                  <li key={certification.name} className={inProgress ? "cert is-in-progress" : "cert"}>
                    <span className="cert-logo" aria-hidden="true">
                      {logo ? (
                        <svg focusable="false">
                          <use href={`${SKILL_SPRITE}#${logo}`} />
                        </svg>
                      ) : null}
                    </span>
                    <div className="cert-body">
                      <p className="cert-name">{certification.name}</p>
                      <p className="credential-meta">
                        {certification.issuer ? `${certification.issuer} · ` : null}
                        <span className="cert-status">{inProgress ? "In progress" : "Earned"}</span>
                      </p>
                    </div>
                    <span className="cert-badge" aria-hidden="true" />
                  </li>
                );
              })}
            </ol>
          </section>
          {currentLearning.length > 0 && (
            <section className="credential-learning" aria-labelledby="learning-title">
              <h3 className="credential-kicker" id="learning-title">
                Currently learning
              </h3>
              <ul>
                {currentLearning.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Section>
  );
}

type CopyState = "idle" | "copying" | "copied" | "error";

function copyTextFallback(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  let copied = false;
  try {
    copied =
      typeof document.execCommand === "function" &&
      document.execCommand("copy");
  } catch {
    // The email remains visible and selectable when the legacy fallback fails.
  }
  document.body.removeChild(textArea);
  return copied;
}

const MANILA_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

/** Current time in the Philippines, refreshed each minute (no animation frames). */
function useManilaTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Align to the next minute, then tick once a minute.
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);
  return now;
}

function ContactCard() {
  const now = useManilaTime();
  return (
    <aside className="contact-card" aria-label="Location and local time">
      <dl>
        <div>
          <dt>Based in</dt>
          <dd>{profile.location}</dd>
        </div>
        <div>
          <dt>Local time</dt>
          <dd>
            <time dateTime={now.toISOString()}>{MANILA_TIME.format(now)}</time>{" "}
            <span className="contact-zone">PHT · UTC+8</span>
          </dd>
        </div>
        <div>
          <dt>Open to</dt>
          <dd>
            <ul className="contact-roles">
              {career.target_roles.map((role) => (
                <li key={role}>{role}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export function Contact() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const copyEmail = async () => {
    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = null;
    }

    setCopyState("copying");
    let copied = false;
    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(profile.email);
        copied = true;
      }
    } catch {
      // Try the local DOM fallback when Clipboard API permission is unavailable.
    }

    if (!copied) {
      copied = copyTextFallback(profile.email);
    }

    setCopyState(copied ? "copied" : "error");
    if (copied) {
      copyResetTimer.current = window.setTimeout(() => {
        setCopyState("idle");
        copyResetTimer.current = null;
      }, 2200);
    }
  };

  const copyStatus = {
    idle: "",
    copying: "Copying email.",
    copied: "Email copied.",
    error: "Copy unavailable. Select the email address to copy it manually.",
  }[copyState];

  return (
    <Section id="contact" title="Contact" eyebrow="Get in touch" number="05" className="contact-section">
      <div className="contact-layout">
      <div className="contact-block">
        <p className="contact-lead">
          Have a cloud support, DevOps or cloud engineering role in mind? I would
          like to hear about it.
        </p>
        <a
          href={`mailto:${profile.email}`}
          className="contact-email"
          aria-label={`Email ${profile.email}`}
        >
          {profile.email}
        </a>
        <p className="contact-availability">
          <span className="availability-dot" aria-hidden="true" />
          <span>Open to opportunities. {career.availability}</span>
        </p>
        <div className="contact-actions">
          <a className="action-primary" href={`mailto:${profile.email}`}>
            Send email <Arrow dir="right" />
          </a>
          <button
            className="action-secondary"
            type="button"
            onClick={copyEmail}
            disabled={copyState === "copying"}
            aria-label={copyState === "copied" ? "Email copied" : "Copy email"}
          >
            {copyState === "copied" ? (
              <>Copied <span aria-hidden="true">✓</span></>
            ) : copyState === "copying" ? (
              "Copying…"
            ) : (
              "Copy email"
            )}
          </button>
        </div>
        <p className="contact-copy-status" aria-live="polite" aria-atomic="true">
          {copyStatus}
        </p>
        <ul className="contact-links">
          <li>
            <a
              className="text-link"
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn (opens in a new tab)"
            >
              LinkedIn <Arrow dir="out" />
            </a>
          </li>
          <li>
            <a
              className="text-link"
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub (opens in a new tab)"
            >
              GitHub <Arrow dir="out" />
            </a>
          </li>
          <li>
            <a className="text-link" href="./resume.pdf" download="Jerome-Ibon-Resume.pdf">
              Resume <Arrow dir="down" />
            </a>
          </li>
        </ul>
      </div>
      <ContactCard />
      </div>
    </Section>
  );
}

export function PrintResume() {
  return (
    <article className="print-resume">
      <h1>Jerome Christian V. Ibon</h1>
      <p>Cloud Support · DevOps · Cloud Engineering</p>
      <p>
        {profile.location} · {profile.email} · {profile.linkedin}
      </p>
      <h2>Professional summary</h2>
      <p>{professionalSummary}</p>
      <h2>Experience</h2>
      {experience.map((x) => (
        <section key={x.role}>
          <h3>
            {x.role} — {x.organization}
          </h3>
          <p>
            {x.period} · {x.location}
          </p>
          <ul>
            {x.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ))}
      <h2>Projects</h2>
      {projects.map((x) => (
        <section key={x.id}>
          <h3>{x.title}</h3>
          <ul>
            {x.details.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ))}
      <h2>Education &amp; certifications</h2>
      <p>
        {education.degree}, {education.school}, {education.period}
      </p>
      <ul>
        {certifications.map((certification) => (
          <li key={certification.name}>
            {certification.name}
            {certification.status === "in-progress" ? " — in progress" : ""}
          </li>
        ))}
      </ul>
    </article>
  );
}
