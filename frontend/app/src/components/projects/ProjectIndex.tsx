import type { Project } from "../../portfolio";
import { Arrow } from "../Arrow";

/**
 * Presentation only: which canonical projects get the larger treatment. The
 * canonical `projects` array keeps all four records and slugs.
 */
const featuredSlugs = ["aws-cloud-resume-challenge", "homelab-gitops"];

function ProjectVisual({ project }: { project: Project }) {
  const flow = project.details.architectureFlows[0];
  if (!flow) return null;

  return (
    <figure className="project-visual">
      <figcaption>{flow.label}</figcaption>
      {project.slug === "aws-cloud-resume-challenge" ? (
        <div className="project-runtime">
          <p className="project-runtime-root">{flow.nodes[0]}</p>
          <div className="project-preview-branches">
            <div>
              <p>Website</p>
              <ol className="project-preview-flow" aria-label="Website delivery">
                <li>{flow.nodes[1]}</li>
              </ol>
            </div>
            <div>
              <p>Counter API</p>
              <ol className="project-preview-flow" aria-label="Visitor counter request">
                {flow.nodes.slice(2).map((node) => <li key={node}>{node}</li>)}
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <ol className="project-preview-flow">
          {flow.nodes.map((node) => <li key={node}>{node}</li>)}
        </ol>
      )}
    </figure>
  );
}

function ProjectCard({
  project,
  onInspect,
  featured = false,
}: {
  project: Project;
  onInspect: (project: Project) => void;
  featured?: boolean;
}) {
  const titleId = `${project.id}-card-title`;
  const Title = featured ? "h3" : "h4";
  return (
    <li>
      <article className={featured ? "project-card project-feature" : "project-card"} aria-labelledby={titleId}>
        <div className="project-copy">
          <p className="project-status">{project.statusLabel}</p>
          <Title id={titleId}>{project.title}</Title>
          <p className="project-summary">{project.preview.summary}</p>
          <p className="project-proof">{project.preview.primaryOutcome}</p>
          <ul className="project-tech" aria-label={`${project.title} technologies`}>
            {project.preview.technologies.slice(0, 3).map((technology) => (
              <li key={technology}>{technology}</li>
            ))}
          </ul>
          <div className="project-actions">
            <button
              className="action-primary"
              type="button"
              onClick={() => onInspect(project)}
              aria-label={`View project: ${project.title}`}
            >
              View project <Arrow dir="right" />
            </button>
            <a
              className="project-link"
              href={project.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${project.title} GitHub repository (opens in a new tab)`}
            >
              GitHub <Arrow dir="out" />
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
        </div>
        {featured && <ProjectVisual project={project} />}
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
      <ul className="project-list project-list-featured" aria-label="Featured projects">
        {featured.map((project) => (
          <ProjectCard key={project.id} project={project} onInspect={onInspect} featured />
        ))}
      </ul>
      <h3 className="project-group-title" data-reveal>
        Currently building
      </h3>
      <ul className="project-list project-list-building" aria-label="Projects in progress" data-reveal>
        {building.map((project) => (
          <ProjectCard key={project.id} project={project} onInspect={onInspect} />
        ))}
      </ul>
    </div>
  );
}
