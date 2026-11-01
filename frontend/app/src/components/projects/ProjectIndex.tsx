import type { Project } from "../../portfolio";
import { Arrow } from "../Arrow";

/**
 * Presentation only: which canonical projects get the larger treatment. The
 * canonical `projects` array keeps all four records and slugs.
 */
const featuredSlugs = ["aws-cloud-resume-challenge", "homelab-gitops"];

function ProjectCard({
  project,
  onInspect,
}: {
  project: Project;
  onInspect: (project: Project) => void;
}) {
  const titleId = `${project.id}-card-title`;
  return (
    <li>
      <article className="project-card" aria-labelledby={titleId}>
        <p className="project-meta">
          {project.category} · {project.status}
        </p>
        <h4 id={titleId}>{project.title}</h4>
        <p className="project-summary">{project.preview.summary}</p>
        <p className="project-proof">{project.preview.primaryOutcome}</p>
        <ul className="project-tech" aria-label={`${project.title} technologies`}>
          {project.preview.technologies.map((technology) => (
            <li key={technology}>{technology}</li>
          ))}
        </ul>
        <div className="project-actions">
          <button
            className="action-primary"
            type="button"
            onClick={() => onInspect(project)}
            aria-label={`View case study: ${project.title}`}
          >
            View case study <Arrow dir="right" />
          </button>
          <a
            className="project-link"
            href={project.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${project.title} source repository (opens in a new tab)`}
          >
            Source <Arrow dir="out" />
          </a>
          {project.liveUrl ? (
            <a
              className="project-link"
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${project.title} live site (opens in a new tab)`}
            >
              Live site <Arrow dir="out" />
            </a>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function ProjectIndex({
  projects,
  onInspect,
}: {
  projects: Project[];
  onInspect: (project: Project) => void;
}) {
  const featured = featuredSlugs
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter((project): project is Project => Boolean(project));
  const building = projects.filter((project) => !featuredSlugs.includes(project.slug));

  return (
    <div className="project-index">
      <h3 className="project-group-title" data-reveal>
        Selected work
      </h3>
      <ul className="project-list project-list-featured" data-reveal>
        {featured.map((project) => (
          <ProjectCard key={project.id} project={project} onInspect={onInspect} />
        ))}
      </ul>
      <h3 className="project-group-title" data-reveal>
        Currently building
      </h3>
      <ul className="project-list project-list-building" data-reveal>
        {building.map((project) => (
          <ProjectCard key={project.id} project={project} onInspect={onInspect} />
        ))}
      </ul>
    </div>
  );
}
