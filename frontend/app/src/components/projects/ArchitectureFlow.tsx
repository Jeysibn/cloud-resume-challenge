import type { CSSProperties } from "react";
import type { Project } from "../../portfolio";

type Flow = Project["details"]["architectureFlows"][number];

/**
 * The ordered path a request or change takes through the system, taken from the
 * repository-derived `architectureFlows` in the canonical content. Steps are an
 * ordered list, so the sequence is available as text; the connectors are
 * decorative and trace in once when the case study opens (CSS only).
 */
export function ArchitectureFlow({ flows }: { flows: Flow[] }) {
  if (!flows.length) return null;
  return (
    <div className="flow-trace">
      <p className="flow-trace-note">Steps in the order a request or change moves through the system.</p>
      {flows.map((flow, flowIndex) => (
        <section key={flow.label} aria-labelledby={`flow-${flowIndex}-label`}>
          <h4 className="flow-trace-label" id={`flow-${flowIndex}-label`}>
            {flow.label}
          </h4>
          <ol className="flow-steps" style={{ "--n": flow.nodes.length } as CSSProperties}>
            {flow.nodes.map((node, index) => (
              <li key={node} style={{ "--i": index } as CSSProperties}>
                {node}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
