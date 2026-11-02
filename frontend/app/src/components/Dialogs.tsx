import { useEffect, useRef } from "react";
import type { Project } from "../portfolio";
import { skillDetails } from "../skill-details";
import type { SkillSelection } from "./capabilities/SkillGroups";
import { ArchitectureFlow } from "./projects/ArchitectureFlow";

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // dialog.close() fires its `close` event asynchronously. Without this flag a
  // programmatic close (for example from browser Back) could report itself as a
  // user close after a quick Forward and wipe the restored ?project= state.
  const closedByState = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-dialog-close]")?.focus();
    }
    if (!open && dialog.open) {
      closedByState.current = true;
      dialog.close();
      opener.current?.focus();
      opener.current = null;
    }
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const close = () => {
      if (closedByState.current) {
        closedByState.current = false;
        return;
      }
      onClose();
    };
    dialog.addEventListener("close", close);
    return () => dialog.removeEventListener("close", close);
  }, [onClose]);
  return ref;
}

export function ProjectDialog({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const ref = useDialog(Boolean(project), onClose);
  return (
    <dialog
      ref={ref}
      className="inspection-dialog project-dialog"
      aria-labelledby="project-dialog-title"
      aria-describedby="project-dialog-summary"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {project && (
        <>
          <div className="project-dialog-toolbar">
            <span>Project details</span>
            <button type="button" onClick={onClose} aria-label="Close project details" data-dialog-close>
              Close <span aria-hidden="true">×</span>
            </button>
          </div>
          <article>
            <header>
              <p>{project.category}</p>
              <h2 id="project-dialog-title">{project.title}</h2>
              <p className="dialog-status">{project.status}</p>
            </header>
            <section className="project-overview" aria-labelledby="project-overview-title">
              <h3 id="project-overview-title">Overview</h3>
              <p className="dialog-lead" id="project-dialog-summary">{project.preview.summary}</p>
              <p>{project.details.purpose}</p>
            </section>
            <section className="project-results" aria-labelledby="project-results-title">
              <h3 id="project-results-title">Results</h3>
              <ul>
                {project.details.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
              </ul>
            </section>
            <section className="dialog-architecture" aria-labelledby="architecture-title">
              <div className="dialog-section-heading">
                <h3 id="architecture-title">Architecture</h3>
              </div>
              <ArchitectureFlow flows={project.details.architectureFlows} />
              {project.architecture.diagrams.map((diagram) => (
                <details className="architecture-detail" key={diagram.id}>
                  <summary>{diagram.title}</summary>
                  <figure className="architecture-figure">
                    <figcaption><p>{diagram.description}</p></figcaption>
                    <div
                      className="architecture-diagram-frame"
                      tabIndex={0}
                      role="region"
                      aria-label={`${diagram.title} diagram; scroll horizontally on smaller screens`}
                    >
                      <img src={diagram.svg} alt="" aria-hidden="true" loading="lazy" />
                    </div>
                    <details className="architecture-summary">
                      <summary>Read architecture as text</summary>
                      <ul>{diagram.summary.map((item) => <li key={item}>{item}</li>)}</ul>
                    </details>
                  </figure>
                </details>
              ))}
            </section>
            <section className="project-implementation" aria-labelledby="project-implementation-title">
              <h3 id="project-implementation-title">Implementation</h3>
              <p>{project.details.summary}</p>
              <ul>{project.details.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
              <h4>Full toolkit</h4>
              <p>{project.details.technologies.join(" · ")}</p>
            </section>
            <div className="dialog-actions">
              <a className="action-primary" href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                GitHub repository ↗
              </a>
              {project.liveUrl && (
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">Open live site ↗</a>
              )}
            </div>
          </article>
        </>
      )}
    </dialog>
  );
}

export function SkillDialog({
  selection,
  onClose,
}: {
  selection: SkillSelection | null;
  onClose: () => void;
}) {
  const group = selection?.group ?? null;
  const ref = useDialog(Boolean(selection), onClose);
  const detail = group ? skillDetails[group.label] : null;
  useEffect(() => {
    if (!selection?.item) return;
    window.requestAnimationFrame(() =>
      ref.current
        ?.querySelector(".is-emphasized")
        ?.scrollIntoView({ block: "center" }),
    );
  }, [ref, selection]);
  return (
    <dialog
      ref={ref}
      className="inspection-dialog skill-dialog"
      aria-labelledby="skill-dialog-title"
      aria-describedby="skill-dialog-summary"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {group && detail && (
        <article>
          <header>
            <p>Capability inspection</p>
            <h2 id="skill-dialog-title">{group.label}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close skill details"
              data-dialog-close
            >
              Close
            </button>
          </header>
          <p className="dialog-lead" id="skill-dialog-summary">
            {detail.summary}
          </p>
          <p>{detail.practice}</p>
          <div className="skill-inspection-list">
            {group.items.map((item) => (
              <section
                key={item}
                className={
                  selection?.item === item ? "is-emphasized" : undefined
                }
                aria-current={selection?.item === item ? "true" : undefined}
              >
                <h3>{item}</h3>
                <p>{detail.itemDescriptions[item]}</p>
              </section>
            ))}
          </div>
        </article>
      )}
    </dialog>
  );
}
