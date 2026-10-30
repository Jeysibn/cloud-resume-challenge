import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  career,
  certifications,
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
import { ProjectIndex } from "../components/projects/ProjectIndex";

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
  eyebrow: string;
  number: string;
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
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function Hero() {
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <p className="hero-eyebrow">Cloud Support · DevOps · Cloud Engineering</p>
      <h1 className="hero-name" id="hero-title">
        Jerome Christian Ibon
      </h1>
      <p className="hero-statement">
        Computer Engineering graduate building cloud infrastructure, automated
        delivery pipelines, Kubernetes environments, and observable systems.
      </p>
      <div className="hero-actions">
        <a className="action-primary" href="#projects">
          View work <Arrow dir="down" />
        </a>
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
      title="Work"
      eyebrow="Projects"
      number="01"
      className="projects-section"
    >
      <p className="projects-intro">
        Selected engineering work, presented as working systems rather than isolated screenshots.
      </p>
      <ProjectIndex projects={projects} onInspect={onOpen} />
    </Section>
  );
}

export function Experience() {
  return (
    <Section id="experience" title="Experience" eyebrow="Career" number="02">
      <div className="experience-list">
        {experience.map((item) => {
          const [, title, scope] = item.role.match(/^(.*?)\s*(\(.*\))$/) ?? [null, item.role, ""];
          return (
          <article key={item.role} data-reveal>
            <aside>
              <time>{item.period}</time>
            </aside>
            <div>
              <h3>
                {title}
                {scope ? <> <span className="role-scope">{scope}</span></> : null}
              </h3>
              <p className="org">
                {item.organization} · {item.location}
              </p>
              <p>{item.summary}</p>
              <ul>
                {item.highlights.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </article>
          );
        })}
      </div>
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
        Skills grouped by domain. Select any skill to see how it is used in
        practice.
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
        <article>
          <h3>{education.degree}</h3>
          <p>
            {education.school} · {education.location}
          </p>
          <time>{education.period}</time>
          <p className="thesis">Thesis — {education.thesis}</p>
        </article>
        <ol>
          {certifications.map((certification) => (
            <li key={certification.name}>
              <div>
                {certification.name}
                <small className="credential-meta">
                  {certification.issuer ? `${certification.issuer} · ` : null}
                  <span
                    className={
                      certification.status === "in-progress"
                        ? "credential-in-progress"
                        : undefined
                    }
                  >
                    {certification.status === "in-progress"
                      ? "In progress"
                      : "Earned"}
                  </span>
                </small>
              </div>
            </li>
          ))}
        </ol>
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
      <div className="contact-block">
        <a
          href={`mailto:${profile.email}`}
          className="contact-email"
          aria-label={`Email ${profile.email}`}
        >
          {profile.email}
        </a>
        <p className="contact-availability">
          <span className="status-light online" aria-hidden="true" />
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
